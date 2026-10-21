-- Tests for migration 0073 (BOOKKEEPER role). Order: 00_supabase_stubs, 01_live_only_stubs, 0018_lalum_firm_core_baseline, 02_matter_team_stub,
-- 04_intake_routings_stub, 0014_lalum_matter_access_by_role, 0016_lalum_member_admin, 0040, 0044, 0072, 05_fin_permissions_stub, 0073, then this file:
--   psql -v ON_ERROR_STOP=1 -f bookkeeper_role.sql      (0024 is not loaded: the stub and this file stand in for the finance tables)
-- Every assertion raises on failure; fixtures roll back. Firm A does not require MFA, so the second factor rule for the role is what is under test.
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
create table public.lalum_fin_customers (firm_id uuid, label text);
alter table public.lalum_fin_customers enable row level security;
create policy fin_read on public.lalum_fin_customers for select using (public.lalum_fin_level(firm_id) >= 1);
grant select on public.lalum_fin_customers to authenticated;

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000a1','partner@a.test'), ('00000000-0000-0000-0000-0000000000a3','admin@a.test'),
  ('00000000-0000-0000-0000-0000000000b1','books@a.test'), ('00000000-0000-0000-0000-0000000000b2','other@a.test');
insert into public.lalum_firms (id, firm_name, registration_no, primary_contact, email, phone, monthly_fee, require_mfa) values
  ('00000000-0000-0000-0000-00000000000a','A','1','c','a@a.test','p',0,false);
insert into public.lalum_firm_members (firm_id, user_id, name, email, role) values
  ('00000000-0000-0000-0000-00000000000a','00000000-0000-0000-0000-0000000000a1','p','partner@a.test','FIRM_PARTNER'),
  ('00000000-0000-0000-0000-00000000000a','00000000-0000-0000-0000-0000000000a3','a','admin@a.test','ADMIN');
insert into public.lalum_fin_customers values ('00000000-0000-0000-0000-00000000000a', 'customer 1');
insert into public.lalum_cockpit_matters (id, firm_id, title) values ('00000000-0000-0000-0000-0000000000c1','00000000-0000-0000-0000-00000000000a','Secret matter');

-- 1. Only an administrator adds her; a partner may not. The call needs an existing sign in and writes no e-mail to the chain.
select t.as_user('00000000-0000-0000-0000-0000000000a1');
do $$ begin
  begin perform public.lalum_add_bookkeeper('books@a.test', 'Ronit'); assert false, 'partner must not add';
  exception when others then assert sqlerrm = 'not allowed', 'refused with: ' || sqlerrm; end;
end $$;
select t.as_user('00000000-0000-0000-0000-0000000000a3');
do $$ declare u uuid; begin
  begin perform public.lalum_add_bookkeeper('nobody@a.test', 'Ronit'); assert false, 'unknown e-mail must fail';
  exception when others then assert sqlerrm = 'no sign in for this e-mail', 'refused with: ' || sqlerrm; end;
  begin perform public.lalum_add_bookkeeper('not an email', 'Ronit'); assert false, 'bad e-mail must fail';
  exception when others then assert sqlerrm = 'bad email', 'refused with: ' || sqlerrm; end;
  begin perform public.lalum_add_bookkeeper('books@a.test', ' '); assert false, 'name required';
  exception when others then assert sqlerrm = 'name required', 'refused with: ' || sqlerrm; end;
  u := public.lalum_add_bookkeeper(' Books@A.test ', 'Ronit');
  assert u = '00000000-0000-0000-0000-0000000000b1', 'the existing sign in is attached';
  begin perform public.lalum_add_bookkeeper('books@a.test', 'Ronit'); assert false, 'already a member';
  exception when others then assert sqlerrm = 'already a member', 'refused with: ' || sqlerrm; end;
end $$;
reset role;
do $$ begin
  assert (select role from public.lalum_firm_members where user_id = '00000000-0000-0000-0000-0000000000b1') = 'BOOKKEEPER', 'role stored';
  assert (select count(*) from public.lalum_audit_stub where action = 'MEMBER_ADDED') = 1, 'one chain entry';
  assert not exists (select 1 from public.lalum_audit_stub where action = 'MEMBER_ADDED' and detail::text like '%@%'), 'no e-mail in the chain';
end $$;

