-- Tests for migration 0048 (risk scope: identical text counts once, partner exclusion).
-- Order: 00, 01, 0018, 02, 03_documents_analysis_stub, 04_intake_routings_stub, 0014, 0040, 0042, 0044, 0045, 0048, then this file.
-- Every assertion raises on failure; a clean run is the pass signal. Fixtures roll back at the end.
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
create or replace function t.denied(p_doc uuid, p_ex boolean, p_reason text, p_msg text) returns void language plpgsql as $$
begin
  begin perform public.lalum_document_set_risk_scope(p_doc, p_ex, p_reason); raise exception 'should have been refused';
  exception when others then if sqlerrm <> p_msg then raise exception 'wrong error: %', sqlerrm; end if; end;
end $$;
grant execute on function t.denied(uuid, boolean, text, text) to authenticated;

begin;
insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000000a1','partner@a.test'),('00000000-0000-0000-0000-0000000000a2','attorney@a.test'),
  ('00000000-0000-0000-0000-0000000000b1','partner@b.test'),('00000000-0000-0000-0000-0000000000f1','nofirm@x.test');
insert into public.lalum_firms (id, firm_name, registration_no, primary_contact, email, phone, monthly_fee, require_mfa) values
  ('00000000-0000-0000-0000-00000000000a','A','1','c','a@a.test','p',0,false),('00000000-0000-0000-0000-00000000000b','B','2','c','b@b.test','p',0,true);
insert into public.lalum_firm_members (firm_id, user_id, name, email, role) values
  ('00000000-0000-0000-0000-00000000000a','00000000-0000-0000-0000-0000000000a1','p','partner@a.test','FIRM_PARTNER'),
  ('00000000-0000-0000-0000-00000000000a','00000000-0000-0000-0000-0000000000a2','a','attorney@a.test','ATTORNEY'),
  ('00000000-0000-0000-0000-00000000000b','00000000-0000-0000-0000-0000000000b1','p','partner@b.test','FIRM_PARTNER');
insert into public.lalum_cockpit_matters (id, firm_id, title) values
  ('00000000-0000-0000-0000-0000000000c1','00000000-0000-0000-0000-00000000000a','m1'),
  ('00000000-0000-0000-0000-0000000000c2','00000000-0000-0000-0000-00000000000a','m2');

create function pg_temp.doc(p_id int, p_matter text, p_type text, p_red int, p_yellow int, p_score int, p_text text) returns void language sql as $$
  insert into public.lalum_matter_documents (id, matter_id, firm_id, file_name, doc_type, editor_content, analysis)
  values (('00000000-0000-0000-0000-0000000001' || lpad(p_id::text, 2, '0'))::uuid, ('00000000-0000-0000-0000-0000000000' || p_matter)::uuid,
          '00000000-0000-0000-0000-00000000000a', 'f' || p_id, p_type, p_text,
          jsonb_build_object('risk', jsonb_build_object('red', p_red, 'yellow', p_yellow, 'green', 1, 'score', p_score, 'level', 'X')))
$$;
create function pg_temp.rs(p_matter text) returns jsonb language sql as $$
  select risk_summary from public.lalum_cockpit_matters where id = ('00000000-0000-0000-0000-0000000000' || p_matter)::uuid $$;
create function pg_temp.id(p int) returns uuid language sql as $$ select ('00000000-0000-0000-0000-0000000001' || lpad(p::text, 2, '0'))::uuid $$;

-- 1. Identical text counts once: two copies of a red contract are one red document, not two.
select pg_temp.doc(1, 'c1', 'CONTRACT', 2, 1, 40, 'same text');
select pg_temp.doc(2, 'c1', 'CONTRACT', 2, 1, 40, 'same text');
select pg_temp.doc(3, 'c1', 'CONTRACT', 0, 1, 90, 'the full agreement');
do $$ begin
  assert (pg_temp.rs('c1')->>'docs_assessed')::int = 2, 'duplicate counted once';
  assert (pg_temp.rs('c1')->>'docs_duplicate')::int = 1, 'duplicate reported';
  assert (pg_temp.rs('c1')->>'red')::int = 2 and (pg_temp.rs('c1')->>'yellow')::int = 2, 'findings not doubled';
  assert (pg_temp.rs('c1')->>'docs_red')::int = 1, 'one red document';
  assert pg_temp.rs('c1')->>'level' = 'HIGH_RISK', 'still red until a partner decides';
end $$;

-- 2. Different text is never merged, and a document with no text is never merged with another.
select pg_temp.doc(4, 'c2', 'CONTRACT', 0, 0, 100, null);
select pg_temp.doc(5, 'c2', 'CONTRACT', 0, 0, 100, null);
select pg_temp.doc(6, 'c2', 'CONTRACT', 0, 0, 100, '');
select pg_temp.doc(7, 'c2', 'CONTRACT', 0, 0, 100, '');
do $$ begin
  assert (pg_temp.rs('c2')->>'docs_assessed')::int = 4 and (pg_temp.rs('c2')->>'docs_duplicate')::int = 0, 'empty text is not a duplicate';
end $$;

