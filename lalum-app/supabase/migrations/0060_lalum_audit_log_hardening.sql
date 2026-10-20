-- 0060: the audit log cannot be emptied or altered by the roles the app uses.
--
-- Found in the live project on 2026-10-20 (SEC-16 evidence): service_role holds TRUNCATE, DELETE, UPDATE,
-- TRIGGER and REFERENCES on public.lalum_matter_audit_log, and authenticated holds TRIGGER and REFERENCES.
-- Row UPDATE and DELETE are already stopped by the row trigger lalum_audit_no_update. TRUNCATE is not a row
-- operation, so nothing stopped it, and the hash chain detects a changed row but not a missing table.
--
-- This migration:
--   1. revokes from service_role everything except INSERT and SELECT, and revokes TRIGGER and REFERENCES
--      from authenticated (SELECT stays, it is what the policies use);
--   2. adds a BEFORE TRUNCATE statement trigger that raises, so an accidental TRUNCATE by the table owner
--      fails too. It is a guard against a mistake, not against someone with ownership, who can drop the
--      trigger; that case is what the chain verification and the weekly audit are for.
--
-- The table is created outside this repository's migrations (live only), so every step is guarded and the
-- file is a no-op where the table does not exist. Idempotent. Apply after the demo of 22.10.2026, not before.

do $$
begin
  if to_regclass('public.lalum_matter_audit_log') is null then
    raise notice '0060: public.lalum_matter_audit_log not present, nothing to harden';
    return;
  end if;

  revoke truncate, delete, update, trigger, references on public.lalum_matter_audit_log from service_role;
  revoke trigger, references on public.lalum_matter_audit_log from authenticated;
  revoke all on public.lalum_matter_audit_log from anon, public;

  create or replace function public.lalum_audit_no_truncate() returns trigger
  language plpgsql
  set search_path = pg_catalog, public
  as $f$
  begin
    raise exception 'the audit log cannot be truncated' using errcode = '42501';
  end
  $f$;
  revoke all on function public.lalum_audit_no_truncate() from public, anon, authenticated;

  if not exists (
    select 1 from pg_trigger
    where tgrelid = 'public.lalum_matter_audit_log'::regclass and tgname = 'lalum_audit_no_truncate'
  ) then
    create trigger lalum_audit_no_truncate
      before truncate on public.lalum_matter_audit_log
      for each statement execute function public.lalum_audit_no_truncate();
  end if;
end $$;
