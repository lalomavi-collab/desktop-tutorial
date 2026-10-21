-- Tests for migration 0077. Order: 00_supabase_stubs, 01_live_only_stubs, 0018_lalum_firm_core_baseline, 02_matter_team_stub, 04_intake_routings_stub,
-- 0014_lalum_matter_access_by_role, 0016_lalum_member_admin, 0040, 0044, 0072, 05_fin_permissions_stub, 0073, 0074, 0077, then this file:
--   psql -v ON_ERROR_STOP=1 -f name_reveal_admin_only.sql
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
  ('00000000-0000-0000-0000-0000000000a1','partner@a.test'), ('00000000-0000-0000-0000-0000000000a2','attorney@a.test'),
  ('00000000-0000-0000-0000-0000000000a3','admin@a.test'), ('00000000-0000-0000-0000-0000000000a4','compliance@a.test'),
  ('00000000-0000-0000-0000-0000000000b1','books@a.test'), ('00000000-0000-0000-0000-0000000000c1','partner@c.test');
insert into public.lalum_firms (id, firm_name, registration_no, primary_contact, email, phone, monthly_fee, require_mfa) values
  ('00000000-0000-0000-0000-00000000000a','A','1','c','a@a.test','p',0,false),
  ('00000000-0000-0000-0000-00000000000c','C','2','c','c@c.test','p',0,true);
insert into public.lalum_firm_members (firm_id, user_id, name, email, role) values
  ('00000000-0000-0000-0000-00000000000a','00000000-0000-0000-0000-0000000000a1','p','partner@a.test','FIRM_PARTNER'),
  ('00000000-0000-0000-0000-00000000000a','00000000-0000-0000-0000-0000000000a2','at','attorney@a.test','ATTORNEY'),
  ('00000000-0000-0000-0000-00000000000a','00000000-0000-0000-0000-0000000000a3','ad','admin@a.test','ADMIN'),
  ('00000000-0000-0000-0000-00000000000a','00000000-0000-0000-0000-0000000000a4','co','compliance@a.test','COMPLIANCE_OFFICER'),
  ('00000000-0000-0000-0000-00000000000a','00000000-0000-0000-0000-0000000000b1','b','books@a.test','BOOKKEEPER'),
  ('00000000-0000-0000-0000-00000000000c','00000000-0000-0000-0000-0000000000c1','p2','partner@c.test','ADMIN');

-- 1. Without a grant only the administrator may reveal.
do $$ declare r record; begin
  for r in select * from (values ('00000000-0000-0000-0000-0000000000a1','partner',false), ('00000000-0000-0000-0000-0000000000a2','attorney',false),
                                 ('00000000-0000-0000-0000-0000000000a3','admin',true), ('00000000-0000-0000-0000-0000000000a4','compliance',false),
                                 ('00000000-0000-0000-0000-0000000000b1','bookkeeper',false)) v(uid, who, expect) loop
    perform t.as_user(r.uid::uuid, 'aal2');
    assert public.lalum_can_see_client_names() = r.expect, r.who || ' without a grant: expected ' || r.expect;
  end loop;
  perform t.as_user(null);
end $$;

-- 2. A partner cannot grant herself or anyone; an administrator grants a partner and an attorney, not a bookkeeper or the compliance officer.
select t.as_user('00000000-0000-0000-0000-0000000000a1', 'aal2');
do $$ begin
  begin perform public.lalum_set_name_reveal('00000000-0000-0000-0000-0000000000a1', true); assert false, 'partner must not self grant';
  exception when others then assert sqlerrm = 'not allowed', 'refused with: ' || sqlerrm; end;
end $$;
select t.as_user('00000000-0000-0000-0000-0000000000b1', 'aal2');
do $$ begin
  begin perform public.lalum_set_name_reveal('00000000-0000-0000-0000-0000000000a2', true); assert false, 'bookkeeper must not grant';
  exception when others then assert sqlerrm = 'not allowed', 'refused with: ' || sqlerrm; end;
end $$;
select t.as_user('00000000-0000-0000-0000-0000000000a3', 'aal2');
select public.lalum_set_name_reveal('00000000-0000-0000-0000-0000000000a1', true);
select public.lalum_set_name_reveal('00000000-0000-0000-0000-0000000000a2', true);
do $$ begin
  begin perform public.lalum_set_name_reveal('00000000-0000-0000-0000-0000000000b1', true); assert false, 'bookkeeper cannot be granted';
  exception when others then assert sqlerrm = 'role cannot be granted', 'refused with: ' || sqlerrm; end;
  begin perform public.lalum_set_name_reveal('00000000-0000-0000-0000-0000000000a4', true); assert false, 'compliance officer cannot be granted';
  exception when others then assert sqlerrm = 'role cannot be granted', 'refused with: ' || sqlerrm; end;
  begin perform public.lalum_set_name_reveal('00000000-0000-0000-0000-0000000000c1', true); assert false, 'another firm cannot be granted';
  exception when others then assert sqlerrm = 'not a firm member', 'refused with: ' || sqlerrm; end;
