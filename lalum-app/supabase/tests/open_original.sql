-- Tests for migration 0047. Order: 00, 01, 0018, 02, 03_documents_analysis_stub, 04_intake_routings_stub, 0014, 0040, 0044, 0045, 0047, then this file.
-- Firm A does not require MFA, firm B does. The audit stub does not keep the hash argument.
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
create or replace function t.denied(p_doc uuid) returns void language plpgsql as $$
begin
  begin perform * from public.lalum_open_original(p_doc); raise exception 'should have been refused';
  exception when others then if sqlerrm <> 'not allowed' then raise exception 'wrong error: %', sqlerrm; end if; end;
end $$;
grant execute on function t.denied(uuid) to authenticated;

begin;
insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000000a1','partner@a.test'),('00000000-0000-0000-0000-0000000000a2','attorney@a.test'),
  ('00000000-0000-0000-0000-0000000000a3','office@a.test'),('00000000-0000-0000-0000-0000000000a4','attorney2@a.test'),
  ('00000000-0000-0000-0000-0000000000b1','partner@b.test'),('00000000-0000-0000-0000-0000000000f1','nofirm@x.test'),('00000000-0000-0000-0000-0000000000c9','avraham@lalum.co');
insert into public.lalum_firms (id, firm_name, registration_no, primary_contact, email, phone, monthly_fee, require_mfa) values
  ('00000000-0000-0000-0000-00000000000a','A','1','c','a@a.test','p',0,false),('00000000-0000-0000-0000-00000000000b','B','2','c','b@b.test','p',0,true);
insert into public.lalum_firm_members (firm_id, user_id, name, email, role) values
  ('00000000-0000-0000-0000-00000000000a','00000000-0000-0000-0000-0000000000a1','p','partner@a.test','FIRM_PARTNER'),
  ('00000000-0000-0000-0000-00000000000a','00000000-0000-0000-0000-0000000000a2','a','attorney@a.test','ATTORNEY'),
  ('00000000-0000-0000-0000-00000000000a','00000000-0000-0000-0000-0000000000a3','o','office@a.test','ADMIN'),
  ('00000000-0000-0000-0000-00000000000a','00000000-0000-0000-0000-0000000000a4','a','attorney2@a.test','ATTORNEY'),
  ('00000000-0000-0000-0000-00000000000b','00000000-0000-0000-0000-0000000000b1','p','partner@b.test','FIRM_PARTNER'),
  ('00000000-0000-0000-0000-00000000000a','00000000-0000-0000-0000-0000000000c9','plat','avraham@lalum.co','FIRM_PARTNER');
insert into public.lalum_cockpit_matters (id, firm_id, title, created_by) values
  ('00000000-0000-0000-0000-0000000000d1','00000000-0000-0000-0000-00000000000a','Secret Client','00000000-0000-0000-0000-0000000000a1'),
  ('00000000-0000-0000-0000-0000000000d2','00000000-0000-0000-0000-00000000000b','Other Firm Client','00000000-0000-0000-0000-0000000000b1');
insert into public.lalum_matter_team (matter_id, user_id) values ('00000000-0000-0000-0000-0000000000d1','00000000-0000-0000-0000-0000000000a2');
insert into public.lalum_matter_documents (id, matter_id, firm_id, file_name, original_path, original_mime, original_size, original_sha256) values
  ('00000000-0000-0000-0000-0000000001e1','00000000-0000-0000-0000-0000000000d1','00000000-0000-0000-0000-00000000000a','Secret Client.pdf','a/d1/e1/original.pdf','application/pdf',1234,'abc'),
  ('00000000-0000-0000-0000-0000000001e2','00000000-0000-0000-0000-0000000000d1','00000000-0000-0000-0000-00000000000a','x','a/d1/e2/original.pdf','application/pdf',1,'abd'),
  ('00000000-0000-0000-0000-0000000001e3','00000000-0000-0000-0000-0000000000d1','00000000-0000-0000-0000-00000000000a','no original',null,null,null,null),
  ('00000000-0000-0000-0000-0000000001e4','00000000-0000-0000-0000-0000000000d2','00000000-0000-0000-0000-00000000000b','y','b/d2/e4/original.pdf','application/pdf',1,'abe');
