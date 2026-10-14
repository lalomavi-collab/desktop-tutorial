-- Tests for migration 0044 (client name reveal). Order: 00_supabase_stubs, 01_live_only_stubs, 0018, 02_matter_team_stub,
-- 04_intake_routings_stub, 0014, 0040, 0044, then this file:  psql -v ON_ERROR_STOP=1 -f client_names_reveal.sql
-- Audit entries land in the local stub table lalum_audit_stub (live: the hash chained log). Every assertion raises on failure; fixtures roll back. Firm A does not require MFA, firm B does.
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
  ('00000000-0000-0000-0000-0000000000a3','office@a.test'),  ('00000000-0000-0000-0000-0000000000a4','compliance@a.test'),
  ('00000000-0000-0000-0000-0000000000b1','partner@b.test'), ('00000000-0000-0000-0000-0000000000c1','nofirm@x.test');
insert into public.lalum_firms (id, firm_name, registration_no, primary_contact, email, phone, monthly_fee, require_mfa) values
  ('00000000-0000-0000-0000-00000000000a','A','1','c','a@a.test','p',0,false),
  ('00000000-0000-0000-0000-00000000000b','B','2','c','b@b.test','p',0,true);
insert into public.lalum_firm_members (firm_id, user_id, name, email, role) values
  ('00000000-0000-0000-0000-00000000000a','00000000-0000-0000-0000-0000000000a1','p','partner@a.test','FIRM_PARTNER'),
  ('00000000-0000-0000-0000-00000000000a','00000000-0000-0000-0000-0000000000a2','a','attorney@a.test','ATTORNEY'),
  ('00000000-0000-0000-0000-00000000000a','00000000-0000-0000-0000-0000000000a3','o','office@a.test','ADMIN'),
  ('00000000-0000-0000-0000-00000000000a','00000000-0000-0000-0000-0000000000a4','c','compliance@a.test','COMPLIANCE_OFFICER'),
  ('00000000-0000-0000-0000-00000000000b','00000000-0000-0000-0000-0000000000b1','p','partner@b.test','FIRM_PARTNER');
insert into public.lalum_cockpit_matters (id, firm_id, title) values ('00000000-0000-0000-0000-0000000000d1','00000000-0000-0000-0000-00000000000a','Client Name');
insert into public.lalum_intake_routings (matter_id, practice_area) values ('00000000-0000-0000-0000-0000000000d1','REAL_ESTATE');

-- 1. Who may ask for names.
select t.as_user('00000000-0000-0000-0000-0000000000a1');
do $$ begin assert public.lalum_can_see_client_names(), 'partner may'; end $$;
select t.as_user('00000000-0000-0000-0000-0000000000a2');
do $$ begin assert public.lalum_can_see_client_names(), 'attorney may'; end $$;
select t.as_user('00000000-0000-0000-0000-0000000000a3');
do $$ begin assert not public.lalum_can_see_client_names(), 'office admin may not'; end $$;
select t.as_user('00000000-0000-0000-0000-0000000000a4');
do $$ begin assert not public.lalum_can_see_client_names(), 'compliance officer may not'; end $$;
select t.as_user('00000000-0000-0000-0000-0000000000c1');
do $$ begin assert not public.lalum_can_see_client_names(), 'user without a firm may not'; end $$;
select t.as_user(null);
do $$ begin assert not public.lalum_can_see_client_names(), 'signed out may not'; end $$;

-- 2. MFA: firm B requires it. A partner at aal1 may not, at aal2 may.
select t.as_user('00000000-0000-0000-0000-0000000000b1', 'aal1');
do $$ begin assert not public.lalum_can_see_client_names(), 'no fresh MFA, no names'; end $$;
select t.as_user('00000000-0000-0000-0000-0000000000b1', 'aal2');
do $$ begin assert public.lalum_can_see_client_names(), 'MFA done, names allowed'; end $$;

-- 3. The act: audited for allowed users, refused for the rest, and the audit holds no name.
select t.as_user('00000000-0000-0000-0000-0000000000a1');
select public.lalum_reveal_client_names();
select public.lalum_reveal_client_names();
reset role;
do $$ declare n int; m jsonb; begin
  select count(*), (array_agg(detail))[1] into n, m from public.lalum_audit_stub where action = 'CLIENT_NAMES_REVEALED' and firm_id = '00000000-0000-0000-0000-00000000000a' and actor = '00000000-0000-0000-0000-0000000000a1';
  assert n = 2, 'each reveal is one audit entry';
  assert m = '{}'::jsonb and m::text not like '%Client Name%', 'audit entry carries no name';
end $$;
select t.as_user('00000000-0000-0000-0000-0000000000a3');
do $$ begin
  begin perform public.lalum_reveal_client_names(); assert false, 'office admin reveal must fail';
  exception when others then assert sqlerrm = 'not allowed', 'refused with: ' || sqlerrm; end;
end $$;
select t.as_user('00000000-0000-0000-0000-0000000000b1', 'aal1');
do $$ begin
  begin perform public.lalum_reveal_client_names(); assert false, 'no MFA reveal must fail';
  exception when others then assert sqlerrm = 'not allowed', 'refused with: ' || sqlerrm; end;
end $$;
reset role;
do $$ begin assert (select count(*) from public.lalum_audit_stub where action = 'CLIENT_NAMES_REVEALED') = 2, 'refused attempts write nothing'; end $$;

-- 4. Anonymous callers cannot execute either function.
do $$ begin
  assert not has_function_privilege('anon', 'public.lalum_can_see_client_names()', 'execute'), 'anon cannot ask';
  assert not has_function_privilege('anon', 'public.lalum_reveal_client_names()', 'execute'), 'anon cannot reveal';
  assert has_function_privilege('authenticated', 'public.lalum_reveal_client_names()', 'execute'), 'signed in can call (the function decides)';
end $$;

-- 5. The view carries the code, last, and the code is the matter code.
do $$ begin
  assert (select matter_code from public.lalum_v_admin_matters where matter_id = '00000000-0000-0000-0000-0000000000d1') like 'L-%', 'view exposes matter_code';
  assert (select column_name from information_schema.columns where table_name = 'lalum_v_admin_matters' order by ordinal_position desc limit 1) = 'matter_code', 'appended last';
  assert (select reloptions::text from pg_class where relname = 'lalum_v_admin_matters') like '%security_invoker=true%', 'still security invoker';
end $$;
rollback;
select 'client_names_reveal: all assertions passed' as result;
