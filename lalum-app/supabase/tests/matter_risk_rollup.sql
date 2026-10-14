-- Tests for migration 0042 (matter level risk rollup).
-- Order: 00_supabase_stubs, 01_live_only_stubs, 0018, 02_matter_team_stub, 03_documents_analysis_stub, 0014, 0040, 0042, then this file:
--   psql -v ON_ERROR_STOP=1 -f matter_risk_rollup.sql
-- Every assertion raises on failure; a clean run is the pass signal. Fixtures roll back at the end.
begin;
insert into public.lalum_firms (id, firm_name, registration_no, primary_contact, email, phone, monthly_fee)
  values ('00000000-0000-0000-0000-00000000000a','A','1','c','a@a.test','p',0);
insert into public.lalum_cockpit_matters (id, firm_id, title, risk_summary) values
  ('00000000-0000-0000-0000-0000000000c1','00000000-0000-0000-0000-00000000000a','m1','{"level":"HIGH_RISK"}'),
  ('00000000-0000-0000-0000-0000000000c2','00000000-0000-0000-0000-00000000000a','m2','{}');

create function pg_temp.doc(p_id int, p_matter text, p_type text, p_red int, p_yellow int, p_score int, p_has boolean default true) returns void language sql as $$
  insert into public.lalum_matter_documents (id, matter_id, firm_id, file_name, doc_type, analysis)
  values (('00000000-0000-0000-0000-0000000001' || lpad(p_id::text, 2, '0'))::uuid, ('00000000-0000-0000-0000-0000000000' || p_matter)::uuid,
          '00000000-0000-0000-0000-00000000000a', 'f' || p_id, p_type,
          case when p_has then jsonb_build_object('risk', jsonb_build_object('red', p_red, 'yellow', p_yellow, 'green', 1, 'score', p_score, 'level', 'X')) else '{}'::jsonb end)
$$;
create function pg_temp.rs(p_matter text) returns jsonb language sql as $$
  select risk_summary from public.lalum_cockpit_matters where id = ('00000000-0000-0000-0000-0000000000' || p_matter)::uuid $$;
create function pg_temp.id(p int) returns uuid language sql as $$ select ('00000000-0000-0000-0000-0000000001' || lpad(p::text, 2, '0'))::uuid $$;

-- 1. The last upload no longer decides: a red contract followed by a clean contract stays HIGH_RISK.
select pg_temp.doc(1, 'c1', 'CONTRACT', 2, 1, 55);
select pg_temp.doc(2, 'c1', 'CONTRACT', 0, 0, 100);
do $$ begin
  assert pg_temp.rs('c1')->>'level' = 'HIGH_RISK', 'red contract first, clean last';
  assert (pg_temp.rs('c1')->>'score')::int = 55, 'score is the worst document';
  assert (pg_temp.rs('c1')->>'docs_red')::int = 1 and (pg_temp.rs('c1')->>'docs_assessed')::int = 2, 'document counts';
  assert (pg_temp.rs('c1')->>'red')::int = 2 and (pg_temp.rs('c1')->>'yellow')::int = 1, 'findings summed';
  assert pg_temp.rs('c1')->'red_docs' = to_jsonb(array[pg_temp.id(1)]), 'red document listed';
end $$;

-- 2. Clean documents only: COMPLIANT. Yellow only: CAUTION.
select pg_temp.doc(3, 'c2', 'CONTRACT', 0, 0, 100);
do $$ begin assert pg_temp.rs('c2')->>'level' = 'COMPLIANT', 'clean'; end $$;
select pg_temp.doc(4, 'c2', 'CONTRACT', 0, 3, 70);
do $$ begin assert pg_temp.rs('c2')->>'level' = 'CAUTION' and (pg_temp.rs('c2')->>'score')::int = 70, 'yellow only'; end $$;

-- 3. Excluded types never raise the level, and are counted as excluded.
select pg_temp.doc(5, 'c2', 'OPINION', 4, 4, 0);
select pg_temp.doc(6, 'c2', 'CORRESPONDENCE', 1, 0, 75);
do $$ begin
  assert pg_temp.rs('c2')->>'level' = 'CAUTION', 'opinion and correspondence ignored';
  assert (pg_temp.rs('c2')->>'docs_excluded')::int = 2 and (pg_temp.rs('c2')->>'docs_total')::int = 4, 'excluded counted';
