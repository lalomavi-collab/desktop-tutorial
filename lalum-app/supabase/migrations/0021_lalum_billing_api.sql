-- Billing API as database functions (the stack has no REST server: Supabase RLS + edge functions).
--   POST /billing/time-entries              -> direct insert on lalum_time_entries, or the timer RPCs
--   GET  /billing/matters/:id/unbilled-wip  -> lalum_billing_unbilled_wip(matter)
--   POST /billing/invoices/draft            -> lalum_billing_draft_from_wip(...) / ..._from_milestone(...)
--   POST /billing/invoices/:id/finalize     -> the lalum-fin-issue edge function issues the document;
--                                              a trigger then locks the WIP; lalum_trust_apply_max
--                                              optionally settles it from trust
--   POST /billing/invoices/:id/payments     -> lalum_billing_record_payment(...)
--
-- WIP lifecycle. A draft RESERVES entries (invoice_doc_id set, status unchanged) so a second draft
-- cannot take them. When the document becomes ISSUED the entries become billed and locked. Deleting
-- a draft releases the reservation. An issued invoice is never voided: it is cancelled by a credit
-- invoice, and the partner then chooses to release the work to WIP or write it off.
-- Phase 1 keeps Invoice4U as the issuer and the ledger mirrors it. Nothing here issues a tax
-- document by itself.

-- A draft deleted by lalum_fin_delete_draft must release what it reserved.
alter table public.lalum_time_entries drop constraint if exists lalum_time_entries_invoice_doc_id_fkey;
alter table public.lalum_time_entries add constraint lalum_time_entries_invoice_doc_id_fkey
  foreign key (invoice_doc_id) references public.lalum_fin_documents(id) on delete set null;
alter table public.lalum_disbursements drop constraint if exists lalum_disbursements_invoice_doc_id_fkey;
alter table public.lalum_disbursements add constraint lalum_disbursements_invoice_doc_id_fkey
  foreign key (invoice_doc_id) references public.lalum_fin_documents(id) on delete set null;
alter table public.lalum_milestones drop constraint if exists lalum_milestones_fin_document_id_fkey;
alter table public.lalum_milestones add constraint lalum_milestones_fin_document_id_fkey
  foreign key (fin_document_id) references public.lalum_fin_documents(id) on delete set null;

-- ───────────────────────── timer ─────────────────────────

create table if not exists public.lalum_time_timers (
  user_id    uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  firm_id    uuid not null references public.lalum_firms(id) on delete cascade,
  matter_id  uuid not null references public.lalum_cockpit_matters(id) on delete cascade,
  narrative  text not null default '',
  started_at timestamptz not null default now()
);
alter table public.lalum_time_timers enable row level security;
revoke all on public.lalum_time_timers from anon, authenticated;
create policy lalum_time_timers_own on public.lalum_time_timers for select using (user_id = (select auth.uid()));
grant select on public.lalum_time_timers to authenticated;

create or replace function public.lalum_timer_start(p_matter uuid, p_narrative text default '') returns void
language plpgsql security definer set search_path to 'public' as $$
begin
  if auth.uid() is null or not public.lalum_is_staff_on(p_matter) then raise exception 'FORBIDDEN'; end if;
  if exists (select 1 from public.lalum_time_timers where user_id = auth.uid()) then raise exception 'TIMER_ALREADY_RUNNING'; end if;
  insert into public.lalum_time_timers (user_id, firm_id, matter_id, narrative)
    values (auth.uid(), public.lalum_matter_firm(p_matter), p_matter, coalesce(p_narrative, ''));
end $$;

