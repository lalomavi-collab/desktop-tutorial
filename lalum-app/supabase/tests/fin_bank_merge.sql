-- Tests for migrations 20261029100000 (lalum_fin_bank_closing) and 20261029100100 (lalum_fin_bank_lines_merge, the feed through it,
-- balances per source, the backfill and v_fin_bank_balance_check). Order: 00_supabase_stubs, 09_fin_bank_sync_stub,
-- 20261023101711_fin_pnl_bank_reconciliation_v1, 20261028143000_lalum_fin_bank_sync, 20261029100000_lalum_fin_bank_closing,
-- 10_fin_bank_merge_fixture, 20261029100100_lalum_fin_bank_lines_merge, then this file:
--   psql -v ON_ERROR_STOP=1 -f fin_bank_merge.sql
-- Every assertion raises on failure; fixtures roll back. D is current_date - 20, as in the fixture.
--
-- The bank, day by day, from 10,000 at D-1: D two card charges of 200 (9,600); D+1 a transfer in of 500 (10,100); D+2 a cheque of 50
-- and a deposit of 300 (10,350); D+4 a charge of 75 (10,275); D+6 two charges of 30 (10,215); D+7 a credit of 1 (10,216); D+11 and
-- D+13 a charge of 40 each (10,136). Financy misses the deposit, dates the cheque D+3 and the D+6 second charge D+7, and has the first
-- charge of 40 on D+12.
begin;
grant all on all tables in schema public to service_role;
grant select, insert, update, delete on public.lalum_fin_bank_accounts, public.lalum_fin_bank_lines, public.lalum_fin_recon_matches,
  public.lalum_fin_archive, public.lalum_fin_expenses to authenticated;

create function pg_temp.l(h text, d int, a numeric, bal numeric default null) returns jsonb language sql as
  $$ select jsonb_strip_nulls(jsonb_build_object('import_hash', h, 'value_date', current_date - 20 + d, 'amount', a, 'balance_after', bal,
                                                  'description', h)) $$;
create function pg_temp.b(d int, bal numeric) returns jsonb language sql as
  $$ select jsonb_build_object('as_of', current_date - 20 + d, 'balance', bal, 'type', 'closingBooked') $$;
create function pg_temp.gaps(p_source text) returns text language sql as
  $$ select coalesce(string_agg((as_of - (current_date - 20))::text || ':' || gap::text || '/' || drift::text, ' ' order by as_of), '')
       from public.v_fin_bank_balance_check where bank_account_id = '00000000-0000-0000-0000-0000000000a1' and source = p_source $$;

-- 1. The closing of a day is the end of its chain, in any order; a day that ends where it began falls back to the last line.
do $$ begin
  assert public.lalum_fin_bank_closing('[{"amount": -18728, "balance_after": -304.41}, {"amount": 500, "balance_after": 18423.59}]') = -304.41, 'chain';
  assert public.lalum_fin_bank_closing('[{"amount": 100, "balance_after": 1100}, {"amount": 100, "balance_after": 1200}, {"amount": -100, "balance_after": 1100}]') = 1100,
    'a balance seen twice';
  assert public.lalum_fin_bank_closing('[{"amount": -100, "balance_after": 1000}, {"amount": 100, "balance_after": 1100}]') = 1100, 'net zero: last line';
  assert public.lalum_fin_bank_closing('[{"amount": -10}]') is null and public.lalum_fin_bank_closing(null) is null, 'no running balance';
end $$;

-- 2. The backfill closed each day of the file lines already stored, by the chain, as 'file' balances.
do $$ begin
  assert (select string_agg((as_of - (current_date - 20))::text || ':' || balance::text, ' ' order by as_of) from public.lalum_fin_bank_balances
           where source = 'file' and balance_type = 'closingBooked') = '-2:-304.41 -1:10000.00', 'backfill';
end $$;

-- 3. Who may merge what.
do $$ begin
  perform public.lalum_fin_bank_lines_merge('00000000-0000-0000-0000-0000000000a1', 'csv', '[]');
  raise exception 'an unknown source was accepted';
exception when raise_exception then
  if sqlerrm not like '%source must be file or financy%' then raise; end if;
