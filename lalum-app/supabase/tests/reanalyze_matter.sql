-- Tests for migration 0046. Order: 00, 01, 0018, 02, 03_documents_analysis_stub, 04_intake_routings_stub, 0014, 0040, 0042, 0045, 0046, then this file.
-- Firm A does not require MFA, firm B does. Audit entries land in the stub table lalum_audit_stub.
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
insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000000a1','partner@a.test'),('00000000-0000-0000-0000-0000000000a2','attorney@a.test'),('00000000-0000-0000-0000-0000000000b1','partner@b.test');
insert into public.lalum_firms (id, firm_name, registration_no, primary_contact, email, phone, monthly_fee, require_mfa) values
  ('00000000-0000-0000-0000-00000000000a','A','1','c','a@a.test','p',0,false),('00000000-0000-0000-0000-00000000000b','B','2','c','b@b.test','p',0,true);
insert into public.lalum_firm_members (firm_id, user_id, name, email, role) values
  ('00000000-0000-0000-0000-00000000000a','00000000-0000-0000-0000-0000000000a1','p','partner@a.test','FIRM_PARTNER'),
  ('00000000-0000-0000-0000-00000000000a','00000000-0000-0000-0000-0000000000a2','a','attorney@a.test','ATTORNEY'),
  ('00000000-0000-0000-0000-00000000000b','00000000-0000-0000-0000-0000000000b1','p','partner@b.test','FIRM_PARTNER');
insert into public.lalum_cockpit_matters (id, firm_id, title, practice_area) values
  ('00000000-0000-0000-0000-0000000000d1','00000000-0000-0000-0000-00000000000a','m','COMMERCIAL_MA'),
  ('00000000-0000-0000-0000-0000000000d2','00000000-0000-0000-0000-00000000000b','m2','COMMERCIAL_MA');
insert into public.lalum_intake_routings (matter_id, practice_area) values ('00000000-0000-0000-0000-0000000000d1','COMMERCIAL_MA'),('00000000-0000-0000-0000-0000000000d2','COMMERCIAL_MA');
insert into public.lalum_matter_documents (id, matter_id, firm_id, file_name, doc_type, analysis) values
  ('00000000-0000-0000-0000-0000000001e1','00000000-0000-0000-0000-0000000000d1','00000000-0000-0000-0000-00000000000a','f1','CONTRACT','{"findings":[],"risk":{"level":"HIGH_RISK","score":50,"red":2,"yellow":0,"green":1}}'),
  ('00000000-0000-0000-0000-0000000001e2','00000000-0000-0000-0000-0000000000d2','00000000-0000-0000-0000-00000000000b','f2','CONTRACT','{}');

-- 1. A partner stores a new analysis; the matter rollup follows (0042 trigger), the audit holds a hash and the area, not the content.
select t.as_user('00000000-0000-0000-0000-0000000000a1');
select public.lalum_document_set_analysis('00000000-0000-0000-0000-0000000001e1', '{"findings":[{"ruleName":"x","severity":"GREEN"}],"risk":{"level":"COMPLIANT","score":100,"red":0,"yellow":0,"green":1}}', 'REAL_ESTATE');
reset role;
do $$ begin
  assert (select analysis->'risk'->>'level' from public.lalum_matter_documents where id = '00000000-0000-0000-0000-0000000001e1') = 'COMPLIANT', 'analysis stored';
  assert (select risk_summary->>'level' from public.lalum_cockpit_matters where id = '00000000-0000-0000-0000-0000000000d1') = 'COMPLIANT', 'rollup follows';
  assert (select count(*) from public.lalum_audit_stub where action = 'DOCUMENT_REANALYZED' and detail->>'practice_area' = 'REAL_ESTATE' and actor = '00000000-0000-0000-0000-0000000000a1') = 1, 'audited with the area';
  assert not exists (select 1 from public.lalum_audit_stub where action = 'DOCUMENT_REANALYZED' and detail::text like '%findings%'), 'no content in the audit';
