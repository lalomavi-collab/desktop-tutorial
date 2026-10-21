-- Tests for migration 0070 (tax retention of accounting records). Run after the stubs, 0018, 0014, 0015, 0019, 0059, 0060, 0061, 0062 and 0070:
--   psql -v ON_ERROR_STOP=1 -f tax_retention.sql
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

alter table public.lalum_matter_team add column if not exists firm_id uuid;
alter table public.lalum_matter_documents add column if not exists original_path text;

do $$
declare
  f1 uuid := gen_random_uuid(); f2 uuid := gen_random_uuid(); f3 uuid := gen_random_uuid(); p1 uuid := gen_random_uuid(); cust uuid := gen_random_uuid();
  aal2 text := '{"aal":"aal2"}'; eOld uuid := gen_random_uuid(); eNew uuid := gen_random_uuid(); eAncient uuid := gen_random_uuid(); pOld uuid := gen_random_uuid(); r jsonb;
begin
  -- the rule itself: kept through 31 December of the tax year plus 7 years
  perform t.eq(public.lalum_tax_retention_until(date '2026-10-21'), date '2033-12-31', 'a 2026 record is kept through 31 December 2033');
  perform t.eq(public.lalum_tax_retention_until(date '2026-01-01'), date '2033-12-31', 'the first day of the year gives the same end');
  perform t.eq(public.lalum_tax_retention_until(date '2025-12-31'), date '2032-12-31', 'the last day of a year gives that year');
  perform t.eq(public.lalum_tax_retention_until(date '2024-02-29'), date '2031-12-31', 'a leap day is an ordinary day of its year');

  insert into auth.users (id, email) values (p1,'p1@x');
  insert into public.lalum_firms (id, firm_name, registration_no, primary_contact, email, phone, monthly_fee, require_mfa) values
    (f1,'Firm One','1','x','f1@x','1',0,false),(f2,'Firm Two','2','x','f2@x','2',0,false),(f3,'Firm Three','3','x','f3@x','3',0,false);
  insert into public.lalum_firm_members (firm_id, user_id, name, email, role) values (f1,p1,'P1','p1@x','FIRM_PARTNER');
  insert into public.lalum_fin_customers (id, firm_id, name) values (cust, f1, 'Customer');

  -- expenses: one entered long ago for last year, one entered just now, one so old its period has ended
  insert into public.lalum_fin_expenses (id, firm_id, spent_on, supplier, total, created_at) values
    (eOld, f1, current_date - 40, 'Old supplier', 100, now() - interval '3 days'),
    (eNew, f1, current_date,      'New supplier', 50,  now()),
    (eAncient, f1, date '2010-05-05', 'Ancient supplier', 10, now() - interval '3 days');
  insert into public.lalum_fin_payments (id, firm_id, customer_id, paid_on, amount, method, created_at) values (pOld, f1, cust, current_date - 40, 70, 'CASH', now() - interval '3 days');

  -- deletion inside retention is refused, for the owner role and for a partner through the API role
  perform t.fails(format('delete from public.lalum_fin_expenses where id = %L', eOld), 'TAX_RETENTION', 'an expense in retention cannot be deleted');
  perform t.fails(format('delete from public.lalum_fin_payments where id = %L', pOld), 'TAX_RETENTION', 'a payment in retention cannot be deleted');
  perform t.as_user(p1, aal2);
  perform t.fails(format('delete from public.lalum_fin_expenses where id = %L', eOld), 'TAX_RETENTION', 'a partner cannot delete it either');
  perform t.fails(format('delete from public.lalum_fin_payments where id = %L', pOld), 'TAX_RETENTION', 'nor a payment');
  reset role;

  -- the date and the firm of a kept row cannot be moved; the amount can be corrected
  perform t.fails(format('update public.lalum_fin_expenses set spent_on = date %L where id = %L', '2001-01-01', eOld), 'TAX_RETENTION_DATE_LOCKED', 'the date of a kept expense cannot be moved out of retention');
  perform t.fails(format('update public.lalum_fin_payments set paid_on = date %L where id = %L', '2001-01-01', pOld), 'TAX_RETENTION_DATE_LOCKED', 'nor the date of a payment');
  perform t.fails(format('update public.lalum_fin_expenses set firm_id = %L where id = %L', f2, eOld), 'TAX_RETENTION_DATE_LOCKED', 'nor its firm');
  update public.lalum_fin_expenses set total = 120 where id = eOld;
  perform t.eq((select total from public.lalum_fin_expenses where id = eOld), 120::numeric, 'an amount can still be corrected');

  -- an entry from the last 24 hours can be undone, including its date
  update public.lalum_fin_expenses set spent_on = current_date - 1 where id = eNew;
  delete from public.lalum_fin_expenses where id = eNew;
  perform t.eq((select count(*) from public.lalum_fin_expenses where id = eNew), 0::bigint, 'a mistaken entry from today can be removed');

  -- past its period a record may go
  delete from public.lalum_fin_expenses where id = eAncient;
  perform t.eq((select count(*) from public.lalum_fin_expenses where id = eAncient), 0::bigint, 'a record whose period has ended can be deleted');

  -- the firm cannot be deleted while it holds records in retention, with a message that names the reason
  perform t.fails(format('delete from public.lalum_firms where id = %L', f1), 'TAX_RETENTION_FIRM', 'a firm with accounting records in retention cannot be deleted');
  perform t.eq((select count(*) from public.lalum_firms where id = f1), 1::bigint, 'and it is still there');
  delete from public.lalum_firms where id = f3;
  perform t.eq((select count(*) from public.lalum_firms where id = f3), 0::bigint, 'a firm with none can');
  insert into public.lalum_fin_archive (firm_id, i4u_doc_id, i4u_doc_type, doc_number, issue_date, raw) values (f2, 'x1', 1, 1, date '2012-01-01', '{}');
  perform t.fails(format('delete from public.lalum_firms where id = %L', f2), 'TAX_RETENTION_FIRM', 'an archive row keeps its firm, whatever its age');

  -- the checklist reports them and the latest day they must be kept
  perform t.as_user(p1, aal2);
  r := public.lalum_firm_closure_checklist(f1);
  perform t.eq((select (e ->> 'count')::int from jsonb_array_elements(r -> 'items') e where e ->> 'key' = 'accounting_records'), 2, 'the checklist counts the accounting records (one expense, one payment)');
  perform t.eq((select e ->> 'severity' from jsonb_array_elements(r -> 'items') e where e ->> 'key' = 'accounting_records'), 'INFO', 'as information, not a blocker');
  perform t.eq(r ->> 'accounting_retained_until', public.lalum_tax_retention_until(current_date - 40)::text, 'and the latest day they must be kept');
  reset role;
  raise exception 'ALL_PASSED_ROLLBACK';
exception when others then
  if sqlerrm = 'ALL_PASSED_ROLLBACK' then raise notice 'tax_retention: all assertions passed (fixtures rolled back)'; else raise; end if;
end $$;