end $$;
do $$ begin
  perform public.lalum_fin_bank_lines_merge('00000000-0000-0000-0000-0000000000a1', 'financy', jsonb_build_array(pg_temp.l('financy:z', 0, 1)));
  raise exception 'the owner wrote feed lines';
exception when raise_exception then
  if sqlerrm not like '%only from the feed%' then raise; end if;
end $$;
do $$ begin
  perform public.lalum_fin_bank_lines_merge('00000000-0000-0000-0000-0000000000a1', 'file',
    jsonb_build_array(pg_temp.l('leumi-xls:ok', 30, 1, 1), pg_temp.l('financy:9', 30, 1, 2)));
  raise exception 'a statement line with a feed key was accepted';
exception when raise_exception then
  if sqlerrm not like '%1 statement lines%' then raise; end if;
end $$;
do $$ begin
  perform public.lalum_fin_bank_lines_merge('00000000-0000-0000-0000-0000000000a1', 'file', '[{"import_hash": "leumi-xls:x", "value_date": "2026-01-01"}]');
  raise exception 'a statement line without an amount was accepted';
exception when raise_exception then
  if sqlerrm not like '%without a key, a value date or an amount%' then raise; end if;
end $$;
do $$ begin
  assert (select count(*) from public.lalum_fin_bank_lines) = 3, 'a refused statement stores nothing';
end $$;
set local role authenticated;
select set_config('test.fin_level', '2', true);
do $$ begin
  perform public.lalum_fin_bank_lines_merge('00000000-0000-0000-0000-0000000000a1', 'file', '[]');
  raise exception 'finance level 2 merged a statement';
exception when raise_exception then
  if sqlerrm not like '%forbidden%' then raise; end if;
end $$;
select set_config('test.fin_level', '4', true);
do $$ begin
  perform public.lalum_fin_bank_lines_merge('00000000-0000-0000-0000-0000000000a1', 'financy', '[]');
  raise exception 'a partner wrote feed lines';
exception when raise_exception then
  if sqlerrm not like '%only from the feed%' then raise; end if;
end $$;
reset role;

-- 4. The feed links the account the day after the file and writes through the merge. Before the statement, its own balances show the
--    deposit it missed: 300 between D+1 and D+4.
set local role service_role;
do $$
declare r jsonb;
begin
  assert public.lalum_fin_bank_sync_link('00000000-0000-0000-0000-0000000000a1', 'fx1') = current_date - 20, 'sync from D';
  begin
    perform public.lalum_fin_bank_lines_merge('00000000-0000-0000-0000-0000000000a2', 'financy', '[]');
    raise exception 'feed lines on an unlinked account';
  exception when raise_exception then
    if sqlerrm not like '%only from the feed%' then raise; end if;
  end;
  r := public.lalum_fin_bank_sync_apply('00000000-0000-0000-0000-0000000000a1',
         jsonb_build_array(pg_temp.l('financy:f0', -1, 10304.41), pg_temp.l('financy:f1', 0, -200), pg_temp.l('financy:f2', 0, -200),
                           pg_temp.l('financy:f3', 1, 500, 999)),
         pg_temp.b(1, 10100));
  assert (r ->> 'inserted')::int = 3 and (r ->> 'before_sync')::int = 1 and (r ->> 'duplicates')::int = 0 and (r ->> 'balance')::int = 1
     and r ? 'matched', 'first run ' || r::text;
  assert (select count(*) from public.lalum_fin_bank_lines where source = 'financy' and balance_after is null) = 3, 'a feed line has no running balance';
  r := public.lalum_fin_bank_sync_apply('00000000-0000-0000-0000-0000000000a1',
         jsonb_build_array(pg_temp.l('financy:f4', 3, -50), pg_temp.l('financy:f5', 4, -75)), pg_temp.b(4, 10275));
  assert (r ->> 'inserted')::int = 2, 'second run ' || r::text;
  assert pg_temp.gaps('financy') = '4:300.00/300.00', 'the feed misses 300: ' || pg_temp.gaps('financy');
  assert pg_temp.gaps('file') = '-1:0.00/0.00', 'the file adds up: ' || pg_temp.gaps('file');
