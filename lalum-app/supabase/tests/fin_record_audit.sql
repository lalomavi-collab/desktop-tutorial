-- Tests for migration 0071 (audit of corrections to payments and expenses). Run after the stubs, 0018, 0014, 0019, 0059, 0060, 0061, 0062, 0070 and 0071:
--   psql -v ON_ERROR_STOP=1 -f fin_record_audit.sql
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
  f1 uuid := gen_random_uuid(); p1 uuid := gen_random_uuid(); cust uuid := gen_random_uuid(); cust2 uuid := gen_random_uuid();
  eOld uuid := gen_random_uuid(); eNew uuid := gen_random_uuid(); pOld uuid := gen_random_uuid(); aal2 text := '{"aal":"aal2"}'; pl jsonb;
begin
  insert into auth.users (id, email) values (p1,'p1@x');
  insert into public.lalum_firms (id, firm_name, registration_no, primary_contact, email, phone, monthly_fee, require_mfa) values (f1,'Firm One','1','x','f1@x','1',0,false);
  insert into public.lalum_firm_members (firm_id, user_id, name, email, role) values (f1,p1,'P1','p1@x','FIRM_PARTNER');
  insert into public.lalum_fin_customers (id, firm_id, name) values (cust, f1, 'Customer'), (cust2, f1, 'Customer Two');
  insert into public.lalum_fin_expenses (id, firm_id, spent_on, supplier, description, total, vat_amount, created_at) values
    (eOld, f1, current_date - 40, 'Secret Supplier Ltd', 'secret description', 100, 18, now() - interval '3 days'),
    (eNew, f1, current_date, 'Fresh Supplier', 'fresh', 50, 9, now());
  insert into public.lalum_fin_payments (id, firm_id, customer_id, paid_on, amount, method, reference, notes, created_at) values
    (pOld, f1, cust, current_date - 40, 70, 'CASH', 'ref-secret', 'notes-secret', now() - interval '3 days');
  perform t.eq((select count(*) from public.lalum_audit_log where entity_id in (eOld::text, eNew::text, pOld::text)), 0::bigint, 'inserting writes no correction row');

  -- an amount correction through the API role: old and new value, the actor, not in the undo window
  perform t.as_user(p1, aal2);
  update public.lalum_fin_expenses set total = 120, vat_amount = 21 where id = eOld;
  reset role;
  select payload into pl from public.lalum_audit_log where entity_id = eOld::text and action = 'FIN_RECORD_CORRECTED';
  perform t.eq(pl #>> '{changes,total,from}', '100.00', 'the old total is recorded');
  perform t.eq(pl #>> '{changes,total,to}', '120.00', 'and the new one');
  perform t.eq(pl #>> '{changes,vat_amount,to}', '21.00', 'VAT too');
  perform t.eq((pl -> 'changes') ? 'category', false, 'unchanged fields are not listed');
  perform t.eq((pl ->> 'within_undo_window')::boolean, false, 'an old row is outside the undo window');
  perform t.eq((select actor_id from public.lalum_audit_log where entity_id = eOld::text and action = 'FIN_RECORD_CORRECTED'), p1, 'the actor is the signed in user');

  -- free text: only the name of the field, never the content
  update public.lalum_fin_expenses set supplier = 'Another Name', description = 'another text' where id = eOld;
  perform t.eq((select payload -> 'text_changed' from public.lalum_audit_log where entity_id = eOld::text and action = 'FIN_RECORD_CORRECTED' order by id desc limit 1), '["supplier","description"]'::jsonb, 'text changes list the field names');
  perform t.eq((select count(*) from public.lalum_audit_log where payload::text ~ '(Secret Supplier|secret description|Another Name|another text|ref-secret|notes-secret)'), 0::bigint, 'no free text reaches the audit log');

  -- an update that changes nothing material writes nothing
  update public.lalum_fin_expenses set total = total where id = eOld;
  perform t.eq((select count(*) from public.lalum_audit_log where entity_id = eOld::text and action = 'FIN_RECORD_CORRECTED'), 2::bigint, 'a touch only writes no row');

  -- payments: amount, method, customer
  update public.lalum_fin_payments set amount = 75, method = 'CARD', customer_id = cust2, reference = 'x' where id = pOld;
  select payload into pl from public.lalum_audit_log where entity_id = pOld::text and action = 'FIN_RECORD_CORRECTED';
  perform t.eq(pl #>> '{changes,amount,from}', '70.00', 'a payment amount correction is recorded');
  perform t.eq(pl #>> '{changes,method,to}', 'CARD', 'and the method');
  perform t.eq(pl #>> '{changes,customer_id,to}', cust2::text, 'and the customer id');
  perform t.eq(pl -> 'text_changed', '["reference"]'::jsonb, 'and that the reference changed, not what it says');

  -- deletion inside the undo window is allowed and recorded with its values
  delete from public.lalum_fin_expenses where id = eNew;
  select payload into pl from public.lalum_audit_log where entity_id = eNew::text and action = 'FIN_RECORD_DELETED';
  perform t.eq(pl #>> '{values,total}', '50.00', 'a deletion records the amount');
  perform t.eq((pl ->> 'within_undo_window')::boolean, true, 'and that it was inside the undo window');
  perform t.eq(pl::text like '%Fresh Supplier%', false, 'without the free text');

  -- a refused deletion (0070) leaves no row
  perform t.fails(format('delete from public.lalum_fin_payments where id = %L', pOld), 'TAX_RETENTION', 'a deletion in retention is still refused');
  perform t.eq((select count(*) from public.lalum_audit_log where entity_id = pOld::text and action = 'FIN_RECORD_DELETED'), 0::bigint, 'and a refused deletion writes no deleted row');

  -- the log cannot be rewritten
  perform t.fails('update public.lalum_audit_log set action = ''X'' where action = ''FIN_RECORD_CORRECTED''', 'AUDIT_LOG_IMMUTABLE', 'the log is immutable');
  perform t.fails('delete from public.lalum_audit_log where action = ''FIN_RECORD_CORRECTED''', 'AUDIT_LOG_IMMUTABLE', 'and cannot be emptied');
  raise exception 'ALL_PASSED_ROLLBACK';
exception when others then
  if sqlerrm = 'ALL_PASSED_ROLLBACK' then raise notice 'fin_record_audit: all assertions passed (fixtures rolled back)'; else raise; end if;
end $$;