-- Stopping writes a draft entry. Worked time is rounded up to the minute; billable time goes to the
-- nearest 6 minutes with a floor of 6, because the entry table bills in 6 minute units.
create or replace function public.lalum_timer_stop(p_narrative text default null) returns uuid
language plpgsql security definer set search_path to 'public' as $$
declare t record; v_worked integer; v_bill integer; v_id uuid;
begin
  select * into t from public.lalum_time_timers where user_id = auth.uid();
  if not found then raise exception 'NO_RUNNING_TIMER'; end if;
  v_worked := greatest(1, ceil(extract(epoch from (now() - t.started_at)) / 60.0)::integer);
  v_bill := greatest(6, round(v_worked / 6.0)::integer * 6);
  v_worked := least(1440, greatest(v_worked, v_bill));
  v_bill := least(v_bill, v_worked - (v_worked % 6));
  insert into public.lalum_time_entries (firm_id, matter_id, timekeeper_id, work_date, worked_minutes, billable_minutes, narrative, status)
    values (t.firm_id, t.matter_id, auth.uid(), current_date, v_worked, v_bill, coalesce(p_narrative, t.narrative), 'draft')
    returning id into v_id;
  delete from public.lalum_time_timers where user_id = auth.uid();
  return v_id;
end $$;

revoke execute on function public.lalum_timer_start(uuid, text), public.lalum_timer_stop(text) from public, anon;
grant execute on function public.lalum_timer_start(uuid, text), public.lalum_timer_stop(text) to authenticated;

-- ───────────────────────── unbilled WIP ─────────────────────────

create or replace function public.lalum_billing_unbilled_wip(p_matter uuid) returns jsonb
language plpgsql security definer set search_path to 'public' as $$
declare v_firm uuid := public.lalum_matter_firm(p_matter); v_time jsonb; v_disb jsonb; v_total numeric; v_norate integer;
begin
  if v_firm is null or not public.lalum_fin_can(v_firm) then raise exception 'FORBIDDEN'; end if;
  perform public.lalum_audit_write(v_firm, 'VIEWED_FINANCIALS', 'unbilled_wip', p_matter::text, '{}'::jsonb);
  with e as (
    select te.id, te.work_date, te.billable_minutes, te.narrative, te.status, te.ai_assisted, fm.name as timekeeper,
           public.lalum_entry_rate(te.firm_id, te.matter_id, te.timekeeper_id, te.work_date) as rate,
           te.invoice_doc_id is not null as reserved
      from public.lalum_time_entries te
      left join public.lalum_firm_members fm on fm.user_id = te.timekeeper_id
     where te.matter_id = p_matter and te.status in ('submitted','approved') and te.billable_minutes > 0)
  select coalesce(jsonb_agg(jsonb_build_object('id', id, 'work_date', work_date, 'timekeeper', timekeeper, 'billable_minutes', billable_minutes,
           'rate', rate, 'amount', case when rate is not null then round(billable_minutes / 60.0 * rate, 2) end,
           'narrative', narrative, 'status', status, 'ai_assisted', ai_assisted, 'reserved', reserved) order by work_date), '[]'::jsonb),
         coalesce(sum(case when status = 'approved' and not reserved and rate is not null then billable_minutes / 60.0 * rate end), 0),
         count(*) filter (where rate is null)
    into v_time, v_total, v_norate from e;
  select coalesce(jsonb_agg(jsonb_build_object('id', id, 'expense_type', expense_type, 'amount', amount, 'description', description,
           'incurred_date', incurred_date, 'reserved', invoice_doc_id is not null) order by incurred_date), '[]'::jsonb)
    into v_disb from public.lalum_disbursements where matter_id = p_matter and status = 'UNBILLED' and is_reimbursable;
  return jsonb_build_object('time_entries', v_time, 'disbursements', v_disb,
    'billable_time_value', round(v_total, 2),
    'disbursements_total', (select coalesce(sum(amount), 0) from public.lalum_disbursements where matter_id = p_matter and status = 'UNBILLED' and is_reimbursable and invoice_doc_id is null),
    'entries_without_rate', v_norate,
    'awaiting_approval', (select count(*) from public.lalum_time_entries where matter_id = p_matter and status = 'submitted'));
end $$;
revoke execute on function public.lalum_billing_unbilled_wip(uuid) from public, anon;
grant execute on function public.lalum_billing_unbilled_wip(uuid) to authenticated;

-- ───────────────────────── drafts ─────────────────────────

