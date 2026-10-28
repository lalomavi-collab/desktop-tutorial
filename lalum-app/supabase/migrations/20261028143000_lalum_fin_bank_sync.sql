begin;
-- Daily bank feed from Financy (Open-Finance LTD) into the bank tables of 20261023101711, for the control room's cash tile and the
-- reconciliation. The edge function lalum-fin-bank-sync reads the business account through the Financy API (GET only) and writes here
-- through lalum_fin_bank_sync_apply, which only the service role can run. Until the owner enters the FINANCY_* secrets the function logs
-- not_configured and writes nothing.
--
-- What is synced: only a firm account linked to a Financy account (provider and provider_account_id below). The function links one
-- account by itself, and only when it is unambiguous: a CHECKING account at Leumi whose number ends in the account_last4 of the one
-- active Leumi account here (2082 on 28.10). Any other account in the owner's Financy profile (a private account, a card) is never
-- read past its type and provider, never written here, and never shown to the bookkeeper.
--
-- Overlap with the Leumi file: the file lines stay as they are (source 'file'). A linked account syncs from sync_from, set at link time
-- to the day after its last file line, so the same movement is not counted twice. Lines are keyed by the Financy transaction id
-- (import_hash 'financy:<id>'), so a rerun adds nothing.
--
-- Balances: Financy lines carry no running balance, so balance_after stays empty on them and the account's booked balance is stored
-- per day in lalum_fin_bank_balances. The snapshot shows the newest balance of either kind (20261028143100).
--
-- lalum_fin_recon_auto: the same function, the same body, with one change to its gate: the service role may run it, so every sync
-- matches the new lines against the issued documents and the expenses. A signed in user still needs finance level 3.
--
-- Paste in the SQL editor as one block. Undo: drop function lalum_fin_bank_sync_apply, lalum_fin_bank_sync_link; drop table
-- lalum_fin_bank_balances, lalum_fin_bank_sync_runs; drop the three account columns and the line column; recon_auto back to 20261023101711.

-- Where a line came from. Every existing line is the Leumi file.
alter table public.lalum_fin_bank_lines add column if not exists source text not null default 'file';
alter table public.lalum_fin_bank_lines drop constraint if exists lalum_fin_bank_lines_source_check;
alter table public.lalum_fin_bank_lines add constraint lalum_fin_bank_lines_source_check check (source in ('file', 'financy'));

-- The link to the provider's account, and the first day the feed may write.
alter table public.lalum_fin_bank_accounts
  add column if not exists provider text,
  add column if not exists provider_account_id text,
  add column if not exists sync_from date;
alter table public.lalum_fin_bank_accounts drop constraint if exists lalum_fin_bank_accounts_provider_check;
alter table public.lalum_fin_bank_accounts add constraint lalum_fin_bank_accounts_provider_check
  check (provider is null or provider = 'financy');
alter table public.lalum_fin_bank_accounts drop constraint if exists lalum_fin_bank_accounts_provider_pair;
alter table public.lalum_fin_bank_accounts add constraint lalum_fin_bank_accounts_provider_pair
  check ((provider is null) = (provider_account_id is null));
create unique index if not exists lalum_fin_bank_accounts_provider_key
  on public.lalum_fin_bank_accounts (firm_id, provider, provider_account_id) where provider_account_id is not null;

-- One booked balance per account, day and balance type, as the bank reported it.
create table if not exists public.lalum_fin_bank_balances (
  id              uuid primary key default gen_random_uuid(),
  firm_id         uuid not null references public.lalum_firms(id),
  bank_account_id uuid not null references public.lalum_fin_bank_accounts(id),
  as_of           date not null,
  balance         numeric(14,2) not null,
  balance_type    text not null,
  currency        text not null default 'ILS',
  source          text not null default 'financy' check (source in ('file', 'financy')),
  fetched_at      timestamptz not null default now(),
  unique (bank_account_id, as_of, balance_type)
);
create index if not exists lalum_fin_bank_balances_firm_day on public.lalum_fin_bank_balances (firm_id, as_of desc);
-- Same model as the other bank tables: read from finance level 1 (the bookkeeper included), write from level 3.
alter table public.lalum_fin_bank_balances enable row level security;
alter table public.lalum_fin_bank_balances force row level security;
drop policy if exists lalum_fin_bank_balances_read on public.lalum_fin_bank_balances;
create policy lalum_fin_bank_balances_read on public.lalum_fin_bank_balances for select
  using ((select public.lalum_fin_can(firm_id, 1)));
drop policy if exists lalum_fin_bank_balances_write on public.lalum_fin_bank_balances;
create policy lalum_fin_bank_balances_write on public.lalum_fin_bank_balances for all
  using ((select public.lalum_fin_can(firm_id, 3))) with check ((select public.lalum_fin_can(firm_id, 3)));
revoke all on public.lalum_fin_bank_balances from anon;
grant select, insert, update, delete on public.lalum_fin_bank_balances to authenticated;

-- One row per run, counts only (no amount, no description, no name). No policy: read through SQL and the snapshot, not from the app.
create table if not exists public.lalum_fin_bank_sync_runs (
  id     bigint generated always as identity primary key,
  ran_at timestamptz not null default now(),
  status text not null,
  detail jsonb not null default '{}'::jsonb
);
alter table public.lalum_fin_bank_sync_runs enable row level security;
revoke all on public.lalum_fin_bank_sync_runs from anon, authenticated;