end $$;
reset role;

-- 5. The statement for D to D+4, merged by the owner in the SQL editor: the two charges of 200, the transfer and the charge of 75 are
--    the feed's; the cheque matches the feed's one day later; only the deposit is new. Every day of the statement becomes a closing.
do $$
declare
  v jsonb := jsonb_build_array(
    pg_temp.l('leumi-xls:h1', 0, -200, 9800), pg_temp.l('leumi-xls:h2', 0, -200, 9600), pg_temp.l('leumi-xls:h3', 1, 500, 10100),
    pg_temp.l('leumi-xls:h4', 2, -50, 10050), pg_temp.l('leumi-xls:h5', 2, 300, 10350) || '{"source_file": "leumi-2026-11.xls"}',
    pg_temp.l('leumi-xls:h6', 4, -75, 10275));
  r jsonb;
begin
  r := public.lalum_fin_bank_lines_merge('00000000-0000-0000-0000-0000000000a1', 'file', v);
  assert r = jsonb_build_object('received', 6, 'invalid', 0, 'before_sync', 0, 'already', 0, 'duplicates', 4, 'near_duplicates', 1,
                                'inserted', 1, 'first_day', current_date - 18, 'balances', 4), 'statement ' || r::text;
  assert (select count(*) from public.lalum_fin_bank_lines where bank_account_id = '00000000-0000-0000-0000-0000000000a1') = 9, 'nine lines';
  assert (select source || ' ' || balance_after::text || ' ' || source_file from public.lalum_fin_bank_lines where import_hash = 'leumi-xls:h5')
         = 'file 10350.00 leumi-2026-11.xls', 'the deposit, with its running balance and its file';
  assert (select string_agg((as_of - (current_date - 20))::text || ':' || balance::text, ' ' order by as_of) from public.lalum_fin_bank_balances
           where source = 'file') = '-2:-304.41 -1:10000.00 0:9600.00 1:10100.00 2:10350.00 4:10275.00', 'daily closings';
  assert (select count(*) from public.lalum_fin_bank_balances where as_of = current_date - 19) = 2, 'the feed and the statement side by side';
  -- The feed's interval now adds up; the statement's shows the cheque a day apart (-50, then +50), and no drift at the end.
  assert pg_temp.gaps('financy') = '4:0.00/0.00', 'feed after the statement: ' || pg_temp.gaps('financy');
  assert pg_temp.gaps('file') = '-1:0.00/0.00 0:0.00/0.00 1:0.00/0.00 2:-50.00/-50.00 4:50.00/0.00', 'statement: ' || pg_temp.gaps('file');

  -- 6. The same statement again stores nothing more, and the feed rereading its days adds nothing.
  r := public.lalum_fin_bank_lines_merge('00000000-0000-0000-0000-0000000000a1', 'file', v);
  assert (r ->> 'inserted')::int = 0 and (r ->> 'already')::int = 1 and (r ->> 'duplicates')::int = 4 and (r ->> 'near_duplicates')::int = 1,
    'statement again ' || r::text;
  assert (select count(*) from public.lalum_fin_bank_balances where source = 'file') = 6, 'closings updated in place';
end $$;
set local role service_role;
do $$
declare r jsonb;
begin
  r := public.lalum_fin_bank_sync_apply('00000000-0000-0000-0000-0000000000a1',
         jsonb_build_array(pg_temp.l('financy:f1', 0, -200), pg_temp.l('financy:f2', 0, -200), pg_temp.l('financy:f3', 1, 500),
                           pg_temp.l('financy:f4', 3, -50), pg_temp.l('financy:f5', 4, -75)), null);
  assert (r ->> 'already')::int = 5 and (r ->> 'inserted')::int = 0 and (r ->> 'balance')::int = 0, 'feed again ' || r::text;
end $$;
reset role;

-- 7. A statement first, the feed after: D+6 is on file with two charges of 30; the feed has one on D+6, the other on D+7, and a
--    credit of 1 the file does not cover.
do $$
declare r jsonb;
begin
  r := public.lalum_fin_bank_lines_merge('00000000-0000-0000-0000-0000000000a1', 'file',
         jsonb_build_array(pg_temp.l('leumi-xls:k1', 6, -30, 10245), pg_temp.l('leumi-xls:k2', 6, -30, 10215)));
  assert (r ->> 'inserted')::int = 2 and (r ->> 'balances')::int = 1, 'file first ' || r::text;
