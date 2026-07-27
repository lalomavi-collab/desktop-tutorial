-- 0003_lalum_admin_guard.sql
-- Security fix: prevent client-side privilege escalation on lalum_profiles.
--
-- The self upsert/update policies in 0001 constrain only verification_status,
-- not is_admin. A logged-in client could therefore run
--   update lalum_profiles set is_admin = true where id = <own uid>
-- (verification_status stays 'unverified', so the WITH CHECK passes) and become
-- a LALUM admin, unlocking every client's files, messages, calls and billing.
--
-- The RLS predicates cannot express "this column may not change" cleanly, so we
-- enforce it with a BEFORE trigger: is_admin may only be set or changed by the
-- service role (server side, migrations, or the verify Edge Function). Normal
-- self upserts, where is_admin stays false and unchanged, pass untouched.

create or replace function public.lalum_guard_profile_admin()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    if coalesce(new.is_admin, false) and coalesce(auth.role(), '') <> 'service_role' then
      raise exception 'is_admin may only be set by the service role';
    end if;
  else -- UPDATE
    if coalesce(new.is_admin, false) is distinct from coalesce(old.is_admin, false)
       and coalesce(auth.role(), '') <> 'service_role' then
      raise exception 'is_admin may only be changed by the service role';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists lalum_guard_profile_admin on public.lalum_profiles;
create trigger lalum_guard_profile_admin
  before insert or update on public.lalum_profiles
  for each row execute function public.lalum_guard_profile_admin();

-- Make the DB flag authoritative for the founder so admin authority no longer
-- depends solely on the hardcoded-email fallback. Runs as service role here.
update public.lalum_profiles p
   set is_admin = true
  from auth.users u
 where u.id = p.id
   and lower(u.email) = 'avraham@lalum.co';