-- 3. A partner excludes the short copy with a reason: the level follows the full agreement.
select t.as_user('00000000-0000-0000-0000-0000000000a1'::uuid);
select public.lalum_document_set_risk_scope(pg_temp.id(1), true, 'גרסה מוקדמת של ההסכם');
select public.lalum_document_set_risk_scope(pg_temp.id(2), true, 'גרסה מוקדמת של ההסכם');
reset role;
do $$ begin
  assert pg_temp.rs('c1')->>'level' = 'CAUTION', 'level follows the operative document';
  assert (pg_temp.rs('c1')->>'score')::int = 90, 'score follows the operative document';
  assert (pg_temp.rs('c1')->>'docs_partner_excluded')::int = 2 and (pg_temp.rs('c1')->>'docs_assessed')::int = 1, 'exclusion counted';
  assert (select risk_excluded_reason from public.lalum_matter_documents where id = pg_temp.id(1)) = 'גרסה מוקדמת של ההסכם', 'reason stored';
  assert (select analysis->'risk'->>'level' from public.lalum_matter_documents where id = pg_temp.id(1)) = 'X', 'the document keeps its own analysis';
end $$;

-- 4. Excluding one of two duplicates must not hide the other: the counted copy is chosen among counted ones only.
select t.as_user('00000000-0000-0000-0000-0000000000a1'::uuid);
select public.lalum_document_set_risk_scope(pg_temp.id(2), false, null);
reset role;
do $$ begin
  assert pg_temp.rs('c1')->>'level' = 'HIGH_RISK', 'the un-excluded copy counts again (copy 1 is still excluded)';
  assert (pg_temp.rs('c1')->>'docs_assessed')::int = 2 and (pg_temp.rs('c1')->>'docs_duplicate')::int = 0, 'excluded copy does not shadow its twin';
  assert (select risk_excluded_reason from public.lalum_matter_documents where id = pg_temp.id(2)) is null, 'reason cleared on un-exclude';
end $$;

-- 5. Permissions and validation: all refusals name the same error and change nothing.
select t.as_user('00000000-0000-0000-0000-0000000000a2'::uuid);
select t.denied(pg_temp.id(3), true, 'סיבה כלשהי', 'not allowed');
select t.as_user('00000000-0000-0000-0000-0000000000b1'::uuid, 'aal2');
select t.denied(pg_temp.id(3), true, 'סיבה כלשהי', 'not allowed');
select t.as_user('00000000-0000-0000-0000-0000000000f1'::uuid);
select t.denied(pg_temp.id(3), true, 'סיבה כלשהי', 'not allowed');
select t.as_user(null);
select t.denied(pg_temp.id(3), true, 'סיבה כלשהי', 'not allowed');
select t.as_user('00000000-0000-0000-0000-0000000000a1'::uuid);
select t.denied(pg_temp.id(3), true, null, 'reason required');
select t.denied(pg_temp.id(3), true, '  ', 'reason required');
select t.denied(pg_temp.id(3), true, 'ab', 'reason required');
select t.denied(pg_temp.id(3), true, repeat('x', 301), 'reason required');
select t.denied(pg_temp.id(3), null, 'סיבה כלשהי', 'bad scope');
select t.denied('00000000-0000-0000-0000-0000000001ff'::uuid, true, 'סיבה כלשהי', 'not allowed');
reset role;
do $$ begin
  assert not (select risk_excluded from public.lalum_matter_documents where id = pg_temp.id(3)), 'nothing changed by refused calls';
  -- the table constraint also refuses an exclusion without a reason, even for a direct write
  begin update public.lalum_matter_documents set risk_excluded = true where id = pg_temp.id(3); raise exception 'constraint missing';
  exception when check_violation then null; end;
end $$;

-- 6. The audit row carries the action and a hash, never the reason text.
do $$ begin
  assert exists (select 1 from public.lalum_audit_stub where action = 'DOCUMENT_RISK_SCOPE_SET' and detail = '{"excluded": true}'::jsonb), 'audited';
  assert not exists (select 1 from public.lalum_audit_stub where detail::text like '%גרסה%'), 'reason text not in audit';
end $$;

-- 7. Trashing and restoring still recompute (0042 behaviour kept).
update public.lalum_matter_documents set deleted_at = now() where id = pg_temp.id(3);
do $$ begin assert (pg_temp.rs('c1')->>'docs_total')::int = 2, 'trash recomputes'; end $$;
update public.lalum_matter_documents set deleted_at = null where id = pg_temp.id(3);
do $$ begin assert (pg_temp.rs('c1')->>'docs_total')::int = 3, 'restore recomputes'; end $$;
-- 8. When every counted document is excluded, nothing is assessed: NOT_ASSESSED, never COMPLIANT.
insert into public.lalum_cockpit_matters (id, firm_id, title) values ('00000000-0000-0000-0000-0000000000c3','00000000-0000-0000-0000-00000000000a','m3');
select pg_temp.doc(8, 'c3', 'CONTRACT', 1, 0, 75, 'only contract');
select t.as_user('00000000-0000-0000-0000-0000000000a1'::uuid);
select public.lalum_document_set_risk_scope(pg_temp.id(8), true, 'נוסח שהוחלף');
reset role;
do $$ begin assert pg_temp.rs('c3')->>'level' = 'NOT_ASSESSED' and (pg_temp.rs('c3')->>'docs_partner_excluded')::int = 1, 'all excluded is not assessed'; end $$;
rollback;
select 'risk_scope: all assertions passed' as result;
