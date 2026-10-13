-- Finance: a trust account that carries movements keeps its identity.
-- Bank, branch, account number and opening date are what every ledger row and bank statement of the account refer to.
-- Changing them after the fact would silently rewrite that history (and the value-date guard of 0033 reads opened_on),
-- so once the account has any ledger movement or any bank statement they can no longer be changed. Closing the account
-- (closed_on) is still allowed; a different bank account means a new account. The screen shows the lock before the user
-- types; this trigger is the rule itself, so a direct update is refused too.
-- NOT YET APPLIED to the project: apply with the Supabase MCP / CLI after review.

create or replace function public.lalum_trust_account_identity_guard() returns trigger
language plpgsql set search_path to 'public' as $$
begin
  if (new.bank_name, new.branch, new.account_number, new.opened_on, new.firm_id)
       is distinct from (old.bank_name, old.branch, old.account_number, old.opened_on, old.firm_id)
     and (exists (select 1 from public.lalum_trust_ledger l where l.trust_account_id = old.id)
          or exists (select 1 from public.lalum_trust_bank_statements s where s.trust_account_id = old.id)) then
    raise exception 'ACCOUNT_LOCKED_HAS_MOVEMENTS';
  end if;
  return new;
end $$;
revoke execute on function public.lalum_trust_account_identity_guard() from public, anon, authenticated;

drop trigger if exists lalum_trust_account_identity_t on public.lalum_trust_accounts;
create trigger lalum_trust_account_identity_t before update on public.lalum_trust_accounts
  for each row execute function public.lalum_trust_account_identity_guard();
