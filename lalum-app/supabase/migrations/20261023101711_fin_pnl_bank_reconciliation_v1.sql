-- Recorded from the live project, not written in this repository.
-- Applied on 23.10.2026 at 10:17 UTC through the Supabase MCP connector under the owner's account
-- (supabase_migrations.schema_migrations version 20261023101711, created_by lalomavi@gmail.com).
-- No session working in this repository has been found that wrote it, and no pull request carried it.
-- The body below is the stored statement, unchanged: 10107 characters, and the md5 of its
-- whitespace-normalised text is c1210583445c43485b4e03b8a9f3a8a7, the same value the database returns.
-- Committing this file changes nothing in the database. Bank lines were later loaded into these
-- tables by plain SQL; that data is not part of this file and is not in the repository.
-- The file carries its live version as its name on purpose, so a tool that matches by version
-- finds it. How the other files are named is a separate decision (docs/infra/migrations-map.md).

-- Additive only: P&L + bank reconciliation layer (no changes to existing tables)

create table public.lalum_fin_bank_accounts (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid not null references public.lalum_firms(id),
  bank_code text not null default '10',          -- 10 = Bank Leumi
  branch text,
  account_last4 text check (account_last4 ~ '^[0-9]{4}$'), -- never store full account number
  label text not null,
  currency text not null default 'ILS',
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.lalum_fin_bank_lines (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid not null references public.lalum_firms(id),
  bank_account_id uuid not null references public.lalum_fin_bank_accounts(id),
  value_date date not null,
  posted_date date,
  description text,
  reference text,
  amount numeric(14,2) not null,                  -- + credit (inflow), - debit (outflow)
  balance_after numeric(14,2),
  source_file text,
  import_hash text not null,                      -- idempotency key per firm
  import_run_id uuid references public.lalum_fin_import_runs(id),
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  unique (firm_id, import_hash)
);
create index on public.lalum_fin_bank_lines (firm_id, value_date);
create index on public.lalum_fin_bank_lines (firm_id, amount);

create table public.lalum_fin_recon_matches (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid not null references public.lalum_firms(id),
  bank_line_id uuid not null references public.lalum_fin_bank_lines(id),
  target_kind text not null check (target_kind in ('income_doc','expense','transfer','private','tax','other')),
  archive_id uuid references public.lalum_fin_archive(id),
  expense_id uuid references public.lalum_fin_expenses(id),
  matched_amount numeric(14,2) not null,
  method text not null check (method in ('auto_exact','auto_fuzzy','manual')),
  confidence numeric(4,3),
  note text,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  check ((target_kind='income_doc') = (archive_id is not null)),
  check ((target_kind='expense') = (expense_id is not null))
);
create unique index on public.lalum_fin_recon_matches (bank_line_id, coalesce(archive_id, expense_id));
create index on public.lalum_fin_recon_matches (firm_id, archive_id);
create index on public.lalum_fin_recon_matches (firm_id, expense_id);

-- Revenue classification overrides (default: 10XXX = partnership settlement, rest = fees)
create table public.lalum_fin_revenue_class (
  archive_id uuid primary key references public.lalum_fin_archive(id),
  firm_id uuid not null references public.lalum_firms(id),
  revenue_class text not null check (revenue_class in ('fees','partnership','other','exclude')),
  note text,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now()
);

-- RLS: same model as existing fin tables, plus FORCE
do $$ declare t text; begin
  foreach t in array array['lalum_fin_bank_accounts','lalum_fin_bank_lines','lalum_fin_recon_matches','lalum_fin_revenue_class'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('alter table public.%I force row level security', t);
    execute format('create policy %I on public.%I for select using ((select public.lalum_fin_can(firm_id, 1)))', t||'_read', t);
    execute format('create policy %I on public.%I for all using ((select public.lalum_fin_can(firm_id, 3))) with check ((select public.lalum_fin_can(firm_id, 3)))', t||'_write', t);
  end loop;
end $$;

-- Recognised revenue lines: tax docs only (1 invoice, 3 invoice-receipt, 4 credit = negative). 90XXX proformas excluded.
create view public.v_fin_revenue_lines with (security_invoker = true) as
select a.firm_id, a.id archive_id, a.issue_date, date_trunc('month', a.issue_date)::date period,
       a.i4u_doc_type, a.doc_number, a.raw->>'ClientName' client, a.subject,
       case when a.i4u_doc_type = 4 then -a.subtotal else a.subtotal end net_amount,
       case when a.i4u_doc_type = 4 then -a.vat_amount else a.vat_amount end vat_amount,
       coalesce(rc.revenue_class, case when a.doc_number between 10000 and 19999 then 'partnership' else 'fees' end) revenue_class
from public.lalum_fin_archive a
left join public.lalum_fin_revenue_class rc on rc.archive_id = a.id
where a.i4u_doc_type in (1,3,4);

create view public.v_fin_expense_lines with (security_invoker = true) as
select e.firm_id, e.id expense_id, e.spent_on, date_trunc('month', e.spent_on)::date period, e.supplier, e.category,
       e.total, e.vat_amount,
       round(e.total - coalesce(e.vat_amount,0) * coalesce(e.vat_recoverable_pct,0)/100, 2) net_cost,
       round((e.total - coalesce(e.vat_amount,0) * coalesce(e.vat_recoverable_pct,0)/100) * coalesce(e.income_tax_recognition_pct,100)/100, 2) recognised_cost
from public.lalum_fin_expenses e;

create view public.v_fin_pnl_monthly with (security_invoker = true) as
with r as (
  select firm_id, period,
    sum(net_amount) filter (where revenue_class='fees') fees,
    sum(net_amount) filter (where revenue_class='other') other_income,
    sum(net_amount) filter (where revenue_class='partnership') partnership,
    sum(vat_amount) filter (where revenue_class<>'exclude') output_vat
  from public.v_fin_revenue_lines group by 1,2),
x as (
  select firm_id, period, sum(recognised_cost) expenses, count(*) expense_docs from public.v_fin_expense_lines group by 1,2)
select coalesce(r.firm_id,x.firm_id) firm_id, coalesce(r.period,x.period) period,
  coalesce(fees,0) fees, coalesce(other_income,0) other_income, coalesce(partnership,0) partnership,
  coalesce(fees,0)+coalesce(other_income,0)+coalesce(partnership,0) total_revenue,
  coalesce(expenses,0) expenses, coalesce(expense_docs,0) expense_docs,
  coalesce(fees,0)+coalesce(other_income,0)+coalesce(partnership,0)-coalesce(expenses,0) operating_profit,
  coalesce(output_vat,0) output_vat
from r full join x on r.firm_id=x.firm_id and r.period=x.period;

-- Reconciliation status per bank line and per document
create view public.v_fin_recon_bank_status with (security_invoker = true) as
select l.*, coalesce(sum(m.matched_amount),0) matched_total,
  case when coalesce(sum(m.matched_amount),0)=0 then 'unmatched'
       when abs(coalesce(sum(m.matched_amount),0)) = abs(l.amount) then 'matched' else 'partial' end status
from public.lalum_fin_bank_lines l left join public.lalum_fin_recon_matches m on m.bank_line_id=l.id
group by l.id;

create view public.v_fin_recon_doc_status with (security_invoker = true) as
select 'income_doc' kind, a.firm_id, a.id doc_id, a.issue_date doc_date, a.doc_number::text ref, a.raw->>'ClientName' party,
       a.total gross, coalesce(sum(m.matched_amount),0) matched,
       case when coalesce(sum(m.matched_amount),0)=0 then 'no_bank_evidence'
            when coalesce(sum(m.matched_amount),0) >= a.total then 'matched' else 'partial' end status
from public.lalum_fin_archive a left join public.lalum_fin_recon_matches m on m.archive_id=a.id
where a.i4u_doc_type in (1,3)
group by a.id
union all
select 'expense', e.firm_id, e.id, e.spent_on, e.supplier_doc_ref, e.supplier, e.total, coalesce(sum(-m.matched_amount),0),
       case when coalesce(sum(m.matched_amount),0)=0 then 'no_bank_evidence'
            when coalesce(sum(-m.matched_amount),0) >= e.total then 'matched' else 'partial' end
from public.lalum_fin_expenses e left join public.lalum_fin_recon_matches m on m.expense_id=e.id
group by e.id;

-- Auto-match: exact gross amount, unique candidate within +/- p_days. Runs as caller (RLS applies).
create function public.lalum_fin_recon_auto(p_firm uuid, p_from date, p_to date, p_days int default 7)
returns integer language plpgsql security invoker set search_path = public as $$
declare n int := 0; k int;
begin
  if not public.lalum_fin_can(p_firm, 3) then raise exception 'forbidden'; end if;
  with cand as (
    select l.id line_id, a.id doc_id, l.amount,
           count(*) over (partition by l.id) c_line, count(*) over (partition by a.id) c_doc
    from lalum_fin_bank_lines l
    join lalum_fin_archive a on a.firm_id=l.firm_id and a.i4u_doc_type in (1,3)
         and a.total = l.amount and abs(a.issue_date - l.value_date) <= p_days
    where l.firm_id=p_firm and l.amount>0 and l.value_date between p_from and p_to
      and not exists (select 1 from lalum_fin_recon_matches m where m.bank_line_id=l.id)
      and not exists (select 1 from lalum_fin_recon_matches m where m.archive_id=a.id))
  insert into lalum_fin_recon_matches(firm_id, bank_line_id, target_kind, archive_id, matched_amount, method, confidence)
  select p_firm, line_id, 'income_doc', doc_id, amount, 'auto_exact', 0.95 from cand where c_line=1 and c_doc=1;
  get diagnostics k = row_count; n := n + k;
  with cand as (
    select l.id line_id, e.id exp_id, l.amount,
           count(*) over (partition by l.id) c_line, count(*) over (partition by e.id) c_exp
    from lalum_fin_bank_lines l
    join lalum_fin_expenses e on e.firm_id=l.firm_id and e.total = -l.amount and abs(e.spent_on - l.value_date) <= p_days
    where l.firm_id=p_firm and l.amount<0 and l.value_date between p_from and p_to
      and not exists (select 1 from lalum_fin_recon_matches m where m.bank_line_id=l.id)
      and not exists (select 1 from lalum_fin_recon_matches m where m.expense_id=e.id))
  insert into lalum_fin_recon_matches(firm_id, bank_line_id, target_kind, expense_id, matched_amount, method, confidence)
  select p_firm, line_id, 'expense', exp_id, amount, 'auto_exact', 0.9 from cand where c_line=1 and c_exp=1;
  get diagnostics k = row_count; n := n + k;
  return n;
end $$;
revoke all on function public.lalum_fin_recon_auto(uuid,date,date,int) from public, anon;
grant execute on function public.lalum_fin_recon_auto(uuid,date,date,int) to authenticated;
revoke all on public.v_fin_revenue_lines, public.v_fin_expense_lines, public.v_fin_pnl_monthly, public.v_fin_recon_bank_status, public.v_fin_recon_doc_status from anon;
