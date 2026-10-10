-- Trust ledger, disbursements, deadlines with client visibility, client document intake gate,
-- and a manual weekly cash forecast. Builds on 0017.
--
-- Design rules
--  * The trust ledger is append only and every balance is computed from its rows. There is no
--    stored balance to edit. A correction is a REVERSAL row, never an edit.
--  * Zero overdraft is enforced per matter AND per trust account, under advisory locks, so two
--    concurrent withdrawals cannot both pass the check. (A plain SELECT SUM trigger has that race.)
--  * Writes go through SECURITY DEFINER functions. Nobody gets INSERT/UPDATE/DELETE on the ledger.
--  * Receipts for trust deposits come from a gapless per firm series (TR-000001), separate from tax
--    documents. Whether and how such a receipt is legally required is NOT encoded here.
--  * Merchant fees on card deposits are not modelled. The rule that they must never be taken from
--    client trust money is a policy to verify against the rules before it is built as a feature.
--  * Court recess dates and the deadline calculation engine are NOT part of this migration. They
--    need verification against the regulations' own text first. Deadlines here are entered dates.
--  * A client document is never inserted straight into lalum_matter_documents: that table requires
--    the anonymised content produced by the existing PII pipeline. Approval only marks the
--    submission, and the pipeline links the resulting document afterwards.

-- ───────────────────────── trust accounts and ledger ─────────────────────────

create table if not exists public.lalum_trust_accounts (
  id             uuid primary key default gen_random_uuid(),
  firm_id        uuid not null references public.lalum_firms(id) on delete cascade,
  bank_name      text not null check (length(btrim(bank_name)) > 0),
  branch         text not null check (length(btrim(branch)) > 0),
  account_number text not null check (length(btrim(account_number)) > 0),
  currency       text not null default 'ILS' check (currency = 'ILS'),
  opened_on      date not null default current_date,
  closed_on      date,
  created_by     uuid default auth.uid(),
  created_at     timestamptz not null default now(),
  unique (firm_id, bank_name, branch, account_number),
  check (closed_on is null or closed_on >= opened_on)
);

create table if not exists public.lalum_trust_receipt_counters (
  firm_id uuid primary key references public.lalum_firms(id) on delete cascade,
  last_no bigint not null default 0
);

create table if not exists public.lalum_trust_ledger (
  id               bigint generated always as identity primary key,
  firm_id          uuid not null references public.lalum_firms(id) on delete cascade,
  trust_account_id uuid not null references public.lalum_trust_accounts(id) on delete restrict,
  matter_id        uuid not null references public.lalum_cockpit_matters(id) on delete restrict,
  customer_id      uuid not null references public.lalum_fin_customers(id) on delete restrict,
  tx_type          text not null check (tx_type in ('DEPOSIT','DISBURSEMENT_TO_THIRD_PARTY','EARNED_FEE_TRANSFER','REFUND_TO_CLIENT','REVERSAL')),
  amount           numeric(14,2) not null check (amount <> 0),
  receipt_no       text not null,
  reference_doc_id uuid references public.lalum_fin_documents(id),
  reverses_entry_id bigint references public.lalum_trust_ledger(id),
  counterparty     text,
  notes            text,
  created_by       uuid not null default auth.uid(),
  created_at       timestamptz not null default now(),
  unique (firm_id, receipt_no),
  check ((tx_type = 'DEPOSIT' and amount > 0)
      or (tx_type in ('DISBURSEMENT_TO_THIRD_PARTY','EARNED_FEE_TRANSFER','REFUND_TO_CLIENT') and amount < 0)
      or tx_type = 'REVERSAL'),
  check (tx_type <> 'REVERSAL' or reverses_entry_id is not null),
  check (tx_type <> 'EARNED_FEE_TRANSFER' or reference_doc_id is not null)
);
create unique index if not exists lalum_trust_ledger_one_reversal_idx on public.lalum_trust_ledger (reverses_entry_id) where reverses_entry_id is not null;
create index if not exists lalum_trust_ledger_matter_idx on public.lalum_trust_ledger (matter_id);
create index if not exists lalum_trust_ledger_account_idx on public.lalum_trust_ledger (trust_account_id);
create index if not exists lalum_trust_ledger_doc_idx on public.lalum_trust_ledger (reference_doc_id) where reference_doc_id is not null;

-- Bank statement balances, kept apart from the ledger so reconciliation compares two sources.
create table if not exists public.lalum_trust_bank_statements (
  id               uuid primary key default gen_random_uuid(),
  firm_id          uuid not null references public.lalum_firms(id) on delete cascade,
  trust_account_id uuid not null references public.lalum_trust_accounts(id) on delete cascade,
  as_of            date not null,
  balance          numeric(14,2) not null,
  entered_by       uuid default auth.uid(),
  created_at       timestamptz not null default now(),
  unique (trust_account_id, as_of)
);

