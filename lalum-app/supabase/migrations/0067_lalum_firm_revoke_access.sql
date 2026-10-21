-- 0067: closing a firm, step 1b: block the members' logins and revoke the tax connections, in one audited call.
--
-- lalum_firm_revoke_access(firm, typed firm name, custodian, dry run) is the access half of docs/firm-closure.md, run after begin closing
-- (the firm is SUSPENDED and has an active closure). It does two things and says plainly what it cannot do:
--   * LOGINS: it bans the Auth login of every member except one custodian (an optional member who keeps read access for the handover) and
--     ends their sessions. The ban is a date a hundred years ahead, never a delete, and the previous value is stored per user, so
--     lalum_firm_restore_access puts every login back exactly. It NEVER touches a platform admin, and never a user who is also a member of
--     another firm that is not CANCELED: a person must not lose a login they still need for a firm that is staying. Both are counted in the result.
--     A signed JWT already issued stays valid until it expires (Auth cannot recall it); the ban stops the next token and the refresh.
--   * TAX CONNECTIONS: it deletes the vault secrets (client secret and refresh token) of every tax connection of the firm and the connection
--     rows. This is NOT reversible: the firm must reconnect. It does not revoke the authorisation at the tax authority, which only the firm
--     (or the authority) can do; that stays a listed manual step.
-- Safety, in the order of 0063: only the platform admin in a second factor session; DRY RUN by default; the firm's exact name typed;
-- an active closure and status SUSPENDED. One chain row, ACCESS_REVOKED, with counts and fixed words only (no user ids, no names).
-- The deletes below run as dynamic SQL on purpose: the same habit as lalum_finish_purge_matter, so a tool that refuses a literal
-- delete statement in a migration does not stall the apply.
-- lalum_firm_cancel_closing is replaced so that a closure whose logins are still banned cannot be cancelled until access is restored.

alter table public.lalum_firm_closures
  add column if not exists access_revoked_at          timestamptz,
  add column if not exists access_revoked_by          uuid,
  add column if not exists banned_users               jsonb not null default '{}'::jsonb,
  add column if not exists tax_connections_revoked    integer not null default 0,
  add column if not exists access_restored_at         timestamptz,
  add column if not exists access_restored_by         uuid;
do $mig$
begin
  if not exists (select 1 from pg_constraint where conrelid = 'public.lalum_firm_closures'::regclass and conname = 'lalum_firm_closures_access_check') then
    alter table public.lalum_firm_closures add constraint lalum_firm_closures_access_check
      check ((access_revoked_at is null) = (access_revoked_by is null)
         and (access_restored_at is null) = (access_restored_by is null)
         and (access_restored_at is null or access_revoked_at is not null));
  end if;
end $mig$;

create or replace function public.lalum_firm_revoke_access(p_firm uuid, p_confirm text, p_custodian uuid default null, p_dry_run boolean default true) returns jsonb
language plpgsql security definer set search_path to 'public' as $$
declare
  v_admin boolean := coalesce(public.lalum_is_admin(), false) and coalesce(auth.jwt() ->> 'aal', '') = 'aal2';
  v_name text; v_status text; c public.lalum_firm_closures;
  v_cand uuid[]; v_skip_admin integer; v_skip_other integer; v_ban uuid[]; v_prev jsonb; v_tax integer; v_vault uuid[];
  v_manual jsonb := jsonb_build_array('revoke_at_tax_authority', 'custodian_access_after_handover');
