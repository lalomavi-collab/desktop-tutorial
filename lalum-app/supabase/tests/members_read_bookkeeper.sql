-- Tests for migration 0074. Order: 00_supabase_stubs, 01_live_only_stubs, 0018_lalum_firm_core_baseline, 02_matter_team_stub, 04_intake_routings_stub,
-- 0014_lalum_matter_access_by_role, 0016_lalum_member_admin, 0040, 0044, 0072, 05_fin_permissions_stub, 0073, 0074, then this file:
--   psql -v ON_ERROR_STOP=1 -f members_read_bookkeeper.sql
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
grant select on public.lalum_firm_members to authenticated;
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000a1','partner@a.test'), ('00000000-0000-0000-0000-0000000000b1','books@a.test'),
  ('00000000-0000-0000-0000-0000000000c1','partner@c.test');
insert into public.lalum_firms (id, firm_name, registration_no, primary_contact, email, phone, monthly_fee, require_mfa) values
  ('00000000-0000-0000-0000-00000000000a','A','1','c','a@a.test','p',0,false),
  ('00000000-0000-0000-0000-00000000000c','C','2','c','c@c.test','p',0,false);
insert into public.lalum_firm_members (firm_id, user_id, name, email, role) values
  ('00000000-0000-0000-0000-00000000000a','00000000-0000-0000-0000-0000000000a1','p','partner@a.test','FIRM_PARTNER'),
  ('00000000-0000-0000-0000-00000000000a','00000000-0000-0000-0000-0000000000b1','b','books@a.test','BOOKKEEPER'),
  ('00000000-0000-0000-0000-00000000000c','00000000-0000-0000-0000-0000000000c1','p2','partner@c.test','FIRM_PARTNER');

-- The bookkeeper sees only her own row, and cannot read the partner's e-mail even when she asks for it directly.
select t.as_user('00000000-0000-0000-0000-0000000000b1', 'aal2');
do $$ begin
  assert (select count(*) from public.lalum_firm_members) = 1, 'own row only';
  assert (select role from public.lalum_firm_members) = 'BOOKKEEPER', 'and it is hers';
  assert (select count(*) from public.lalum_firm_members where user_id = '00000000-0000-0000-0000-0000000000a1') = 0, 'the partner row is not readable';
  assert (select count(*) from public.lalum_firm_members where email = 'partner@a.test') = 0, 'filtering by e-mail finds nothing';
end $$;

-- Unchanged for the others: a partner reads her firm's roster and not another firm's.
select t.as_user('00000000-0000-0000-0000-0000000000a1', 'aal2');
do $$ begin
  assert (select count(*) from public.lalum_firm_members) = 2, 'partner sees the two members of firm A';
  assert (select count(*) from public.lalum_firm_members where firm_id = '00000000-0000-0000-0000-00000000000c') = 0, 'and none of firm C';
end $$;
reset role;
rollback;
select 'members_read_bookkeeper: all assertions passed' as result;
