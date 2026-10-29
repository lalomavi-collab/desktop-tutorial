begin;
-- What Financy shows about the firm's money beyond the business account's own lines, read by hand (Chrome, read only) until a direct
-- bank connection exists (the owner, 29.10: "למשוך הכל"). Financy's free plan has no export and no API for these, so each month the
-- monthly close reads its screens and the owner pastes the result. Nothing here is written by the app or by a job.
--
-- lalum_fin_ext_lines: one row per transaction Financy lists.
--  * card: the business Visa card (account_ref = its last four digits), merchant by merchant, in the currency charged. The bank
--    already holds the card's monthly bill as one line, so these rows are detail for the dashboard and are never added to the cash.
--  * current: the business current account (account_ref = account_last4 of lalum_fin_bank_accounts) before its first statement
--    line. The dashboard uses only the days before that line, chained back from the statement's opening balance, so a statement
--    imported later for the same days replaces them without counting anything twice. They never enter lalum_fin_bank_lines, the
--    reconciliation or the closings.
-- import_hash is built from the account, the date, the amount, the currency, the text and the occurrence on that day, so a second
-- paste of the same read adds nothing. Two identical charges on one day (a purchase in installments) stay two rows.
--
-- lalum_fin_ext_facts: figures Financy states about an account on a day: the card's open charge and its due date, the card limit, the
-- overdraft limit, a bank guarantee, a foreign currency balance. One row per kind, account and day; the dashboard reads the newest.
--
-- Read from finance level 3 only (the card holds the owner's own spending; the bookkeeper sees the bank lines, not this). No write
-- policy: rows come from the SQL editor. No owner name, no card holder, no profile data is stored.
--
-- Undo: drop table lalum_fin_ext_lines, lalum_fin_ext_facts.

create table if not exists public.lalum_fin_ext_lines (
  id              uuid primary key default gen_random_uuid(),
  firm_id         uuid not null references public.lalum_firms(id),
  source          text not null default 'financy' check (source = 'financy'),
  account_kind    text not null check (account_kind in ('card', 'current')),
  account_ref     text not null check (account_ref ~ '^[0-9]{4}$'),
  txn_date        date not null,
  description     text not null,
  source_category text,
  amount          numeric(14,2) not null,
  currency        text not null default 'ILS' check (currency ~ '^[A-Z]{3}$'),
  import_hash     text not null,
  read_on         date not null,
  created_at      timestamptz not null default now(),
  unique (firm_id, import_hash)
);
create index if not exists lalum_fin_ext_lines_firm_day on public.lalum_fin_ext_lines (firm_id, account_kind, txn_date);

create table if not exists public.lalum_fin_ext_facts (
  id          uuid primary key default gen_random_uuid(),
  firm_id     uuid not null references public.lalum_firms(id),
  source      text not null default 'financy' check (source = 'financy'),
  kind        text not null check (kind in ('CARD_ACCRUED', 'CARD_LIMIT', 'OVERDRAFT_LIMIT', 'GUARANTEE', 'FX_BALANCE')),
  account_ref text not null,
  label       text,
  amount      numeric(14,2) not null,
  currency    text not null default 'ILS' check (currency ~ '^[A-Z]{3}$'),
  due_on      date,
  as_of       date not null,
  created_at  timestamptz not null default now(),
  unique (firm_id, kind, account_ref, as_of)
);

alter table public.lalum_fin_ext_lines enable row level security;
alter table public.lalum_fin_ext_lines force row level security;
drop policy if exists lalum_fin_ext_lines_read on public.lalum_fin_ext_lines;
create policy lalum_fin_ext_lines_read on public.lalum_fin_ext_lines for select using ((select public.lalum_fin_can(firm_id, 3)));
revoke all on public.lalum_fin_ext_lines from anon, authenticated;
grant select on public.lalum_fin_ext_lines to authenticated;

alter table public.lalum_fin_ext_facts enable row level security;
alter table public.lalum_fin_ext_facts force row level security;
drop policy if exists lalum_fin_ext_facts_read on public.lalum_fin_ext_facts;
create policy lalum_fin_ext_facts_read on public.lalum_fin_ext_facts for select using ((select public.lalum_fin_can(firm_id, 3)));
revoke all on public.lalum_fin_ext_facts from anon, authenticated;
grant select on public.lalum_fin_ext_facts to authenticated;

insert into supabase_migrations.schema_migrations (version, name) values ('20261029150000', 'lalum_fin_ext_read') on conflict (version) do nothing;
commit;