end $$;

-- 3. With the grant they may reveal (with the reason of 0072); the audit has the grant entries and no e-mail.
select t.as_user('00000000-0000-0000-0000-0000000000a1', 'aal2');
do $$ begin assert public.lalum_can_see_client_names(), 'granted partner may'; end $$;
select public.lalum_reveal_client_names('INVOICE');
reset role;
do $$ begin
  assert (select count(*) from public.lalum_audit_stub where action = 'NAME_REVEAL_GRANT_SET') = 2, 'two grants in the chain';
  assert not exists (select 1 from public.lalum_audit_stub where action = 'NAME_REVEAL_GRANT_SET' and detail::text like '%@%'), 'no e-mail in the chain';
  assert (select count(*) from public.lalum_audit_stub where action = 'CLIENT_NAMES_REVEALED') = 1, 'the reveal is logged';
end $$;

-- 4. Taking the grant away, or changing the role, ends it. A partner reads only her own grant row; the administrator reads the firm's.
select t.as_user('00000000-0000-0000-0000-0000000000a2', 'aal2');
do $$ begin assert (select count(*) from public.lalum_name_reveal_grants) = 1, 'attorney sees her own grant only'; end $$;
select t.as_user('00000000-0000-0000-0000-0000000000a3', 'aal2');
do $$ begin assert (select count(*) from public.lalum_name_reveal_grants) = 2, 'administrator sees the firm grants'; end $$;
select public.lalum_set_name_reveal('00000000-0000-0000-0000-0000000000a1', false);
select t.as_user('00000000-0000-0000-0000-0000000000a1', 'aal2');
do $$ begin assert not public.lalum_can_see_client_names(), 'grant removed: no names'; end $$;
select t.as_user('00000000-0000-0000-0000-0000000000a3', 'aal2');
select public.lalum_set_member_role('00000000-0000-0000-0000-0000000000a2', 'COMPLIANCE_OFFICER');
reset role;
do $$ begin assert (select count(*) from public.lalum_name_reveal_grants) = 0, 'role change drops the grant'; end $$;
select t.as_user('00000000-0000-0000-0000-0000000000a3', 'aal2');
select public.lalum_set_member_role('00000000-0000-0000-0000-0000000000a2', 'ATTORNEY');
select t.as_user('00000000-0000-0000-0000-0000000000a2', 'aal2');
do $$ begin assert not public.lalum_can_see_client_names(), 'role came back, grant did not'; end $$;

-- 5. The administrator in a firm that requires MFA needs it; and anonymous cannot call the new function.
select t.as_user('00000000-0000-0000-0000-0000000000c1', 'aal1');
do $$ begin assert not public.lalum_can_see_client_names(), 'no second factor, no names'; end $$;
select t.as_user('00000000-0000-0000-0000-0000000000c1', 'aal2');
do $$ begin assert public.lalum_can_see_client_names(), 'second factor done: the administrator may'; end $$;
reset role;
do $$ begin
  assert not has_function_privilege('anon', 'public.lalum_set_name_reveal(uuid,boolean)', 'execute'), 'anon cannot grant';
  assert not has_table_privilege('authenticated', 'public.lalum_name_reveal_grants', 'insert'), 'no direct writes';
  assert (select count(*) from public.lalum_bookkeeper_gaps()) = 0, 'the new table has the bookkeeper deny policy';
end $$;

-- 6. The bookkeeper defaults to level 1, is capped at level 1, and a lower level is kept.
select t.as_user('00000000-0000-0000-0000-0000000000b1', 'aal2');
do $$ begin assert public.lalum_fin_level('00000000-0000-0000-0000-00000000000a') = 1, 'no row: default level 1'; end $$;
reset role;
insert into public.lalum_fin_permissions values ('00000000-0000-0000-0000-00000000000a','00000000-0000-0000-0000-0000000000b1', 4);
select t.as_user('00000000-0000-0000-0000-0000000000b1', 'aal2');
do $$ begin assert public.lalum_fin_level('00000000-0000-0000-0000-00000000000a') = 1, 'level 4 stored, level 1 in force'; end $$;
reset role;
update public.lalum_fin_permissions set level = 0 where user_id = '00000000-0000-0000-0000-0000000000b1';
select t.as_user('00000000-0000-0000-0000-0000000000b1', 'aal2');
do $$ begin assert public.lalum_fin_level('00000000-0000-0000-0000-00000000000a') = 0, 'level 0 stays 0'; end $$;
select t.as_user('00000000-0000-0000-0000-0000000000a1', 'aal1');
do $$ begin assert public.lalum_fin_level('00000000-0000-0000-0000-00000000000a') = 4, 'partner level unchanged'; end $$;
reset role;
rollback;
select 'name_reveal_admin_only: all assertions passed' as result;