create or replace function public.lalum_billing_draft_from_wip(
  p_matter uuid, p_to_date date default current_date, p_vat_rate numeric default null,
  p_allow_over_cap boolean default false, p_subject text default null) returns jsonb
language plpgsql security definer set search_path to 'public' as $$
declare
  v_firm uuid := public.lalum_matter_firm(p_matter); f record; v_lines jsonb := '[]'::jsonb; v_doc uuid;
  v_entry_ids uuid[]; v_disb_ids uuid[]; v_norate integer; v_fees numeric := 0; v_disb numeric := 0; v_cap_used numeric; r record;
begin
  if v_firm is null or not public.lalum_fin_can(v_firm) then raise exception 'FORBIDDEN'; end if;
  select * into f from public.lalum_matter_fees where matter_id = p_matter;
  if not found or f.fin_customer_id is null then raise exception 'MATTER_HAS_NO_CUSTOMER'; end if;
  if not f.billing_active then raise exception 'BILLING_NOT_ACTIVE'; end if;
  if f.fee_model not in ('hourly','capped','hybrid') then raise exception 'FEE_MODEL_NOT_TIME_BASED'; end if;

  select count(*) into v_norate from public.lalum_time_entries te
   where te.matter_id = p_matter and te.status = 'approved' and te.invoice_doc_id is null and te.work_date <= p_to_date and te.billable_minutes > 0
     and coalesce(public.lalum_entry_rate(te.firm_id, te.matter_id, te.timekeeper_id, te.work_date), 0) <= 0;
  if v_norate > 0 then raise exception 'ENTRIES_WITHOUT_RATE: %', v_norate; end if;

  for r in
    select x.rate, coalesce(fm.name, 'עורך דין') as keeper, sum(x.billable_minutes) as mins, array_agg(x.id) as ids
      from (select te.id, te.billable_minutes, te.timekeeper_id,
                   public.lalum_entry_rate(te.firm_id, te.matter_id, te.timekeeper_id, te.work_date) as rate
              from public.lalum_time_entries te
             where te.matter_id = p_matter and te.status = 'approved' and te.invoice_doc_id is null
               and te.work_date <= p_to_date and te.billable_minutes > 0) x
      left join public.lalum_firm_members fm on fm.user_id = x.timekeeper_id
     group by x.rate, fm.name order by fm.name
  loop
    v_lines := v_lines || jsonb_build_array(jsonb_build_object(
      'name', left('שכר טרחה, ' || r.keeper || ', ' || round(r.mins / 60.0, 2)::text || ' שעות', 200),
      'qty', round(r.mins / 60.0, 4), 'price', r.rate));
    v_fees := v_fees + round(r.mins / 60.0 * r.rate, 2);
    v_entry_ids := coalesce(v_entry_ids, '{}') || r.ids;
  end loop;

  for r in
    select expense_type, sum(amount) as total, array_agg(id) as ids from public.lalum_disbursements
     where matter_id = p_matter and status = 'UNBILLED' and is_reimbursable and invoice_doc_id is null and incurred_date <= p_to_date
     group by expense_type order by expense_type
  loop
    v_lines := v_lines || jsonb_build_array(jsonb_build_object(
      'name', left('הוצאות: ' || case r.expense_type when 'COURT_FEE' then 'אגרות בית משפט' when 'EXPERT_WITNESS' then 'עדי מומחה'
                   when 'COURIER' then 'שליחויות' when 'PHOTOCOPY' then 'צילומים' else 'אחר' end, 200),
      'qty', 1, 'price', r.total));
    v_disb := v_disb + r.total;
    v_disb_ids := coalesce(v_disb_ids, '{}') || r.ids;
  end loop;

  if jsonb_array_length(v_lines) = 0 then raise exception 'NOTHING_TO_BILL'; end if;

  if f.fee_model = 'capped' and f.fee_cap is not null and not p_allow_over_cap then
    select coalesce(sum(te.billable_minutes / 60.0 * coalesce(public.lalum_entry_rate(te.firm_id, te.matter_id, te.timekeeper_id, te.work_date), 0)), 0)
      into v_cap_used from public.lalum_time_entries te
     where te.matter_id = p_matter and (te.status = 'billed' or (te.status = 'approved' and te.invoice_doc_id is not null));
    if v_cap_used + v_fees > f.fee_cap then raise exception 'EXCEEDS_CAP: cap %, would reach %', f.fee_cap, v_cap_used + v_fees; end if;
  end if;

  v_doc := public.lalum_fin_save_draft(null, jsonb_build_object(
    'customer_id', f.fin_customer_id, 'doc_type', 'INVOICE', 'subject', coalesce(p_subject, ''),
    'tax_included', false, 'vat_rate', coalesce(p_vat_rate, 18), 'lines', v_lines));

  if v_entry_ids is not null then update public.lalum_time_entries set invoice_doc_id = v_doc where id = any(v_entry_ids); end if;
  if v_disb_ids is not null then update public.lalum_disbursements set invoice_doc_id = v_doc where id = any(v_disb_ids); end if;
  insert into public.lalum_fin_document_matters (document_id, matter_id, firm_id, amount) values (v_doc, p_matter, v_firm, round(v_fees + v_disb, 2));

  return jsonb_build_object('document_id', v_doc, 'fees', round(v_fees, 2), 'disbursements', round(v_disb, 2),
    'time_entries', coalesce(array_length(v_entry_ids, 1), 0), 'disbursement_rows', coalesce(array_length(v_disb_ids, 1), 0));
