-- Tests for migration 0066 (firm wide export package, the database half). Run after the stubs, 0018, 0014, 0019, 0059, 0060, 0061, 0062, 0063 and 0066:
--   psql -v ON_ERROR_STOP=1 -f firm_export_package.sql
-- Stand ins for the tables no repository migration builds are created below when absent. Every assertion raises on failure. Fixtures roll back.
create schema if not exists t;
create schema if not exists lalum_private;
create table if not exists public.lalum_trust_ledger (id bigserial primary key, firm_id uuid, matter_id uuid, amount numeric);
create table if not exists public.lalum_deadlines (id uuid primary key default gen_random_uuid(), firm_id uuid, matter_id uuid, status text, due_date date);
create table if not exists public.lalum_signature_requests (id uuid primary key default gen_random_uuid(), firm_id uuid, matter_id uuid, status text);
create table if not exists public.lalum_matter_inquiries (id uuid primary key default gen_random_uuid(), firm_id uuid, status text);
create table if not exists public.lalum_matter_tasks (id uuid primary key default gen_random_uuid(), firm_id uuid, matter_id uuid, status text);
create table if not exists public.lalum_disbursements (id uuid primary key default gen_random_uuid(), firm_id uuid, status text);
create table if not exists public.lalum_invoices (id uuid primary key default gen_random_uuid(), firm_id uuid, status text, net_amount numeric, vat_amount numeric);
create table if not exists public.lalum_matter_documents (id uuid primary key default gen_random_uuid(), firm_id uuid, original_path text);
create table if not exists public.lalum_tax_connections (firm_id uuid);
create table if not exists lalum_private.firm_secrets (firm_id uuid primary key, intake_token_hash text);
alter table public.lalum_fin_documents drop constraint if exists lalum_fin_documents_status_check;
grant usage on schema t to authenticated;

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
grant execute on all functions in schema t to authenticated;
-- no blanket table grants here: the roles must have exactly what the migrations gave them


alter table public.lalum_matter_team add column if not exists firm_id uuid; -- the local stand in lacks it; the live table has it
alter table public.lalum_matter_documents add column if not exists original_path text;
alter table public.lalum_matter_documents add column if not exists original_sha256 text;
alter table public.lalum_matter_documents add column if not exists original_size bigint;
alter table public.lalum_matter_documents add column if not exists original_mime text;

do $$
declare
  f1 uuid := gen_random_uuid(); f2 uuid := gen_random_uuid(); p1 uuid := gen_random_uuid(); p2 uuid := gen_random_uuid(); att uuid := gen_random_uuid();
  adm uuid := gen_random_uuid(); mA uuid := gen_random_uuid(); mB uuid := gen_random_uuid(); mP uuid := gen_random_uuid();
  aal2 text := '{"aal":"aal2"}'; r jsonb; base jsonb; pg jsonb; sect jsonb; joined text; n0 bigint;
