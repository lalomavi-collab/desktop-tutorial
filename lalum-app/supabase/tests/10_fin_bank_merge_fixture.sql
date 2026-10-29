-- Fixture for fin_bank_merge.sql, loaded before migration 20261029100100 so its backfill has file lines to close: a firm, the business
-- account and a second one, and three Leumi file lines, the two of D-2 stored in one statement (one created_at, as on 29.10). D is
-- current_date - 20. Order: 00_supabase_stubs, 09_fin_bank_sync_stub, 20261023101711, 20261028143000, 20261029100000, this file,
-- 20261029100100, fin_bank_merge.sql. Test use only: never apply to a real project.
insert into public.lalum_firms (id, firm_name) values ('00000000-0000-0000-0000-0000000000f1', 'F');
insert into public.lalum_fin_bank_accounts (id, firm_id, bank_code, account_last4, label) values
  ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000f1', '10', '2082', 'business'),
  ('00000000-0000-0000-0000-0000000000a2', '00000000-0000-0000-0000-0000000000f1', '10', '1111', 'second');
-- D-2 closes at -304.41 (18,423.59, then -18,728); the ids put the larger balance last, so only the chain gives the closing.
insert into public.lalum_fin_bank_lines (id, firm_id, bank_account_id, value_date, amount, balance_after, import_hash, source_file, created_at) values
  ('00000000-0000-0000-0000-00000000c001', '00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-0000000000a1', current_date - 22,
   -18728, -304.41, 'leumi-xls:1', 'oct.xls', now() - interval '1 day'),
  ('00000000-0000-0000-0000-00000000c002', '00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-0000000000a1', current_date - 22,
   500, 18423.59, 'leumi-xls:2', 'oct.xls', now() - interval '1 day'),
  ('00000000-0000-0000-0000-00000000c003', '00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-0000000000a1', current_date - 21,
   10304.41, 10000, 'leumi-xls:3', 'oct.xls', now() - interval '1 day');
