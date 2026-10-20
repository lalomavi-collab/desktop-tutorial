-- 0065: closing a firm, last step: finish closing (the tombstone).
--
-- lalum_firm_finish_closing(firm, reason, typed firm name, dry run) ends a closure that lalum_firm_begin_closing (0063) started.
-- It changes one thing, the status SUSPENDED to CANCELED, and it only does so when nothing is left that the closure promised to handle:
--   * every matter of the firm is purged (lalum_finish_purge_matter has run, which itself waits for the retention period and the blockers);
--   * no tax connection is left (their vault secrets are revoked by hand first);
--   * no intake token is set;
--   * the closing checklist (0062) reports no blocker (client money, legal hold, pending deadline, signature in flight, tax document mid issuance).
-- The firm row, the closure record, the members and the audit chain stay: the chain refuses row deletion and the firm row is the tombstone.
-- Members' logins are reported (members_logins_not_banned), not gated, because the platform does not own Auth and one custodian may stay.
--
-- Safety, in the order of 0063: only the platform admin in a second factor session; defaults to a DRY RUN; a real run needs the firm's exact
-- name typed and a reason of at least 10 characters. CLOSURE_FINISHED goes to the chain with counts and fixed words only (the reason text goes
-- to the closure record, as in 0063). A finished closure cannot be cancelled: lalum_firm_cancel_closing only works on SUSPENDED.

alter table public.lalum_firm_closures add column if not exists finished_at timestamptz;
alter table public.lalum_firm_closures add column if not exists finished_by uuid;
alter table public.lalum_firm_closures add column if not exists finish_reason text;
do $mig$
begin
  if not exists (select 1 from pg_constraint where conrelid = 'public.lalum_firm_closures'::regclass and conname = 'lalum_firm_closures_finish_check') then
    alter table public.lalum_firm_closures add constraint lalum_firm_closures_finish_check
      check ((finished_at is null) = (finished_by is null)
         and (finished_at is null or (cancelled_at is null and length(btrim(coalesce(finish_reason, ''))) >= 10)));
  end if;
end $mig$;

create or replace function public.lalum_firm_finish_closing(p_firm uuid, p_reason text, p_confirm text, p_dry_run boolean default true) returns jsonb
language plpgsql security definer set search_path to 'public' as $$
declare
  v_admin boolean := coalesce(public.lalum_is_admin(), false) and coalesce(auth.jwt() ->> 'aal', '') = 'aal2';
  v_name text; v_status text; c public.lalum_firm_closures; v_check jsonb;
  v_unpurged integer; v_total integer; v_tax integer; v_token boolean; v_checklist integer; v_not_banned integer; v_blockers integer;
  v_manual jsonb := jsonb_build_array('member_logins');
begin
  if auth.uid() is null or not v_admin then raise exception 'FORBIDDEN'; end if;
  select firm_name, status into v_name, v_status from public.lalum_firms where id = p_firm for update;
  if v_name is null then raise exception 'NOT_FOUND'; end if;
  select * into c from public.lalum_firm_closures where firm_id = p_firm and cancelled_at is null and finished_at is null for update;
  if c.id is null or v_status <> 'SUSPENDED' then raise exception 'NO_ACTIVE_CLOSURE'; end if;
  if p_reason is null or length(btrim(p_reason)) < 10 then raise exception 'REASON_REQUIRED'; end if;
  if p_confirm is distinct from v_name then raise exception 'BAD_CONFIRM'; end if;

  v_check := public.lalum_firm_closure_checklist(p_firm);
  v_checklist := (v_check ->> 'blockers')::integer;
  select count(*) filter (where purged_at is null), count(*) into v_unpurged, v_total from public.lalum_cockpit_matters where firm_id = p_firm;
  select count(*) into v_tax from public.lalum_tax_connections where firm_id = p_firm;
  select exists (select 1 from lalum_private.firm_secrets where firm_id = p_firm and intake_token_hash is not null) into v_token;
  -- banned_until is read through to_jsonb so the function does not depend on the Auth schema's column list
  select count(*) into v_not_banned from public.lalum_firm_members m join auth.users u on u.id = m.user_id
   where coalesce((to_jsonb(u) ->> 'banned_until')::timestamptz, '-infinity') <= now();
  v_blockers := (v_unpurged > 0)::int + (v_tax > 0)::int + v_token::int + (v_checklist > 0)::int;

  if p_dry_run then
    return jsonb_build_object('dry_run', true, 'would_proceed', v_blockers = 0, 'blockers', v_blockers,
      'matters_not_purged', v_unpurged, 'matters_total', v_total, 'tax_connections_remaining', v_tax,
      'intake_token_set', v_token, 'checklist_blockers', v_checklist,
      'members_logins_not_banned', v_not_banned, 'manual_steps', v_manual);
  end if;
  if v_blockers > 0 then raise exception 'BLOCKED'; end if;

  update public.lalum_firms set status = 'CANCELED' where id = p_firm;
  update public.lalum_firm_closures set finished_at = now(), finished_by = auth.uid(), finish_reason = btrim(p_reason) where id = c.id;
  perform public.lalum_append_audit(p_firm, null, auth.uid(), 'CLOSURE_FINISHED', null,
    jsonb_build_object('matters', v_total, 'status_from', v_status, 'status_to', 'CANCELED', 'logins_not_banned', v_not_banned));
  return jsonb_build_object('dry_run', false, 'status', 'CANCELED', 'matters', v_total, 'members_logins_not_banned', v_not_banned, 'manual_steps', v_manual);
end $$;
revoke execute on function public.lalum_firm_finish_closing(uuid, text, text, boolean) from public, anon;
grant execute on function public.lalum_firm_finish_closing(uuid, text, text, boolean) to authenticated;