-- 2. Finance level: 0 by default, needs a second factor session, then follows the level an administrator sets.
select t.as_user('00000000-0000-0000-0000-0000000000b1', 'aal2');
do $$ begin
  assert public.lalum_fin_level('00000000-0000-0000-0000-00000000000a') = 0, 'default level 0';
  assert (select count(*) from public.lalum_fin_customers) = 0, 'no customers at level 0';
end $$;
reset role;
insert into public.lalum_fin_permissions values ('00000000-0000-0000-0000-00000000000a','00000000-0000-0000-0000-0000000000b1', 3);
select t.as_user('00000000-0000-0000-0000-0000000000b1', 'aal1');
do $$ begin
  assert public.lalum_fin_level('00000000-0000-0000-0000-00000000000a') = 0, 'level 3 but only a first factor session: nothing';
  assert (select count(*) from public.lalum_fin_customers) = 0, 'no customers without the second factor';
end $$;
select t.as_user('00000000-0000-0000-0000-0000000000b1', 'aal2');
do $$ begin
  assert public.lalum_fin_level('00000000-0000-0000-0000-00000000000a') = 3, 'level 3 with the second factor';
  assert (select count(*) from public.lalum_fin_customers) = 1, 'customers readable at level 3';
end $$;
-- A partner on the same firm without the second factor is unchanged (this firm does not require it).
select t.as_user('00000000-0000-0000-0000-0000000000a1', 'aal1');
do $$ begin assert public.lalum_fin_level('00000000-0000-0000-0000-00000000000a') = 4, 'partner level unchanged'; end $$;

-- 3. Default deny: she sees no matter even if a policy elsewhere were to open it; a restrictive policy exists on every non allowed table.
reset role;
grant select on public.lalum_cockpit_matters to authenticated;
create policy open_all on public.lalum_cockpit_matters for select using (true);
select t.as_user('00000000-0000-0000-0000-0000000000b1', 'aal2');
do $$ begin assert (select count(*) from public.lalum_cockpit_matters) = 0, 'a permissive policy does not open the legal side to her'; end $$;
select t.as_user('00000000-0000-0000-0000-0000000000a1', 'aal2');
do $$ begin assert (select count(*) from public.lalum_cockpit_matters) = 1, 'the partner still sees the matter'; end $$;
reset role;
drop policy open_all on public.lalum_cockpit_matters;
do $$ begin
  assert (select count(*) from public.lalum_bookkeeper_gaps()) = 0, 'no gaps: ' || (select string_agg(table_name, ',') from public.lalum_bookkeeper_gaps());
  create table public.lalum_future_thing (firm_id uuid);
  alter table public.lalum_future_thing enable row level security;
  assert (select count(*) from public.lalum_bookkeeper_gaps()) = 1, 'a new table with RLS shows up as a gap';
  assert public.lalum_bookkeeper_apply() = 1, 'apply covers it';
  assert (select count(*) from public.lalum_bookkeeper_gaps()) = 0, 'and the gap is closed';
  assert not public.lalum_bookkeeper_allowed('lalum_cockpit_matters') and public.lalum_bookkeeper_allowed('lalum_fin_payments'), 'allowlist';
end $$;

-- 4. She may reveal names with a reason; the role change helper accepts the role; the platform and anon surface is closed.
select t.as_user('00000000-0000-0000-0000-0000000000b1', 'aal2');
select public.lalum_reveal_client_names('INVOICE');
do $$ begin assert public.lalum_can_see_client_names(), 'bookkeeper may ask for names'; end $$;
select t.as_user('00000000-0000-0000-0000-0000000000a3', 'aal2');
select public.lalum_set_member_role('00000000-0000-0000-0000-0000000000a1', 'ATTORNEY');
select public.lalum_set_member_role('00000000-0000-0000-0000-0000000000a1', 'BOOKKEEPER');
reset role;
do $$ begin
  assert (select count(*) from public.lalum_audit_stub where action = 'CLIENT_NAMES_REVEALED') = 1, 'reveal logged';
  assert not has_function_privilege('anon', 'public.lalum_add_bookkeeper(text,text)', 'execute'), 'anon cannot add';
  assert not has_function_privilege('authenticated', 'public.lalum_bookkeeper_apply()', 'execute'), 'apply is not callable from the client';
  begin update public.lalum_firm_members set role = 'NOPE' where user_id = '00000000-0000-0000-0000-0000000000b1'; assert false, 'constraint';
  exception when check_violation then null; end;
end $$;

rollback;
select 'bookkeeper_role: all assertions passed' as result;