end $$;

-- 2. Who may not: an attorney, another firm's partner, a partner at aal1 in an MFA firm, signed out.
select t.as_user('00000000-0000-0000-0000-0000000000a2');
select t.fails($q$select public.lalum_document_set_analysis('00000000-0000-0000-0000-0000000001e1', '{"findings":[],"risk":{"level":"COMPLIANT","score":100,"red":0,"yellow":0,"green":0}}', 'REAL_ESTATE')$q$, 'not allowed');
select t.as_user('00000000-0000-0000-0000-0000000000a1');
select t.fails($q$select public.lalum_document_set_analysis('00000000-0000-0000-0000-0000000001e2', '{"findings":[],"risk":{"level":"COMPLIANT","score":100,"red":0,"yellow":0,"green":0}}', 'REAL_ESTATE')$q$, 'not allowed');
select t.as_user('00000000-0000-0000-0000-0000000000b1', 'aal1');
select t.fails($q$select public.lalum_document_set_analysis('00000000-0000-0000-0000-0000000001e2', '{"findings":[],"risk":{"level":"COMPLIANT","score":100,"red":0,"yellow":0,"green":0}}', 'REAL_ESTATE')$q$, 'not allowed');
select t.as_user('00000000-0000-0000-0000-0000000000b1', 'aal2');
select public.lalum_document_set_analysis('00000000-0000-0000-0000-0000000001e2', '{"findings":[],"risk":{"level":"CAUTION","score":90,"red":0,"yellow":1,"green":0}}', 'LITIGATION');
select t.as_user(null);
select t.fails($q$select public.lalum_document_set_analysis('00000000-0000-0000-0000-0000000001e1', '{"findings":[],"risk":{"level":"COMPLIANT","score":100,"red":0,"yellow":0,"green":0}}', 'REAL_ESTATE')$q$, 'not allowed');