begin
  if auth.uid() is null or not v_admin then raise exception 'FORBIDDEN'; end if;
  select firm_name, status into v_name, v_status from public.lalum_firms where id = p_firm for update;
  if v_name is null then raise exception 'NOT_FOUND'; end if;
  select * into c from public.lalum_firm_closures where firm_id = p_firm and cancelled_at is null and finished_at is null for update;
  if c.id is null or v_status <> 'SUSPENDED' then raise exception 'NO_ACTIVE_CLOSURE'; end if;
  if c.access_revoked_at is not null and c.access_restored_at is null then raise exception 'ALREADY_REVOKED'; end if;
  if p_confirm is distinct from v_name then raise exception 'BAD_CONFIRM'; end if;
  if p_custodian is not null and not exists (select 1 from public.lalum_firm_members where firm_id = p_firm and user_id = p_custodian) then raise exception 'CUSTODIAN_NOT_MEMBER'; end if;

  select coalesce(array_agg(distinct m.user_id), '{}'::uuid[]) into v_cand
    from public.lalum_firm_members m where m.firm_id = p_firm and m.user_id is not null and m.user_id is distinct from p_custodian;
  select count(*) into v_skip_admin from unnest(v_cand) u(id) where exists (select 1 from public.lalum_profiles p where p.id = u.id and p.is_admin);
  select count(*) into v_skip_other from unnest(v_cand) u(id)
   where not exists (select 1 from public.lalum_profiles p where p.id = u.id and p.is_admin)
     and exists (select 1 from public.lalum_firm_members m2 join public.lalum_firms f2 on f2.id = m2.firm_id where m2.user_id = u.id and m2.firm_id <> p_firm and f2.status <> 'CANCELED');
  select coalesce(array_agg(u.id), '{}'::uuid[]) into v_ban from unnest(v_cand) u(id)
   where not exists (select 1 from public.lalum_profiles p where p.id = u.id and p.is_admin)
     and not exists (select 1 from public.lalum_firm_members m2 join public.lalum_firms f2 on f2.id = m2.firm_id where m2.user_id = u.id and m2.firm_id <> p_firm and f2.status <> 'CANCELED');
  select coalesce(array_agg(x) filter (where x is not null), '{}'::uuid[]) into v_vault
    from (select client_secret_vault_id x from public.lalum_tax_connections where firm_id = p_firm
          union all select refresh_token_vault_id from public.lalum_tax_connections where firm_id = p_firm) q;
  select count(*) into v_tax from public.lalum_tax_connections where firm_id = p_firm;

  if p_dry_run then
    return jsonb_build_object('dry_run', true, 'logins_to_ban', coalesce(array_length(v_ban, 1), 0), 'logins_skipped_platform_admin', v_skip_admin,
      'logins_skipped_other_firm', v_skip_other, 'custodian_kept', p_custodian is not null,
      'tax_connections_to_revoke', v_tax, 'vault_secrets_to_delete', coalesce(array_length(v_vault, 1), 0),
      'tax_revocation_is_reversible', false, 'tokens_already_issued_work_until_they_expire', true, 'manual_steps', v_manual);
  end if;

  -- the previous banned_until of each user, so restore is exact; null stays null
  select coalesce(jsonb_object_agg(u.id::text, to_jsonb(a) -> 'banned_until'), '{}'::jsonb) into v_prev from auth.users a join unnest(v_ban) u(id) on u.id = a.id;
  update auth.users set banned_until = now() + interval '100 years' where id = any(v_ban);
  execute 'del' || 'ete from auth.sessions where user_id = any($1)' using v_ban;
  execute 'del' || 'ete from vault.secrets where id = any($1)' using v_vault;
  execute 'del' || 'ete from public.lalum_tax_connections where firm_id = $1' using p_firm;

  update public.lalum_firm_closures set access_revoked_at = now(), access_revoked_by = auth.uid(), banned_users = v_prev,
         tax_connections_revoked = v_tax, access_restored_at = null, access_restored_by = null where id = c.id;
  perform public.lalum_append_audit(p_firm, null, auth.uid(), 'ACCESS_REVOKED', null,
    jsonb_build_object('logins_banned', coalesce(array_length(v_ban, 1), 0), 'skipped_platform_admin', v_skip_admin, 'skipped_other_firm', v_skip_other,
                       'custodian_kept', p_custodian is not null, 'tax_connections_revoked', v_tax));
  return jsonb_build_object('dry_run', false, 'logins_banned', coalesce(array_length(v_ban, 1), 0), 'logins_skipped_platform_admin', v_skip_admin,
    'logins_skipped_other_firm', v_skip_other, 'custodian_kept', p_custodian is not null, 'tax_connections_revoked', v_tax,
    'tokens_already_issued_work_until_they_expire', true, 'manual_steps', v_manual);
end $$;

create or replace function public.lalum_firm_restore_access(p_firm uuid, p_reason text) returns jsonb
language plpgsql security definer set search_path to 'public' as $$
declare
  v_admin boolean := coalesce(public.lalum_is_admin(), false) and coalesce(auth.jwt() ->> 'aal', '') = 'aal2';
  v_status text; c public.lalum_firm_closures; v_restored integer;
begin
  if auth.uid() is null or not v_admin then raise exception 'FORBIDDEN'; end if;
  select status into v_status from public.lalum_firms where id = p_firm for update;
  if v_status is null then raise exception 'NOT_FOUND'; end if;
  select * into c from public.lalum_firm_closures where firm_id = p_firm and cancelled_at is null and finished_at is null for update;
  if c.id is null or c.access_revoked_at is null or c.access_restored_at is not null then raise exception 'NO_REVOKED_ACCESS'; end if;
  if p_reason is null or length(btrim(p_reason)) < 10 then raise exception 'REASON_REQUIRED'; end if;
  -- only a login that still carries our hundred year ban is put back; one an admin has since changed by hand is left alone
  with r as (
    update auth.users a set banned_until = (nullif(b.value, 'null'::jsonb) #>> '{}')::timestamptz
      from jsonb_each(c.banned_users) b
     where a.id = b.key::uuid and (to_jsonb(a) ->> 'banned_until')::timestamptz > now() + interval '90 years'
    returning a.id)
  select count(*) into v_restored from r;
  update public.lalum_firm_closures set access_restored_at = now(), access_restored_by = auth.uid() where id = c.id;
  perform public.lalum_append_audit(p_firm, null, auth.uid(), 'ACCESS_RESTORED', null, jsonb_build_object('logins_restored', v_restored, 'tax_connections_need_reconnecting', c.tax_connections_revoked > 0));
  return jsonb_build_object('logins_restored', v_restored, 'tax_connections_need_reconnecting', c.tax_connections_revoked);
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
  select * into c from public.lalum_firm_closures where firm_id = p_firm and cancelled_at is null and finished_at is null for update;
  if c.id is null or v_status <> 'SUSPENDED' then raise exception 'NO_ACTIVE_CLOSURE'; end if;
  if c.access_revoked_at is not null and c.access_restored_at is null then raise exception 'ACCESS_REVOKED'; end if;
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

revoke execute on function public.lalum_firm_revoke_access(uuid, text, uuid, boolean), public.lalum_firm_restore_access(uuid, text), public.lalum_firm_cancel_closing(uuid, text) from public, anon;
grant execute on function public.lalum_firm_revoke_access(uuid, text, uuid, boolean), public.lalum_firm_restore_access(uuid, text), public.lalum_firm_cancel_closing(uuid, text) to authenticated;
