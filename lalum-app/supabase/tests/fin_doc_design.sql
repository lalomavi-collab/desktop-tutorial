-- Tests for migration 20261029080000 (document design: brand profile and saved designs). On a scratch database prepared as in
-- docs/firm-closure.md (roles, extensions.digest), run in order: 00_supabase_stubs, 01_live_only_stubs, 03_documents_analysis_stub,
-- 04_intake_routings_stub, 08_storage_stub, 0018_lalum_firm_core_baseline, 0014_lalum_finance_ledger, 0018_lalum_finance_casual_customers,
-- 0019, 0024, 0059, 0060, 0061, 0062, 0070, 0071, 0073, 0079_lalum_bookkeeper_password_only, 20261029080000, then:
--   psql -v ON_ERROR_STOP=1 -f fin_doc_design.sql
-- Every assertion raises on failure; a clean run is the pass signal. Fixtures roll back at the end.
begin;
create schema if not exists t;
grant usage on schema t to authenticated, anon;

create or replace function t.as_user(p_uid uuid, p_claims text default '{}') returns void language plpgsql as $$
begin
  execute 'reset role';
  perform set_config('request.jwt.claim.sub', coalesce(p_uid::text, ''), true);
  perform set_config('request.jwt.claims', p_claims, true);
  execute 'set local role authenticated';
end $$;
create or replace function t.fails(p_sql text, p_expect text, p_label text) returns void language plpgsql as $$
begin
  begin execute p_sql;
  exception when others then
    if sqlerrm like '%' || p_expect || '%' then raise notice 'PASS: %', p_label; return; end if;
    raise exception 'FAIL: % (wrong error: %)', p_label, sqlerrm;
  end;
  raise exception 'FAIL: % (statement succeeded)', p_label;
end $$;
create or replace function t.eq(p_got anyelement, p_want anyelement, p_label text) returns void language plpgsql as $$
begin
  if p_got is distinct from p_want then raise exception 'FAIL: % (got %, want %)', p_label, p_got, p_want; end if;
  raise notice 'PASS: %', p_label;
end $$;
grant execute on all functions in schema t to authenticated, anon;

do $$
declare
  f1 uuid := gen_random_uuid(); f2 uuid := gen_random_uuid();
  p1 uuid := gen_random_uuid(); b1 uuid := gen_random_uuid(); p2 uuid := gen_random_uuid();
  aal2 text := '{"aal":"aal2"}';
  spec jsonb := '{"v":1,"layout":"band","palette":{"primary":"#1b1b1b"}}';
  logo text := 'data:image/png;base64,iVBORw0KGgo=';
  d1 uuid; d2 uuid;
