begin;
-- Two sources for the same bank account until a direct bank connection exists (the owner, 29.10): the Financy feed, twice a day, and
-- the bank's own statement, once a month. Both now write lines through one function, lalum_fin_bank_lines_merge, so the same movement
-- is stored once whichever source brings it first. Apply after 20261028143000 and 20261029100000.
--
-- The same movement: the same account, the same amount, and the same value date, counted by occurrence. If the statement shows two
-- charges of 200 on a day and the feed already holds one, the first is the feed's and the second is new. Lines that miss an exact
-- partner are tried one day either side, because the statement and Financy can date a cheque or a card settlement a day apart; each
-- line of the other source is used once, the earlier day first. A rerun of one source is caught by its own key (import_hash).
--
-- The statement's running balance is kept even where its line is not stored: every day a file brings becomes one 'file' closing in
-- lalum_fin_bank_balances (lalum_fin_bank_closing). Balances are now unique per source, so the feed's booked balance and the
-- statement's closing for the same day sit side by side. The existing file lines get their daily closings below.
--
-- lalum_fin_bank_lines_merge(account, 'file' | 'financy', lines, balance default null): a statement is merged by the service role,
-- the owner in the SQL editor, or finance level 3; feed lines only by the service role, only on a linked account, only from
-- sync_from. lalum_fin_bank_sync_apply keeps its signature and its answer and now writes through it. A statement line is
-- {import_hash, value_date, amount} (the file's own key, never 'financy:'; + money in, - money out) with balance_after, posted_date,
-- description, reference and source_file when the file has them, in the statement's order, oldest first. The answer counts every
-- line once: invalid, before_sync, already (key stored or repeated), duplicates, near_duplicates, inserted; and balances written.
--
-- v_fin_bank_balance_check: for each source's balances in turn, the bank's change between two balances against the lines stored for
-- the days between. gap is that interval's difference and drift adds the gaps up. A movement the two sources date a day apart shows
-- as a gap and its opposite in the next interval, so the drift comes back to zero; a drift that stays is a line missing or counted
-- twice.
--
-- Paste in the SQL editor as one block. Undo: drop the view and lalum_fin_bank_lines_merge, delete the 'file' balances, restore the
-- unique key (bank_account_id, as_of, balance_type) and lalum_fin_bank_sync_apply of 20261028143000.

-- One balance per account, day, type and source.
do $$
declare c text;
begin
  select con.conname into c from pg_constraint con
   where con.conrelid = 'public.lalum_fin_bank_balances'::regclass and con.contype = 'u'
     and (select array_agg(a.attname::text order by a.attname) from pg_attribute a
           where a.attrelid = con.conrelid and a.attnum = any (con.conkey)) = array['as_of', 'balance_type', 'bank_account_id'];
  if c is not null then execute format('alter table public.lalum_fin_bank_balances drop constraint %I', c); end if;
end $$;
alter table public.lalum_fin_bank_balances drop constraint if exists lalum_fin_bank_balances_day_key;
alter table public.lalum_fin_bank_balances add constraint lalum_fin_bank_balances_day_key unique (bank_account_id, as_of, balance_type, source);

create or replace function public.lalum_fin_bank_lines_merge(p_account uuid, p_source text, p_lines jsonb, p_balance jsonb default null)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_firm     uuid;
  v_since    date;
  v_provider text;
  v_currency text;
  v_lines    jsonb := coalesce(p_lines, '[]'::jsonb);
  v_valid    int;
  v_window   int;
  v_new      jsonb;
  v_dup      int[];
  v_rem      jsonb;
  v_free     jsonb;
  v_near     int[] := '{}';
  r          record;
  k          text;
  v_out      jsonb;
  v_bal      int := 0;
  n          int;
begin
  if p_source is null or p_source not in ('file', 'financy') then
    raise exception 'lalum_fin_bank_lines_merge: source must be file or financy';
  end if;
  select a.firm_id, a.sync_from, a.provider, coalesce(a.currency, 'ILS') into v_firm, v_since, v_provider, v_currency
    from public.lalum_fin_bank_accounts a where a.id = p_account and a.is_active;
  if v_firm is null then raise exception 'lalum_fin_bank_lines_merge: no such active account'; end if;
  if not (current_user in ('service_role', 'postgres') or public.lalum_fin_can(v_firm, 3)) then
    raise exception 'lalum_fin_bank_lines_merge: forbidden';
  end if;
  if p_source = 'financy' and (current_user <> 'service_role' or v_provider is distinct from 'financy') then
    raise exception 'lalum_fin_bank_lines_merge: feed lines come only from the feed, on a linked account';
  end if;
  if jsonb_typeof(v_lines) <> 'array' then raise exception 'lalum_fin_bank_lines_merge: lines must be an array'; end if;
  if jsonb_array_length(v_lines) > 5000 then
    raise exception 'lalum_fin_bank_lines_merge: % lines in one call, the cap is 5000', jsonb_array_length(v_lines);
  end if;

  -- A line needs its key, its value date and its amount, and its key says its source ('financy:<id>' for the feed, anything else for
  -- a statement). The feed's lines count from sync_from. A key already stored, or repeated in the call, is the same line again.
  with raw as (
    select x.ord::int as ord, x.e
      from jsonb_array_elements(v_lines) with ordinality as x(e, ord)
     where coalesce(x.e ->> 'import_hash', '') <> '' and x.e ->> 'value_date' is not null and x.e ->> 'amount' is not null
       and case when p_source = 'financy' then x.e ->> 'import_hash' like 'financy:_%' else x.e ->> 'import_hash' not like 'financy:%' end),
  win as (select * from raw where p_source = 'file' or v_since is null or (e ->> 'value_date')::date >= v_since),
  new as (
    select distinct on (w.e ->> 'import_hash') w.* from win w
     where not exists (select 1 from public.lalum_fin_bank_lines b where b.firm_id = v_firm and b.import_hash = w.e ->> 'import_hash')
     order by w.e ->> 'import_hash', w.ord)
  select (select count(*) from raw), (select count(*) from win),
         coalesce((select jsonb_agg(n.e || jsonb_build_object('ord', n.ord) order by n.ord) from new n), '[]'::jsonb)
    into v_valid, v_window, v_new;
  -- A statement is merged whole or not at all.
  if p_source = 'file' and v_valid < jsonb_array_length(v_lines) then
    raise exception 'lalum_fin_bank_lines_merge: % statement lines without a key, a value date or an amount, or with a feed key',
      jsonb_array_length(v_lines) - v_valid;
  end if;

  -- Per value date and amount, how many lines each source holds. A new line is the k-th of its source there, after the ones stored;
  -- it is a duplicate when the other source holds at least k.
  with new as (
    select (x ->> 'ord')::int as ord, (x ->> 'value_date')::date as d, (x ->> 'amount')::numeric(14,2) as a from jsonb_array_elements(v_new) x),
  stored as (
    select b.value_date as d, b.amount as a, count(*) filter (where b.source = p_source) as same,
           count(*) filter (where b.source <> p_source) as other
      from public.lalum_fin_bank_lines b
     where b.bank_account_id = p_account and b.value_date between (select min(d) - 1 from new) and (select max(d) + 1 from new)
     group by 1, 2),
  incoming as (select d, a, count(*) as n from new group by 1, 2),
  ranked as (
    select w.*, coalesce(s.same, 0) + row_number() over (partition by w.d, w.a order by w.ord) as pos, coalesce(s.other, 0) as other
      from new w left join stored s on s.d = w.d and s.a = w.a),
  -- Lines of the other source that this source does not match on their own day.
  free as (
    select s.d, s.a, s.other - s.same - coalesce(i.n, 0) as n
      from stored s left join incoming i on i.d = s.d and i.a = s.a
     where s.other - s.same - coalesce(i.n, 0) > 0)
  select array_agg(ord) filter (where pos <= other),
         (select jsonb_agg(jsonb_build_object('ord', q.ord, 'd', q.d, 'a', q.a) order by q.d, q.ord) from ranked q
           where q.pos > q.other and exists (select 1 from free f where f.a = q.a and abs(f.d - q.d) = 1)),
         (select jsonb_object_agg(f.d::text || '|' || f.a::text, f.n) from free f)
    into v_dup, v_rem, v_free
    from ranked;

  -- The rest, one day either side: each free line is used once, the earlier day first.
  v_free := coalesce(v_free, '{}'::jsonb);
  for r in select * from jsonb_to_recordset(coalesce(v_rem, '[]'::jsonb)) as x(ord int, d date, a numeric(14,2)) loop
    foreach k in array array[(r.d - 1)::text || '|' || r.a::text, (r.d + 1)::text || '|' || r.a::text] loop
      if coalesce((v_free ->> k)::int, 0) > 0 then
        v_free := jsonb_set(v_free, array[k], to_jsonb((v_free ->> k)::int - 1));
        v_near := v_near || r.ord;
        exit;
      end if;
    end loop;
  end loop;

  -- created_at follows the order of the lines, so lines stored in one call keep their order within the day.
  with ins as (
    insert into public.lalum_fin_bank_lines (firm_id, bank_account_id, value_date, posted_date, description, reference, amount,
                                             balance_after, source, source_file, import_hash, created_at)
    select v_firm, p_account, w.value_date, w.posted_date, left(w.description, 500), left(w.reference, 200), w.amount,
           case when p_source = 'file' then w.balance_after end, p_source,
           case when p_source = 'financy' then 'Financy API' else left(w.source_file, 200) end, w.import_hash,
           now() + w.ord * interval '1 microsecond'
      from jsonb_to_recordset(v_new) as w(ord int, import_hash text, value_date date, posted_date date, description text,
                                           reference text, amount numeric(14,2), balance_after numeric(14,2), source_file text)
     where w.ord <> all (coalesce(v_dup, '{}')) and w.ord <> all (v_near)
     order by w.ord
    on conflict (firm_id, import_hash) do nothing
    returning value_date)
  select jsonb_build_object(
           'received', jsonb_array_length(v_lines), 'invalid', jsonb_array_length(v_lines) - v_valid, 'before_sync', v_valid - v_window,
           'already', v_window - jsonb_array_length(v_new), 'duplicates', coalesce(cardinality(v_dup), 0),
           'near_duplicates', cardinality(v_near), 'inserted', (select count(*) from ins), 'first_day', (select min(value_date) from ins))
    into v_out;

  -- The balance the caller read (the feed's booked balance, or a statement's stated closing), then each day's closing on a statement.
  if p_balance is not null and p_balance ->> 'balance' is not null and p_balance ->> 'as_of' is not null then
    insert into public.lalum_fin_bank_balances (firm_id, bank_account_id, as_of, balance, balance_type, currency, source, fetched_at)
    values (v_firm, p_account, (p_balance ->> 'as_of')::date, (p_balance ->> 'balance')::numeric,
            coalesce(nullif(p_balance ->> 'type', ''), 'unknown'), coalesce(nullif(p_balance ->> 'currency', ''), v_currency), p_source, now())
    on conflict (bank_account_id, as_of, balance_type, source)
    do update set balance = excluded.balance, currency = excluded.currency, fetched_at = excluded.fetched_at;
    v_bal := 1;
  end if;
  if p_source = 'file' then
    insert into public.lalum_fin_bank_balances (firm_id, bank_account_id, as_of, balance, balance_type, currency, source, fetched_at)
    select v_firm, p_account, c.d, c.closing, 'closingBooked', v_currency, 'file', now()
      from (select (x.e ->> 'value_date')::date as d, public.lalum_fin_bank_closing(jsonb_agg(x.e order by x.ord)) as closing
              from jsonb_array_elements(v_lines) with ordinality as x(e, ord)
             where x.e ->> 'balance_after' is not null
             group by 1) c
     where c.closing is not null
    on conflict (bank_account_id, as_of, balance_type, source)
    do update set balance = excluded.balance, fetched_at = excluded.fetched_at;
    get diagnostics n = row_count;
    v_bal := v_bal + n;
  end if;

  return v_out || jsonb_build_object('balances', v_bal);
end $$;
revoke all on function public.lalum_fin_bank_lines_merge(uuid, text, jsonb, jsonb) from public, anon;
grant execute on function public.lalum_fin_bank_lines_merge(uuid, text, jsonb, jsonb) to authenticated, service_role;

-- The feed writes through the merge. Same signature, same answer (inserted, first_day, balance, matched), plus the merge's counts.
create or replace function public.lalum_fin_bank_sync_apply(p_account uuid, p_lines jsonb, p_balance jsonb default null)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_firm    uuid;
  v_merge   jsonb;
  v_first   date;
  v_matched int;
begin
  if current_user <> 'service_role' then raise exception 'lalum_fin_bank_sync_apply: service role only'; end if;
  select a.firm_id into v_firm from public.lalum_fin_bank_accounts a where a.id = p_account and a.provider = 'financy' and a.is_active;
  if v_firm is null then raise exception 'lalum_fin_bank_sync_apply: not a linked account'; end if;
  if jsonb_array_length(coalesce(p_lines, '[]'::jsonb)) > 5000 then
    raise exception 'lalum_fin_bank_sync_apply: % lines in one run, the cap is 5000', jsonb_array_length(p_lines);
  end if;

  v_merge := public.lalum_fin_bank_lines_merge(p_account, 'financy', p_lines, p_balance);
  v_first := (v_merge ->> 'first_day')::date;
  -- A receipt issued a few days after the money came in matches on a later run, so the window looks back, not only at today's lines.
  v_matched := public.lalum_fin_recon_auto(v_firm, least(coalesce(v_first, current_date - 45), current_date - 45), current_date);

  return v_merge || jsonb_build_object('balance', least((v_merge ->> 'balances')::int, 1), 'matched', v_matched);
end $$;
revoke all on function public.lalum_fin_bank_sync_apply(uuid, jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.lalum_fin_bank_sync_apply(uuid, jsonb, jsonb) to service_role;

-- The file lines already stored: one 'file' closing per day.
insert into public.lalum_fin_bank_balances (firm_id, bank_account_id, as_of, balance, balance_type, currency, source, fetched_at)
select c.firm_id, c.bank_account_id, c.d, c.closing, 'closingBooked', c.currency, 'file', now()
  from (select l.firm_id, l.bank_account_id, l.value_date as d, a.currency,
               public.lalum_fin_bank_closing(jsonb_agg(jsonb_build_object('amount', l.amount, 'balance_after', l.balance_after)
                                                       order by l.created_at, l.id)) as closing
          from public.lalum_fin_bank_lines l join public.lalum_fin_bank_accounts a on a.id = l.bank_account_id
         where l.source = 'file' and l.balance_after is not null
         group by l.firm_id, l.bank_account_id, l.value_date, a.currency) c
 where c.closing is not null
on conflict (bank_account_id, as_of, balance_type, source) do nothing;

-- Each source's balances against the lines between them. One balance per account, source and day: the booked closing when there is
-- one, else the newest read. lines counts every stored line of the interval, whichever source it came from.
create or replace view public.v_fin_bank_balance_check with (security_invoker = true) as
with pts as (
  select distinct on (b.bank_account_id, b.source, b.as_of) b.firm_id, b.bank_account_id, b.source, b.as_of, b.balance, b.balance_type
    from public.lalum_fin_bank_balances b
   order by b.bank_account_id, b.source, b.as_of, (b.balance_type = 'closingBooked') desc, b.fetched_at desc),
seq as (
  select p.*, lag(p.as_of) over w as prev_as_of, lag(p.balance) over w as prev_balance
    from pts p window w as (partition by p.bank_account_id, p.source order by p.as_of)),
chk as (
  select s.firm_id, s.bank_account_id, s.source, s.prev_as_of, s.as_of, s.balance_type, s.prev_balance, s.balance,
         coalesce(t.lines, 0) as lines, coalesce(t.file_lines, 0) as file_lines, coalesce(t.feed_lines, 0) as feed_lines,
         coalesce(t.total, 0) as lines_total, round(s.balance - s.prev_balance - coalesce(t.total, 0), 2) as gap
    from seq s
    left join lateral (
      select count(*) as lines, count(*) filter (where l.source = 'file') as file_lines, count(*) filter (where l.source = 'financy') as feed_lines,
             sum(l.amount) as total
        from public.lalum_fin_bank_lines l
       where l.bank_account_id = s.bank_account_id and l.value_date > s.prev_as_of and l.value_date <= s.as_of) t on true
   where s.prev_as_of is not null)
select c.*, sum(c.gap) over (partition by c.bank_account_id, c.source order by c.as_of) as drift from chk c;
revoke all on public.v_fin_bank_balance_check from anon;
grant select on public.v_fin_bank_balance_check to authenticated, service_role;

insert into supabase_migrations.schema_migrations (version, name) values ('20261029100100', 'lalum_fin_bank_lines_merge') on conflict (version) do nothing;
commit;
