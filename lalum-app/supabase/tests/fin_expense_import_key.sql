-- Tests for migration 20261027220000 (an import key on expenses). Run after the chain of fin_record_audit.sql, then 20261027220000:
--   psql -v ON_ERROR_STOP=1 -f fin_expense_import_key.sql
-- The migration is applied a second time inside the transaction (it is idempotent) so its backfill meets the fixtures.
-- Every assertion raises on failure. Fixtures roll back.
create schema if not exists t;
create or replace function t.fails(p_sql text, p_expect text, p_label text) returns void language plpgsql as $$
begin
  begin execute p_sql;
  exception when others then
    if sqlerrm like '%' || p_expect || '%' then raise notice 'PASS: %', p_label; return; end if;
    raise exception 'FAIL: % (got "%")', p_label, sqlerrm;
  end;
  raise exception 'FAIL: % (no error)', p_label;
end $$;

begin;
insert into public.lalum_firms (id, firm_name, registration_no, primary_contact, email, phone, monthly_fee)
values ('a2000000-0000-0000-0000-000000000001', 'Import key firm', '000000000', 'x', 'x@example.com', '0', 0);
insert into public.lalum_fin_expenses (id, firm_id, spent_on, supplier, category, description, total, vat_amount, supplier_doc_ref, created_at, updated_at)
values
  ('a2000000-0000-0000-0000-0000000000e1', 'a2000000-0000-0000-0000-000000000001', '2026-06-13', 'Gett', 'OFFICE', 'נסיעה (לבדוק עסקי/פרטי)', 76.5, 11.67, null,
   '2026-10-21 22:34:25+00', '2026-10-21 22:34:25+00'),
  ('a2000000-0000-0000-0000-0000000000e2', 'a2000000-0000-0000-0000-000000000001', '2026-01-04', 'לינק ניהול תקשורת לעסקים', 'OFFICE', null, 58.73, 8.96, '140179',
   '2026-10-21 22:34:25+00', '2026-10-21 22:34:25+00');
create temp table audit_before as select coalesce(max(id), 0) as id from public.lalum_audit_log;

\ir ../migrations/20261027220000_lalum_fin_expense_import_key.sql

do $$
begin
  -- the same string HistoricalImport.tsx builds: date|supplier|description|total.toFixed(2)|vat.toFixed(2)|ref
  if (select import_key from public.lalum_fin_expenses where id = 'a2000000-0000-0000-0000-0000000000e1')
     is distinct from '2026-06-13|Gett|נסיעה (לבדוק עסקי/פרטי)|76.50|11.67|' then raise exception 'FAIL: backfill key of a line without a reference'; end if;
  if (select import_key from public.lalum_fin_expenses where id = 'a2000000-0000-0000-0000-0000000000e2')
     is distinct from '2026-01-04|לינק ניהול תקשורת לעסקים||58.73|8.96|140179' then raise exception 'FAIL: backfill key of a line without a description'; end if;
  raise notice 'PASS: the backfill builds the key the import panel builds';

  if exists (select 1 from public.lalum_fin_expenses where firm_id = 'a2000000-0000-0000-0000-000000000001' and updated_at <> '2026-10-21 22:34:25+00') then
    raise exception 'FAIL: the backfill moved updated_at'; end if;
  raise notice 'PASS: the backfill leaves updated_at alone';

  if exists (select 1 from public.lalum_audit_log where id > (select id from audit_before) and entity = 'lalum_fin_expenses') then
    raise exception 'FAIL: the backfill wrote audit rows'; end if;
  raise notice 'PASS: the backfill is not logged as a correction';

  if (select tgenabled from pg_trigger where tgname = 'lalum_fin_expenses_touch') <> 'O' then raise exception 'FAIL: touch trigger left off'; end if;
  raise notice 'PASS: the touch trigger is on again';
end $$;

-- importing the same line again adds nothing
do $$
declare v_n int;
begin
  insert into public.lalum_fin_expenses (firm_id, spent_on, supplier, category, description, total, vat_amount, import_key)
  values ('a2000000-0000-0000-0000-000000000001', '2026-06-13', 'Gett', 'OFFICE', 'נסיעה (לבדוק עסקי/פרטי)', 76.5, 11.67,
          '2026-06-13|Gett|נסיעה (לבדוק עסקי/פרטי)|76.50|11.67|')
  on conflict (firm_id, import_key) do nothing;
  get diagnostics v_n = row_count;
  if v_n <> 0 then raise exception 'FAIL: a second import of the same line was added'; end if;
  raise notice 'PASS: a second import of the same line is skipped';
end $$;

select t.fails($q$insert into public.lalum_fin_expenses (firm_id, spent_on, supplier, category, total, vat_amount, import_key)
  values ('a2000000-0000-0000-0000-000000000001', '2026-06-13', 'Gett', 'OFFICE', 76.5, 11.67, '2026-06-13|Gett|נסיעה (לבדוק עסקי/פרטי)|76.50|11.67|')$q$,
  'lalum_fin_expenses_import_key_uniq', 'a plain insert of a known key is refused');

-- lines entered by hand carry no key and never collide
insert into public.lalum_fin_expenses (firm_id, spent_on, supplier, category, total, vat_amount)
values ('a2000000-0000-0000-0000-000000000001', '2026-07-01', 'חניון', 'OFFICE', 10, 0),
       ('a2000000-0000-0000-0000-000000000001', '2026-07-01', 'חניון', 'OFFICE', 10, 0);
\echo PASS: two identical lines entered by hand are both kept

-- a duplicate pair stops the backfill, so the migration cannot run before A1 removed the duplicates
select t.fails($q$update public.lalum_fin_expenses
   set import_key = concat_ws('|', to_char(spent_on, 'YYYY-MM-DD'), supplier, coalesce(btrim(description), ''),
                              round(total, 2)::text, round(coalesce(vat_amount, 0), 2)::text, coalesce(btrim(supplier_doc_ref), ''))
 where import_key is null$q$, 'lalum_fin_expenses_import_key_uniq', 'a duplicate pair makes the backfill fail');
rollback;