-- Links a firm account to a Financy account once. A linked account is never pointed elsewhere by the sync.
create or replace function public.lalum_fin_bank_sync_link(p_account uuid, p_provider_account_id text)
returns date
language plpgsql
security invoker
set search_path = public
as $$
declare v_from date;
begin
  if current_user <> 'service_role' then raise exception 'lalum_fin_bank_sync_link: service role only'; end if;
  if coalesce(p_provider_account_id, '') = '' then raise exception 'lalum_fin_bank_sync_link: no provider account'; end if;
  select coalesce(max(l.value_date) + 1, current_date - 365) into v_from
    from public.lalum_fin_bank_lines l where l.bank_account_id = p_account and l.source = 'file';
  update public.lalum_fin_bank_accounts
     set provider = 'financy', provider_account_id = p_provider_account_id, sync_from = coalesce(sync_from, v_from)
   where id = p_account and provider is null and is_active
  returning sync_from into v_from;
  if not found then raise exception 'lalum_fin_bank_sync_link: account is missing, inactive or already linked'; end if;
  return v_from;
end $$;
revoke all on function public.lalum_fin_bank_sync_link(uuid, text) from public, anon, authenticated;
grant execute on function public.lalum_fin_bank_sync_link(uuid, text) to service_role;

-- Writes one account's new lines and its balance, then reconciles the last 45 days. Lines before sync_from are dropped here, whatever
-- the function sent.
create or replace function public.lalum_fin_bank_sync_apply(p_account uuid, p_lines jsonb, p_balance jsonb default null)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_firm     uuid;
  v_since    date;
  v_inserted int := 0;
  v_first    date;
  v_balance  int := 0;
  v_matched  int := 0;
begin
  if current_user <> 'service_role' then raise exception 'lalum_fin_bank_sync_apply: service role only'; end if;
  select a.firm_id, a.sync_from into v_firm, v_since
    from public.lalum_fin_bank_accounts a where a.id = p_account and a.provider = 'financy' and a.is_active;
  if v_firm is null then raise exception 'lalum_fin_bank_sync_apply: not a linked account'; end if;
  if jsonb_array_length(coalesce(p_lines, '[]'::jsonb)) > 5000 then
    raise exception 'lalum_fin_bank_sync_apply: % lines in one run, the cap is 5000', jsonb_array_length(p_lines);
  end if;

  with ins as (
    insert into public.lalum_fin_bank_lines (firm_id, bank_account_id, value_date, posted_date, description, reference, amount,
                                             source, source_file, import_hash, created_by)
    select v_firm, p_account, l.value_date, l.posted_date, left(l.description, 500), left(l.reference, 200), l.amount,
           'financy', 'Financy API', l.import_hash, null
      from jsonb_to_recordset(coalesce(p_lines, '[]'::jsonb))
        as l(import_hash text, value_date date, posted_date date, description text, reference text, amount numeric)
     where l.import_hash like 'financy:_%' and l.value_date is not null and l.amount is not null
       and (v_since is null or l.value_date >= v_since)
    on conflict (firm_id, import_hash) do nothing
    returning value_date
  )
  select count(*), min(value_date) into v_inserted, v_first from ins;

  if p_balance is not null and p_balance ->> 'balance' is not null and p_balance ->> 'as_of' is not null then
    insert into public.lalum_fin_bank_balances (firm_id, bank_account_id, as_of, balance, balance_type, currency, source, fetched_at)
    values (v_firm, p_account, (p_balance ->> 'as_of')::date, (p_balance ->> 'balance')::numeric,
            coalesce(nullif(p_balance ->> 'type', ''), 'unknown'), coalesce(nullif(p_balance ->> 'currency', ''), 'ILS'), 'financy', now())
    on conflict (bank_account_id, as_of, balance_type)
    do update set balance = excluded.balance, currency = excluded.currency, fetched_at = excluded.fetched_at;
    v_balance := 1;
  end if;

  -- A receipt issued a few days after the money came in matches on a later run, so the window looks back, not only at today's lines.
  v_matched := public.lalum_fin_recon_auto(v_firm, least(coalesce(v_first, current_date - 45), current_date - 45), current_date);

  return jsonb_build_object('inserted', v_inserted, 'first_day', v_first, 'balance', v_balance, 'matched', v_matched);
end $$;
revoke all on function public.lalum_fin_bank_sync_apply(uuid, jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.lalum_fin_bank_sync_apply(uuid, jsonb, jsonb) to service_role;

-- 20261023101711, unchanged but for the first line of the body.
create or replace function public.lalum_fin_recon_auto(p_firm uuid, p_from date, p_to date, p_days int default 7)
returns integer language plpgsql security invoker set search_path = public as $$
declare n int := 0; k int;
begin
  if not (current_user = 'service_role' or public.lalum_fin_can(p_firm, 3)) then raise exception 'forbidden'; end if;
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
grant execute on function public.lalum_fin_recon_auto(uuid,date,date,int) to authenticated, service_role;

insert into supabase_migrations.schema_migrations (version, name) values ('20261028143000', 'lalum_fin_bank_sync') on conflict (version) do nothing;
commit;

-- What was applied: expected 6 rows.
select 'account' as what, label || ' linked=' || (provider is not null)::text as value from public.lalum_fin_bank_accounts
union all select 'balances', count(*)::text from public.lalum_fin_bank_balances
union all select 'functions', count(*)::text from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                               where n.nspname = 'public' and p.proname in ('lalum_fin_bank_sync_apply', 'lalum_fin_bank_sync_link')
union all select 'lines by source', string_agg(s.source || ' ' || s.n, ', ') from (select source, count(*)::text n from public.lalum_fin_bank_lines group by 1) s
union all select 'migration', version || ' ' || name from supabase_migrations.schema_migrations where version = '20261028143000'
union all select 'runs', count(*)::text from public.lalum_fin_bank_sync_runs
order by 1, 2;