end $$;
revoke execute on function public.lalum_billing_draft_from_wip(uuid, date, numeric, boolean, text) from public, anon;
grant execute on function public.lalum_billing_draft_from_wip(uuid, date, numeric, boolean, text) to authenticated;

create or replace function public.lalum_billing_draft_from_milestone(p_milestone uuid, p_vat_rate numeric default null) returns jsonb
language plpgsql security definer set search_path to 'public' as $$
declare m record; f record; v_doc uuid;
begin
  select * into m from public.lalum_milestones where id = p_milestone;
  if not found or not public.lalum_fin_can(m.firm_id) then raise exception 'FORBIDDEN'; end if;
  if m.achieved_at is null then raise exception 'MILESTONE_NOT_ACHIEVED'; end if;
  if m.fin_document_id is not null then raise exception 'MILESTONE_ALREADY_BILLED'; end if;
  select * into f from public.lalum_matter_fees where matter_id = m.matter_id;
  if not found or f.fin_customer_id is null then raise exception 'MATTER_HAS_NO_CUSTOMER'; end if;
  if not f.billing_active then raise exception 'BILLING_NOT_ACTIVE'; end if;
  if m.amount <= 0 then raise exception 'BAD_AMOUNT'; end if;
  v_doc := public.lalum_fin_save_draft(null, jsonb_build_object(
    'customer_id', f.fin_customer_id, 'doc_type', 'INVOICE', 'subject', m.name, 'tax_included', false,
    'vat_rate', coalesce(p_vat_rate, 18), 'lines', jsonb_build_array(jsonb_build_object('name', left(m.name, 200), 'qty', 1, 'price', m.amount))));
  update public.lalum_milestones set fin_document_id = v_doc where id = p_milestone;
  insert into public.lalum_fin_document_matters (document_id, matter_id, firm_id, amount) values (v_doc, m.matter_id, m.firm_id, m.amount);
  return jsonb_build_object('document_id', v_doc, 'amount', m.amount);
end $$;
revoke execute on function public.lalum_billing_draft_from_milestone(uuid, numeric) from public, anon;
grant execute on function public.lalum_billing_draft_from_milestone(uuid, numeric) to authenticated;

-- ───────────────────────── lock when issued ─────────────────────────

create or replace function public.lalum_billing_on_issue() returns trigger
language plpgsql security definer set search_path to 'public' as $$
begin
  if new.status = 'ISSUED' and old.status is distinct from 'ISSUED' then
    update public.lalum_time_entries set status = 'billed' where invoice_doc_id = new.id and status = 'approved';
    update public.lalum_disbursements set status = 'BILLED' where invoice_doc_id = new.id and status = 'UNBILLED';
  end if;
  return new;
