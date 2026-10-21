-- 0063: closing a firm, step 1: begin closing, and take it back.
--
-- lalum_firm_begin_closing(firm, effective date, reason, typed firm name, dry run) is the audited start of docs/firm-closure.md.
-- It does only what can be undone exactly, and says plainly what stays manual:
--   * the firm status goes ACTIVE to SUSPENDED (the intake pipeline then refuses the firm; the cockpit stays open for the handover);
--   * the retention clock starts: handling_ended_at is set to the effective date on every unpurged matter that has none. A matter that
--     already has a date keeps it. The ids it set are stored, so the cancel function undoes exactly those and nothing else;
--   * the intake token is cleared (a partner or the platform admin can issue a new one);
--   * CLOSURE_STARTED is written to the audit chain with ids, counts and fixed words only (the reason text goes to the closure record, not the chain).
-- Not done here, listed in the result as manual steps: tax connections and their vault secrets, members' logins, the handover export.
--
-- Safety, in order: only the platform admin in a second factor session may call it (a partner asks, LALUM executes); it defaults to a DRY RUN
-- that changes nothing and reports what would happen; a real run needs the firm's exact name typed, a reason of at least 10 characters, an effective
-- date from today to one year ahead (a past date would shorten retention), and zero blockers from lalum_firm_closure_checklist.
-- Consequence to read before a real run: a matter in the bin gets a retention clock too, so it can no longer be purged until the retention period
-- after the effective date ends. The dry run counts those.
--
-- lalum_firm_cancel_closing(firm, reason) reverses it: status back, the clocks it set cleared (only where still equal to the effective date),
-- the closure record marked cancelled, CLOSURE_CANCELLED in the chain. It refuses while a purge is in progress. It cannot restore the intake token;
-- issue a new one. Both functions write nothing outside this list. Their bodies bind late, so on a database without the audit chain
-- or lalum_private.firm_secrets they are created but fail when called.

create table if not exists public.lalum_firm_closures (
  id                 uuid primary key default gen_random_uuid(),
  firm_id            uuid not null references public.lalum_firms(id) on delete restrict,
  started_at         timestamptz not null default now(),
  started_by         uuid not null,
  effective_date     date not null,
  reason             text not null check (length(btrim(reason)) >= 10),
  previous_status    text not null,
  clocked_matter_ids uuid[] not null default '{}',
  cancelled_at       timestamptz,
  cancelled_by       uuid,
  cancel_reason      text,
  check ((cancelled_at is null) = (cancelled_by is null)),
  check (cancelled_at is null or length(btrim(coalesce(cancel_reason, ''))) >= 10)
);
create unique index if not exists lalum_firm_closures_one_active on public.lalum_firm_closures (firm_id) where cancelled_at is null;

alter table public.lalum_firm_closures enable row level security;
revoke all on public.lalum_firm_closures from anon, authenticated;
drop policy if exists lalum_firm_closures_read on public.lalum_firm_closures;
create policy lalum_firm_closures_read on public.lalum_firm_closures for select
  using ((select coalesce(public.lalum_fin_can(firm_id), false)) or (select coalesce(public.lalum_is_admin(), false)));
grant select on public.lalum_firm_closures to authenticated;

create or replace function public.lalum_firm_begin_closing(p_firm uuid, p_effective date, p_reason text, p_confirm text, p_dry_run boolean default true) returns jsonb
language plpgsql security definer set search_path to 'public' as $$
declare
  v_admin boolean := coalesce(public.lalum_is_admin(), false) and coalesce(auth.jwt() ->> 'aal', '') = 'aal2';
  v_name text; v_status text; v_check jsonb; v_blockers integer; v_to_clock integer; v_bin integer; v_token boolean; v_clocked uuid[];
  v_manual jsonb := jsonb_build_array('tax_connections', 'member_logins', 'handover_export');
