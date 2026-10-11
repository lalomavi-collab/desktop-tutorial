-- Tests for 0018 (trust ledger, disbursements, deadlines, intake gate) and 0019 (billing API).
-- Order: 00_supabase_stubs, 01_live_only_stubs, 0016, 0014, 0017, 0018, 0019, then this file.
-- Fixtures roll back at the end. Concurrency is covered separately by trust_concurrency.sh.
create schema if not exists t;
grant usage on schema t to authenticated;

create or replace function t.as_user(p_uid uuid) returns void language plpgsql as $$
begin
  execute 'reset role';
  perform set_config('request.jwt.claim.sub', coalesce(p_uid::text, ''), true);
  execute 'set local role authenticated';
end $$;
create or replace function t.as_owner() returns void language plpgsql as $$
begin
  execute 'reset role';
  perform set_config('request.jwt.claim.sub', '', true);
end $$;
create or replace function t.n(p_sql text) returns bigint language plpgsql as $$
declare v bigint; begin execute 'select count(*) from (' || p_sql || ') q' into v; return v; end $$;
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

do $$
declare
  f1 uuid := gen_random_uuid(); f2 uuid := gen_random_uuid();
  p1 uuid := gen_random_uuid(); a1 uuid := gen_random_uuid(); b1 uuid := gen_random_uuid(); p2 uuid := gen_random_uuid();
  c1 uuid := gen_random_uuid(); c2 uuid := gen_random_uuid();
  m1 uuid := gen_random_uuid(); m2 uuid := gen_random_uuid(); m3 uuid := gen_random_uuid();
  cust uuid := gen_random_uuid(); inv uuid := gen_random_uuid(); acct uuid := gen_random_uuid(); acct2 uuid := gen_random_uuid();
  e1 uuid := gen_random_uuid(); e2 uuid := gen_random_uuid(); e3 uuid := gen_random_uuid();
  dep bigint; wd bigint; r jsonb; r2 jsonb; d1 uuid; d2 uuid; sub1 uuid; sub2 uuid; ty bigint;