end $$;
revoke execute on function public.lalum_billing_on_issue() from public, anon, authenticated;
drop trigger if exists lalum_billing_on_issue_t on public.lalum_fin_documents;
create trigger lalum_billing_on_issue_t after update on public.lalum_fin_documents
  for each row execute function public.lalum_billing_on_issue();

-- Settle an issued invoice from trust with as much as the client's trust balance allows.
create or replace function public.lalum_trust_apply_max(p_matter uuid, p_account uuid, p_doc uuid) returns jsonb
language plpgsql security definer set search_path to 'public' as $$
declare v_firm uuid := public.lalum_matter_firm(p_matter); v_bal numeric; v_open numeric; v_amt numeric; v_id bigint;
begin
  if v_firm is null or not public.lalum_fin_can(v_firm) then raise exception 'FORBIDDEN'; end if;
  select coalesce(sum(amount), 0) into v_bal from public.lalum_trust_ledger where matter_id = p_matter;
  v_open := public.lalum_invoice_open_amount(p_doc);
  v_amt := least(v_bal, v_open);
  if v_amt <= 0 then return jsonb_build_object('applied', 0, 'balance_due', v_open); end if;
  v_id := public.lalum_trust_apply_to_invoice(p_matter, p_account, p_doc, v_amt);
  return jsonb_build_object('applied', v_amt, 'ledger_entry', v_id, 'balance_due', v_open - v_amt);
end $$;
revoke execute on function public.lalum_trust_apply_max(uuid, uuid, uuid) from public, anon;
grant execute on function public.lalum_trust_apply_max(uuid, uuid, uuid) to authenticated;

-- ───────────────────────── release after a credit invoice ─────────────────────────

create or replace function public.lalum_time_entries_guard() returns trigger
language plpgsql set search_path to 'public' as $$
declare v_partner boolean := public.lalum_fin_can(coalesce(new.firm_id, old.firm_id));
begin
  if auth.uid() is null then return coalesce(new, old); end if;
  if current_setting('lalum.wip_release', true) = coalesce(old.id::text, '') and tg_op = 'UPDATE' then
    new.updated_at := now();
    return new;
  end if;
  if tg_op = 'INSERT' then
    if new.firm_id is distinct from public.lalum_matter_firm(new.matter_id) then raise exception 'FIRM_MISMATCH'; end if;
    if new.status not in ('draft','submitted') and not v_partner then raise exception 'STATUS_FORBIDDEN'; end if;
    if new.work_date < current_date - 7 and not v_partner then raise exception 'BACKDATE_NEEDS_PARTNER'; end if;
    return new;
  end if;
  if tg_op = 'DELETE' then
    if old.status <> 'draft' then raise exception 'ONLY_DRAFT_DELETABLE'; end if;
    return old;
  end if;
  if new.firm_id is distinct from old.firm_id or new.matter_id is distinct from old.matter_id
     or new.timekeeper_id is distinct from old.timekeeper_id then raise exception 'IDENTITY_IMMUTABLE'; end if;
  if old.status in ('billed','written_off') then raise exception 'ENTRY_LOCKED'; end if;
  if not v_partner then
    if old.status not in ('draft','submitted') or new.status not in ('draft','submitted') then raise exception 'STATUS_FORBIDDEN'; end if;
    if new.work_date is distinct from old.work_date and new.work_date < current_date - 7 then raise exception 'BACKDATE_NEEDS_PARTNER'; end if;
  elsif new.status = 'approved' and old.status is distinct from 'approved' then
    new.approved_by := auth.uid(); new.approved_at := now();
  end if;
  new.updated_at := now();
  return new;
end $$;