create or replace function public.lalum_trust_guard() returns trigger
language plpgsql security definer set search_path to 'public' as $$
declare
  v_matter_firm uuid; v_acct record; v_cust_firm uuid; v_orig record;
  v_matter_bal numeric; v_acct_bal numeric; v_n bigint;
begin
  select firm_id into v_matter_firm from public.lalum_cockpit_matters where id = new.matter_id;
  select firm_id, closed_on into v_acct from public.lalum_trust_accounts where id = new.trust_account_id;
  select firm_id into v_cust_firm from public.lalum_fin_customers where id = new.customer_id;
  if v_matter_firm is null or v_acct.firm_id is null or v_cust_firm is null then raise exception 'TRUST_REFERENCE_MISSING'; end if;
  if new.firm_id is distinct from v_matter_firm or new.firm_id is distinct from v_acct.firm_id or new.firm_id is distinct from v_cust_firm then
    raise exception 'FIRM_MISMATCH';
  end if;
  if v_acct.closed_on is not null and v_acct.closed_on <= current_date then raise exception 'TRUST_ACCOUNT_CLOSED'; end if;

  if new.tx_type = 'REVERSAL' then
    select * into v_orig from public.lalum_trust_ledger where id = new.reverses_entry_id;
    if not found then raise exception 'REVERSAL_TARGET_MISSING'; end if;
    if v_orig.tx_type = 'REVERSAL' then raise exception 'CANNOT_REVERSE_A_REVERSAL'; end if;
    if v_orig.matter_id <> new.matter_id or v_orig.trust_account_id <> new.trust_account_id or v_orig.customer_id <> new.customer_id then
      raise exception 'REVERSAL_MISMATCH';
    end if;
    if new.amount <> -v_orig.amount then raise exception 'REVERSAL_AMOUNT_MISMATCH'; end if;
    new.reference_doc_id := v_orig.reference_doc_id;
  end if;

  -- Serialise every writer on this account and this matter, in a fixed order, so the balance
  -- read below cannot go stale before the row is inserted.
  perform pg_advisory_xact_lock(hashtextextended('trust-acct:' || new.trust_account_id::text, 0));
  perform pg_advisory_xact_lock(hashtextextended('trust-matter:' || new.matter_id::text, 0));

  select coalesce(sum(amount), 0) into v_matter_bal from public.lalum_trust_ledger where matter_id = new.matter_id;
  if v_matter_bal + new.amount < 0 then
    raise exception 'TRUST_OVERDRAFT_MATTER: balance %, delta %', v_matter_bal, new.amount;
  end if;
  select coalesce(sum(amount), 0) into v_acct_bal from public.lalum_trust_ledger where trust_account_id = new.trust_account_id;
  if v_acct_bal + new.amount < 0 then
    raise exception 'TRUST_OVERDRAFT_ACCOUNT: balance %, delta %', v_acct_bal, new.amount;
  end if;

  if new.receipt_no is null or btrim(new.receipt_no) = '' then
    insert into public.lalum_trust_receipt_counters as c (firm_id, last_no) values (new.firm_id, 1)
      on conflict (firm_id) do update set last_no = c.last_no + 1
      returning last_no into v_n;
    new.receipt_no := 'TR-' || lpad(v_n::text, 6, '0');
  end if;
  return new;
end $$;
revoke execute on function public.lalum_trust_guard() from public, anon, authenticated;

create or replace function public.lalum_trust_immutable() returns trigger
language plpgsql set search_path to 'public' as $$
begin raise exception 'TRUST_LEDGER_IMMUTABLE'; end $$;
revoke execute on function public.lalum_trust_immutable() from public, anon, authenticated;

drop trigger if exists lalum_trust_guard_t on public.lalum_trust_ledger;
-- receipt_no is NOT NULL, so the placeholder default is filled by the guard before the check runs.
alter table public.lalum_trust_ledger alter column receipt_no set default '';
create trigger lalum_trust_guard_t before insert on public.lalum_trust_ledger
  for each row execute function public.lalum_trust_guard();
drop trigger if exists lalum_trust_no_change on public.lalum_trust_ledger;
create trigger lalum_trust_no_change before update or delete on public.lalum_trust_ledger
  for each row execute function public.lalum_trust_immutable();
drop trigger if exists lalum_trust_no_truncate on public.lalum_trust_ledger;
create trigger lalum_trust_no_truncate before truncate on public.lalum_trust_ledger
  for each statement execute function public.lalum_trust_immutable();

drop trigger if exists lalum_audit_t on public.lalum_trust_ledger;
create trigger lalum_audit_t after insert on public.lalum_trust_ledger
  for each row execute function public.lalum_billing_audit_trg();
