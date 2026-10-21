-- Tests for migration 0062 (firm closure checklist). Run after the stubs, 0018, 0014, 0019 and 0062:
--   psql -v ON_ERROR_STOP=1 -f firm_closure_checklist.sql
-- The tables the checklist reads that no repository migration builds (trust ledger, deadlines, signature requests,
-- inquiries, tasks, disbursements, platform invoices, matter documents, tax connections, firm secrets) get a minimal
-- stand in below when absent, so this runs on the repository's stub schema. Every assertion raises on failure. Fixtures roll back.
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
-- 0014 (the only finance migration this stub schema loads) predates the sealing statuses SEALING, ALLOCATED and SEALED that the live
-- project allows, so the local status check is dropped for this test. It changes nothing in a real database.
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

create or replace function t.item(p_r jsonb, p_key text, p_field text default 'count') returns integer language sql as $$
  select (x ->> p_field)::numeric::integer from jsonb_array_elements(p_r -> 'items') x where x ->> 'key' = p_key $$;

grant execute on all functions in schema t to authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant usage on all sequences in schema public to authenticated;

do $$
declare
  f1 uuid := gen_random_uuid(); f2 uuid := gen_random_uuid(); fe uuid := gen_random_uuid();
  p1 uuid := gen_random_uuid(); a1 uuid := gen_random_uuid(); p2 uuid := gen_random_uuid(); pe uuid := gen_random_uuid(); adm uuid := gen_random_uuid();
  m1 uuid := gen_random_uuid(); m2 uuid := gen_random_uuid(); m3 uuid := gen_random_uuid(); m4 uuid := gen_random_uuid();
  cust uuid := gen_random_uuid(); r jsonb; n_before bigint; n_after bigint;
