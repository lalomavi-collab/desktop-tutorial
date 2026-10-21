-- Tests for migration 0068 (the originals of the firm export, one page at a time). Run after the stubs, 0018, 0014, 0019, 0059, 0060, 0061, 0062, 0063, 0066 and 0068:
--   psql -v ON_ERROR_STOP=1 -f firm_export_originals_page.sql
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
  f1 uuid := gen_random_uuid(); f2 uuid := gen_random_uuid(); p1 uuid := gen_random_uuid(); p2 uuid := gen_random_uuid(); att uuid := gen_random_uuid(); adm uuid := gen_random_uuid();
  mA uuid := gen_random_uuid(); mP uuid := gen_random_uuid(); aal2 text := '{"aal":"aal2"}';
  r jsonb; seen uuid[] := '{}'; cursor_ uuid; pages integer := 0; ids uuid[]; sorted uuid[]; n0 bigint;
begin
  insert into auth.users (id, email) values (p1,'p1@x'),(p2,'p2@x'),(att,'att@x'),(adm,'admin@x');
  insert into public.lalum_profiles (id, is_admin) values (adm, true);
  insert into public.lalum_firms (id, firm_name, registration_no, primary_contact, email, phone, monthly_fee, require_mfa) values
    (f1,'F1','1','x','f1@x','1',0,false),(f2,'F2','2','x','f2@x','2',0,false);
  insert into public.lalum_firm_members (firm_id, user_id, name, email, role) values (f1,p1,'P1','p1@x','FIRM_PARTNER'),(f2,p2,'P2','p2@x','FIRM_PARTNER'),(f1,att,'ATT','att@x','ATTORNEY');
  insert into public.lalum_cockpit_matters (id, firm_id, title) values (mA, f1, 'A');
  insert into public.lalum_cockpit_matters (id, firm_id, title, purged_at) values (mP, f1, 'purged', now());
  -- seven stored originals, two documents without one, one original of a purged matter, one original of another firm
  insert into public.lalum_matter_documents (matter_id, firm_id, file_name, original_path, original_sha256, original_size, original_mime)
    select mA, f1, 'd' || g || '.pdf', 'f1/d' || g, repeat('ab', 32), 100 + g, 'application/pdf' from generate_series(1, 7) g;
  insert into public.lalum_matter_documents (matter_id, firm_id, file_name) values (mA, f1, 'none1.pdf'), (mA, f1, 'none2.pdf');
  insert into public.lalum_matter_documents (matter_id, firm_id, file_name, original_path) values (mP, f1, 'purged.pdf', 'f1/purged');
  insert into public.lalum_cockpit_matters (id, firm_id, title) values (gen_random_uuid(), f2, 'other');
  insert into public.lalum_matter_documents (matter_id, firm_id, file_name, original_path) select id, f2, 'x.pdf', 'f2/x' from public.lalum_cockpit_matters where firm_id = f2;

  -- who may call
  perform t.as_user(att, aal2);
  perform t.fails(format('select public.lalum_firm_export_originals_page(%L)', f1), 'FORBIDDEN', 'an attorney cannot');
  perform t.as_user(p2, aal2);
  perform t.fails(format('select public.lalum_firm_export_originals_page(%L)', f1), 'FORBIDDEN', 'a partner of another firm cannot');
  perform t.as_user(adm, '{}');
  perform t.fails(format('select public.lalum_firm_export_originals_page(%L)', f1), 'FORBIDDEN', 'the platform admin needs a second factor session');
  perform t.as_user(null, aal2);
  perform t.fails(format('select public.lalum_firm_export_originals_page(%L)', f1), 'FORBIDDEN', 'no user cannot');
  perform t.as_user(adm, aal2);
  perform t.fails(format('select public.lalum_firm_export_originals_page(%L)', gen_random_uuid()), 'NOT_FOUND', 'an unknown firm is not found');
  reset role;
  perform t.eq((select count(*) from public.lalum_matter_audit_log where action = 'FIRM_EXPORT_ORIGINALS'), 0::bigint, 'a refused call writes nothing to the chain');

  -- walk the pages, three at a time
  perform t.as_user(p1, aal2);
  loop
    r := public.lalum_firm_export_originals_page(f1, cursor_, 3);
    pages := pages + 1;
    perform t.eq((r ->> 'total')::integer, 7, 'page ' || pages || ' reports the total of seven');
    select array_agg((e ->> 'document')::uuid order by ord) into ids from jsonb_array_elements(r -> 'originals') with ordinality x(e, ord);
    seen := seen || ids;
    exit when r -> 'next_after' = 'null'::jsonb or pages > 5;
    cursor_ := (r ->> 'next_after')::uuid;
    perform t.eq(cursor_, ids[array_upper(ids, 1)], 'the cursor is the last document of the page');
  end loop;
  perform t.eq(pages, 3, 'seven originals in pages of three make three pages');
  perform t.eq(array_length(seen, 1), 7, 'every original appears');
  perform t.eq((select count(distinct x) from unnest(seen) x), 7::bigint, 'none twice');
  select array_agg(x order by x) into sorted from unnest(seen) x;
  perform t.eq(seen, sorted, 'in document id order across pages');
  perform t.eq(jsonb_array_length(r -> 'originals'), 1, 'the last page holds the remainder');
  perform t.eq(r -> 'next_after', 'null'::jsonb, 'and has no next page');
  reset role;
  perform t.eq((select count(*) from public.lalum_matter_audit_log where action = 'FIRM_EXPORT_ORIGINALS'), 3::bigint, 'one chain row per page');
  perform t.eq((select array_agg(meta order by seq) from public.lalum_matter_audit_log where action = 'FIRM_EXPORT_ORIGINALS'), array['{"originals": 3}','{"originals": 3}','{"originals": 1}']::jsonb[], 'each row carries only the number of originals in its page');

  -- what a page holds, and does not
  perform t.as_user(p1, aal2);
  r := public.lalum_firm_export_originals_page(f1, null, 500);
  perform t.eq(jsonb_array_length(r -> 'originals'), 7, 'a page of 500 holds all seven');
  perform t.eq(r -> 'next_after', 'null'::jsonb, 'with no next page');
  perform t.eq((select count(*) from jsonb_array_elements(r -> 'originals') e where e ->> 'path' in ('f1/purged', 'f2/x')), 0::bigint, 'no original of a purged matter and none of another firm');
  perform t.eq(jsonb_array_length(public.lalum_firm_export_originals_page(f1) -> 'originals'), 7, 'the defaults give the first page of up to 500');
  perform t.eq((select e ->> 'sha256' from jsonb_array_elements(r -> 'originals') e limit 1), repeat('ab', 32), 'the recorded sha256 is returned');
  perform t.eq((select (e ->> 'size')::integer from jsonb_array_elements(r -> 'originals') e where e ->> 'path' = 'f1/d3'), 103, 'and the size');
  perform t.eq(jsonb_array_length(public.lalum_firm_export_originals_page(f1, null, 100000) -> 'originals'), 7, 'a huge limit is clamped but still returns the rows');
  perform t.eq(jsonb_array_length(public.lalum_firm_export_originals_page(f1, null, 0) -> 'originals'), 1, 'a limit of zero is clamped to one');
  perform t.eq(jsonb_array_length(public.lalum_firm_export_originals_page(f1, null, -5) -> 'originals'), 1, 'and a negative limit too');
  perform t.eq(jsonb_array_length(public.lalum_firm_export_originals_page(f1, null, null) -> 'originals'), 7, 'a null limit means the default');
  r := public.lalum_firm_export_originals_page(f1, 'ffffffff-ffff-ffff-ffff-ffffffffffff', 3);
  perform t.eq(jsonb_array_length(r -> 'originals'), 0, 'a cursor past the end gives an empty page');
  perform t.eq(r -> 'next_after', 'null'::jsonb, 'with no next page');
  perform t.eq((r ->> 'total')::integer, 7, 'and the total is still reported');

  -- a cursor in the middle still leaves a trace, so a page of paths cannot be read unseen
  reset role;
  n0 := (select count(*) from public.lalum_matter_audit_log where action = 'FIRM_EXPORT_ORIGINALS');
  perform t.as_user(adm, aal2);
  r := public.lalum_firm_export_originals_page(f1, (select (e ->> 'document')::uuid from jsonb_array_elements(public.lalum_firm_export_originals_page(f1, null, 2) -> 'originals') e limit 1), 3);
  reset role;
  perform t.eq((select count(*) from public.lalum_matter_audit_log where action = 'FIRM_EXPORT_ORIGINALS') - n0, 2::bigint, 'every call leaves a row, including one that starts from a cursor');

  -- a row added during the export does not shift the pages already read (keyset paging)
  perform t.as_user(p1, aal2);
  r := public.lalum_firm_export_originals_page(f1, null, 3);
  cursor_ := (r ->> 'next_after')::uuid;
  reset role;
  insert into public.lalum_matter_documents (matter_id, firm_id, file_name, original_path, id) values (mA, f1, 'late.pdf', 'f1/late', '00000000-0000-0000-0000-000000000001');
  perform t.as_user(p1, aal2);
  r := public.lalum_firm_export_originals_page(f1, cursor_, 3);
  perform t.eq((select count(*) from jsonb_array_elements(r -> 'originals') e where e ->> 'path' = 'f1/late'), 0::bigint, 'a document added before the cursor does not appear in the next page and does not shift it');
  perform t.eq(jsonb_array_length(r -> 'originals'), 3, 'the next page is still three');
  reset role;
  perform t.eq(has_function_privilege('anon', 'public.lalum_firm_export_originals_page(uuid,uuid,integer)', 'execute'), false, 'anon cannot execute it');
  perform t.eq(has_function_privilege('authenticated', 'public.lalum_firm_export_originals_page(uuid,uuid,integer)', 'execute'), true, 'authenticated can');
  perform t.eq(jsonb_array_length(public.lalum_firm_export_originals(f1) -> 'originals') > 0, true, 'the old function still answers');

  raise exception 'ALL_PASSED_ROLLBACK';
exception when others then
  if sqlerrm <> 'ALL_PASSED_ROLLBACK' then raise; end if;
  raise notice 'firm_export_originals_page: all assertions passed (fixtures rolled back)';
end $$;