drop trigger if exists lalum_audit_t on public.lalum_trust_accounts;
create trigger lalum_audit_t after insert or update or delete on public.lalum_trust_accounts
  for each row execute function public.lalum_billing_audit_trg();

-- ───────────────────────── open amount of an invoice, in one place ─────────────────────────

create or replace function public.lalum_invoice_open_amount(p_doc uuid) returns numeric
language sql stable security definer set search_path to 'public' as $$
  select d.total
       - coalesce((select sum(p.amount) from public.lalum_fin_payments p where p.document_id = d.id), 0)
       - coalesce((select sum(x.total) from public.lalum_fin_documents x
                    where x.related_doc_id = d.id and x.status = 'ISSUED' and not x.is_test
                      and x.doc_type in ('RECEIPT','CREDIT')), 0)
       - coalesce((select -sum(t.amount) from public.lalum_trust_ledger t
                    where t.reference_doc_id = d.id and t.tx_type in ('EARNED_FEE_TRANSFER','REVERSAL')), 0)
    from public.lalum_fin_documents d where d.id = p_doc $$;
revoke execute on function public.lalum_invoice_open_amount(uuid) from public, anon, authenticated;

-- ───────────────────────── trust RPCs ─────────────────────────

create or replace function public.lalum_trust_balance(p_matter uuid) returns numeric
language plpgsql stable security definer set search_path to 'public' as $$
begin
  if not (public.lalum_is_staff_on(p_matter) or public.lalum_fin_can(public.lalum_matter_firm(p_matter))) then raise exception 'FORBIDDEN'; end if;
  return (select coalesce(sum(amount), 0) from public.lalum_trust_ledger where matter_id = p_matter);
end $$;
revoke execute on function public.lalum_trust_balance(uuid) from public, anon;
grant execute on function public.lalum_trust_balance(uuid) to authenticated;

create or replace function public.lalum_client_trust_balance(p_matter uuid) returns numeric
language plpgsql stable security definer set search_path to 'public' as $$
begin
  if not public.lalum_client_can(p_matter, false) then raise exception 'FORBIDDEN'; end if;
  return (select coalesce(sum(amount), 0) from public.lalum_trust_ledger where matter_id = p_matter);
end $$;
revoke execute on function public.lalum_client_trust_balance(uuid) from public, anon;
grant execute on function public.lalum_client_trust_balance(uuid) to authenticated;

-- Post a movement. p_amount is a positive magnitude; the sign comes from the type.
-- EARNED_FEE_TRANSFER goes through lalum_trust_apply_to_invoice. A correction is a REVERSAL.
create or replace function public.lalum_trust_post(
  p_matter uuid, p_account uuid, p_type text, p_amount numeric,
  p_counterparty text default null, p_notes text default null, p_reverses bigint default null) returns bigint
language plpgsql security definer set search_path to 'public' as $$
declare v_firm uuid := public.lalum_matter_firm(p_matter); v_cust uuid; v_signed numeric; v_orig numeric; v_id bigint;
begin
  if v_firm is null or not public.lalum_fin_can(v_firm) then raise exception 'FORBIDDEN'; end if;
  if p_type not in ('DEPOSIT','DISBURSEMENT_TO_THIRD_PARTY','REFUND_TO_CLIENT','REVERSAL') then raise exception 'BAD_TYPE'; end if;
  select fin_customer_id into v_cust from public.lalum_matter_fees where matter_id = p_matter;
  if v_cust is null then raise exception 'MATTER_HAS_NO_CUSTOMER'; end if;
  if p_type = 'REVERSAL' then
    select amount into v_orig from public.lalum_trust_ledger where id = p_reverses;
    if v_orig is null then raise exception 'REVERSAL_TARGET_MISSING'; end if;
    v_signed := -v_orig;
  else
    if coalesce(p_amount, 0) <= 0 then raise exception 'BAD_AMOUNT'; end if;
    v_signed := case when p_type = 'DEPOSIT' then p_amount else -p_amount end;
  end if;
  insert into public.lalum_trust_ledger (firm_id, trust_account_id, matter_id, customer_id, tx_type, amount, counterparty, notes, reverses_entry_id)
    values (v_firm, p_account, p_matter, v_cust, p_type, v_signed, p_counterparty, p_notes, p_reverses)
    returning id into v_id;
  return v_id;
end $$;
revoke execute on function public.lalum_trust_post(uuid, uuid, text, numeric, text, text, bigint) from public, anon;
grant execute on function public.lalum_trust_post(uuid, uuid, text, numeric, text, text, bigint) to authenticated;

