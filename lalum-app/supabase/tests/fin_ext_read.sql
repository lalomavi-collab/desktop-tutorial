-- Tests for migration 20261029150000 (lalum_fin_ext_lines, lalum_fin_ext_facts: what Financy shows beyond the bank lines). Order:
-- 00_supabase_stubs, 09_fin_bank_sync_stub, 20261029150000_lalum_fin_ext_read, then this file:
--   psql -v ON_ERROR_STOP=1 -f fin_ext_read.sql
-- Every assertion raises on failure; fixtures roll back.
begin;
insert into public.lalum_firms (id, firm_name) values ('00000000-0000-0000-0000-0000000000f1', 'test');

-- 1. A paste: card rows (two identical charges on one day stay two), history rows of the current account, and facts.
insert into public.lalum_fin_ext_lines (firm_id, account_kind, account_ref, txn_date, description, source_category, amount, currency, import_hash, read_on)
values ('00000000-0000-0000-0000-0000000000f1', 'card', '9616', '2026-06-17', 'furniture', null, -10788, 'ILS', 'financy-read:card:1', '2026-10-29'),
       ('00000000-0000-0000-0000-0000000000f1', 'card', '9616', '2026-06-17', 'furniture', null, -10788, 'ILS', 'financy-read:card:2', '2026-10-29'),
       ('00000000-0000-0000-0000-0000000000f1', 'card', '9616', '2026-10-01', 'software', null, -15, 'USD', 'financy-read:card:3', '2026-10-29'),
       ('00000000-0000-0000-0000-0000000000f1', 'current', '2082', '2026-07-01', 'rent', null, -8875, 'ILS', 'financy-read:cur:1', '2026-10-29')
on conflict (firm_id, import_hash) do nothing;
insert into public.lalum_fin_ext_facts (firm_id, kind, account_ref, label, amount, currency, due_on, as_of)
values ('00000000-0000-0000-0000-0000000000f1', 'CARD_ACCRUED', '9616', null, 3030.53, 'ILS', '2026-11-15', '2026-10-29'),
       ('00000000-0000-0000-0000-0000000000f1', 'GUARANTEE', '2082', 'guarantee', 35181.55, 'ILS', null, '2026-10-28');

-- 2. The same paste again adds nothing; a second fact of a kind on the same day is refused.
insert into public.lalum_fin_ext_lines (firm_id, account_kind, account_ref, txn_date, description, amount, currency, import_hash, read_on)
values ('00000000-0000-0000-0000-0000000000f1', 'card', '9616', '2026-06-17', 'furniture', -10788, 'ILS', 'financy-read:card:1', '2026-10-29')
on conflict (firm_id, import_hash) do nothing;
do $$ begin
  assert (select count(*) from public.lalum_fin_ext_lines) = 4, 'a repeated paste';
  assert (select count(*) from public.lalum_fin_ext_lines where account_kind = 'card' and txn_date = '2026-06-17') = 2, 'installments';
end $$;
do $$ begin
  insert into public.lalum_fin_ext_facts (firm_id, kind, account_ref, amount, as_of)
  values ('00000000-0000-0000-0000-0000000000f1', 'CARD_ACCRUED', '9616', 1, '2026-10-29');
  raise exception 'two facts of one kind on one day';
exception when unique_violation then null;
end $$;

-- 3. The checks: a full card number, an unknown kind, a currency that is not a code.
do $$ begin
  insert into public.lalum_fin_ext_lines (firm_id, account_kind, account_ref, txn_date, description, amount, import_hash, read_on)
  values ('00000000-0000-0000-0000-0000000000f1', 'card', '4580123412349616', '2026-10-01', 'x', -1, 'h1', '2026-10-29');
  raise exception 'a full card number was stored';
exception when check_violation then null;
end $$;
do $$ begin
  insert into public.lalum_fin_ext_lines (firm_id, account_kind, account_ref, txn_date, description, amount, import_hash, read_on)
  values ('00000000-0000-0000-0000-0000000000f1', 'loan', '2082', '2026-10-01', 'x', -1, 'h2', '2026-10-29');
  raise exception 'an unknown account kind was stored';
exception when check_violation then null;
end $$;
do $$ begin
  insert into public.lalum_fin_ext_facts (firm_id, kind, account_ref, amount, currency, as_of)
  values ('00000000-0000-0000-0000-0000000000f1', 'FX_BALANCE', 'USD', 0, 'usd', '2026-10-28');
  raise exception 'a lower case currency was stored';
exception when check_violation then null;
end $$;

-- 4. Who reads: finance level 3 sees everything, level 1 (the bookkeeper) nothing, anon is refused; nobody writes from the app.
set local role authenticated;
select set_config('test.fin_level', '3', true);
do $$ begin
  assert (select count(*) from public.lalum_fin_ext_lines) = 4 and (select count(*) from public.lalum_fin_ext_facts) = 2, 'level 3 reads';
end $$;
select set_config('test.fin_level', '1', true);
do $$ begin
  assert (select count(*) from public.lalum_fin_ext_lines) = 0 and (select count(*) from public.lalum_fin_ext_facts) = 0, 'level 1 sees nothing';
end $$;
select set_config('test.fin_level', '4', true);
do $$ begin
  insert into public.lalum_fin_ext_lines (firm_id, account_kind, account_ref, txn_date, description, amount, import_hash, read_on)
  values ('00000000-0000-0000-0000-0000000000f1', 'card', '9616', '2026-10-01', 'x', -1, 'h3', '2026-10-29');
  raise exception 'the app wrote a line';
exception when insufficient_privilege then null;
end $$;
do $$ begin
  delete from public.lalum_fin_ext_facts;
  raise exception 'the app deleted a fact';
exception when insufficient_privilege then null;
end $$;
reset role;
set local role anon;
do $$ begin
  perform 1 from public.lalum_fin_ext_lines;
  raise exception 'anon read the card';
exception when insufficient_privilege then null;
end $$;
reset role;

select 'fin_ext_read: all assertions passed' as result;
rollback;
