-- Tests for migration 0079. Order: 00_supabase_stubs, 01_live_only_stubs, 0018_lalum_firm_core_baseline, 02_matter_team_stub, 04_intake_routings_stub,
-- 0014_lalum_matter_access_by_role, 0016_lalum_member_admin, 0040, 0044, 0072, 05_fin_permissions_stub, 0073, 0074, 0077_lalum_name_reveal_admin_only, 0079, then this file:
--   psql -v ON_ERROR_STOP=1 -f bookkeeper_password_only.sql
create schema if not exists t;
grant usage on schema t to authenticated;
create or replace function t.as_user(p_uid uuid, p_aal text default 'aal1') returns void language plpgsql as $$
begin
  execute 'reset role';
  perform set_config('request.jwt.claim.sub', coalesce(p_uid::text, ''), true);
  perform set_config('request.jwt.claims', json_build_object('aal', p_aal)::text, true);
  execute 'set local role authenticated';
end $$;
grant execute on function t.as_user(uuid, text) to authenticated;

begin;
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000a1','partner@a.test'), ('00000000-0000-0000-0000-0000000000b1','books@a.test');
-- The firm REQUIRES a second factor, as the live firm does.
insert into public.lalum_firms (id, firm_name, registration_no, primary_contact, email, phone, monthly_fee, require_mfa) values
  ('00000000-0000-0000-0000-00000000000a','A','1','c','a@a.test','p',0,true);
insert into public.lalum_firm_members (firm_id, user_id, name, email, role) values
  ('00000000-0000-0000-0000-00000000000a','00000000-0000-0000-0000-0000000000a1','p','partner@a.test','FIRM_PARTNER'),
  ('00000000-0000-0000-0000-00000000000a','00000000-0000-0000-0000-0000000000b1','b','books@a.test','BOOKKEEPER');

-- 1. The bookkeeper with a password session gets level 1 even though the firm requires MFA; a second factor session gives the same.
select t.as_user('00000000-0000-0000-0000-0000000000b1', 'aal1');
do $$ begin assert public.lalum_fin_level('00000000-0000-0000-0000-00000000000a') = 1, 'password only: level 1'; end $$;
select t.as_user('00000000-0000-0000-0000-0000000000b1', 'aal2');
do $$ begin assert public.lalum_fin_level('00000000-0000-0000-0000-00000000000a') = 1, 'with a second factor: still 1'; end $$;

-- 2. Nothing else opens for her: no name reveal, level cap, a stored 0 is kept.
select t.as_user('00000000-0000-0000-0000-0000000000b1', 'aal1');
do $$ begin assert not public.lalum_can_see_client_names(), 'no name reveal for the bookkeeper'; end $$;
reset role;
insert into public.lalum_fin_permissions values ('00000000-0000-0000-0000-00000000000a','00000000-0000-0000-0000-0000000000b1', 4);
select t.as_user('00000000-0000-0000-0000-0000000000b1', 'aal1');
do $$ begin assert public.lalum_fin_level('00000000-0000-0000-0000-00000000000a') = 1, 'stored 4 is capped at 1'; end $$;
reset role;
update public.lalum_fin_permissions set level = 0 where user_id = '00000000-0000-0000-0000-0000000000b1';
select t.as_user('00000000-0000-0000-0000-0000000000b1', 'aal1');
do $$ begin assert public.lalum_fin_level('00000000-0000-0000-0000-00000000000a') = 0, 'stored 0 stays 0'; end $$;

-- 3. Every other role is unchanged: the partner in a firm that requires MFA gets nothing without it.
select t.as_user('00000000-0000-0000-0000-0000000000a1', 'aal1');
do $$ begin assert public.lalum_fin_level('00000000-0000-0000-0000-00000000000a') = 0, 'partner without a second factor: 0'; end $$;
select t.as_user('00000000-0000-0000-0000-0000000000a1', 'aal2');
do $$ begin assert public.lalum_fin_level('00000000-0000-0000-0000-00000000000a') = 4, 'partner with a second factor: 4'; end $$;

-- 4. The default deny policies still keep her out of the legal side (restrictive, by role, whatever the session).
reset role;
do $$ begin assert (select count(*) from public.lalum_bookkeeper_gaps()) = 0, 'no gaps'; end $$;
rollback;
select 'bookkeeper_password_only: all assertions passed' as result;
