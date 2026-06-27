-- 0002_harden_verification.sql
-- Close the DB-level "format auto-verify" hole. Before this, a client could
-- self-set verification_status='verified' as long as license_no matched
-- ^\d{5,6}$ — bypassing the Bar-registry check entirely.
--
-- After this migration, 'verified' (and is_admin) can be granted ONLY by:
--   - the service role (the verify-attorney Edge Function, which matches the
--     submitted name+license against bar_registry), or
--   - an existing admin.
-- A normal user may still move their own status to 'pending' (request review).

create or replace function private.guard_profile_escalation()
returns trigger
language plpgsql
security definer
set search_path to 'private','public'
as $$
begin
  -- verified escalation
  if new.verification_status = 'verified' and old.verification_status <> 'verified' then
    if auth.role() <> 'service_role' and not private.ldr_is_admin() then
      raise exception 'verified status may be granted only via Bar-registry verification (service role) or an admin';
    end if;
  end if;

  -- is_admin escalation
  if new.is_admin = true and coalesce(old.is_admin, false) = false then
    if auth.role() <> 'service_role' and not private.ldr_is_admin() then
      raise exception 'only an admin may grant admin status';
    end if;
  end if;

  return new;
end;
$$;

-- guard trigger already exists from the base schema (guard_profile_escalation);
-- this migration only replaces the function body.