update public.lalum_matter_documents set deleted_at = now() where id = '00000000-0000-0000-0000-0000000001e2';

-- 1. Partner who created the matter: gets the path, mime, size and code, and one audit entry that holds neither name nor path.
select t.as_user('00000000-0000-0000-0000-0000000000a1');
do $$ declare r record; begin
  select * into r from public.lalum_open_original('00000000-0000-0000-0000-0000000001e1');
  assert r.path = 'a/d1/e1/original.pdf' and r.mime = 'application/pdf' and r.size = 1234, 'returns the storage facts';
  assert r.matter_code like 'L-%', 'returns the matter code';
end $$;
reset role;
do $$ begin
  assert (select count(*) from public.lalum_audit_stub where action = 'DOCUMENT_ORIGINAL_OPENED' and actor = '00000000-0000-0000-0000-0000000000a1' and matter_id = '00000000-0000-0000-0000-0000000000d1') = 1, 'one audit entry per open';
  assert not exists (select 1 from public.lalum_audit_stub where action = 'DOCUMENT_ORIGINAL_OPENED' and (detail::text ilike '%Secret%' or detail::text ilike '%original.pdf%')), 'audit holds no name and no path';
end $$;
-- 2. An attorney on the matter team: allowed. An attorney not on the team: refused (matter access).
select t.as_user('00000000-0000-0000-0000-0000000000a2');
select * from public.lalum_open_original('00000000-0000-0000-0000-0000000001e1');
select t.as_user('00000000-0000-0000-0000-0000000000a4');
select t.denied('00000000-0000-0000-0000-0000000001e1');
-- 3. Office admin may view the matter but may not see client names, so may not open the original.
select t.as_user('00000000-0000-0000-0000-0000000000a3');
select t.denied('00000000-0000-0000-0000-0000000001e1');
-- 4. Other firm, no firm, signed out.
select t.as_user('00000000-0000-0000-0000-0000000000b1', 'aal2');
select t.denied('00000000-0000-0000-0000-0000000001e1');
select t.as_user('00000000-0000-0000-0000-0000000000f1');
select t.denied('00000000-0000-0000-0000-0000000001e1');
select t.as_user(null);
select t.denied('00000000-0000-0000-0000-0000000001e1');
-- 4b. The platform admin belongs to firm A: allowed in firm A, refused in firm B (same as the vault read policy).
select t.as_user('00000000-0000-0000-0000-0000000000c9');
select * from public.lalum_open_original('00000000-0000-0000-0000-0000000001e1');
select t.denied('00000000-0000-0000-0000-0000000001e4');
-- 5. MFA: firm B requires it. Its own partner at aal1 is refused, at aal2 allowed.
select t.as_user('00000000-0000-0000-0000-0000000000b1', 'aal1');
select t.denied('00000000-0000-0000-0000-0000000001e4');
select t.as_user('00000000-0000-0000-0000-0000000000b1', 'aal2');
select * from public.lalum_open_original('00000000-0000-0000-0000-0000000001e4');
-- 6. A trashed document, a document without an original, an unknown document, a trashed matter.
select t.as_user('00000000-0000-0000-0000-0000000000a1');
select t.denied('00000000-0000-0000-0000-0000000001e2');
select t.denied('00000000-0000-0000-0000-0000000001e3');
select t.denied('00000000-0000-0000-0000-0000000001ff');
reset role;
update public.lalum_cockpit_matters set deleted_at = now() where id = '00000000-0000-0000-0000-0000000000d1';
select t.as_user('00000000-0000-0000-0000-0000000000a1');
select t.denied('00000000-0000-0000-0000-0000000001e1');
reset role;
-- 7. Refused attempts wrote nothing; anonymous callers cannot execute.
do $$ begin
  assert (select count(*) from public.lalum_audit_stub where action = 'DOCUMENT_ORIGINAL_OPENED') = 4, 'only the four successful opens were audited';
  assert not has_function_privilege('anon', 'public.lalum_open_original(uuid)', 'execute'), 'anon cannot open';
  assert has_function_privilege('authenticated', 'public.lalum_open_original(uuid)', 'execute'), 'signed in can call (the function decides)';
end $$;
rollback;
select 'open_original: all assertions passed' as result;
