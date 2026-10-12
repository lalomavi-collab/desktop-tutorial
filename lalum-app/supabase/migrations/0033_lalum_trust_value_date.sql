-- Finance: value date (תאריך ערך) on trust ledger movements.
-- The bank counts a movement on its value date; the ledger so far counted it on the day it was recorded
-- (created_at). A cheque or transfer recorded today with a value date last Friday made the reconciliation show a
-- timing difference that was really just the wrong date. value_date is set when the movement is posted and, like
-- the rest of the row, is never edited. A correction (REVERSAL) takes the original's value date so the pair nets
-- to zero at every statement date.
--  * no future value date (Israel date), none before the trust account was opened
--  * lalum_trust_post / lalum_trust_apply_to_invoice gain an optional p_value_date (default: today, Israel date)
--  * lalum_trust_reconciliation compares the bank statement with the ledger by value date
-- The ledger must be empty when this runs: the immutable-row trigger forbids a backfill, and a default would
-- stamp old rows with today's date. Checked below.
-- NOT YET APPLIED to the project: apply with the Supabase MCP / CLI after review.

do $$ begin
  if exists (select 1 from public.lalum_trust_ledger) then
    raise exception 'LEDGER_NOT_EMPTY: backfill value_date from created_at (with the immutable trigger disabled) before this migration';
  end if;
end $$;

alter table public.lalum_trust_ledger
  add column if not exists value_date date not null default ((now() at time zone 'Asia/Jerusalem')::date);

create or replace function public.lalum_trust_value_date_guard() returns trigger
language plpgsql set search_path to 'public' as $$
declare v_opened date;
begin
  if new.value_date > (now() at time zone 'Asia/Jerusalem')::date then raise exception 'VALUE_DATE_IN_FUTURE'; end if;
  select opened_on into v_opened from public.lalum_trust_accounts where id = new.trust_account_id;
  if v_opened is not null and new.value_date < v_opened then raise exception 'VALUE_DATE_BEFORE_ACCOUNT_OPENED'; end if;
  return new;
end $$;
revoke execute on function public.lalum_trust_value_date_guard() from public, anon, authenticated;
drop trigger if exists lalum_trust_value_date_t on public.lalum_trust_ledger;
create trigger lalum_trust_value_date_t before insert on public.lalum_trust_ledger
  for each row execute function public.lalum_trust_value_date_guard();

-- Replace the 7 and 4 argument versions with ones that take a value date.
drop function if exists public.lalum_trust_post(uuid, uuid, text, numeric, text, text, bigint);
create or replace function public.lalum_trust_post(
  p_matter uuid, p_account uuid, p_type text, p_amount numeric,
  p_counterparty text default null, p_notes text default null, p_reverses bigint default null, p_value_date date default null) returns bigint
language plpgsql security definer set search_path to 'public' as $$
declare v_firm uuid := public.lalum_matter_firm(p_matter); v_cust uuid; v_signed numeric; v_orig numeric; v_orig_vd date; v_vd date; v_id bigint;
begin
  if v_firm is null or not public.lalum_fin_can(v_firm) then raise exception 'FORBIDDEN'; end if;
  if p_type not in ('DEPOSIT','DISBURSEMENT_TO_THIRD_PARTY','REFUND_TO_CLIENT','REVERSAL') then raise exception 'BAD_TYPE'; end if;
  select fin_customer_id into v_cust from public.lalum_matter_fees where matter_id = p_matter;
  if v_cust is null then raise exception 'MATTER_HAS_NO_CUSTOMER'; end if;
  if p_type = 'REVERSAL' then
    select amount, value_date into v_orig, v_orig_vd from public.lalum_trust_ledger where id = p_reverses;
    if v_orig is null then raise exception 'REVERSAL_TARGET_MISSING'; end if;
    v_signed := -v_orig;
    v_vd := v_orig_vd;
  else
    if coalesce(p_amount, 0) <= 0 then raise exception 'BAD_AMOUNT'; end if;
    v_signed := case when p_type = 'DEPOSIT' then p_amount else -p_amount end;
    v_vd := coalesce(p_value_date, (now() at time zone 'Asia/Jerusalem')::date);
  end if;
  insert into public.lalum_trust_ledger (firm_id, trust_account_id, matter_id, customer_id, tx_type, amount, counterparty, notes, reverses_entry_id, value_date)
    values (v_firm, p_account, p_matter, v_cust, p_type, v_signed, p_counterparty, p_notes, p_reverses, v_vd)
    returning id into v_id;
  return v_id;
end $$;
revoke execute on function public.lalum_trust_post(uuid, uuid, text, numeric, text, text, bigint, date) from public, anon;
grant execute on function public.lalum_trust_post(uuid, uuid, text, numeric, text, text, bigint, date) to authenticated;

drop function if exists public.lalum_trust_apply_to_invoice(uuid, uuid, uuid, numeric);
create or replace function public.lalum_trust_apply_to_invoice(p_matter uuid, p_account uuid, p_doc uuid, p_amount numeric, p_value_date date default null) returns bigint
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
  insert into public.lalum_trust_ledger (firm_id, trust_account_id, matter_id, customer_id, tx_type, amount, reference_doc_id, value_date)
    values (v_firm, p_account, p_matter, v_cust, 'EARNED_FEE_TRANSFER', -p_amount, p_doc, coalesce(p_value_date, (now() at time zone 'Asia/Jerusalem')::date))
    returning id into v_id;
  return v_id;
end $$;
revoke execute on function public.lalum_trust_apply_to_invoice(uuid, uuid, uuid, numeric, date) from public, anon;
grant execute on function public.lalum_trust_apply_to_invoice(uuid, uuid, uuid, numeric, date) to authenticated;

-- Reconciliation: ledger up to the statement date by value date (0032 definition, created_at replaced by value_date).
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
             coalesce((select sum(amount) from public.lalum_trust_ledger l where l.trust_account_id = a.id and l.value_date <= s.as_of), 0) - s.balance end as difference_at_statement_date
      from public.lalum_trust_accounts a
      left join lateral (select as_of, balance from public.lalum_trust_bank_statements b where b.trust_account_id = a.id and b.superseded_at is null order by as_of desc limit 1) s on true
     where a.firm_id = v_firm order by a.created_at) x;
  return v_out;
end $$;
revoke execute on function public.lalum_trust_reconciliation() from public, anon;
grant execute on function public.lalum_trust_reconciliation() to authenticated;