end $$;
set local role service_role;
do $$
declare r jsonb;
begin
  r := public.lalum_fin_bank_sync_apply('00000000-0000-0000-0000-0000000000a1',
         jsonb_build_array(pg_temp.l('financy:g1', 6, -30), pg_temp.l('financy:g2', 7, -30), pg_temp.l('financy:g3', 7, 1),
                           pg_temp.l('financy:m1', 12, -40)), null);
  assert (r ->> 'duplicates')::int = 1 and (r ->> 'near_duplicates')::int = 1 and (r ->> 'inserted')::int = 2, 'feed after ' || r::text;
  assert (select count(*) from public.lalum_fin_bank_lines where amount = -30) = 2, 'two charges of 30, once each';
end $$;
reset role;

-- 8. Two statement lines a day either side of one feed line: one pairs with it (the earlier), the other is new. The feed's charge of
--    40 on D+12 is one of the statement's two, so the bank holds two, not three.
do $$
declare r jsonb;
begin
  r := public.lalum_fin_bank_lines_merge('00000000-0000-0000-0000-0000000000a1', 'file',
         jsonb_build_array(pg_temp.l('leumi-xls:n1', 11, -40, 10176), pg_temp.l('leumi-xls:n2', 13, -40, 10136)));
  assert (r ->> 'near_duplicates')::int = 1 and (r ->> 'inserted')::int = 1, 'one feed line, two statement lines ' || r::text;
  assert (select string_agg((value_date - (current_date - 20))::text || ' ' || source, ', ' order by value_date)
            from public.lalum_fin_bank_lines where amount = -40) = '12 financy, 13 file', 'the earlier pairs';
  -- Every interval of the statement adds up once the movements dated a day apart are past both days.
  assert pg_temp.gaps('file') = '-1:0.00/0.00 0:0.00/0.00 1:0.00/0.00 2:-50.00/-50.00 4:50.00/0.00 6:0.00/0.00 11:-40.00/-40.00 13:40.00/0.00',
    'statement intervals: ' || pg_temp.gaps('file');
end $$;

-- 9. Created together, ordered by the call: the two lines of one call keep their order within the day.
do $$ begin
  assert (select array_agg(import_hash order by created_at) from public.lalum_fin_bank_lines where import_hash in ('leumi-xls:k1', 'leumi-xls:k2'))
         = array['leumi-xls:k1', 'leumi-xls:k2'], 'call order';
  assert (select count(distinct created_at) from public.lalum_fin_bank_lines where import_hash in ('leumi-xls:k1', 'leumi-xls:k2')) = 2, 'distinct times';
end $$;

-- 10. Finance level 3 merges a statement on the second account; level 1 reads the check view, and nobody without a level does.
set local role authenticated;
select set_config('test.fin_level', '3', true);
do $$
declare r jsonb;
begin
  r := public.lalum_fin_bank_lines_merge('00000000-0000-0000-0000-0000000000a2', 'file',
         jsonb_build_array(pg_temp.l('leumi-xls:s1', 0, 5, 105), pg_temp.l('leumi-xls:s2', 1, 5, 110)), pg_temp.b(1, 110));
  assert (r ->> 'inserted')::int = 2 and (r ->> 'balances')::int = 3, 'level 3 statement ' || r::text;
end $$;
select set_config('test.fin_level', '1', true);
do $$ begin
  assert (select count(*) from public.v_fin_bank_balance_check) > 0, 'level 1 reads the check';
end $$;
select set_config('test.fin_level', '0', true);
do $$ begin
  assert (select count(*) from public.v_fin_bank_balance_check) = 0, 'no level, no check';
end $$;
reset role;

-- 11. Recorded under their versions.
do $$ begin
  assert (select count(*) from supabase_migrations.schema_migrations where version in ('20261029100000', '20261029100100')) = 2, 'migrations recorded';
end $$;
rollback;
select 'fin_bank_merge: all assertions passed' as result;