begin
  insert into auth.users (id, email) values (p1,'p1@x'),(a1,'a1@x'),(b1,'b1@x'),(p2,'p2@x'),(c1,'c1@x'),(c2,'c2@x');
  insert into public.lalum_firms (id, firm_name, registration_no, primary_contact, email, phone, monthly_fee)
    values (f1,'F1','1','x','f1@x','1',0),(f2,'F2','2','x','f2@x','2',0);
  insert into public.lalum_firm_members (firm_id, user_id, name, email, role) values
    (f1,p1,'P1','p1@x','FIRM_PARTNER'),(f1,a1,'A1','a1@x','ATTORNEY'),(f1,b1,'B1','b1@x','ATTORNEY'),(f2,p2,'P2','p2@x','FIRM_PARTNER');
  insert into public.lalum_cockpit_matters (id, firm_id, title) values (m1,f1,'M1'),(m2,f1,'M2'),(m3,f2,'M3');
  insert into public.lalum_matter_team (matter_id, user_id, firm_id) values (m1,a1,f1);
  insert into public.lalum_matter_client_access (matter_id, client_user_id, firm_id, access_level) values (m1,c1,f1,'READ_WRITE'),(m2,c2,f1,'READ');
  insert into public.lalum_fin_customers (id, firm_id, name) values (cust,f1,'Client One');
  insert into public.lalum_matter_fees (matter_id, firm_id, fin_customer_id, fee_model, fee_agreement_path, billing_active)
    values (m1,f1,cust,'hourly','agreements/m1.pdf',true),(m2,f1,cust,'hourly',null,false);
  insert into public.lalum_rate_cards (firm_id, member_role, hourly_rate, valid_from) values (f1,'ATTORNEY',500,current_date-365);
  insert into public.lalum_trust_accounts (id, firm_id, bank_name, branch, account_number) values (acct,f1,'Bank','100','111'),(acct2,f1,'Bank','100','222');
  insert into public.lalum_fin_documents (id, firm_id, customer_id, doc_type, status, subtotal, vat_amount, total, issue_date, due_date, doc_number)
    values (inv,f1,cust,'INVOICE','ISSUED',1000,180,1180,current_date-40,current_date-10,1);

  -- ───── trust ledger
  perform t.as_user(p1);
  dep := public.lalum_trust_post(m1, acct, 'DEPOSIT', 1000);
  perform t.eq((select receipt_no from public.lalum_trust_ledger where id = dep), 'TR-000001', 'first trust receipt number');
  perform public.lalum_trust_post(m1, acct, 'DEPOSIT', 100);
  perform t.eq((select count(distinct receipt_no) from public.lalum_trust_ledger), 2::bigint, 'receipt numbers are distinct and gapless');
  perform t.eq(public.lalum_trust_balance(m1), 1100.00, 'balance is computed from rows');
  perform t.fails(format('select public.lalum_trust_post(%L,%L,%L,1500)', m1, acct, 'DISBURSEMENT_TO_THIRD_PARTY'), 'TRUST_OVERDRAFT_MATTER', 'withdrawal beyond the matter balance is rejected');
  wd := public.lalum_trust_post(m1, acct, 'DISBURSEMENT_TO_THIRD_PARTY', 400, 'court', 'filing fee');
  perform t.eq(public.lalum_trust_balance(m1), 700.00, 'balance after a withdrawal');
  perform t.eq((select amount from public.lalum_trust_ledger where id = wd), -400.00, 'withdrawal is stored negative');
  perform t.fails('insert into public.lalum_trust_ledger (firm_id, trust_account_id, matter_id, customer_id, tx_type, amount, receipt_no) values (gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), ''DEPOSIT'', 5, ''X'')', 'permission denied', 'no direct insert into the ledger');
  perform t.fails(format('select public.lalum_trust_post(%L,%L,%L,0)', m1, acct, 'DEPOSIT'), 'BAD_AMOUNT', 'zero amount is rejected');
  perform t.fails(format('select public.lalum_trust_post(%L,%L,%L,10)', m1, acct, 'EARNED_FEE_TRANSFER'), 'BAD_TYPE', 'earned fee transfer goes through the invoice function only');
  ty := public.lalum_trust_post(m1, acct, 'REVERSAL', null, null, 'wrong payee', wd);
  perform t.eq(public.lalum_trust_balance(m1), 1100.00, 'a reversal restores the balance');
  perform t.fails(format('select public.lalum_trust_post(%L,%L,%L,null,null,null,%L)', m1, acct, 'REVERSAL', wd), 'duplicate key', 'an entry can be reversed only once');
  perform public.lalum_trust_post(m1, acct, 'DISBURSEMENT_TO_THIRD_PARTY', 1000);
  perform t.fails(format('select public.lalum_trust_post(%L,%L,%L,null,null,null,%L)', m1, acct, 'REVERSAL', dep), 'TRUST_OVERDRAFT', 'a deposit that was spent cannot be reversed');
  perform t.fails(format('select public.lalum_trust_post(%L,%L,%L,50)', m1, acct2, 'DISBURSEMENT_TO_THIRD_PARTY'), 'TRUST_OVERDRAFT_ACCOUNT', 'overdraft is also checked per trust account');
  perform t.as_owner();
  perform t.fails(format('update public.lalum_trust_ledger set notes = %L where id = %L', 'x', dep), 'TRUST_LEDGER_IMMUTABLE', 'ledger rows cannot be edited, even by the owner');
  perform t.fails(format('delete from public.lalum_trust_ledger where id = %L', dep), 'TRUST_LEDGER_IMMUTABLE', 'ledger rows cannot be deleted');
  perform t.fails('truncate public.lalum_trust_ledger', 'TRUST_LEDGER_IMMUTABLE', 'ledger cannot be truncated');

  perform t.as_user(a1);
  perform t.fails(format('select public.lalum_trust_post(%L,%L,%L,10)', m1, acct, 'DEPOSIT'), 'FORBIDDEN', 'an associate cannot post to trust');
  perform t.eq(t.n('select 1 from public.lalum_trust_ledger'), 0::bigint, 'an associate cannot read the ledger');
  perform t.eq(public.lalum_trust_balance(m1), 100.00, 'a team associate can read the balance of their matter');
  perform t.as_user(b1);
  perform t.fails(format('select public.lalum_trust_balance(%L)', m1), 'FORBIDDEN', 'a non team associate cannot read the balance');
  perform t.as_user(c1);
  perform t.eq(public.lalum_client_trust_balance(m1), 100.00, 'a client sees the balance held for them');
  perform t.fails(format('select public.lalum_client_trust_balance(%L)', m2), 'FORBIDDEN', 'a client cannot see another matter balance');
  perform t.eq(t.n('select 1 from public.lalum_trust_ledger'), 0::bigint, 'a client cannot read ledger rows');
  perform t.as_user(p2);
  perform t.fails(format('select public.lalum_trust_post(%L,%L,%L,10)', m1, acct, 'DEPOSIT'), 'FORBIDDEN', 'another firm cannot post to this matter');

  -- trust against an invoice
  perform t.as_user(p1);
  perform public.lalum_trust_post(m1, acct, 'DEPOSIT', 900);
  perform t.fails(format('select public.lalum_trust_apply_to_invoice(%L,%L,%L,5000)', m1, acct, inv), 'EXCEEDS_OPEN_AMOUNT', 'cannot settle more than the open amount');
  ty := public.lalum_trust_apply_to_invoice(m1, acct, inv, 400);
  perform t.eq(public.lalum_trust_balance(m1), 600.00, 'trust balance after paying an invoice');
  r := public.lalum_trust_apply_max(m1, acct, inv);
  perform t.eq((r->>'applied')::numeric, 600.00, 'apply max settles with what trust holds');
  r := public.lalum_partner_overview();
  perform t.eq((r->'ar_aging'->>'d1_30')::numeric, 180.00, 'AR reflects trust settlement (1180 - 1000)');
  perform t.eq((r->>'trust_liability')::numeric, 0.00, 'trust liability after settling');

  -- ───── disbursements and deadlines
  perform t.as_user(a1);
  perform t.fails(format('insert into public.lalum_disbursements (matter_id, amount, description) values (%L, 50, %L)', m1, 'courier'), 'row-level security', 'an associate cannot book disbursements');
  insert into public.lalum_deadlines (matter_id, title, kind, due_date, is_client_visible, client_display_title, client_instructions)
    values (m1, 'prep affidavit', 'INTERNAL', current_date + 5, false, null, null);
  insert into public.lalum_deadlines (matter_id, title, kind, due_date, is_client_visible, client_display_title, client_instructions)
    values (m1, 'pretrial hearing', 'HEARING', current_date + 20, true, 'דיון קדם משפט', 'להגיע 15 דקות לפני');
  perform t.fails(format('insert into public.lalum_deadlines (matter_id, title, kind, due_date, is_client_visible) values (%L, %L, %L, current_date, true)', m1, 'x', 'INTERNAL'), 'check constraint', 'an internal deadline cannot be client visible');
  perform t.fails(format('insert into public.lalum_deadlines (matter_id, title, kind, due_date) values (%L, %L, %L, current_date)', m2, 'x', 'FILING'), 'row-level security', 'cannot add deadlines outside the matter team');
  perform t.as_user(c1);
  r := public.lalum_client_deadlines(m1);
  perform t.eq(jsonb_array_length(r), 1, 'client sees only the visible deadline');
  perform t.eq(r->0->>'title', 'דיון קדם משפט', 'client sees the client facing title');
  perform t.eq(t.n('select 1 from public.lalum_deadlines'), 0::bigint, 'client cannot read the deadlines table');
  perform t.fails(format('select public.lalum_client_deadlines(%L)', m2), 'FORBIDDEN', 'client cannot read another matter deadlines');

  -- ───── intake gate
  insert into public.lalum_client_submissions (matter_id, file_name, storage_path, mime_type, file_size_bytes)
    values (m1, 'bank.pdf', 'sub/' || gen_random_uuid(), 'application/pdf', 1000) returning id into sub1;
  insert into public.lalum_client_submissions (matter_id, file_name, storage_path, mime_type, file_size_bytes)
    values (m1, 'photo.png', 'sub/' || gen_random_uuid(), 'image/png', 2000) returning id into sub2;
  perform t.fails(format('insert into public.lalum_client_submissions (matter_id, file_name, storage_path, mime_type, file_size_bytes) values (%L,%L,%L,%L,10)', m1, 'a.exe', 'sub/x1', 'application/x-msdownload'), 'check constraint', 'file type allow list');
  perform t.fails(format('insert into public.lalum_client_submissions (matter_id, file_name, storage_path, mime_type, file_size_bytes) values (%L,%L,%L,%L,99999999)', m1, 'a.pdf', 'sub/x2', 'application/pdf'), 'check constraint', 'file size limit');
  perform t.fails(format('insert into public.lalum_client_submissions (matter_id, file_name, storage_path, mime_type, file_size_bytes, status, reviewed_at) values (%L,%L,%L,%L,10,%L,now())', m1, 'a.pdf', 'sub/x3', 'application/pdf', 'approved'), 'row-level security', 'a client cannot self approve');
  perform t.fails(format('select public.lalum_submission_review(%L, %L)', sub1, 'approved'), 'FORBIDDEN', 'a client cannot review');
  perform t.as_user(c2);
  perform t.fails(format('insert into public.lalum_client_submissions (matter_id, file_name, storage_path, mime_type, file_size_bytes) values (%L,%L,%L,%L,10)', m2, 'a.pdf', 'sub/x4', 'application/pdf'), 'row-level security', 'a READ client cannot upload');
  perform t.as_user(b1);
  perform t.eq(t.n('select 1 from public.lalum_client_submissions'), 0::bigint, 'a non team associate sees no submissions');
  perform t.as_user(a1);
  perform t.eq(t.n('select 1 from public.lalum_client_submissions'), 2::bigint, 'the team sees pending submissions');
  perform t.fails(format('select public.lalum_submission_review(%L, %L)', sub2, 'rejected'), 'REASON_REQUIRED', 'rejection needs a reason');
  perform public.lalum_submission_review(sub1, 'approved');
  perform public.lalum_submission_review(sub2, 'rejected', 'unreadable scan');
  perform t.fails(format('select public.lalum_submission_review(%L, %L)', sub1, 'rejected'), 'ALREADY_REVIEWED', 'a decision is final');
  perform t.as_user(c1);
  r := public.lalum_client_submission_list(m1);
  perform t.eq(jsonb_array_length(r), 2, 'client sees their own submissions');
  perform t.eq((select e->>'rejection_reason' from jsonb_array_elements(r) e where e->>'status' = 'rejected'), 'unreadable scan', 'client sees the rejection reason');

  -- ───── billing API
  perform t.as_owner();
  insert into public.lalum_time_entries (id, firm_id, matter_id, timekeeper_id, work_date, worked_minutes, billable_minutes, narrative, status)
    values (e1,f1,m1,a1,current_date-2,60,60,'review the draft lease agreement','approved'),
           (e2,f1,m1,a1,current_date-1,30,30,'call with client about clause 7','approved');
  insert into public.lalum_disbursements (firm_id, matter_id, expense_type, amount, description) values (f1,m1,'COURT_FEE',200,'filing fee');
  perform t.as_user(p1);
  r := public.lalum_billing_unbilled_wip(m1);
  perform t.eq((r->>'billable_time_value')::numeric, 750.00, 'WIP time value = 1.5h x 500');
  perform t.eq((r->>'disbursements_total')::numeric, 200.00, 'WIP disbursements');
  r := public.lalum_billing_draft_from_wip(m1);
  d1 := (r->>'document_id')::uuid;
  perform t.eq((r->>'fees')::numeric, 750.00, 'draft fees from WIP');
  perform t.eq((select subtotal from public.lalum_fin_documents where id = d1), 950.00, 'draft subtotal = fees + disbursements');
  perform t.eq((select count(*) from public.lalum_time_entries where invoice_doc_id = d1), 2::bigint, 'entries are reserved by the draft');
  perform t.fails(format('select public.lalum_billing_draft_from_wip(%L)', m1), 'NOTHING_TO_BILL', 'reserved work cannot be drafted twice');
  perform public.lalum_fin_delete_draft(d1);
  perform t.eq((select count(*) from public.lalum_time_entries where invoice_doc_id is not null), 0::bigint, 'deleting a draft releases the reservation');
  r := public.lalum_billing_draft_from_wip(m1);
  d1 := (r->>'document_id')::uuid;
  perform t.as_owner();
  update public.lalum_fin_documents set status = 'ISSUED', doc_number = 2, issued_at = now() where id = d1;
  perform t.eq((select count(*) from public.lalum_time_entries where status = 'billed' and invoice_doc_id = d1), 2::bigint, 'issuing locks the work as billed');
  perform t.eq((select status from public.lalum_disbursements where invoice_doc_id = d1), 'BILLED', 'issuing marks disbursements billed');
  perform t.as_user(p1);
  perform t.fails(format('update public.lalum_time_entries set narrative = %L where id = %L', 'rewrite history please', e1), 'ENTRY_LOCKED', 'billed work is locked even for a partner');
  perform t.fails(format('select public.lalum_billing_draft_from_wip(%L)', m1), 'NOTHING_TO_BILL', 'billed work cannot be billed again');

  -- payments
  perform t.fails(format('select public.lalum_billing_record_payment(%L, 5000, %L)', d1, 'TRANSFER'), 'EXCEEDS_OPEN_AMOUNT', 'payment above the open amount is rejected');
  r2 := public.lalum_billing_record_payment(d1, 300, 'TRANSFER', 'ref1');
  perform t.eq(r2->>'status', 'PARTIALLY_PAID', 'partial payment status');
  perform t.eq((select actual_amount from public.lalum_cash_forecast_items where category = 'INFLOW_COLLECTIONS'), 300.00, 'payment feeds the forecast actuals');
  perform t.eq((select extract(dow from week_ending)::int from public.lalum_cash_forecast_items limit 1), 5, 'forecast weeks end on Friday');
  r2 := public.lalum_billing_record_payment(d1, (r2->>'balance_due')::numeric, 'TRANSFER');
  perform t.eq(r2->>'status', 'PAID', 'full payment closes the balance');
  perform t.as_user(a1);
  perform t.fails(format('select public.lalum_billing_record_payment(%L, 1, %L)', d1, 'CASH'), 'FORBIDDEN', 'an associate cannot record payments');
  perform t.fails(format('select public.lalum_billing_unbilled_wip(%L)', m1), 'FORBIDDEN', 'an associate cannot read WIP values');

  -- release only after a full credit
  perform t.as_user(p1);
  perform t.fails(format('select public.lalum_billing_release_wip(%L, %L)', d1, 'release'), 'INVOICE_NOT_FULLY_CREDITED', 'no release without a credit invoice');
  perform t.as_owner();
  insert into public.lalum_fin_documents (firm_id, customer_id, doc_type, status, related_doc_id, subtotal, vat_amount, total, issue_date, doc_number)
    select f1, cust, 'CREDIT', 'ISSUED', d1, subtotal, vat_amount, total, current_date, 3 from public.lalum_fin_documents where id = d1;
  perform t.as_user(p1);
  perform t.eq(public.lalum_billing_release_wip(d1, 'release'), 2, 'release returns the entries to WIP');
  perform t.eq((select count(*) from public.lalum_time_entries where status = 'approved' and invoice_doc_id is null), 2::bigint, 'released entries are billable again');

  -- guards on drafting
  perform t.fails(format('select public.lalum_billing_draft_from_wip(%L)', m2), 'BILLING_NOT_ACTIVE', 'billing needs an active fee agreement');
  perform t.as_owner();
  update public.lalum_matter_fees set fee_model = 'capped', fee_cap = 100 where matter_id = m1;
  perform t.as_user(p1);
  perform t.fails(format('select public.lalum_billing_draft_from_wip(%L)', m1), 'EXCEEDS_CAP', 'a capped matter cannot be over billed without an override');
  r := public.lalum_billing_draft_from_wip(m1, current_date, null, true);
  perform t.eq((r->>'fees')::numeric, 750.00, 'partner can override the cap');
  perform t.as_owner();
  delete from public.lalum_fin_documents where id = (r->>'document_id')::uuid;
  insert into public.lalum_time_entries (firm_id, matter_id, timekeeper_id, work_date, worked_minutes, billable_minutes, narrative, status)
    values (f1,m1,p1,current_date,60,60,'partner time with no rate card','approved');
  perform t.as_user(p1);
  perform t.fails(format('select public.lalum_billing_draft_from_wip(%L, current_date, null, true)', m1), 'ENTRIES_WITHOUT_RATE', 'entries without a rate stop the draft');

  -- timer
  perform t.as_user(a1);
  perform public.lalum_timer_start(m1, 'research');
  perform t.fails(format('select public.lalum_timer_start(%L)', m1), 'TIMER_ALREADY_RUNNING', 'one timer at a time');
  ty := 0;
  d2 := public.lalum_timer_stop('timer based entry for research');
  perform t.eq((select billable_minutes % 6 from public.lalum_time_entries where id = d2), 0, 'timer billable time is in 6 minute units');
  perform t.eq((select billable_minutes <= worked_minutes from public.lalum_time_entries where id = d2), true, 'billable never exceeds worked');
  perform t.fails('select public.lalum_timer_stop()', 'NO_RUNNING_TIMER', 'stop without a timer');

  -- charts
  perform t.as_user(p1);
  r := public.lalum_partner_charts(12);
  perform t.eq(jsonb_array_length(r->'months'), 12, 'twelve months of chart data');
  perform t.as_user(c1);
  perform t.fails('select public.lalum_partner_charts(12)', 'FORBIDDEN', 'a client cannot read firm charts');
  perform t.as_owner();
  raise exception 'ALL_PASSED_ROLLBACK';
exception when others then
  if sqlerrm = 'ALL_PASSED_ROLLBACK' then raise notice 'ALL 0018/0019 CHECKS PASSED'; else raise; end if;
end $$;
