-- Tests for migration 0045. Order: 00, 01, 0018, 02, 04_intake_routings_stub, 0014, 0040, then run this file BEFORE 0045 to see it fail,
-- then apply 0045 and run it again to see it pass:  psql -v ON_ERROR_STOP=1 -f mgr_ok_never_null.sql
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
create or replace function t.fails(p_sql text, p_msg text) returns void language plpgsql as $$
begin
  begin execute p_sql; raise exception 'should have failed: %', p_sql;
  exception when others then if sqlerrm <> p_msg then raise exception 'wrong error for %: %', p_sql, sqlerrm; end if; end;
end $$;
grant execute on function t.fails(text, text) to authenticated;

begin;
insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000000a1','partner@a.test'),('00000000-0000-0000-0000-0000000000a2','attorney@a.test'),
  ('00000000-0000-0000-0000-0000000000b1','partner@b.test'),('00000000-0000-0000-0000-0000000000f1','nofirm@x.test');
insert into public.lalum_firms (id, firm_name, registration_no, primary_contact, email, phone, monthly_fee, require_mfa) values
  ('00000000-0000-0000-0000-00000000000a','A','1','c','a@a.test','p',0,false),('00000000-0000-0000-0000-00000000000b','B','2','c','b@b.test','p',0,true);
insert into public.lalum_firm_members (firm_id, user_id, name, email, role) values
  ('00000000-0000-0000-0000-00000000000a','00000000-0000-0000-0000-0000000000a1','p','partner@a.test','FIRM_PARTNER'),
  ('00000000-0000-0000-0000-00000000000a','00000000-0000-0000-0000-0000000000a2','a','attorney@a.test','ATTORNEY'),
  ('00000000-0000-0000-0000-00000000000b','00000000-0000-0000-0000-0000000000b1','p','partner@b.test','FIRM_PARTNER');
insert into public.lalum_cockpit_matters (id, firm_id, title) values ('00000000-0000-0000-0000-0000000000d1','00000000-0000-0000-0000-00000000000a','m');

-- The function itself: never NULL.
select t.as_user('00000000-0000-0000-0000-0000000000f1');
do $$ begin assert public.lalum_mgr_ok('00000000-0000-0000-0000-00000000000a') is not null, 'user without a firm: result must be false, not NULL'; end $$;
select t.as_user(null);
do $$ begin assert public.lalum_mgr_ok('00000000-0000-0000-0000-00000000000a') is not null, 'signed out: result must be false, not NULL'; end $$;
-- The consequence: the definer functions refuse a user who belongs to no firm.
select t.as_user('00000000-0000-0000-0000-0000000000f1');
select t.fails($q$select public.lalum_set_matter_sync('00000000-0000-0000-0000-0000000000d1', true)$q$, 'not allowed');
select t.fails($q$select public.lalum_set_matter_department('00000000-0000-0000-0000-0000000000d1', 'x')$q$, 'not allowed');
select t.fails($q$select public.lalum_set_member_department('00000000-0000-0000-0000-0000000000a2', 'x')$q$, 'not allowed');
-- The rule itself is unchanged.
select t.as_user('00000000-0000-0000-0000-0000000000a1');
do $$ begin assert public.lalum_mgr_ok('00000000-0000-0000-0000-00000000000a') = true, 'partner of the firm'; assert public.lalum_mgr_ok('00000000-0000-0000-0000-00000000000b') = false, 'partner of another firm'; end $$;
select t.as_user('00000000-0000-0000-0000-0000000000a2');
do $$ begin assert public.lalum_mgr_ok('00000000-0000-0000-0000-00000000000a') = false, 'attorney is not a manager'; end $$;
select t.as_user('00000000-0000-0000-0000-0000000000b1', 'aal1');
do $$ begin assert public.lalum_mgr_ok('00000000-0000-0000-0000-00000000000b') = false, 'MFA firm, no MFA'; end $$;
select t.as_user('00000000-0000-0000-0000-0000000000b1', 'aal2');
do $$ begin assert public.lalum_mgr_ok('00000000-0000-0000-0000-00000000000b') = true, 'MFA firm, MFA done'; end $$;
select t.as_user('00000000-0000-0000-0000-0000000000a1');
select public.lalum_set_matter_sync('00000000-0000-0000-0000-0000000000d1', true);
rollback;
select 'mgr_ok_never_null: all assertions passed' as result;
