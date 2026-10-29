-- Tests for migration 20261029160000 (the owner's daily read of Financy written as feed lines, and the API's link starting after it).
-- Order: 00_supabase_stubs, 09_fin_bank_sync_stub, 20261023101711_fin_pnl_bank_reconciliation_v1, 20261028143000_lalum_fin_bank_sync,
-- 20261029100000_lalum_fin_bank_closing, 10_fin_bank_merge_fixture, 20261029100100_lalum_fin_bank_lines_merge,
-- 20261029160000_lalum_fin_bank_hand_feed, then this file:
--   psql -v ON_ERROR_STOP=1 -f fin_bank_hand_feed.sql
-- Every assertion raises on failure; fixtures roll back. D is current_date - 20; the fixture's statement ends at D-1 (10,000).
begin;
grant all on all tables in schema public to service_role;
grant select, insert, update, delete on public.lalum_fin_bank_accounts, public.lalum_fin_bank_lines to authenticated;

create function pg_temp.l(h text, d int, a numeric, bal numeric default null) returns jsonb language sql as
  $$ select jsonb_strip_nulls(jsonb_build_object('import_hash', h, 'value_date', current_date - 20 + d, 'amount', a, 'balance_after', bal,
                                                  'description', h, 'source_file', case when h like 'financy:%' then 'Financy read' end)) $$;
create function pg_temp.b(d int, bal numeric) returns jsonb language sql as
  $$ select jsonb_build_object('as_of', current_date - 20 + d, 'balance', bal, 'type', 'financyScreen') $$;

-- 1. Without a sync_from the owner still cannot write feed lines.
do $$ begin
  perform public.lalum_fin_bank_lines_merge('00000000-0000-0000-0000-0000000000a1', 'financy', jsonb_build_array(pg_temp.l('financy:read:z', 0, 1)));
  raise exception 'the owner wrote feed lines with no sync_from';
exception when raise_exception then
  if sqlerrm not like '%only from the feed%' then raise; end if;
end $$;

-- 2. The first daily paste sets sync_from to the day after the statement, then the owner's read goes in as feed lines with the
--    screen's balance. A line before sync_from is dropped; the same read again adds nothing.
update public.lalum_fin_bank_accounts set sync_from = current_date - 20 where id = '00000000-0000-0000-0000-0000000000a1' and sync_from is null;
do $$
declare r jsonb;
begin
  r := public.lalum_fin_bank_lines_merge('00000000-0000-0000-0000-0000000000a1', 'financy',
         jsonb_build_array(pg_temp.l('financy:read:0', -1, 10304.41), pg_temp.l('financy:read:1', 0, -200), pg_temp.l('financy:read:2', 0, -200),
                           pg_temp.l('financy:read:3', 1, 500)),
         pg_temp.b(1, 10100));
  assert (r ->> 'inserted')::int = 3 and (r ->> 'before_sync')::int = 1 and (r ->> 'balances')::int = 1, 'first read ' || r::text;
  assert (select string_agg(source || ' ' || source_file || ' ' || coalesce(balance_after::text, '-'), ', ' order by import_hash)
            from public.lalum_fin_bank_lines where import_hash like 'financy:read:%') = 'financy Financy read -, financy Financy read -, financy Financy read -',
    'feed lines, named by the read, with no running balance';
  assert (select balance from public.lalum_fin_bank_balances where source = 'financy' and as_of = current_date - 19) = 10100, 'the screen balance';
  r := public.lalum_fin_bank_lines_merge('00000000-0000-0000-0000-0000000000a1', 'financy',
         jsonb_build_array(pg_temp.l('financy:read:1', 0, -200), pg_temp.l('financy:read:2', 0, -200), pg_temp.l('financy:read:3', 1, 500)),
         pg_temp.b(1, 10100));
  assert (r ->> 'inserted')::int = 0 and (r ->> 'already')::int = 3, 'the same read again ' || r::text;
  assert (select count(*) from public.lalum_fin_bank_balances where source = 'financy') = 1, 'the balance updated in place';
end $$;

-- 3. The month's statement later: lines the hand feed already holds are not stored twice, the one it missed is, and every day still
--    gets its 'file' closing.
do $$
declare r jsonb;
begin
  r := public.lalum_fin_bank_lines_merge('00000000-0000-0000-0000-0000000000a1', 'file',
         jsonb_build_array(pg_temp.l('leumi-xls:h1', 0, -200, 9800), pg_temp.l('leumi-xls:h2', 0, -200, 9600),
                           pg_temp.l('leumi-xls:h3', 1, 500, 10100), pg_temp.l('leumi-xls:h4', 1, 7, 10107)));
  assert (r ->> 'duplicates')::int = 3 and (r ->> 'inserted')::int = 1 and (r ->> 'balances')::int = 2, 'statement after the reads ' || r::text;
  assert (select count(*) from public.lalum_fin_bank_lines where value_date between current_date - 20 and current_date - 19) = 4, 'four movements, once each';
end $$;

-- 4. Nobody signed in to the app writes feed lines, even on an account with a sync_from; the service role still needs a link.
set local role authenticated;
select set_config('test.fin_level', '4', true);
do $$ begin
  perform public.lalum_fin_bank_lines_merge('00000000-0000-0000-0000-0000000000a1', 'financy', jsonb_build_array(pg_temp.l('financy:read:9', 2, 1)));
  raise exception 'a partner wrote feed lines';
exception when raise_exception then
  if sqlerrm not like '%only from the feed%' then raise; end if;
end $$;
reset role;
set local role service_role;
do $$ begin
  perform public.lalum_fin_bank_lines_merge('00000000-0000-0000-0000-0000000000a1', 'financy', jsonb_build_array(pg_temp.l('financy:x', 2, 1)));
  raise exception 'the service role wrote feed lines on an unlinked account';
exception when raise_exception then
  if sqlerrm not like '%only from the feed%' then raise; end if;
end $$;

-- 5. If the API is bought later, its lines start the day after the newest line stored, here the statement's D+1, not the hand
--    feed's sync_from, so a day already read is never brought again under the API's keys.
do $$ begin
  assert public.lalum_fin_bank_sync_link('00000000-0000-0000-0000-0000000000a1', 'fx1') = current_date - 18, 'sync from D+2';
  assert public.lalum_fin_bank_sync_link('00000000-0000-0000-0000-0000000000a2', 'fx2') = current_date - 365, 'no lines, a year back';
end $$;
reset role;

-- 6. Recorded under its version.
do $$ begin
  assert (select count(*) from supabase_migrations.schema_migrations where version = '20261029160000') = 1, 'migration recorded';
end $$;
rollback;
select 'fin_bank_hand_feed: all assertions passed' as result;
