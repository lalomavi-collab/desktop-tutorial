-- Finance: correcting a trust bank statement balance, without editing history.
-- A statement row is never updated by a user and never deleted. A correction inserts a new row for the same account and
-- date and marks the old one superseded, with who, when and why. The reconciliation then reads only the live row.
-- NOT YET APPLIED to the project: apply with the Supabase MCP / CLI after review.

alter table public.lalum_trust_bank_statements
  add column if not exists superseded_at timestamptz,
  add column if not exists superseded_by uuid references public.lalum_trust_bank_statements(id),
  add column if not exists superseded_by_user uuid,
  add column if not exists correction_reason text check (correction_reason is null or length(btrim(correction_reason)) between 3 and 500),
  add column if not exists corrects_id uuid references public.lalum_trust_bank_statements(id);

-- One live statement per account and date; superseded rows may repeat the pair.
alter table public.lalum_trust_bank_statements drop constraint if exists lalum_trust_bank_statements_trust_account_id_as_of_key;
create unique index if not exists lalum_trust_statements_live_uq
  on public.lalum_trust_bank_statements (trust_account_id, as_of) where superseded_at is null;

-- The only way to change a statement figure. Runs as definer because users have no UPDATE grant on the table.
create or replace function public.lalum_trust_statement_correct(p_statement uuid, p_balance numeric, p_reason text) returns uuid
language plpgsql security definer set search_path to 'public' as $$
declare s record; v_new uuid;
begin
  select * into s from public.lalum_trust_bank_statements where id = p_statement for update;
  if not found then raise exception 'STATEMENT_NOT_FOUND'; end if;
  if not public.lalum_fin_can(s.firm_id) then raise exception 'FORBIDDEN'; end if;
  if s.superseded_at is not null then raise exception 'STATEMENT_ALREADY_SUPERSEDED'; end if;
  if p_balance is null then raise exception 'BAD_BALANCE'; end if;
  if p_balance = s.balance then raise exception 'NO_CHANGE'; end if;
  if p_reason is null or length(btrim(p_reason)) < 3 then raise exception 'REASON_REQUIRED'; end if;
  update public.lalum_trust_bank_statements set superseded_at = now(), superseded_by_user = auth.uid() where id = s.id;
  insert into public.lalum_trust_bank_statements (firm_id, trust_account_id, as_of, balance, correction_reason, corrects_id)
    values (s.firm_id, s.trust_account_id, s.as_of, p_balance, btrim(p_reason), s.id) returning id into v_new;
  update public.lalum_trust_bank_statements set superseded_by = v_new where id = s.id;
  perform public.lalum_audit_write(s.firm_id, 'CORRECTED', 'lalum_trust_bank_statements', v_new::text,
    jsonb_build_object('account', s.trust_account_id, 'as_of', s.as_of, 'from', s.balance, 'to', p_balance, 'reason', btrim(p_reason)));
  return v_new;
end $$;
revoke execute on function public.lalum_trust_statement_correct(uuid, numeric, text) from public, anon;
grant execute on function public.lalum_trust_statement_correct(uuid, numeric, text) to authenticated;

-- Reconciliation reads the live statement only (0020 definition, plus the superseded filter).
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
      left join lateral (select as_of, balance from public.lalum_trust_bank_statements b where b.trust_account_id = a.id and b.superseded_at is null order by as_of desc limit 1) s on true
     where a.firm_id = v_firm order by a.created_at) x;
  return v_out;
end $$;
revoke execute on function public.lalum_trust_reconciliation() from public, anon;
grant execute on function public.lalum_trust_reconciliation() to authenticated;
