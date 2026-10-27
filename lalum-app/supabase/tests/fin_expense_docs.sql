-- Tests for migration 20261027100000 (source documents behind an expense). On a scratch database with a service_role role and the
-- extensions.digest wrapper (docs/firm-closure.md), run in order: 00_supabase_stubs, 01_live_only_stubs, 03_documents_analysis_stub,
-- 04_intake_routings_stub, 08_storage_stub, 0018_lalum_firm_core_baseline, 0014_lalum_finance_ledger, 0018_lalum_finance_casual_customers,
-- 0019, 0024, 0059, 0060, 0061, 0062, 0070, 0071, 0073, 0079_lalum_bookkeeper_password_only, 20261027100000, then:
--   psql -v ON_ERROR_STOP=1 -f fin_expense_docs.sql
-- Every assertion raises on failure; a clean run is the pass signal. Fixtures roll back at the end.
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
  e1 uuid := gen_random_uuid(); e2 uuid := gen_random_uuid(); eAncient uuid := gen_random_uuid();
  h1 text := encode(digest('invoice one', 'sha256'), 'hex'); h2 text := encode(digest('invoice two', 'sha256'), 'hex');
  aal2 text := '{"aal":"aal2"}'; path1 text; path2 text; r jsonb; d1 uuid; d2 uuid; dOther uuid; n bigint;
