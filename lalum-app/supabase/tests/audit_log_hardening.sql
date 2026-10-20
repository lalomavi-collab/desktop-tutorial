-- Tests for migration 0060 (audit log hardening). Where public.lalum_matter_audit_log does not exist (the
-- repository's stub schema) the file prints a notice and passes; on a database that has it, every assertion
-- raises on failure, so a clean run is the pass signal. Fixtures roll back at the end.
--   psql -v ON_ERROR_STOP=1 -f 0060_lalum_audit_log_hardening.sql -f audit_log_hardening.sql
begin;
do $$
declare v text;
begin
  if to_regclass('public.lalum_matter_audit_log') is null then
    raise notice 'audit_log_hardening: table not present, skipped';
    return;
  end if;
  if has_table_privilege('service_role', 'public.lalum_matter_audit_log', 'TRUNCATE')
     or has_table_privilege('service_role', 'public.lalum_matter_audit_log', 'DELETE')
     or has_table_privilege('service_role', 'public.lalum_matter_audit_log', 'UPDATE') then
    raise exception 'service_role still holds a write privilege other than INSERT';
  end if;
  if not has_table_privilege('service_role', 'public.lalum_matter_audit_log', 'INSERT')
     or not has_table_privilege('service_role', 'public.lalum_matter_audit_log', 'SELECT') then
    raise exception 'service_role lost INSERT or SELECT';
  end if;
  if has_table_privilege('authenticated', 'public.lalum_matter_audit_log', 'TRIGGER')
     or has_table_privilege('anon', 'public.lalum_matter_audit_log', 'SELECT') then
    raise exception 'authenticated or anon holds a privilege it should not';
  end if;
  begin
    execute 'truncate public.lalum_matter_audit_log';
    raise exception 'truncate succeeded';
  exception when sqlstate '42501' then
    v := 'blocked';
  end;
  if v is distinct from 'blocked' then raise exception 'truncate was not blocked'; end if;
end $$;
rollback;
