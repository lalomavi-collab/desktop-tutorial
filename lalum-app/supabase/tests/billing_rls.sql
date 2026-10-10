-- RLS and function tests for migration 0019. Run after 00_supabase_stubs.sql, 0018, 0014, 0019:
--   psql -v ON_ERROR_STOP=1 -f billing_rls.sql
-- Every assertion raises on failure, so a clean run is the pass signal.
create schema if not exists t;
grant usage on schema t to authenticated;

create or replace function t.as_user(p_uid uuid) returns void language plpgsql as $$
begin
  execute 'reset role';
  perform set_config('request.jwt.claim.sub', coalesce(p_uid::text, ''), true);
  execute 'set local role authenticated';
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
  cust uuid := gen_random_uuid(); inv uuid := gen_random_uuid(); draft uuid := gen_random_uuid();
  te uuid; r jsonb;
begin
  -- fixtures, written as the table owner
  insert into auth.users (id, email) values (p1,'p1@x'),(a1,'a1@x'),(b1,'b1@x'),(p2,'p2@x'),(c1,'c1@x'),(c2,'c2@x');
  insert into public.lalum_firms (id, firm_name, registration_no, primary_contact, email, phone, monthly_fee)
    values (f1,'F1','1','x','f1@x','1',0),(f2,'F2','2','x','f2@x','2',0);
  insert into public.lalum_firm_members (firm_id, user_id, name, email, role) values
    (f1,p1,'P1','p1@x','FIRM_PARTNER'),(f1,a1,'A1','a1@x','ATTORNEY'),(f1,b1,'B1','b1@x','ATTORNEY'),(f2,p2,'P2','p2@x','FIRM_PARTNER');
  insert into public.lalum_cockpit_matters (id, firm_id, title) values (m1,f1,'M1'),(m2,f1,'M2'),(m3,f2,'M3');
  insert into public.lalum_matter_team (matter_id, user_id, firm_id) values (m1,a1,f1);
  insert into public.lalum_matter_client_access (matter_id, client_user_id, firm_id, access_level) values (m1,c1,f1,'READ_WRITE'),(m2,c2,f1,'READ');
  insert into public.lalum_fin_customers (id, firm_id, name) values (cust,f1,'Client One');
  insert into public.lalum_matter_fees (matter_id, firm_id, fin_customer_id, fee_model) values (m1,f1,cust,'hourly');
  insert into public.lalum_rate_cards (firm_id, member_role, hourly_rate) values (f1,'ATTORNEY',500);
  insert into public.lalum_fin_documents (id, firm_id, customer_id, doc_type, status, subtotal, vat_amount, total, issue_date, due_date, doc_number)
    values (inv,f1,cust,'INVOICE','ISSUED',1000,180,1180,current_date-40,current_date-10,1),
           (draft,f1,cust,'INVOICE','DRAFT',500,90,590,current_date,null,null);

  -- time entries: associate
  perform t.as_user(a1);
  insert into public.lalum_time_entries (firm_id, matter_id, worked_minutes, billable_minutes, narrative, status)
    values (f1, m1, 60, 60, 'review draft agreement section 4', 'submitted') returning id into te;
  perform t.eq(t.n('select 1 from public.lalum_time_entries'), 1::bigint, 'associate sees own entry');
  perform t.fails(format('insert into public.lalum_time_entries (firm_id, matter_id, worked_minutes, billable_minutes, narrative, status) values (%L,%L,30,30,%L,%L)', f1, m2, 'not on the matter team here', 'submitted'),
    'row-level security', 'associate cannot log time on a matter outside the team');
  perform t.fails(format('insert into public.lalum_time_entries (firm_id, matter_id, worked_minutes, billable_minutes, narrative, status, work_date) values (%L,%L,30,30,%L,%L,current_date-10)', f1, m1, 'backdated entry needs a partner', 'submitted'),
    'BACKDATE_NEEDS_PARTNER', 'associate cannot backdate beyond 7 days');
  perform t.fails(format('update public.lalum_time_entries set status = %L where id = %L', 'approved', te),
    'STATUS_FORBIDDEN', 'associate cannot approve own time');
  perform t.fails(format('insert into public.lalum_time_entries (firm_id, matter_id, worked_minutes, billable_minutes, narrative, status) values (%L,%L,30,30,%L,%L)', f1, m1, 'short', 'submitted'),
    'check constraint', 'a submitted entry needs a real narrative');
  perform t.eq(t.n('select 1 from public.lalum_matter_fees'), 0::bigint, 'associate sees no fee terms');
  perform t.eq(t.n('select 1 from public.lalum_rate_cards'), 0::bigint, 'associate sees no rates');
  perform t.eq(t.n('select 1 from public.lalum_audit_log'), 0::bigint, 'associate sees no audit log');
  perform t.fails('select public.lalum_partner_overview()', 'FORBIDDEN', 'associate cannot call the partner overview');

  -- non team associate
  perform t.as_user(b1);
  perform t.fails(format('insert into public.lalum_time_entries (firm_id, matter_id, worked_minutes, billable_minutes, narrative, status) values (%L,%L,30,30,%L,%L)', f1, m1, 'not on the matter team here', 'submitted'),
    'row-level security', 'non team associate cannot log time');
  perform t.eq(t.n('select 1 from public.lalum_time_entries'), 0::bigint, 'non team associate sees no one else''s time');

  -- partner: sees all, approves, WIP and AR come out of rows
  perform t.as_user(p1);
  perform t.eq(t.n('select 1 from public.lalum_time_entries'), 1::bigint, 'partner sees the firm''s time');
  update public.lalum_time_entries set status = 'approved' where id = te;
  perform t.eq((select approved_by from public.lalum_time_entries where id = te), p1, 'approval is stamped with the approving partner');
  r := public.lalum_partner_overview();
  perform t.eq((r->>'wip_value')::numeric, 500.00, 'WIP = 1h x 500 from rate card');
  perform t.eq((r->'ar_aging'->>'d1_30')::numeric, 1180.00, 'AR aging: issued invoice 10 days overdue, draft excluded');
  perform t.eq((r->>'entries_without_rate')::int, 0, 'no entries without a rate');
  perform t.eq(t.n('select 1 from public.lalum_audit_log where action = ''VIEWED_FINANCIALS'''), 1::bigint, 'reading the overview is audited');
  perform t.eq(t.n('select 1 from public.lalum_audit_log where action = ''STATUS_APPROVED'''), 1::bigint, 'approval is audited');

  perform t.as_user(a1);
  perform t.eq((select count(*) from (select 1 from public.lalum_time_entries where status = 'approved') q), 1::bigint, 'associate can still read an approved entry');
  update public.lalum_time_entries set narrative = 'tampering after approval attempt' where id = te;
  perform t.eq((select narrative from public.lalum_time_entries where id = te), 'review draft agreement section 4', 'associate cannot edit an approved entry');

  -- fee agreement gate
  perform t.as_user(p1);
  perform t.fails(format('update public.lalum_matter_fees set billing_active = true where matter_id = %L', m1), 'check constraint', 'billing cannot be switched on without a fee agreement file');

  -- messages and client isolation
  perform t.as_user(c1);
  insert into public.lalum_matter_messages (matter_id, sender_kind, body) values (m1, 'CLIENT', 'documents are on their way');
  perform t.fails(format('insert into public.lalum_matter_messages (matter_id, sender_kind, body) values (%L,%L,%L)', m2, 'CLIENT', 'wrong matter'), 'row-level security', 'client cannot post to another matter');
  perform t.fails(format('insert into public.lalum_matter_messages (matter_id, sender_kind, body, is_internal_only) values (%L,%L,%L,true)', m1, 'CLIENT', 'x'), 'row-level security', 'client cannot create an internal note');
  perform t.fails(format('insert into public.lalum_matter_messages (matter_id, sender_kind, body) values (%L,%L,%L)', m1, 'FIRM', 'impersonating the firm'), 'row-level security', 'client cannot post as the firm');
  perform t.fails(format('update public.lalum_matter_messages set body = %L', 'edited'), 'permission denied', 'messages cannot be edited');
  perform t.fails('delete from public.lalum_matter_messages', 'permission denied', 'messages cannot be deleted');
  perform t.eq(t.n('select 1 from public.lalum_time_entries'), 0::bigint, 'client sees no time entries');
  perform t.eq(t.n('select 1 from public.lalum_matter_fees'), 0::bigint, 'client sees no fee terms');
  perform t.eq(t.n('select 1 from public.lalum_audit_log'), 0::bigint, 'client sees no audit log');
  perform t.eq(t.n('select 1 from public.lalum_fin_documents'), 0::bigint, 'client cannot read the ledger directly');
  perform t.fails('select public.lalum_partner_overview()', 'FORBIDDEN', 'client cannot call the partner overview');

  perform t.as_user(c2);
  perform t.fails(format('insert into public.lalum_matter_messages (matter_id, sender_kind, body) values (%L,%L,%L)', m2, 'CLIENT', 'read only grant'), 'row-level security', 'READ grant cannot write');
  perform t.eq(t.n('select 1 from public.lalum_matter_messages'), 0::bigint, 'client of another matter sees none of M1''s messages');

  perform t.as_user(a1);
  insert into public.lalum_matter_messages (matter_id, sender_kind, body, is_internal_only) values (m1, 'FIRM', 'internal: weak point in clause 7', true);
  insert into public.lalum_matter_messages (matter_id, sender_kind, body) values (m1, 'FIRM', 'received, reviewing');
  perform t.eq(t.n('select 1 from public.lalum_matter_messages'), 3::bigint, 'team associate sees all messages on the matter');

  perform t.as_user(b1);
  perform t.eq(t.n('select 1 from public.lalum_matter_messages'), 0::bigint, 'non team associate sees no messages');

  perform t.as_user(c1);
  perform t.eq(t.n('select 1 from public.lalum_matter_messages'), 2::bigint, 'client sees their message and the firm reply, never the internal note');
  perform t.eq(t.n('select 1 from public.lalum_matter_messages where is_internal_only'), 0::bigint, 'no internal note leaks to the client');

  -- client financial summary
  r := public.lalum_client_matter_financials(m1);
  perform t.eq(jsonb_array_length(r), 1, 'client financials list issued documents only');
  perform t.eq((r->0->>'open_amount')::numeric, 1180.00, 'client sees the open amount');
  perform t.fails(format('select public.lalum_client_matter_financials(%L)', m2), 'FORBIDDEN', 'client cannot read another matter''s financials');

  -- audit trail
  perform t.as_user(p1);
  perform t.eq(t.n('select 1 from public.lalum_audit_log where action = ''CLIENT_MESSAGE'''), 1::bigint, 'client message is audited');
  perform t.eq(t.n('select 1 from public.lalum_audit_log where action = ''VIEWED_FINANCIALS'' and entity = ''client_matter_financials'''), 1::bigint, 'client financial view is audited');
  perform t.fails('update public.lalum_audit_log set action = ''X''', 'permission denied', 'partner cannot edit the audit log');
  reset role;
  perform t.fails('update public.lalum_audit_log set action = ''X''', 'AUDIT_LOG_IMMUTABLE', 'even the owner cannot edit the audit log');
  perform t.fails('delete from public.lalum_audit_log', 'AUDIT_LOG_IMMUTABLE', 'even the owner cannot delete audit rows');
  perform t.fails('truncate public.lalum_audit_log', 'AUDIT_LOG_IMMUTABLE', 'even the owner cannot truncate the audit log');

  -- tenant isolation
  perform t.as_user(p2);
  perform t.eq(t.n('select 1 from public.lalum_time_entries'), 0::bigint, 'other firm partner sees no time');
  perform t.eq(t.n('select 1 from public.lalum_matter_fees'), 0::bigint, 'other firm partner sees no fee terms');
  perform t.eq(t.n('select 1 from public.lalum_audit_log'), 0::bigint, 'other firm partner sees no audit rows');
  perform t.fails(format('insert into public.lalum_time_entries (firm_id, matter_id, worked_minutes, billable_minutes, narrative, status) values (%L,%L,30,30,%L,%L)', f2, m1, 'cross tenant attempt on firm one', 'submitted'), 'FIRM_MISMATCH', 'cannot log time on another firm''s matter');

  -- grants
  perform t.as_user(p1);
  perform t.fails(format('insert into public.lalum_matter_client_access (matter_id, client_user_id, firm_id) values (%L,%L,%L)', m2, a1, f1), 'CLIENT_CANNOT_BE_FIRM_MEMBER', 'a firm member cannot be granted client access');
  reset role;
  raise notice 'ALL BILLING RLS CHECKS PASSED';
  raise exception 'ROLLBACK_FIXTURES';  -- keeps the database clean between runs
exception when others then
  if sqlerrm = 'ROLLBACK_FIXTURES' then raise notice 'rolled back fixtures'; else raise; end if;
end $$;