-- Pay an issued invoice from trust: moves earned fees out of the client's money.
create or replace function public.lalum_trust_apply_to_invoice(p_matter uuid, p_account uuid, p_doc uuid, p_amount numeric) returns bigint
language plpgsql security definer set search_path to 'public' as $$
declare v_firm uuid := public.lalum_matter_firm(p_matter); v_cust uuid; d record; v_open numeric; v_id bigint;
begin
  if v_firm is null or not public.lalum_fin_can(v_firm) then raise exception 'FORBIDDEN'; end if;
  if coalesce(p_amount, 0) <= 0 then raise exception 'BAD_AMOUNT'; end if;
  select fin_customer_id into v_cust from public.lalum_matter_fees where matter_id = p_matter;
  select * into d from public.lalum_fin_documents where id = p_doc;
  if v_cust is null or not found or d.firm_id <> v_firm or d.customer_id <> v_cust then raise exception 'INVOICE_NOT_FOR_THIS_MATTER'; end if;
  if d.doc_type <> 'INVOICE' or d.status <> 'ISSUED' or d.is_test then raise exception 'INVOICE_NOT_PAYABLE'; end if;
  v_open := public.lalum_invoice_open_amount(p_doc);
  if p_amount > v_open then raise exception 'EXCEEDS_OPEN_AMOUNT: open %', v_open; end if;
  insert into public.lalum_trust_ledger (firm_id, trust_account_id, matter_id, customer_id, tx_type, amount, reference_doc_id)
    values (v_firm, p_account, p_matter, v_cust, 'EARNED_FEE_TRANSFER', -p_amount, p_doc)
    returning id into v_id;
  return v_id;
end $$;
revoke execute on function public.lalum_trust_apply_to_invoice(uuid, uuid, uuid, numeric) from public, anon;
grant execute on function public.lalum_trust_apply_to_invoice(uuid, uuid, uuid, numeric) to authenticated;

-- Ledger against the bank statement, per account.
create or replace function public.lalum_trust_reconciliation() returns jsonb
language plpgsql security definer set search_path to 'public' as $$
declare v_firm uuid := public.lalum_my_firm_id(); v_out jsonb;
begin
  if not public.lalum_fin_can(v_firm) then raise exception 'FORBIDDEN'; end if;
  perform public.lalum_audit_write(v_firm, 'VIEWED_FINANCIALS', 'trust_reconciliation', null, '{}'::jsonb);
  select coalesce(jsonb_agg(row_to_json(x)), '[]'::jsonb) into v_out from (
    select a.id as trust_account_id, a.bank_name, a.branch, a.account_number,
           coalesce((select sum(amount) from public.lalum_trust_ledger l where l.trust_account_id = a.id), 0) as ledger_balance,
           s.as_of as statement_as_of, s.balance as statement_balance,
           case when s.as_of is not null then
             coalesce((select sum(amount) from public.lalum_trust_ledger l where l.trust_account_id = a.id and l.created_at::date <= s.as_of), 0) - s.balance end as difference_at_statement_date
      from public.lalum_trust_accounts a
      left join lateral (select as_of, balance from public.lalum_trust_bank_statements b where b.trust_account_id = a.id order by as_of desc limit 1) s on true
     where a.firm_id = v_firm order by a.created_at) x;
  return v_out;
end $$;
revoke execute on function public.lalum_trust_reconciliation() from public, anon;
grant execute on function public.lalum_trust_reconciliation() to authenticated;

-- ───────────────────────── disbursements ─────────────────────────

create table if not exists public.lalum_disbursements (
  id             uuid primary key default gen_random_uuid(),
  firm_id        uuid not null references public.lalum_firms(id) on delete cascade,
  matter_id      uuid not null references public.lalum_cockpit_matters(id) on delete restrict,
  expense_type   text not null default 'OTHER' check (expense_type in ('COURT_FEE','EXPERT_WITNESS','COURIER','PHOTOCOPY','OTHER')),
  amount         numeric(14,2) not null check (amount > 0),
  description    text not null check (length(btrim(description)) > 0),
  is_reimbursable boolean not null default true,
  status         text not null default 'UNBILLED' check (status in ('UNBILLED','BILLED','REIMBURSED')),
  invoice_doc_id uuid references public.lalum_fin_documents(id),
  incurred_date  date not null default current_date,
  created_by     uuid default auth.uid(),
  created_at     timestamptz not null default now(),
  check (status <> 'BILLED' or invoice_doc_id is not null)
);
create index if not exists lalum_disbursements_matter_idx on public.lalum_disbursements (matter_id, status);

create or replace function public.lalum_firm_from_matter() returns trigger
language plpgsql security definer set search_path to 'public' as $$
begin
  new.firm_id := public.lalum_matter_firm(new.matter_id);
  if new.firm_id is null then raise exception 'NO_SUCH_MATTER'; end if;
  return new;