begin
  if auth.uid() is null or not v_admin then raise exception 'FORBIDDEN'; end if;
  select firm_name, status into v_name, v_status from public.lalum_firms where id = p_firm for update;
  if v_name is null then raise exception 'NOT_FOUND'; end if;
  if v_status <> 'ACTIVE' then raise exception 'NOT_ACTIVE'; end if;
  if p_effective is null or p_effective < current_date or p_effective > current_date + 366 then raise exception 'BAD_DATE'; end if;
  if p_reason is null or length(btrim(p_reason)) < 10 then raise exception 'REASON_REQUIRED'; end if;
  if p_confirm is distinct from v_name then raise exception 'BAD_CONFIRM'; end if;

  v_check := public.lalum_firm_closure_checklist(p_firm);
  v_blockers := (v_check ->> 'blockers')::integer;
  select count(*) into v_to_clock from public.lalum_cockpit_matters where firm_id = p_firm and purged_at is null and handling_ended_at is null;
  select count(*) into v_bin from public.lalum_cockpit_matters where firm_id = p_firm and purged_at is null and handling_ended_at is null and deleted_at is not null;
  select exists (select 1 from lalum_private.firm_secrets where firm_id = p_firm and intake_token_hash is not null) into v_token;

  if p_dry_run then
    return jsonb_build_object('dry_run', true, 'would_proceed', v_blockers = 0, 'blockers', v_blockers, 'warnings', (v_check ->> 'warnings')::integer,
      'matters_to_clock', v_to_clock, 'bin_matters_not_purgeable_until_retention_ends', v_bin,
      'intake_token_will_be_cleared', v_token, 'manual_steps', v_manual);
  end if;
  if v_blockers > 0 then raise exception 'BLOCKED'; end if;

  with c as (
    update public.lalum_cockpit_matters set handling_ended_at = p_effective
     where firm_id = p_firm and purged_at is null and handling_ended_at is null returning id)
  select coalesce(array_agg(id), '{}'::uuid[]) into v_clocked from c;
  update public.lalum_firms set status = 'SUSPENDED' where id = p_firm;
  update lalum_private.firm_secrets set intake_token_hash = null where firm_id = p_firm;
  insert into public.lalum_firm_closures (firm_id, started_by, effective_date, reason, previous_status, clocked_matter_ids)
    values (p_firm, auth.uid(), p_effective, btrim(p_reason), v_status, v_clocked);
  perform public.lalum_append_audit(p_firm, null, auth.uid(), 'CLOSURE_STARTED', null,
    jsonb_build_object('effective', p_effective, 'matters_clocked', coalesce(array_length(v_clocked, 1), 0), 'status_from', v_status, 'status_to', 'SUSPENDED', 'intake_token_cleared', v_token));
  return jsonb_build_object('dry_run', false, 'status', 'SUSPENDED', 'effective_date', p_effective, 'matters_clocked', coalesce(array_length(v_clocked, 1), 0),
    'intake_token_cleared', v_token, 'manual_steps', v_manual);
end $$;

create or replace function public.lalum_firm_cancel_closing(p_firm uuid, p_reason text) returns jsonb
language plpgsql security definer set search_path to 'public' as $$
declare
  v_admin boolean := coalesce(public.lalum_is_admin(), false) and coalesce(auth.jwt() ->> 'aal', '') = 'aal2';
  v_status text; c public.lalum_firm_closures; v_unclocked integer;
begin
  if auth.uid() is null or not v_admin then raise exception 'FORBIDDEN'; end if;
  select status into v_status from public.lalum_firms where id = p_firm for update;
  if v_status is null then raise exception 'NOT_FOUND'; end if;
  select * into c from public.lalum_firm_closures where firm_id = p_firm and cancelled_at is null for update;
  if c.id is null or v_status <> 'SUSPENDED' then raise exception 'NO_ACTIVE_CLOSURE'; end if;
  if p_reason is null or length(btrim(p_reason)) < 10 then raise exception 'REASON_REQUIRED'; end if;
  if exists (select 1 from public.lalum_cockpit_matters where firm_id = p_firm and purge_requested_at is not null and purged_at is null) then raise exception 'PURGE_IN_PROGRESS'; end if;

  with u as (
    update public.lalum_cockpit_matters set handling_ended_at = null
     where id = any(c.clocked_matter_ids) and handling_ended_at = c.effective_date and purged_at is null returning id)
  select count(*) into v_unclocked from u;
  update public.lalum_firms set status = c.previous_status where id = p_firm;
  update public.lalum_firm_closures set cancelled_at = now(), cancelled_by = auth.uid(), cancel_reason = btrim(p_reason) where id = c.id;
  perform public.lalum_append_audit(p_firm, null, auth.uid(), 'CLOSURE_CANCELLED', null,
    jsonb_build_object('matters_unclocked', v_unclocked, 'status_to', c.previous_status));
  return jsonb_build_object('status', c.previous_status, 'matters_unclocked', v_unclocked, 'intake_token', 'issue_a_new_one');
end $$;

revoke execute on function public.lalum_firm_begin_closing(uuid, date, text, text, boolean), public.lalum_firm_cancel_closing(uuid, text) from public, anon;
grant execute on function public.lalum_firm_begin_closing(uuid, date, text, text, boolean), public.lalum_firm_cancel_closing(uuid, text) to authenticated;
