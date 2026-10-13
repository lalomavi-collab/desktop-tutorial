-- Finance: a bank statement balance is dated by its value date.
-- lalum_trust_bank_statements.as_of is the date the balance is struck on, which is what the reconciliation compares the
-- ledger's value dates against (0033). It follows the same two rules as a ledger movement: not in the future (Israel date),
-- Applied to project meoymkcotomoluwlwues (function and trigger as two migrations) and checked in a rolled-back transaction.
-- (0032) inserts a row for the same date, so it passes through the same check.
-- Applied to project meoymkcotomoluwlwues as "lalum_trust_statement_value_date_guard_fn" and "..._trigger".

create or replace function public.lalum_trust_statement_date_guard() returns trigger
language plpgsql set search_path to 'public' as $$
declare v_opened date;
begin
  if new.as_of > (now() at time zone 'Asia/Jerusalem')::date then raise exception 'VALUE_DATE_IN_FUTURE'; end if;
  select opened_on into v_opened from public.lalum_trust_accounts where id = new.trust_account_id;
  if v_opened is not null and new.as_of < v_opened then raise exception 'VALUE_DATE_BEFORE_ACCOUNT_OPENED'; end if;
  return new;
end $$;
revoke execute on function public.lalum_trust_statement_date_guard() from public, anon, authenticated;

create trigger lalum_trust_statement_date_t before insert on public.lalum_trust_bank_statements
  for each row execute function public.lalum_trust_statement_date_guard();