end $$;
revoke execute on function public.lalum_firm_from_matter() from public, anon, authenticated;

create or replace function public.lalum_disbursements_guard() returns trigger
language plpgsql set search_path to 'public' as $$
begin
  if auth.uid() is null then return coalesce(new, old); end if;
  if tg_op = 'DELETE' then
    if old.status <> 'UNBILLED' then raise exception 'DISBURSEMENT_LOCKED'; end if;
    return old;
  end if;
  if old.status <> 'UNBILLED' and (new.amount is distinct from old.amount or new.matter_id is distinct from old.matter_id
     or new.expense_type is distinct from old.expense_type or new.invoice_doc_id is distinct from old.invoice_doc_id) then
    raise exception 'DISBURSEMENT_LOCKED';
  end if;
  return new;
end $$;

-- ───────────────────────── deadlines with client visibility ─────────────────────────

create table if not exists public.lalum_deadlines (
  id                   uuid primary key default gen_random_uuid(),
  firm_id              uuid not null references public.lalum_firms(id) on delete cascade,
  matter_id            uuid not null references public.lalum_cockpit_matters(id) on delete cascade,
  title                text not null check (length(btrim(title)) between 1 and 255),
  kind                 text not null default 'INTERNAL' check (kind in ('HEARING','FILING','INTERNAL')),
  due_date             date not null,
  due_time             time,
  status               text not null default 'PENDING' check (status in ('PENDING','DONE','DISMISSED')),
  is_client_visible    boolean not null default false,
  client_display_title text,
  client_instructions  text,
  assigned_user_id     uuid references auth.users(id) on delete set null,
  source_note          text,
  created_by           uuid default auth.uid(),
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  check (kind <> 'INTERNAL' or not is_client_visible)
);
create index if not exists lalum_deadlines_matter_idx on public.lalum_deadlines (matter_id, due_date);
create index if not exists lalum_deadlines_due_idx on public.lalum_deadlines (due_date, status);

-- ───────────────────────── client document intake gate ─────────────────────────

create table if not exists public.lalum_client_submissions (
  id                   uuid primary key default gen_random_uuid(),
  firm_id              uuid not null references public.lalum_firms(id) on delete cascade,
  matter_id            uuid not null references public.lalum_cockpit_matters(id) on delete cascade,
  client_user_id       uuid not null default auth.uid() references auth.users(id) on delete restrict,
  file_name            text not null check (length(btrim(file_name)) between 1 and 255),
  storage_path         text not null unique,
  mime_type            text not null check (mime_type in ('application/pdf','image/jpeg','image/png','application/vnd.openxmlformats-officedocument.wordprocessingml.document')),
  file_size_bytes      bigint not null check (file_size_bytes between 1 and 26214400),
  client_notes         text check (client_notes is null or length(client_notes) <= 4000),
  status               text not null default 'pending' check (status in ('pending','approved','rejected')),
  reviewed_by          uuid references auth.users(id) on delete set null,
  reviewed_at          timestamptz,
  rejection_reason     text,
  promoted_document_id uuid references public.lalum_matter_documents(id) on delete set null,
  created_at           timestamptz not null default now(),
  check (status <> 'rejected' or length(btrim(coalesce(rejection_reason, ''))) > 0),
  check (status = 'pending' or reviewed_at is not null)
);
create index if not exists lalum_client_submissions_matter_idx on public.lalum_client_submissions (matter_id, status);

-- ───────────────────────── manual weekly cash forecast ─────────────────────────
-- Entered by the partner. Nothing here is computed from collections: there is no collection
-- history to derive it from. The UI must label it as a manual forecast.

create table if not exists public.lalum_cash_forecast_items (
  id               uuid primary key default gen_random_uuid(),
  firm_id          uuid not null references public.lalum_firms(id) on delete cascade,
  week_ending      date not null check (extract(dow from week_ending) = 5),
  category         text not null check (category in ('INFLOW_COLLECTIONS','INFLOW_RETAINER','OUTFLOW_PAYROLL','OUTFLOW_PAYROLL_TAX','OUTFLOW_RENT_OFFICE','OUTFLOW_DISBURSEMENTS_PREPAID','OUTFLOW_TAX_REMITTANCE')),
  projected_amount numeric(14,2) not null default 0 check (projected_amount >= 0),
  actual_amount    numeric(14,2) check (actual_amount is null or actual_amount >= 0),
  variance_reason  text check (variance_reason in ('TIMING','AMOUNT','MISSED')),
  notes            text,
  created_by       uuid default auth.uid(),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (firm_id, week_ending, category)
);

alter table public.lalum_matter_fees add column if not exists trust_low_threshold numeric(14,2) check (trust_low_threshold is null or trust_low_threshold >= 0);