-- Only after the invoice has been fully cancelled by issued credit invoices.
-- p_action: 'release' puts the work back into WIP, 'write_off' closes it as lost.
create or replace function public.lalum_billing_release_wip(p_doc uuid, p_action text) returns integer
language plpgsql security definer set search_path to 'public' as $$
declare d record; v_credited numeric; r record; n integer := 0;
begin
  select * into d from public.lalum_fin_documents where id = p_doc;
  if not found or not public.lalum_fin_can(d.firm_id) then raise exception 'FORBIDDEN'; end if;
  if p_action not in ('release','write_off') then raise exception 'BAD_ACTION'; end if;
  if d.doc_type <> 'INVOICE' or d.status <> 'ISSUED' then raise exception 'NOT_AN_ISSUED_INVOICE'; end if;
  select coalesce(sum(x.total), 0) into v_credited from public.lalum_fin_documents x
   where x.related_doc_id = p_doc and x.doc_type = 'CREDIT' and x.status = 'ISSUED' and not x.is_test;
  if v_credited < d.total then raise exception 'INVOICE_NOT_FULLY_CREDITED'; end if;
  for r in select id from public.lalum_time_entries where invoice_doc_id = p_doc and status = 'billed' loop
    perform set_config('lalum.wip_release', r.id::text, true);
    if p_action = 'release' then
      update public.lalum_time_entries set status = 'approved', invoice_doc_id = null where id = r.id;
    else
      update public.lalum_time_entries set status = 'written_off' where id = r.id;
    end if;
    n := n + 1;
  end loop;
  perform set_config('lalum.wip_release', '', true);
  if p_action = 'release' then
    update public.lalum_disbursements set status = 'UNBILLED', invoice_doc_id = null where invoice_doc_id = p_doc and status = 'BILLED';
  end if;
  perform public.lalum_audit_write(d.firm_id, 'WIP_' || upper(p_action), 'lalum_fin_documents', p_doc::text, jsonb_build_object('entries', n));
  return n;
end $$;
revoke execute on function public.lalum_billing_release_wip(uuid, text) from public, anon;
grant execute on function public.lalum_billing_release_wip(uuid, text) to authenticated;

-- The disbursement guard must let a release through; it only blocks changes by end users, and the
-- release runs with the owner's rights on rows that have no auth check of their own.
create or replace function public.lalum_disbursements_guard() returns trigger
language plpgsql set search_path to 'public' as $$
begin
  if auth.uid() is null then return coalesce(new, old); end if;
  if tg_op = 'DELETE' then
    if old.status <> 'UNBILLED' then raise exception 'DISBURSEMENT_LOCKED'; end if;
    return old;
  end if;
  if old.status <> 'UNBILLED' and old.invoice_doc_id is not null and new.status = 'UNBILLED' and new.invoice_doc_id is null then
    return new;
  end if;
  if old.status <> 'UNBILLED' and (new.amount is distinct from old.amount or new.matter_id is distinct from old.matter_id
     or new.expense_type is distinct from old.expense_type or new.invoice_doc_id is distinct from old.invoice_doc_id) then
    raise exception 'DISBURSEMENT_LOCKED';
  end if;
  return new;
end $$;

-- ───────────────────────── payments ─────────────────────────

create or replace function public.lalum_billing_record_payment(
  p_doc uuid, p_amount numeric, p_method text, p_reference text default null, p_paid_on date default current_date) returns jsonb
language plpgsql security definer set search_path to 'public' as $$
declare d record; v_open numeric; v_week date; v_id uuid;
begin
  select * into d from public.lalum_fin_documents where id = p_doc;
  if not found or not public.lalum_fin_can(d.firm_id) then raise exception 'FORBIDDEN'; end if;
  if d.doc_type <> 'INVOICE' or d.status <> 'ISSUED' or d.is_test then raise exception 'INVOICE_NOT_PAYABLE'; end if;
  if coalesce(p_amount, 0) <= 0 then raise exception 'BAD_AMOUNT'; end if;
  if p_paid_on > current_date then raise exception 'PAYMENT_DATE_IN_FUTURE'; end if;
  v_open := public.lalum_invoice_open_amount(p_doc);
  if p_amount > v_open then raise exception 'EXCEEDS_OPEN_AMOUNT: open %', v_open; end if;
  insert into public.lalum_fin_payments (firm_id, customer_id, document_id, paid_on, amount, method, reference, created_by)
    values (d.firm_id, d.customer_id, p_doc, p_paid_on, p_amount, p_method, p_reference, auth.uid()) returning id into v_id;
  v_week := p_paid_on + ((5 - extract(dow from p_paid_on)::integer + 7) % 7);
  insert into public.lalum_cash_forecast_items as c (firm_id, week_ending, category, projected_amount, actual_amount)
    values (d.firm_id, v_week, 'INFLOW_COLLECTIONS', 0, p_amount)
    on conflict (firm_id, week_ending, category) do update
      set actual_amount = coalesce(c.actual_amount, 0) + p_amount, updated_at = now();
  return jsonb_build_object('payment_id', v_id, 'balance_due', v_open - p_amount, 'status', case when v_open - p_amount <= 0.004 then 'PAID' else 'PARTIALLY_PAID' end);
