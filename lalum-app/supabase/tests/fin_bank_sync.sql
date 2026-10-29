-- Tests for migration 20261028143000 (the bank feed: lalum_fin_bank_sync_link, lalum_fin_bank_sync_apply, the balances table, the run
-- log, and the service role gate on lalum_fin_recon_auto), with the apply writing through the merge of 20261029100100. Order:
-- 00_supabase_stubs, 09_fin_bank_sync_stub, 20261023101711_fin_pnl_bank_reconciliation_v1, 20261028143000_lalum_fin_bank_sync,
-- 20261029100000_lalum_fin_bank_closing, 20261029100100_lalum_fin_bank_lines_merge, then this file:
--   psql -v ON_ERROR_STOP=1 -f fin_bank_sync.sql
-- Every assertion raises on failure; fixtures roll back. Dates are relative to today so the file does not age.
begin;
-- What Supabase grants by default; the run log keeps the migration's revoke.
grant all on all tables in schema public to service_role;
grant select, insert, update, delete on public.lalum_fin_bank_accounts, public.lalum_fin_bank_lines, public.lalum_fin_recon_matches,
  public.lalum_fin_archive, public.lalum_fin_expenses to authenticated;

insert into public.lalum_firms (id, firm_name) values ('00000000-0000-0000-0000-0000000000f1', 'F');
insert into public.lalum_fin_bank_accounts (id, firm_id, bank_code, account_last4, label) values
  ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000f1', '10', '2082', 'business'),
  ('00000000-0000-0000-0000-0000000000a2', '00000000-0000-0000-0000-0000000000f1', '10', '1111', 'no file');
insert into public.lalum_fin_bank_lines (firm_id, bank_account_id, value_date, amount, balance_after, import_hash, source_file) values
  ('00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-0000000000a1', current_date - 70, 100, 41269.21, 'file:1', 'Bankin.dat'),
  ('00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-0000000000a1', current_date - 60, 100, 41369.21, 'file:2', 'Bankin.dat');
insert into public.lalum_fin_archive (firm_id, issue_date, i4u_doc_type, doc_number, total) values
  ('00000000-0000-0000-0000-0000000000f1', current_date - 6, 3, 20001, 1180);
insert into public.lalum_fin_expenses (firm_id, spent_on, supplier, total) values
  ('00000000-0000-0000-0000-0000000000f1', current_date - 3, 'S', 500);

-- 1. Existing lines are the file, and an account cannot be half linked.
do $$ begin
  assert (select count(*) from public.lalum_fin_bank_lines where source = 'file') = 2, 'existing lines are file lines';
  begin
    update public.lalum_fin_bank_accounts set provider = 'financy' where id = '00000000-0000-0000-0000-0000000000a1';
    raise exception 'a provider without an account id was accepted';
  exception when check_violation then null;
  end;
end $$;

-- 2. Nobody but the service role links or writes, not even the owner of the tables.
do $$ begin
  perform public.lalum_fin_bank_sync_link('00000000-0000-0000-0000-0000000000a1', 'fx1');
  raise exception 'the owner linked an account';
exception when raise_exception then
  if sqlerrm not like '%service role only%' then raise; end if;
end $$;
set local role authenticated;
select set_config('test.fin_level', '4', true);
do $$ begin
  perform public.lalum_fin_bank_sync_apply('00000000-0000-0000-0000-0000000000a1', '[]');
  raise exception 'a partner ran the sync apply';
exception when insufficient_privilege then null;
end $$;
reset role;

set local role service_role;
-- 3. An unlinked account takes no lines.
do $$ begin
  perform public.lalum_fin_bank_sync_apply('00000000-0000-0000-0000-0000000000a1', '[]');
  raise exception 'an unlinked account was written';
exception when raise_exception then
  if sqlerrm not like '%not a linked account%' then raise; end if;
end $$;

-- 4. Linking starts the feed the day after the last file line, once; an account with no file starts a year back.
do $$ begin
  assert public.lalum_fin_bank_sync_link('00000000-0000-0000-0000-0000000000a1', 'fx1') = current_date - 59, 'sync_from after the file';
  assert public.lalum_fin_bank_sync_link('00000000-0000-0000-0000-0000000000a2', 'fx2') = current_date - 365, 'no file, a year back';
  begin
    perform public.lalum_fin_bank_sync_link('00000000-0000-0000-0000-0000000000a1', 'fx9');
    raise exception 'a linked account was pointed elsewhere';
  exception when raise_exception then
    if sqlerrm not like '%already linked%' then raise; end if;
  end;
  assert (select provider_account_id from public.lalum_fin_bank_accounts where id = '00000000-0000-0000-0000-0000000000a1') = 'fx1', 'link kept';
end $$;

