-- Finance: a key for every expense line that came from an import, so running the same import again adds nothing.
-- The 14 duplicate expenses of 21.10.2026 came from the historical import panel (HistoricalImport.tsx) running twice:
-- it did a plain insert and nothing in the table could tell an imported line from the same line imported again. A
-- unique index on supplier_doc_ref would not have caught them all (three of the fourteen Gett rides carry no document
-- reference), so the key is the line itself: date, supplier, description, total, VAT and reference, exactly as the
-- panel builds it (importKey in HistoricalImport.tsx). The panel now inserts with ON CONFLICT DO NOTHING on
-- (firm_id, import_key). A line entered by hand has no key, and two NULL keys never conflict.
--
-- The backfill gives every existing row its key from its own values, so a later import that holds the same line skips
-- it. It must run after the duplicates are removed (A1, 27.10.2026): with a duplicate pair still in the table the unique
-- constraint below fails and nothing is applied. Only import_key changes: the audit trigger (0071) does not log it,
-- and the touch trigger is held off for the backfill so updated_at keeps meaning "last edited by a person".
alter table public.lalum_fin_expenses add column if not exists import_key text;

alter table public.lalum_fin_expenses drop constraint if exists lalum_fin_expenses_import_key_uniq;
alter table public.lalum_fin_expenses add constraint lalum_fin_expenses_import_key_uniq unique (firm_id, import_key);

alter table public.lalum_fin_expenses disable trigger lalum_fin_expenses_touch;
update public.lalum_fin_expenses
   set import_key = concat_ws('|', to_char(spent_on, 'YYYY-MM-DD'), supplier, coalesce(btrim(description), ''),
                              round(total, 2)::text, round(coalesce(vat_amount, 0), 2)::text, coalesce(btrim(supplier_doc_ref), ''))
 where import_key is null;
alter table public.lalum_fin_expenses enable trigger lalum_fin_expenses_touch;

comment on column public.lalum_fin_expenses.import_key is
  'Identity of an imported line (date|supplier|description|total|vat|reference). NULL for a line entered by hand. Unique per firm.';