begin
  insert into auth.users (id, email) values (p1,'p1@x'), (b1,'b1@x'), (p2,'p2@x');
  insert into public.lalum_firms (id, firm_name, registration_no, primary_contact, email, phone, monthly_fee, require_mfa) values
    (f1,'Firm One','1','x','f1@x','1',0,false), (f2,'Firm Two','2','x','f2@x','2',0,false);
  insert into public.lalum_firm_members (firm_id, user_id, name, email, role) values
    (f1,p1,'P1','p1@x','FIRM_PARTNER'), (f1,b1,'B1','b1@x','BOOKKEEPER'), (f2,p2,'P2','p2@x','FIRM_PARTNER');

  -- the partner (finance admin) sets the brand and saves two designs
  perform t.as_user(p1, aal2);
  perform public.lalum_fin_doc_brand_set(f1, logo, ' 052 ', 'a@x', null, '{"bank":"לאומי","branch":"855","account":"1"}', 'תודה');
  d1 := public.lalum_fin_doc_design_save(f1, null, 'ראשון', spec, array['INVOICE','PROFORMA']);
  d2 := public.lalum_fin_doc_design_save(f1, null, 'שני', spec, array['INVOICE']);
  perform t.eq((select default_for from public.lalum_fin_doc_designs where id = d1), array['PROFORMA']::text[], 'a type has one default: the newer design took INVOICE');
  perform t.eq((select default_for from public.lalum_fin_doc_designs where id = d2), array['INVOICE']::text[], 'and holds it');
  perform t.eq((select phone from public.lalum_fin_doc_brand where firm_id = f1), '052', 'contact lines are trimmed');
  perform public.lalum_fin_doc_design_save(f1, d1, 'ראשון מתוקן', spec, '{}');
  perform t.eq((select name from public.lalum_fin_doc_designs where id = d1), 'ראשון מתוקן', 'a design can be renamed');
  perform public.lalum_fin_doc_design_archive(d2);
  perform t.eq((select default_for from public.lalum_fin_doc_designs where id = d2), '{}'::text[], 'an archived design is nobody''s default');
  perform t.fails(format('select public.lalum_fin_doc_design_save(%L, %L, %L, %L::jsonb, null)', f1, d2, 'x', spec), 'NOT_FOUND', 'an archived design cannot be edited');
  perform t.fails(format('select public.lalum_fin_doc_design_archive(%L)', d2), 'FORBIDDEN', 'nor archived twice');

  -- what the table refuses whoever calls
  perform t.fails(format('select public.lalum_fin_doc_brand_set(%L, %L, null, null, null, null, null)', f1, 'data:text/html;base64,PHNjcmlwdD4='), 'check constraint', 'a logo that is not an image is refused');
  perform t.fails(format('select public.lalum_fin_doc_design_save(%L, null, %L, %L::jsonb, null)', f1, 'x', '{"v":2}'), 'check constraint', 'a spec of an unknown version is refused');
  perform t.fails(format('select public.lalum_fin_doc_design_save(%L, null, %L, %L::jsonb, array[%L])', f1, 'x', spec, 'QUOTE'), 'check constraint', 'a default for an unknown type is refused');
  perform t.fails(format('select public.lalum_fin_doc_design_save(%L, null, %L, %L::jsonb, null)', f1, '  ', spec), 'check constraint', 'a design needs a name');

  -- no client writes the tables directly
  perform t.fails(format('insert into public.lalum_fin_doc_designs (firm_id, name, spec) values (%L, %L, %L::jsonb)', f1, 'x', spec), 'permission denied', 'no direct insert');
  perform t.fails(format('update public.lalum_fin_doc_brand set footer_note = %L', 'x'), 'permission denied', 'no direct update');

  -- the bookkeeper reads, and cannot write
  perform t.as_user(b1, aal2);
  perform t.eq((select count(*) from public.lalum_fin_doc_designs where firm_id = f1), 2::bigint, 'the bookkeeper sees the firm''s designs');
  perform t.eq((select count(*) from public.lalum_fin_doc_brand where firm_id = f1), 1::bigint, 'and its brand');
  perform t.fails(format('select public.lalum_fin_doc_design_save(%L, null, %L, %L::jsonb, null)', f1, 'x', spec), 'FORBIDDEN', 'the bookkeeper cannot save a design');
  perform t.fails(format('select public.lalum_fin_doc_brand_set(%L, null, null, null, null, null, null)', f1), 'FORBIDDEN', 'nor set the brand');

  -- another firm sees nothing and touches nothing
  perform t.as_user(p2, aal2);
  perform t.eq((select count(*) from public.lalum_fin_doc_designs), 0::bigint, 'another firm sees no design');
  perform t.eq((select count(*) from public.lalum_fin_doc_brand), 0::bigint, 'and no brand');
  perform t.fails(format('select public.lalum_fin_doc_design_save(%L, null, %L, %L::jsonb, null)', f1, 'x', spec), 'FORBIDDEN', 'another firm cannot save into this one');
  perform t.fails(format('select public.lalum_fin_doc_design_archive(%L)', d1), 'FORBIDDEN', 'nor archive its design');

  reset role;
  perform t.eq((select count(*) from public.lalum_audit_log where action = 'FIN_DOC_DESIGN_SAVED' and firm_id = f1), 3::bigint, 'each save is in the audit chain');
  perform t.eq((select count(*) from public.lalum_audit_log where action = 'FIN_DOC_BRAND_SET' and payload ? 'logo_md5' and not payload::text like '%iVBOR%'), 1::bigint, 'the brand audit row carries the logo''s fingerprint, not the logo');
  perform t.eq((public.lalum_export_classification() -> 'included') ? 'lalum_fin_doc_designs' and (public.lalum_export_classification() -> 'included') ? 'lalum_fin_doc_brand', true, 'both tables are in the firm export');
end $$;
rollback;