-- 5. One run: the line inside the file's period, a line with a foreign key and a repeated line are dropped; the two new lines are
--    reconciled against the receipt and the expense; the balance is stored.
do $$
declare
  r jsonb;
  v_lines jsonb := jsonb_build_array(
    jsonb_build_object('import_hash', 'financy:t0', 'value_date', current_date - 60, 'amount', 100, 'description', 'in the file'),
    jsonb_build_object('import_hash', 'x:1', 'value_date', current_date - 5, 'amount', 7, 'description', 'not ours'),
    jsonb_build_object('import_hash', 'financy:t1', 'value_date', current_date - 5, 'posted_date', current_date - 4, 'amount', 1180,
                       'description', 'transfer in', 'reference', 'r1'),
    jsonb_build_object('import_hash', 'financy:t1', 'value_date', current_date - 5, 'amount', 1180, 'description', 'again'),
    jsonb_build_object('import_hash', 'financy:t2', 'value_date', current_date - 4, 'amount', -500, 'description', 'card'));
begin
  r := public.lalum_fin_bank_sync_apply('00000000-0000-0000-0000-0000000000a1', v_lines,
         jsonb_build_object('as_of', current_date, 'balance', 52000.5, 'type', 'closingBooked', 'currency', 'ILS'));
  assert (r ->> 'inserted')::int = 2, 'inserted ' || r::text;
  assert (r ->> 'first_day')::date = current_date - 5, 'first day';
  assert (r ->> 'balance')::int = 1 and (r ->> 'matched')::int = 2, 'balance and matches ' || r::text;
  assert (select count(*) from public.lalum_fin_bank_lines where source = 'financy' and balance_after is null and created_by is null
            and source_file = 'Financy API') = 2, 'feed lines';
  assert (select description from public.lalum_fin_bank_lines where import_hash = 'financy:t1') = 'transfer in', 'first copy kept';
  assert (select count(*) from public.lalum_fin_recon_matches where method = 'auto_exact') = 2, 'reconciled';

  -- 6. The same run again adds nothing and updates the day's balance in place.
  r := public.lalum_fin_bank_sync_apply('00000000-0000-0000-0000-0000000000a1', v_lines,
         jsonb_build_object('as_of', current_date, 'balance', 52100, 'type', 'closingBooked'));
  assert (r ->> 'inserted')::int = 0 and (r ->> 'matched')::int = 0, 'rerun ' || r::text;
  assert (select count(*) from public.lalum_fin_bank_balances) = 1
     and (select balance from public.lalum_fin_bank_balances) = 52100, 'one balance per day, updated';
  -- no balance in the payload: lines only
  r := public.lalum_fin_bank_sync_apply('00000000-0000-0000-0000-0000000000a1', '[]', null);
  assert (r ->> 'balance')::int = 0, 'no balance';
end $$;

-- 7. A run over the cap fails whole.
do $$ begin
  perform public.lalum_fin_bank_sync_apply('00000000-0000-0000-0000-0000000000a1',
    (select jsonb_agg(jsonb_build_object('import_hash', 'financy:c' || g, 'value_date', current_date, 'amount', 1)) from generate_series(1, 5001) g));
  raise exception 'cap not enforced';
exception when raise_exception then
  if sqlerrm not like '%cap is 5000%' then raise; end if;
end $$;

-- 8. The run log takes rows from the service role.
insert into public.lalum_fin_bank_sync_runs (status, detail) values ('ok', '{"data_at": "2026-10-28T05:12:00Z"}');
reset role;

-- 9. Reading: the balance from finance level 1 (the bookkeeper), writing from level 3; the run log not at all.
set local role authenticated;
select set_config('test.fin_level', '0', true);
do $$ begin
  assert (select count(*) from public.lalum_fin_bank_balances) = 0, 'no finance level, no balance';
end $$;
select set_config('test.fin_level', '1', true);
do $$ begin
  assert (select count(*) from public.lalum_fin_bank_balances) = 1, 'level 1 reads the balance';
  begin
    insert into public.lalum_fin_bank_balances (firm_id, bank_account_id, as_of, balance, balance_type)
    values ('00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-0000000000a1', current_date - 1, 1, 'closingBooked');
    raise exception 'level 1 wrote a balance';
  exception when insufficient_privilege then null;
  end;
  begin
    perform count(*) from public.lalum_fin_bank_sync_runs;
    raise exception 'a signed in user read the run log';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.lalum_fin_recon_auto('00000000-0000-0000-0000-0000000000f1', current_date - 30, current_date);
    raise exception 'level 1 ran the reconciliation';
  exception when raise_exception then
    if sqlerrm <> 'forbidden' then raise; end if;
  end;
end $$;
-- 10. The gate change leaves level 3 as it was.
select set_config('test.fin_level', '3', true);
do $$ begin
  assert public.lalum_fin_recon_auto('00000000-0000-0000-0000-0000000000f1', current_date - 30, current_date) = 0, 'level 3 reconciles';
end $$;
reset role;

-- 11. The migration is recorded under its file's version.
do $$ begin
  assert exists (select 1 from supabase_migrations.schema_migrations where version = '20261028143000'), 'migration recorded';
end $$;
rollback;
select 'fin_bank_sync: all assertions passed' as result;