end $$;
revoke execute on function public.lalum_billing_record_payment(uuid, numeric, text, text, date) from public, anon;
grant execute on function public.lalum_billing_record_payment(uuid, numeric, text, text, date) to authenticated;

-- ───────────────────────── chart data ─────────────────────────

-- One call for the dashboard charts. Every series is computed from rows.
create or replace function public.lalum_partner_charts(p_months integer default 12) returns jsonb
language plpgsql security definer set search_path to 'public' as $$
declare v_firm uuid := public.lalum_my_firm_id(); v_out jsonb; v_m integer := least(greatest(coalesce(p_months, 12), 3), 36);
begin
  if not public.lalum_fin_can(v_firm) then raise exception 'FORBIDDEN'; end if;
  perform public.lalum_audit_write(v_firm, 'VIEWED_FINANCIALS', 'partner_charts', null, '{}'::jsonb);
  select jsonb_build_object(
    'months', (select coalesce(jsonb_agg(jsonb_build_object('month', to_char(m, 'YYYY-MM'),
         'billed', coalesce((select sum(d.subtotal * case when d.doc_type = 'CREDIT' then -1 else 1 end) from public.lalum_fin_documents d
                              where d.firm_id = v_firm and d.status = 'ISSUED' and not d.is_test and d.doc_type in ('INVOICE','INVOICE_RECEIPT','CREDIT')
                                and date_trunc('month', d.issue_date) = m), 0),
         'collected', coalesce((select sum(p.amount) from public.lalum_fin_payments p where p.firm_id = v_firm and date_trunc('month', p.paid_on) = m), 0),
         'worked_hours', coalesce((select sum(te.worked_minutes) / 60.0 from public.lalum_time_entries te where te.firm_id = v_firm and date_trunc('month', te.work_date) = m and te.status <> 'draft'), 0),
         'billable_hours', coalesce((select sum(te.billable_minutes) / 60.0 from public.lalum_time_entries te where te.firm_id = v_firm and date_trunc('month', te.work_date) = m and te.status <> 'draft'), 0)
       ) order by m), '[]'::jsonb)
       from generate_series(date_trunc('month', current_date) - ((v_m - 1) || ' months')::interval, date_trunc('month', current_date), interval '1 month') m),
    'by_practice_area', (select coalesce(jsonb_agg(jsonb_build_object('practice_area', practice_area, 'hours', round(h, 1))), '[]'::jsonb)
       from (select m.practice_area, sum(te.worked_minutes) / 60.0 as h from public.lalum_time_entries te
               join public.lalum_cockpit_matters m on m.id = te.matter_id
              where te.firm_id = v_firm and te.work_date >= current_date - 365 and te.status <> 'draft' group by m.practice_area) a),
    'forecast', (select coalesce(jsonb_agg(jsonb_build_object('week_ending', week_ending, 'category', category,
         'projected', projected_amount, 'actual', actual_amount) order by week_ending), '[]'::jsonb)
       from public.lalum_cash_forecast_items where firm_id = v_firm and week_ending between current_date - 28 and current_date + 98),
    'forecast_is_manual', true
  ) into v_out;
  return v_out;
end $$;
revoke execute on function public.lalum_partner_charts(integer) from public, anon;
grant execute on function public.lalum_partner_charts(integer) to authenticated;