-- ───────────────────────── triggers for the new tables ─────────────────────────

drop trigger if exists lalum_firm_t on public.lalum_disbursements;
create trigger lalum_firm_t before insert on public.lalum_disbursements for each row execute function public.lalum_firm_from_matter();
drop trigger if exists lalum_firm_t on public.lalum_deadlines;
create trigger lalum_firm_t before insert on public.lalum_deadlines for each row execute function public.lalum_firm_from_matter();
drop trigger if exists lalum_firm_t on public.lalum_client_submissions;
create trigger lalum_firm_t before insert on public.lalum_client_submissions for each row execute function public.lalum_firm_from_matter();
drop trigger if exists lalum_disbursements_guard_t on public.lalum_disbursements;
create trigger lalum_disbursements_guard_t before update or delete on public.lalum_disbursements for each row execute function public.lalum_disbursements_guard();

drop trigger if exists lalum_audit_t on public.lalum_disbursements;
create trigger lalum_audit_t after insert or update or delete on public.lalum_disbursements for each row execute function public.lalum_billing_audit_trg();
drop trigger if exists lalum_audit_t on public.lalum_deadlines;
create trigger lalum_audit_t after insert or update or delete on public.lalum_deadlines for each row execute function public.lalum_billing_audit_trg();
drop trigger if exists lalum_audit_t on public.lalum_client_submissions;
create trigger lalum_audit_t after insert or update on public.lalum_client_submissions for each row execute function public.lalum_billing_audit_trg();
drop trigger if exists lalum_audit_t on public.lalum_cash_forecast_items;
create trigger lalum_audit_t after insert or update or delete on public.lalum_cash_forecast_items for each row execute function public.lalum_billing_audit_trg();

-- ───────────────────────── submission and deadline RPCs ─────────────────────────

create or replace function public.lalum_submission_review(p_id uuid, p_decision text, p_reason text default null) returns void
language plpgsql security definer set search_path to 'public' as $$
declare s record;
begin
  select * into s from public.lalum_client_submissions where id = p_id;
  if not found or not public.lalum_is_staff_on(s.matter_id) then raise exception 'FORBIDDEN'; end if;
  if s.status <> 'pending' then raise exception 'ALREADY_REVIEWED'; end if;
  if p_decision not in ('approved','rejected') then raise exception 'BAD_DECISION'; end if;
  if p_decision = 'rejected' and length(btrim(coalesce(p_reason, ''))) = 0 then raise exception 'REASON_REQUIRED'; end if;
  update public.lalum_client_submissions
     set status = p_decision, reviewed_by = auth.uid(), reviewed_at = now(),
         rejection_reason = case when p_decision = 'rejected' then p_reason end
   where id = p_id;
end $$;
revoke execute on function public.lalum_submission_review(uuid, text, text) from public, anon;
grant execute on function public.lalum_submission_review(uuid, text, text) to authenticated;

create or replace function public.lalum_submission_link_document(p_id uuid, p_doc uuid) returns void
language plpgsql security definer set search_path to 'public' as $$
declare s record;
begin
  select * into s from public.lalum_client_submissions where id = p_id;
  if not found or not public.lalum_is_staff_on(s.matter_id) then raise exception 'FORBIDDEN'; end if;
  if s.status <> 'approved' then raise exception 'NOT_APPROVED'; end if;
  if not exists (select 1 from public.lalum_matter_documents d where d.id = p_doc and d.matter_id = s.matter_id) then raise exception 'DOCUMENT_NOT_ON_MATTER'; end if;
  update public.lalum_client_submissions set promoted_document_id = p_doc where id = p_id;
end $$;
revoke execute on function public.lalum_submission_link_document(uuid, uuid) from public, anon;
grant execute on function public.lalum_submission_link_document(uuid, uuid) to authenticated;

-- The only way a client sees deadlines: visible rows, client facing wording, nothing else.
create or replace function public.lalum_client_deadlines(p_matter uuid) returns jsonb
language plpgsql stable security definer set search_path to 'public' as $$
begin
  if not public.lalum_client_can(p_matter, false) then raise exception 'FORBIDDEN'; end if;
  return (select coalesce(jsonb_agg(jsonb_build_object(
            'id', d.id, 'title', coalesce(nullif(btrim(d.client_display_title), ''), d.title), 'kind', d.kind,
            'due_date', d.due_date, 'due_time', d.due_time, 'instructions', d.client_instructions) order by d.due_date), '[]'::jsonb)
            from public.lalum_deadlines d
           where d.matter_id = p_matter and d.is_client_visible and d.status = 'PENDING');
end $$;
revoke execute on function public.lalum_client_deadlines(uuid) from public, anon;
grant execute on function public.lalum_client_deadlines(uuid) to authenticated;