-- 3. Bad input is refused and changes nothing.
select t.as_user('00000000-0000-0000-0000-0000000000a1');
select t.fails($q$select public.lalum_document_set_analysis('00000000-0000-0000-0000-0000000001e1', '{"findings":[],"risk":{"level":"COMPLIANT","score":100,"red":0,"yellow":0,"green":0}}', 'NOT_AN_AREA')$q$, 'bad practice area');
select t.fails($q$select public.lalum_document_set_analysis('00000000-0000-0000-0000-0000000001e1', '{"risk":{"level":"COMPLIANT","score":100,"red":0,"yellow":0,"green":0}}', 'REAL_ESTATE')$q$, 'bad analysis');
select t.fails($q$select public.lalum_document_set_analysis('00000000-0000-0000-0000-0000000001e1', '{"findings":[],"risk":{"level":"FINE","score":100,"red":0,"yellow":0,"green":0}}', 'REAL_ESTATE')$q$, 'bad analysis');
select t.fails($q$select public.lalum_document_set_analysis('00000000-0000-0000-0000-0000000001e1', '{"findings":[],"risk":{"level":"COMPLIANT","score":101,"red":0,"yellow":0,"green":0}}', 'REAL_ESTATE')$q$, 'bad analysis');
select t.fails($q$select public.lalum_document_set_analysis('00000000-0000-0000-0000-0000000001e1', '{"findings":[],"risk":{"level":"COMPLIANT","score":100,"red":-1,"yellow":0,"green":0}}', 'REAL_ESTATE')$q$, 'bad analysis');
select t.fails($q$select public.lalum_document_set_analysis('00000000-0000-0000-0000-0000000001e1', '[]', 'REAL_ESTATE')$q$, 'bad analysis');
select t.fails($q$select public.lalum_document_set_analysis('00000000-0000-0000-0000-0000000001e1', '{"findings":[]}', 'REAL_ESTATE')$q$, 'bad analysis');
select t.fails($q$select public.lalum_document_set_analysis('00000000-0000-0000-0000-0000000001e1', '{"findings":"x","risk":{"level":"COMPLIANT","score":1,"red":0,"yellow":0,"green":0}}', 'REAL_ESTATE')$q$, 'bad analysis');
select t.fails($q$select public.lalum_document_set_analysis('00000000-0000-0000-0000-0000000001e1', '{"findings":[],"risk":{"score":1,"red":0,"yellow":0,"green":0}}', 'REAL_ESTATE')$q$, 'bad analysis');
select t.fails($q$select public.lalum_document_set_analysis('00000000-0000-0000-0000-0000000001e1', '{"findings":[],"risk":{"level":"COMPLIANT","score":"1","red":0,"yellow":0,"green":0}}', 'REAL_ESTATE')$q$, 'bad analysis');
select t.fails($q$select public.lalum_document_set_analysis('00000000-0000-0000-0000-0000000001e1', null, 'REAL_ESTATE')$q$, 'bad analysis');
select t.fails($q$select public.lalum_document_set_analysis('00000000-0000-0000-0000-0000000001e1', jsonb_build_object('findings','[]'::jsonb,'risk','{"level":"COMPLIANT","score":1,"red":0,"yellow":0,"green":0}'::jsonb,'pad',repeat('x',250000)), 'REAL_ESTATE')$q$, 'bad analysis');
select t.fails($q$select public.lalum_document_set_analysis('00000000-0000-0000-0000-0000000001e1', jsonb_build_object('findings',(select jsonb_agg('{}'::jsonb) from generate_series(1,201)),'risk','{"level":"COMPLIANT","score":1,"red":0,"yellow":0,"green":0}'::jsonb), 'REAL_ESTATE')$q$, 'bad analysis');
select t.fails($q$select public.lalum_document_set_analysis('00000000-0000-0000-0000-0000000001ff', '{"findings":[],"risk":{"level":"COMPLIANT","score":100,"red":0,"yellow":0,"green":0}}', 'REAL_ESTATE')$q$, 'not allowed');
reset role;
do $$ begin assert (select analysis->'risk'->>'level' from public.lalum_matter_documents where id = '00000000-0000-0000-0000-0000000001e1') = 'COMPLIANT', 'refused calls changed nothing'; end $$;

-- 4. Practice area of the matter: both rows, partner only, audited.
select t.as_user('00000000-0000-0000-0000-0000000000a1');
select public.lalum_matter_set_practice('00000000-0000-0000-0000-0000000000d1', 'REAL_ESTATE');
reset role;
do $$ begin
  assert (select practice_area from public.lalum_cockpit_matters where id = '00000000-0000-0000-0000-0000000000d1') = 'REAL_ESTATE', 'matter area';
  assert (select practice_area from public.lalum_intake_routings where matter_id = '00000000-0000-0000-0000-0000000000d1') = 'REAL_ESTATE', 'routing area';
  assert (select count(*) from public.lalum_audit_stub where action = 'MATTER_PRACTICE_SET') = 1, 'audited';
end $$;
select t.as_user('00000000-0000-0000-0000-0000000000a2');
select t.fails($q$select public.lalum_matter_set_practice('00000000-0000-0000-0000-0000000000d1', 'LITIGATION')$q$, 'not allowed');
select t.as_user('00000000-0000-0000-0000-0000000000a1');
select t.fails($q$select public.lalum_matter_set_practice('00000000-0000-0000-0000-0000000000d1', 'NOPE')$q$, 'bad practice area');
select t.fails($q$select public.lalum_matter_set_practice('00000000-0000-0000-0000-0000000000d2', 'LITIGATION')$q$, 'not allowed');

-- 5. Not executable anonymously.
do $$ begin
  assert not has_function_privilege('anon', 'public.lalum_document_set_analysis(uuid,jsonb,text)', 'execute'), 'anon set analysis';
  assert not has_function_privilege('anon', 'public.lalum_matter_set_practice(uuid,text)', 'execute'), 'anon set practice';
end $$;
rollback;
select 'reanalyze_matter: all assertions passed' as result;