begin
  insert into auth.users (id, email) values (p1,'p1@x'),(a1,'a1@x'),(p2,'p2@x'),(pe,'pe@x'),(adm,'admin@x');
  insert into public.lalum_profiles (id, is_admin) values (adm, true);
  insert into public.lalum_firms (id, firm_name, registration_no, primary_contact, email, phone, monthly_fee, require_mfa)
    values (f1,'F1','1','x','f1@x','1',0,false),(f2,'F2','2','x','f2@x','2',0,false),(fe,'Empty','3','x','fe@x','3',0,false);
  insert into public.lalum_firm_members (firm_id, user_id, name, email, role) values
    (f1,p1,'P1','p1@x','FIRM_PARTNER'),(f1,a1,'A1','a1@x','ATTORNEY'),(f2,p2,'P2','p2@x','FIRM_PARTNER'),(fe,pe,'PE','pe@x','FIRM_PARTNER');
  -- firm 1: four live matters, one in the bin, one with a legal hold, none with a retention clock
  insert into public.lalum_cockpit_matters (id, firm_id, title, legal_hold, deleted_at) values
    (m1,f1,'M1',true,null),(m2,f1,'M2',false,null),(m3,f1,'M3',false,null),(m4,f1,'M4 in bin',false,now());
  insert into public.lalum_cockpit_matters (firm_id, title, purged_at) values (f1,'purged one',now());
  -- client money: m1 holds 100 (blocker), m2 nets to zero (not a blocker)
  insert into public.lalum_trust_ledger (firm_id, matter_id, amount) values (f1,m1,100),(f1,m2,500),(f1,m2,-500);
  insert into public.lalum_deadlines (firm_id, matter_id, status, due_date) values
    (f1,m2,'PENDING',current_date+10),(f1,m2,'PENDING',current_date+90),(f1,m2,'DONE',current_date-5);
  insert into public.lalum_signature_requests (firm_id, matter_id, status) values (f1,m2,'SENT'),(f1,m2,'VIEWED'),(f1,m2,'SIGNED'),(f1,m2,'DRAFT');
  insert into public.lalum_fin_customers (id, firm_id, name) values (cust,f1,'C');
  insert into public.lalum_fin_documents (firm_id, customer_id, doc_type, status, subtotal, vat_amount, total, issue_date, due_date, doc_number)
    values (f1,cust,'INVOICE','SEALING',100,18,118,current_date,current_date,1),(f1,cust,'INVOICE','DRAFT',50,9,59,current_date,null,null),(f1,cust,'INVOICE','SEALED',70,12,82,current_date,current_date,2);
  insert into public.lalum_matter_tasks (firm_id, matter_id, status) values (f1,m2,'OPEN'),(f1,m2,'DONE');
  insert into public.lalum_matter_inquiries (firm_id, status) values (f1,'NEW'),(f1,'SEEN'),(f1,'HANDLED');
  insert into public.lalum_time_entries (firm_id, matter_id, timekeeper_id, worked_minutes, billable_minutes, narrative, status)
    values (f1,m2,a1,60,60,'review of the draft agreement','submitted'),(f1,m2,a1,30,30,'','draft'),(f1,m2,a1,30,30,'billed work item','written_off');
  insert into public.lalum_disbursements (firm_id, status) values (f1,'UNBILLED'),(f1,'BILLED');
  insert into public.lalum_invoices (firm_id, status, net_amount, vat_amount) values (f1,'ISSUED',1000,180),(f1,'PAID',500,90);
  insert into public.lalum_matter_documents (firm_id, original_path) values (f1,'a/b.pdf'),(f1,'a/c.pdf'),(f1,null);
  insert into public.lalum_tax_connections (firm_id) values (f1);
  insert into lalum_private.firm_secrets (firm_id, intake_token_hash) values (f1,'x');

  -- who may call it
  perform t.as_user(a1);
  perform t.fails(format('select public.lalum_firm_closure_checklist(%L)', f1), 'FORBIDDEN', 'an attorney cannot call it');
  perform t.as_user(p2);
  perform t.fails(format('select public.lalum_firm_closure_checklist(%L)', f1), 'FORBIDDEN', 'a partner of another firm cannot call it');
  perform t.as_user(null);
  perform t.fails(format('select public.lalum_firm_closure_checklist(%L)', f1), 'FORBIDDEN', 'no user cannot call it');
  perform t.as_user(adm, '{"email":"admin@x"}');
  perform t.fails(format('select public.lalum_firm_closure_checklist(%L)', f1), 'FORBIDDEN', 'the platform admin needs a second factor session');
  perform t.as_user(adm, '{"aal":"aal2"}');
  r := public.lalum_firm_closure_checklist(f1);
  perform t.eq(r ->> 'firm_status', 'ACTIVE', 'the platform admin with a second factor can read any firm');

  -- a firm with blockers
  perform t.as_user(p1);
  r := public.lalum_firm_closure_checklist(f1);
  perform t.eq((r ->> 'can_begin_closing')::boolean, false, 'blockers mean closing cannot begin');
  perform t.eq((r ->> 'blockers')::integer, 5, 'five blocker kinds are present');
  perform t.eq(t.item(r, 'trust_balance_nonzero'), 1, 'one matter holds client money (a matter netting to zero is not counted)');
  perform t.eq(t.item(r, 'trust_balance_nonzero', 'amount'), 100, 'the amount held is reported');
  perform t.eq(t.item(r, 'legal_hold_active'), 1, 'a legal hold is a blocker');
  perform t.eq(t.item(r, 'deadlines_pending'), 2, 'pending deadlines are counted, done ones are not');
  perform t.eq(t.item(r, 'deadlines_pending', 'amount'), 1, 'and those within 30 days are called out');
  perform t.eq(t.item(r, 'signatures_in_flight'), 2, 'sent and viewed signature requests are in flight');
  perform t.eq(t.item(r, 'fin_documents_mid_issuance'), 1, 'a tax document mid issuance is a blocker');
  perform t.eq(t.item(r, 'fin_documents_draft'), 1, 'drafts are a warning');
  perform t.eq(t.item(r, 'signature_drafts'), 1, 'signature drafts are a warning');
  perform t.eq(t.item(r, 'tasks_open'), 1, 'open tasks are counted');
  perform t.eq(t.item(r, 'inquiries_unhandled'), 2, 'new and seen inquiries are unhandled');
  perform t.eq(t.item(r, 'unbilled_time_entries'), 2, 'draft and submitted time is unbilled, written off is not');
  perform t.eq(t.item(r, 'unbilled_time_entries', 'amount'), 90, 'with its billable minutes');
  perform t.eq(t.item(r, 'unbilled_disbursements'), 1, 'unbilled disbursements are counted');
  perform t.eq(t.item(r, 'platform_invoices_unpaid'), 1, 'one platform invoice is unpaid');
  perform t.eq(t.item(r, 'platform_invoices_unpaid', 'amount'), 1180, 'with its gross amount');
  perform t.eq(t.item(r, 'matters_live'), 3, 'live matters exclude the bin and the purged');
  perform t.eq(t.item(r, 'matters_in_bin'), 1, 'one matter is in the bin');
  perform t.eq(t.item(r, 'matters_without_retention_clock'), 4, 'every unpurged matter lacks a retention clock');
  perform t.eq(t.item(r, 'originals_in_storage'), 2, 'originals in storage are counted');
  perform t.eq(t.item(r, 'members'), 2, 'members are counted');
  perform t.eq(t.item(r, 'tax_connections'), 1, 'tax connections are counted');
  perform t.eq(t.item(r, 'intake_token_set'), 1, 'the intake token is reported as set');

  -- what it returns: counts and amounts only
  perform t.eq((select bool_and(x ?& array['key','severity','count','amount'] and (select count(*) from jsonb_object_keys(x)) = 4) from jsonb_array_elements(r -> 'items') x), true, 'every item is exactly key, severity, count, amount');
  perform t.eq(r::text ~* 'P1|F1|M1|a/b', false, 'no name, title or path appears in the result');

  -- a clean firm
  perform t.as_user(pe);
  r := public.lalum_firm_closure_checklist(fe);
  perform t.eq((r ->> 'can_begin_closing')::boolean, true, 'a firm with nothing in the way can begin closing');
  perform t.eq((r ->> 'blockers')::integer, 0, 'with no blockers');
  perform t.eq((r ->> 'warnings')::integer, 0, 'and no warnings');

  -- it reads, and writes only its audit row
  reset role;
  select count(*) into n_before from public.lalum_cockpit_matters;
  perform t.as_user(p1);
  perform public.lalum_firm_closure_checklist(f1);
  reset role;
  select count(*) into n_after from public.lalum_cockpit_matters;
  perform t.eq(n_after, n_before, 'it changes no matter');
  perform t.eq((select status from public.lalum_firms where id = f1), 'ACTIVE', 'it does not change the firm status');
  perform t.eq((select count(*) from public.lalum_audit_log where entity = 'closure_checklist' and firm_id = f1) >= 3, true, 'each call is written to the audit log');
  perform t.as_user(p1);
  perform t.fails(format('select public.lalum_firm_closure_checklist(%L)', gen_random_uuid()), 'FORBIDDEN', 'an unknown firm is refused to a firm partner');
  perform t.as_user(adm, '{"aal":"aal2"}');
  perform t.fails(format('select public.lalum_firm_closure_checklist(%L)', gen_random_uuid()), 'NOT_FOUND', 'an unknown firm is not found for the platform admin');

  reset role;
  raise notice 'ALL FIRM CLOSURE CHECKLIST CHECKS PASSED';
  raise exception 'ROLLBACK_FIXTURES';
exception when others then
  if sqlerrm = 'ROLLBACK_FIXTURES' then raise notice 'rolled back fixtures'; else raise; end if;
end $$;