-- What the client sees of their own submissions, with the staff names left out.
create or replace function public.lalum_client_submission_list(p_matter uuid) returns jsonb
language plpgsql stable security definer set search_path to 'public' as $$
begin
  if not public.lalum_client_can(p_matter, false) then raise exception 'FORBIDDEN'; end if;
  return (select coalesce(jsonb_agg(jsonb_build_object(
            'id', s.id, 'file_name', s.file_name, 'status', s.status, 'created_at', s.created_at,
            'rejection_reason', s.rejection_reason) order by s.created_at desc), '[]'::jsonb)
            from public.lalum_client_submissions s where s.matter_id = p_matter and s.client_user_id = auth.uid());
end $$;
revoke execute on function public.lalum_client_submission_list(uuid) from public, anon;
grant execute on function public.lalum_client_submission_list(uuid) to authenticated;

-- ───────────────────────── RLS and grants ─────────────────────────

alter table public.lalum_trust_accounts        enable row level security;
alter table public.lalum_trust_receipt_counters enable row level security;
alter table public.lalum_trust_ledger          enable row level security;
alter table public.lalum_trust_bank_statements enable row level security;
alter table public.lalum_disbursements         enable row level security;
alter table public.lalum_deadlines             enable row level security;
alter table public.lalum_client_submissions    enable row level security;
alter table public.lalum_cash_forecast_items   enable row level security;

revoke all on public.lalum_trust_accounts, public.lalum_trust_receipt_counters, public.lalum_trust_ledger,
  public.lalum_trust_bank_statements, public.lalum_disbursements, public.lalum_deadlines,
  public.lalum_client_submissions, public.lalum_cash_forecast_items from anon, authenticated;

create policy lalum_trust_accounts_all on public.lalum_trust_accounts for all
  using ((select public.lalum_fin_can(firm_id))) with check ((select public.lalum_fin_can(firm_id)));
grant select, insert, update on public.lalum_trust_accounts to authenticated;

create policy lalum_trust_ledger_read on public.lalum_trust_ledger for select
  using ((select public.lalum_fin_can(firm_id)));
grant select on public.lalum_trust_ledger to authenticated;

create policy lalum_trust_statements_all on public.lalum_trust_bank_statements for all
  using ((select public.lalum_fin_can(firm_id))) with check ((select public.lalum_fin_can(firm_id)));
grant select, insert on public.lalum_trust_bank_statements to authenticated;

create policy lalum_disbursements_all on public.lalum_disbursements for all
  using ((select public.lalum_fin_can(firm_id))) with check ((select public.lalum_fin_can(firm_id)));
grant select, insert, update, delete on public.lalum_disbursements to authenticated;

create policy lalum_deadlines_staff on public.lalum_deadlines for all
  using (public.lalum_is_staff_on(matter_id)) with check (public.lalum_is_staff_on(matter_id));
grant select, insert, update, delete on public.lalum_deadlines to authenticated;

create policy lalum_submissions_read on public.lalum_client_submissions for select
  using (public.lalum_is_staff_on(matter_id) or client_user_id = (select auth.uid()));
create policy lalum_submissions_insert on public.lalum_client_submissions for insert
  with check (client_user_id = (select auth.uid()) and status = 'pending' and public.lalum_client_can(matter_id, true));
grant select, insert on public.lalum_client_submissions to authenticated;

create policy lalum_cash_forecast_all on public.lalum_cash_forecast_items for all
  using ((select public.lalum_fin_can(firm_id))) with check ((select public.lalum_fin_can(firm_id)));
grant select, insert, update, delete on public.lalum_cash_forecast_items to authenticated;

-- ───────────────────────── 0017 functions, now aware of trust ─────────────────────────

create or replace function public.lalum_partner_overview() returns jsonb
language plpgsql security definer set search_path to 'public' as $$
declare
  v_firm uuid := public.lalum_my_firm_id();
  v_wip numeric; v_wip_h numeric; v_norate integer; v_fixed_h numeric; v_ar jsonb; v_pending integer; v_trust numeric; v_low jsonb;