end $$;

-- 4. Changing the type later (the import sets it after provisioning) recomputes.
update public.lalum_matter_documents set doc_type = 'CONTRACT' where id = pg_temp.id(5);
do $$ begin assert pg_temp.rs('c2')->>'level' = 'HIGH_RISK', 'type change recomputes'; end $$;
update public.lalum_matter_documents set doc_type = 'OPINION' where id = pg_temp.id(5);
do $$ begin assert pg_temp.rs('c2')->>'level' = 'CAUTION', 'and back'; end $$;

-- 5. Trash and restore: a trashed red document stops counting; restoring brings it back.
update public.lalum_matter_documents set deleted_at = now() where id = pg_temp.id(1);
do $$ begin assert pg_temp.rs('c1')->>'level' = 'COMPLIANT' and (pg_temp.rs('c1')->>'docs_total')::int = 1, 'trashed document ignored'; end $$;
update public.lalum_matter_documents set deleted_at = null where id = pg_temp.id(1);
do $$ begin assert pg_temp.rs('c1')->>'level' = 'HIGH_RISK', 'restore'; end $$;

-- 6. A new analysis on an existing document (re-analysis in the editor) recomputes.
update public.lalum_matter_documents set analysis = jsonb_build_object('risk', jsonb_build_object('red', 0, 'yellow', 0, 'green', 5, 'score', 100)) where id = pg_temp.id(1);
do $$ begin assert pg_temp.rs('c1')->>'level' = 'COMPLIANT', 'reanalysis'; end $$;

-- 7. Nothing assessed is NOT_ASSESSED, never COMPLIANT: only an opinion, or a contract with no analysis yet.
delete from public.lalum_matter_documents where matter_id = '00000000-0000-0000-0000-0000000000c1';
select pg_temp.doc(7, 'c1', 'OPINION', 1, 0, 75);
select pg_temp.doc(8, 'c1', 'CONTRACT', 0, 0, 100, false);
do $$ begin
  assert pg_temp.rs('c1')->>'level' = 'NOT_ASSESSED' and pg_temp.rs('c1')->'score' = 'null'::jsonb, 'not assessed';
end $$;

-- 8. Purging every document leaves a valid summary; the old matter is recomputed when a document moves away.
update public.lalum_matter_documents set matter_id = '00000000-0000-0000-0000-0000000000c2' where id = pg_temp.id(7);
do $$ begin assert (pg_temp.rs('c1')->>'docs_total')::int = 1 and (pg_temp.rs('c2')->>'docs_total')::int = 5, 'moved document counted on both sides'; end $$;
delete from public.lalum_matter_documents where matter_id = '00000000-0000-0000-0000-0000000000c1';
do $$ begin assert pg_temp.rs('c1')->>'level' = 'NOT_ASSESSED' and (pg_temp.rs('c1')->>'docs_total')::int = 0, 'empty matter'; end $$;

-- 9. Backfill statement shape: matters with no documents keep their summary untouched (m3 has none).
insert into public.lalum_cockpit_matters (id, firm_id, title, risk_summary) values ('00000000-0000-0000-0000-0000000000c3','00000000-0000-0000-0000-00000000000a','m3','{"level":"CAUTION"}');
update public.lalum_cockpit_matters m set risk_summary = public.lalum_matter_risk(m.id)
 where exists (select 1 from public.lalum_matter_documents d where d.matter_id = m.id);
do $$ begin assert pg_temp.rs('c3')->>'level' = 'CAUTION', 'backfill leaves matters without documents alone'; end $$;

-- 10. Not callable by signed in users directly.
do $$ begin
  assert not has_function_privilege('authenticated', 'public.lalum_matter_risk(uuid)', 'execute'), 'rollup function is internal';
  assert not has_function_privilege('anon', 'public.lalum_matter_risk_refresh()', 'execute'), 'trigger function is internal';
end $$;
rollback;
select 'matter_risk_rollup: all assertions passed' as result;