begin
  insert into auth.users (id, email) values (p1,'p1@x'), (b1,'b1@x'), (p2,'p2@x');
  insert into public.lalum_firms (id, firm_name, registration_no, primary_contact, email, phone, monthly_fee, require_mfa) values
    (f1,'Firm One','1','x','f1@x','1',0,false), (f2,'Firm Two','2','x','f2@x','2',0,false);
  insert into public.lalum_firm_members (firm_id, user_id, name, email, role) values
    (f1,p1,'P1','p1@x','FIRM_PARTNER'), (f1,b1,'B1','b1@x','BOOKKEEPER'), (f2,p2,'P2','p2@x','FIRM_PARTNER');
  insert into public.lalum_fin_expenses (id, firm_id, spent_on, supplier, total, vat_amount, created_at) values
    (e1, f1, current_date - 40, 'Supplier', 100, 18, now() - interval '3 days'),
    (e2, f1, current_date, 'Supplier', 100, 18, now()),
    (eAncient, f1, make_date(extract(year from current_date)::int - 9, 6, 1), 'Supplier', 10, 0, now() - interval '9 years');
  path1 := f1::text || '/' || e1::text || '/' || h1 || '.pdf';
  path2 := f1::text || '/' || e1::text || '/' || h2 || '.pdf';
  insert into storage.objects (bucket_id, name, metadata) values
    ('finance-expense-docs', path1, '{"size": 1000}'), ('finance-expense-docs', path2, '{"size": 2000}'),
    ('finance-expense-docs', f1::text || '/' || e2::text || '/' || h1 || '.pdf', '{"size": 1000}'),
    ('finance-expense-docs', f1::text || '/' || eAncient::text || '/' || h1 || '.pdf', '{"size": 1000}');

  perform t.eq((select public from storage.buckets where id = 'finance-expense-docs'), false, 'the bucket is private');

  -- a partner attaches: one row, the actor, one audit row
  perform t.as_user(p1, aal2);
  r := public.lalum_fin_expense_doc_attach(e1, path1, h1, 'application/pdf', 1000);
  d1 := (r ->> 'id')::uuid;
  perform t.eq((r ->> 'duplicate')::boolean, false, 'a first attachment is not a duplicate');
  perform t.eq((r ->> 'same_file_elsewhere')::int, 0, 'and the file is nowhere else');
  perform t.eq((select uploaded_by from public.lalum_fin_expense_docs where id = d1), p1, 'the row records who attached it');
  -- the same file again: the same row, no second audit row
  r := public.lalum_fin_expense_doc_attach(e1, path1, h1, 'application/pdf', 1000);
  perform t.eq((r ->> 'id')::uuid, d1, 'the same file twice is the same row');
  perform t.eq((r ->> 'duplicate')::boolean, true, 'and is reported as a duplicate');
  reset role;
  perform t.eq((select count(*) from public.lalum_fin_expense_docs where expense_id = e1), 1::bigint, 'one row for one file');
  perform t.eq((select count(*) from public.lalum_audit_log where action = 'FIN_EXPENSE_DOC_ATTACHED' and entity_id = d1::text), 1::bigint, 'one audit row for one attachment');
  perform t.eq((select actor_id from public.lalum_audit_log where action = 'FIN_EXPENSE_DOC_ATTACHED' and entity_id = d1::text), p1, 'the audit row names the actor');

  -- what the database refuses: the path the content does not dictate, a bad hash or type, an object that is not there or not that size
  perform t.as_user(p1, aal2);
  perform t.fails(format('select public.lalum_fin_expense_doc_attach(%L, %L, %L, ''application/pdf'', 1000)', e1, f2::text || '/' || e1::text || '/' || h1 || '.pdf', h1), 'BAD_PATH', 'a path under another firm is refused');
  perform t.fails(format('select public.lalum_fin_expense_doc_attach(%L, %L, %L, ''application/pdf'', 1000)', e1, path1, 'ABC'), 'BAD_HASH', 'a malformed hash is refused');
  perform t.fails(format('select public.lalum_fin_expense_doc_attach(%L, %L, %L, ''text/html'', 1000)', e1, path1, h1), 'BAD_TYPE', 'a type outside the list is refused');
  perform t.fails(format('select public.lalum_fin_expense_doc_attach(%L, %L, %L, ''image/png'', 1000)', e1, f1::text || '/' || e1::text || '/' || h1 || '.png', h1), 'OBJECT_MISSING', 'an object that is not in the bucket is refused');
  perform t.fails(format('select public.lalum_fin_expense_doc_attach(%L, %L, %L, ''application/pdf'', 999)', e1, path1, h1), 'OBJECT_MISSING', 'an object of another size is refused');

  -- a replacement keeps the earlier row, marked once
  r := public.lalum_fin_expense_doc_attach(e1, path2, h2, 'application/pdf', 2000, d1);
  d2 := (r ->> 'id')::uuid;
  perform t.eq((select superseded_by from public.lalum_fin_expense_docs where id = d1), d2, 'the earlier document is marked as replaced by the new one');
  perform t.eq((select superseded_at is not null from public.lalum_fin_expense_docs where id = d1), true, 'with a time');
  perform t.eq((select count(*) from public.lalum_fin_expense_docs where expense_id = e1), 2::bigint, 'and both rows stay');
  perform t.fails(format('select public.lalum_fin_expense_doc_attach(%L, %L, %L, ''application/pdf'', 2000, %L)', e1, path2, h2, d1), 'ALREADY_SUPERSEDED', 'a replaced document cannot be replaced again');
  -- the same invoice behind a second expense is reported, and it cannot replace a document of another expense
  r := public.lalum_fin_expense_doc_attach(e2, f1::text || '/' || e2::text || '/' || h1 || '.pdf', h1, 'application/pdf', 1000);
  dOther := (r ->> 'id')::uuid;
  perform t.eq((r ->> 'same_file_elsewhere')::int, 1, 'the same file behind another expense is reported');
  perform t.fails(format('select public.lalum_fin_expense_doc_attach(%L, %L, %L, ''application/pdf'', 2000, %L)', e1, path2, h2, dOther), 'BAD_SUPERSEDES', 'a document of another expense cannot be superseded from this one');

  -- the browser reads the table at level 1 and writes it at no level
  perform t.fails(format('insert into public.lalum_fin_expense_docs (firm_id, expense_id, path, sha256, mime, size_bytes) values (%L, %L, ''x'', %L, ''application/pdf'', 1)', f1, e1, h1), 'permission denied', 'no direct insert');
  perform t.fails(format('update public.lalum_fin_expense_docs set superseded_at = null where id = %L', d1), 'permission denied', 'no direct update');
  perform t.fails(format('delete from public.lalum_fin_expense_docs where id = %L', d1), 'permission denied', 'no direct delete');

  -- the bookkeeper sees and opens, and cannot attach
  perform t.as_user(b1);
  perform t.eq((select count(*) from public.lalum_fin_expense_docs), 3::bigint, 'the bookkeeper sees the firm''s documents');
  perform t.eq((public.lalum_fin_expense_doc_open(d1) ->> 'path'), path1, 'and can open a replaced one too');
  perform t.fails(format('select public.lalum_fin_expense_doc_attach(%L, %L, %L, ''application/pdf'', 1000)', e1, path1, h1), 'FORBIDDEN', 'but cannot attach');
  reset role;
  perform t.eq((select actor_id from public.lalum_audit_log where action = 'FIN_EXPENSE_DOC_VIEWED' and entity_id = d1::text), b1, 'opening a document is audited with the reader');

  -- another firm sees nothing and can do nothing, with the same answer whether the expense exists or not
  perform t.as_user(p2, aal2);
  perform t.eq((select count(*) from public.lalum_fin_expense_docs), 0::bigint, 'another firm sees no rows');
  perform t.fails(format('select public.lalum_fin_expense_doc_open(%L)', d1), 'FORBIDDEN', 'another firm cannot open');
  perform t.fails(format('select public.lalum_fin_expense_doc_attach(%L, %L, %L, ''application/pdf'', 1000)', e1, path1, h1), 'FORBIDDEN', 'another firm cannot attach');
  perform t.fails(format('select public.lalum_fin_expense_doc_attach(%L, %L, %L, ''application/pdf'', 1000)', gen_random_uuid(), path1, h1), 'FORBIDDEN', 'an unknown expense gets the same refusal');
  -- no session at all
  execute 'reset role';
  perform set_config('request.jwt.claim.sub', '', true);
  execute 'set local role anon';
  perform t.fails(format('select public.lalum_fin_expense_doc_open(%L)', d1), 'permission denied', 'anon cannot call the functions');
  reset role;

  -- even the owner role: no deletion in retention, no edits but the one supersession
  perform t.fails(format('delete from public.lalum_fin_expense_docs where id = %L', d1), 'TAX_RETENTION', 'a document in retention cannot be deleted');
  perform t.fails(format('update public.lalum_fin_expense_docs set path = ''x'' where id = %L', d2), 'EXPENSE_DOC_IMMUTABLE', 'its fields cannot change');
  perform t.fails(format('update public.lalum_fin_expense_docs set superseded_at = null, superseded_by = null where id = %L', d1), 'EXPENSE_DOC_IMMUTABLE', 'a replacement cannot be undone');
  -- an expense with a document cannot be deleted, even in its undo window
  perform t.as_user(p1, aal2);
  perform t.fails(format('delete from public.lalum_fin_expenses where id = %L', e2), 'foreign key', 'an expense with a document cannot be deleted');
  reset role;
  -- past the retention period a document can go
  insert into public.lalum_fin_expense_docs (firm_id, expense_id, path, sha256, mime, size_bytes) values (f1, eAncient, f1::text || '/' || eAncient::text || '/' || h1 || '.pdf', h1, 'application/pdf', 1000);
  delete from public.lalum_fin_expense_docs where expense_id = eAncient;
  get diagnostics n = row_count;
  perform t.eq(n, 1::bigint, 'after the retention period the document can be removed');

  -- the firm export knows the new table and the five that were missing
  perform t.eq((select count(*) from jsonb_array_elements_text(public.lalum_export_classification() -> 'included') x
                 where x in ('lalum_fin_expense_docs','lalum_fin_bank_accounts','lalum_fin_bank_lines','lalum_fin_recon_matches','lalum_fin_revenue_class','lalum_fin_tax_settings')), 6::bigint,
               'all six tables are classified for the firm export');
  raise exception 'ALL_PASSED_ROLLBACK';
exception when others then
  if sqlerrm = 'ALL_PASSED_ROLLBACK' then raise notice 'fin_expense_docs: all assertions passed (fixtures rolled back)'; else raise; end if;
end $$;