begin
  if not public.lalum_fin_can(v_firm) then raise exception 'FORBIDDEN'; end if;
  perform public.lalum_audit_write(v_firm, 'VIEWED_FINANCIALS', 'partner_overview', null, '{}'::jsonb);

  select coalesce(sum(case when r.rate is not null then te.billable_minutes / 60.0 * r.rate end), 0),
         coalesce(sum(te.billable_minutes), 0) / 60.0,
         count(*) filter (where r.rate is null)
    into v_wip, v_wip_h, v_norate
    from public.lalum_time_entries te
    join public.lalum_matter_fees f on f.matter_id = te.matter_id and f.fee_model in ('hourly','capped','hybrid')
    cross join lateral (select public.lalum_entry_rate(te.firm_id, te.matter_id, te.timekeeper_id, te.work_date) as rate) r
   where te.firm_id = v_firm and te.status in ('submitted','approved');

  select coalesce(sum(te.billable_minutes), 0) / 60.0 into v_fixed_h
    from public.lalum_time_entries te
    left join public.lalum_matter_fees f on f.matter_id = te.matter_id
   where te.firm_id = v_firm and te.status in ('submitted','approved')
     and (f.matter_id is null or f.fee_model not in ('hourly','capped','hybrid'));

  select count(*) into v_pending from public.lalum_time_entries where firm_id = v_firm and status = 'submitted';

  with inv as (
    select d.id, coalesce(d.due_date, d.issue_date) as due, public.lalum_invoice_open_amount(d.id) as open_amt
      from public.lalum_fin_documents d
     where d.firm_id = v_firm and d.doc_type = 'INVOICE' and d.status = 'ISSUED' and not d.is_test
  ), b as (
    select case when current_date - due <= 0 then 'current'
                when current_date - due <= 30 then 'd1_30'
                when current_date - due <= 60 then 'd31_60'
                when current_date - due <= 90 then 'd61_90'
                else 'd90_plus' end as bucket, open_amt
      from inv where open_amt > 0.004
  )
  select jsonb_build_object(
           'current',  coalesce(sum(open_amt) filter (where bucket = 'current'), 0),
           'd1_30',    coalesce(sum(open_amt) filter (where bucket = 'd1_30'), 0),
           'd31_60',   coalesce(sum(open_amt) filter (where bucket = 'd31_60'), 0),
           'd61_90',   coalesce(sum(open_amt) filter (where bucket = 'd61_90'), 0),
           'd90_plus', coalesce(sum(open_amt) filter (where bucket = 'd90_plus'), 0),
           'total',    coalesce(sum(open_amt), 0))
    into v_ar from b;

  select coalesce(sum(amount), 0) into v_trust from public.lalum_trust_ledger where firm_id = v_firm;

  select coalesce(jsonb_agg(jsonb_build_object('matter_id', x.matter_id, 'title', x.title, 'balance', x.bal, 'threshold', x.thr)), '[]'::jsonb)
    into v_low
    from (select l.matter_id, m.title, sum(l.amount) as bal, f.trust_low_threshold as thr
            from public.lalum_trust_ledger l
            join public.lalum_cockpit_matters m on m.id = l.matter_id
            join public.lalum_matter_fees f on f.matter_id = l.matter_id and f.trust_low_threshold is not null
           where l.firm_id = v_firm group by l.matter_id, m.title, f.trust_low_threshold
          having sum(l.amount) < f.trust_low_threshold) x;

  return jsonb_build_object(
    'wip_value', round(v_wip, 2), 'wip_hours', round(v_wip_h, 2),
    'entries_without_rate', v_norate, 'unbilled_hours_non_hourly_matters', round(v_fixed_h, 2),
    'entries_awaiting_approval', v_pending, 'ar_aging', v_ar,
    'trust_liability', v_trust, 'trust_below_threshold', v_low,
    'excludes', jsonb_build_array('Invoice4U archive documents', 'operating cash balance', 'collection based cash forecast'));
end $$;

create or replace function public.lalum_client_matter_financials(p_matter uuid) returns jsonb
language plpgsql security definer set search_path to 'public' as $$
declare v_cust uuid; v_firm uuid; v_out jsonb;
begin
  if not public.lalum_client_can(p_matter, false) then raise exception 'FORBIDDEN'; end if;
  select f.fin_customer_id, f.firm_id into v_cust, v_firm from public.lalum_matter_fees f where f.matter_id = p_matter;
  perform public.lalum_audit_write(coalesce(v_firm, public.lalum_matter_firm(p_matter)), 'VIEWED_FINANCIALS', 'client_matter_financials', p_matter::text, '{}'::jsonb);
  if v_cust is null then return '[]'::jsonb; end if;
  select coalesce(jsonb_agg(row_to_json(x) order by x.issue_date desc), '[]'::jsonb) into v_out from (
    select d.id, d.doc_type, d.doc_number, d.subject, d.issue_date, d.due_date, d.total, d.pdf_url,
           case when d.doc_type = 'INVOICE' then public.lalum_invoice_open_amount(d.id) end as open_amount
      from public.lalum_fin_documents d
     where d.customer_id = v_cust and d.firm_id = v_firm and d.status = 'ISSUED' and not d.is_test
       and d.doc_type in ('INVOICE','INVOICE_RECEIPT','RECEIPT','CREDIT')) x;
  return v_out;
end $$;
