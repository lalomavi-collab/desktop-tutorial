begin;
-- Financy every day on its free plan (the owner, 29.10: "המטרה לעדכן באופן יומי", "המקסימום שמסלול חינם נותן"). The free plan has no
-- API, so each morning the screens are read (Chrome, read only) and the owner pastes the day's lines in the SQL editor. They are the
-- same feed the API would bring, so they go through the same merge as source 'financy' with keys 'financy:read:<md5>', and the
-- monthly statement is matched against them exactly as against the API's lines: a movement is stored once whichever source has it
-- first, and the statement's running balance still becomes each day's 'file' closing.
--
-- Two changes, nothing else:
--  * lalum_fin_bank_lines_merge accepts feed lines from the owner (current_user postgres, the SQL editor) on an account with a
--    sync_from, the first day the hand feed may write, set once by the first daily paste. The app's users still cannot write them,
--    and the service role still needs a linked account. A hand line may name its read in source_file ('Financy read 2026-10-30').
--  * lalum_fin_bank_sync_link, if the API is ever bought, starts the API's lines the day after the newest line already stored from
--    either source, so it never brings again a day the hand feed read under other keys.
--
-- Apply after 20261029100100. Paste in the SQL editor as one block. Undo: the function blocks of 20261029100100 and 20261028143000.

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
  -- Feed lines come from the feed on a linked account, or from the owner in the SQL editor reading Financy by hand (its free plan has
  -- no API) on an account given a sync_from. Nobody signed in to the app writes them.
  if p_source = 'financy' and not ((current_user = 'service_role' and v_provider is not distinct from 'financy')
                                   or (current_user = 'postgres' and v_since is not null)) then
    raise exception 'lalum_fin_bank_lines_merge: feed lines come only from the feed, on a linked account, or from the owner on an account with sync_from';
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
           case when p_source = 'financy' then coalesce(left(w.source_file, 200), 'Financy API') else left(w.source_file, 200) end, w.import_hash,
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
  -- The day after the newest line of either source: before a link, feed lines can only be the owner's hand reads.
  select coalesce(max(l.value_date) + 1, current_date - 365) into v_from
    from public.lalum_fin_bank_lines l where l.bank_account_id = p_account;
  update public.lalum_fin_bank_accounts
     set provider = 'financy', provider_account_id = p_provider_account_id, sync_from = greatest(sync_from, v_from)
   where id = p_account and provider is null and is_active
  returning sync_from into v_from;
  if not found then raise exception 'lalum_fin_bank_sync_link: account is missing, inactive or already linked'; end if;
  return v_from;
end $$;
revoke all on function public.lalum_fin_bank_sync_link(uuid, text) from public, anon, authenticated;
grant execute on function public.lalum_fin_bank_sync_link(uuid, text) to service_role;

insert into supabase_migrations.schema_migrations (version, name) values ('20261029160000', 'lalum_fin_bank_hand_feed') on conflict (version) do nothing;
commit;