begin
  insert into auth.users (id, email) values (p1,'p1@x'),(p2,'p2@x'),(att,'att@x'),(adm,'admin@x');
  insert into public.lalum_profiles (id, is_admin) values (adm, true);
  insert into public.lalum_firms (id, firm_name, registration_no, primary_contact, email, phone, monthly_fee, require_mfa) values
    (f1,'Firm One','1','x','f1@x','1',0,false),(f2,'Firm Two','2','x','f2@x','2',0,false);
  insert into public.lalum_firm_members (firm_id, user_id, name, email, role) values (f1,p1,'P1','p1@x','FIRM_PARTNER'),(f2,p2,'P2','p2@x','FIRM_PARTNER'),(f1,att,'ATT','att@x','ATTORNEY');
  insert into public.lalum_cockpit_matters (id, firm_id, title) values (mA,f1,'A'),(mB,f1,'B');
  insert into public.lalum_cockpit_matters (id, firm_id, title, purged_at) values (mP,f1,'purged',now());
  insert into public.lalum_cockpit_matters (firm_id, title) values (f2,'other firm matter');
  insert into public.lalum_matter_documents (matter_id, firm_id, file_name, original_path, original_sha256, original_size, original_mime) values
    (mA,f1,'a.docx','f1/a','aa',100,'x/y'),(mA,f1,'b.docx','f1/b',null,50,'x/y'),(mB,f1,'c.docx',null,null,null,null),(mP,f1,'d.docx','f1/d','dd',999,'x/y');
  perform public.lalum_append_audit(f1, mA, null, 'MATTER_TRASHED', null, jsonb_build_object('documents', 1));

  -- who may call
  perform t.as_user(att, aal2);
  perform t.fails(format('select public.lalum_firm_export_manifest(%L)', f1), 'FORBIDDEN', 'an attorney cannot');
  perform t.as_user(p2, aal2);
  perform t.fails(format('select public.lalum_firm_export_manifest(%L)', f1), 'FORBIDDEN', 'a partner of another firm cannot');
  perform t.as_user(adm, '{}');
  perform t.fails(format('select public.lalum_firm_export_manifest(%L)', f1), 'FORBIDDEN', 'the platform admin needs a second factor session');
  perform t.as_user(null, aal2);
  perform t.fails(format('select public.lalum_firm_export_manifest(%L)', f1), 'FORBIDDEN', 'no user cannot');
  perform t.as_user(adm, aal2);
  perform t.fails(format('select public.lalum_firm_export_manifest(%L)', gen_random_uuid()), 'NOT_FOUND', 'an unknown firm is not found');
  -- the page and originals calls are gated like the manifest
  perform t.as_user(att, aal2);
  perform t.fails(format('select public.lalum_firm_export_page(%L,%L)', f1, 'lalum_cockpit_matters'), 'FORBIDDEN', 'an attorney cannot read a page');
  perform t.fails(format('select public.lalum_firm_export_originals_page(%L)', f1), 'FORBIDDEN', 'an attorney cannot list the originals');
  perform t.as_user(p2, aal2);
  perform t.fails(format('select public.lalum_firm_export_page(%L,%L)', f1, 'lalum_cockpit_matters'), 'FORBIDDEN', 'a partner of another firm cannot read a page');

  -- the manifest (partner of the firm)
  perform t.as_user(p1, aal2);
  r := public.lalum_firm_export_manifest(f1);
  perform t.eq(r ->> 'firm_status', 'ACTIVE', 'it reports the firm status');
  select e into sect from jsonb_array_elements(r -> 'sections') e where e ->> 'table' = 'lalum_cockpit_matters';
  perform t.eq((sect ->> 'rows')::integer, 3, 'the matters section counts the firm matters only (three, not the other firm)');
  select e into sect from jsonb_array_elements(r -> 'sections') e where e ->> 'table' = 'lalum_matter_documents';
  perform t.eq((sect ->> 'rows')::integer, 4, 'the documents section counts the firm documents');
  perform t.eq(sect ->> 'file', 'lalum_matter_documents.jsonl', 'and names its file');
  perform t.eq((r -> 'audit_chain' ->> 'verified')::boolean, true, 'the audit chain verifies');
  perform t.eq((r -> 'originals' ->> 'count')::integer, 2, 'originals count skips the purged matter and the documents without one');
  perform t.eq((r -> 'originals' ->> 'bytes')::integer, 150, 'and sums only those');
  perform t.eq((r -> 'originals' ->> 'without_sha256')::integer, 1, 'one original has no sha256 and is reported');
  perform t.eq(r -> 'excluded' ? 'lalum_tax_connections', true, 'the tax connections are listed as excluded with a reason');
  perform t.eq(r -> 'excluded' ? 'lalum_matter_client_access', true, 'so is the client portal access');
  -- the stand in tables of other test files may be unclassified here; the live list is checked against the real schema, not this one
  base := r -> 'unclassified';
  perform t.eq((r ->> 'complete')::boolean, jsonb_array_length(base) = 0, 'complete is true exactly when nothing is unclassified');
  reset role;
  perform t.eq((select count(*) from public.lalum_matter_audit_log where firm_id = f1 and action = 'FIRM_EXPORT_MANIFEST'), 1::bigint, 'the manifest wrote one chain row');
  perform t.eq((select array_agg(k order by k) from jsonb_object_keys((select meta from public.lalum_matter_audit_log where firm_id = f1 and action = 'FIRM_EXPORT_MANIFEST')) k), array['chain_ok','originals','rows','tables'], 'with counts only');

  -- the page: the rows joined with newlines hash to the manifest value
  perform t.as_user(p1, aal2);
  pg := public.lalum_firm_export_page(f1, 'lalum_matter_documents', 0, 2);
  perform t.eq((pg ->> 'total')::integer, 4, 'the page reports the total');
  perform t.eq(jsonb_array_length(pg -> 'rows'), 2, 'and honours the limit');
  select string_agg(v, E'\n' order by ord) into joined from (
    select x.v, x.ord from jsonb_array_elements_text(public.lalum_firm_export_page(f1, 'lalum_matter_documents', 0, 2) -> 'rows') with ordinality as x(v, ord)
    union all
    select y.v, y.ord + 2 from jsonb_array_elements_text(public.lalum_firm_export_page(f1, 'lalum_matter_documents', 2, 2) -> 'rows') with ordinality as y(v, ord)) q;
  select e into sect from jsonb_array_elements(r -> 'sections') e where e ->> 'table' = 'lalum_matter_documents';
  reset role;
  perform t.eq(encode(extensions.digest(convert_to(joined, 'UTF8'), 'sha256'), 'hex'), sect ->> 'sha256', 'the pages joined by newlines hash to the manifest sha256 (the client can verify)');
  perform t.as_user(p1, aal2);
  perform t.eq((select count(*) from jsonb_array_elements_text(public.lalum_firm_export_page(f1, 'lalum_cockpit_matters', 0, 100) -> 'rows') v where v like '%other firm matter%'), 0::bigint, 'a page never carries another firm row');
  perform t.eq(jsonb_array_length(public.lalum_firm_export_page(f1, 'lalum_cockpit_matters', 0, 100000) -> 'rows'), 3, 'a huge limit is clamped but still returns the rows');
  perform t.eq(jsonb_array_length(public.lalum_firm_export_page(f1, 'lalum_cockpit_matters', 50, 10) -> 'rows'), 0, 'an offset past the end is empty');
  perform t.fails(format('select public.lalum_firm_export_page(%L,%L)', f1, 'lalum_tax_connections'), 'TABLE_NOT_EXPORTED', 'an excluded table is refused');
  perform t.fails(format('select public.lalum_firm_export_page(%L,%L)', f1, 'lalum_firms'), 'TABLE_NOT_EXPORTED', 'a table off the list is refused');
  perform t.fails(format('select public.lalum_firm_export_page(%L,%L)', f1, 'lalum_cockpit_matters; drop table x'), 'TABLE_NOT_EXPORTED', 'a table name with SQL in it is refused');
  perform t.fails(format('select public.lalum_firm_export_page(%L,%L)', f1, null), 'TABLE_NOT_EXPORTED', 'a null table is refused');

  -- the originals list
  r := public.lalum_firm_export_originals_page(f1);
  perform t.eq(jsonb_array_length(r -> 'originals'), 2, 'the originals list has the two stored originals of live matters');
  perform t.eq((select count(*) from jsonb_array_elements(r -> 'originals') e where e ->> 'path' = 'f1/d'), 0::bigint, 'and not the one of the purged matter');
  reset role;
  perform t.eq((select meta from public.lalum_matter_audit_log where firm_id = f1 and action = 'FIRM_EXPORT_ORIGINALS'), jsonb_build_object('originals', 2), 'the originals page call wrote one chain row with the count');

  -- drift guard: a table added later and not classified shows up
  create table public.lalum_zz_new_table (firm_id uuid);
  perform t.as_user(p1, aal2);
  r := public.lalum_firm_export_manifest(f1);
  perform t.eq((r -> 'unclassified') ? 'lalum_zz_new_table', true, 'a new table with a firm_id is reported as unclassified');
  perform t.eq(jsonb_array_length(r -> 'unclassified'), jsonb_array_length(base) + 1, 'and it is the only addition');
  perform t.eq((r ->> 'complete')::boolean, false, 'and the package is not complete');
  reset role;

  -- a listed table that lost its firm_id is an error, not an empty file
  alter table public.lalum_matter_team rename column firm_id to firm_id_gone;
  perform t.as_user(p1, aal2);
  perform t.fails(format('select public.lalum_firm_export_manifest(%L)', f1), 'TABLE_HAS_NO_FIRM_ID', 'a listed table without firm_id fails loudly');
  reset role;
  alter table public.lalum_matter_team rename column firm_id_gone to firm_id;

  -- a closed firm can still export (the handover is the point)
  update public.lalum_firms set status = 'CANCELED' where id = f1;
  perform t.as_user(adm, aal2);
  r := public.lalum_firm_export_manifest(f1);
  perform t.eq(r ->> 'firm_status', 'CANCELED', 'a CANCELED firm can still be exported');
  reset role;
  perform t.eq(has_function_privilege('anon', 'public.lalum_firm_export_manifest(uuid)', 'execute'), false, 'anon cannot execute the manifest');
  perform t.eq(has_function_privilege('authenticated', 'public.lalum_export_allowed(uuid)', 'execute'), false, 'the internal gate is not callable');
  perform t.eq(has_function_privilege('authenticated', 'public.lalum_export_classification()', 'execute'), false, 'nor the classification');

  raise exception 'ALL_PASSED_ROLLBACK';
exception when others then
  if sqlerrm <> 'ALL_PASSED_ROLLBACK' then raise; end if;
  raise notice 'firm_export_package: all assertions passed (fixtures rolled back)';
end $$;
