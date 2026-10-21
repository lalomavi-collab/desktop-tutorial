-- 0071: an audit trail for corrections to payments and expenses.
--
-- 0070 stops payments and expenses being deleted during the tax retention period, but a record can still be corrected, and a correction
-- (an amount, a date, a VAT figure) is exactly what a tax audit asks about. Until now nothing recorded it: unlike the other billing tables
-- (0019, 0020), lalum_fin_payments and lalum_fin_expenses had no audit trigger at all.
--
-- This adds an AFTER UPDATE / DELETE trigger on both that writes one row to the immutable billing audit log (lalum_audit_log):
--   FIN_RECORD_CORRECTED  what changed: for amounts, dates, VAT figures, category / method and ids, the old and the new value; for free text
--                         (supplier, description, supplier document reference, payment reference, notes) only the NAME of the field that changed,
--                         never its content, because those fields can hold a client or a supplier name. An update that changes none of
--                         these (only the touch of updated_at) writes nothing.
--   FIN_RECORD_DELETED    the amounts, dates and ids of the removed row, never the free text.
-- Both carry within_undo_window: true when the platform recorded the row less than 24 hours earlier (0070), the only time a deletion or a
-- re-dating is allowed during retention. An insert is not audited here: the row carries its own created_at and created_by.
-- No data changes; nothing is backfilled. The audit log is already part of the firm export (0066).

create or replace function public.lalum_fin_record_audit_trg() returns trigger
language plpgsql security definer set search_path to 'public' as $$
declare
  o jsonb := to_jsonb(old); n jsonb := case when tg_op = 'UPDATE' then to_jsonb(new) end;
  v_val text[]; v_txt text[]; c text; ch jsonb := '{}'::jsonb; tx jsonb := '[]'::jsonb; v_vals jsonb := '{}'::jsonb;
  v_win boolean := old.created_at >= now() - interval '24 hours';
begin
  if tg_table_name = 'lalum_fin_expenses' then
    v_val := array['spent_on', 'total', 'vat_amount', 'vat_recoverable_pct', 'category', 'payment_method'];
    v_txt := array['supplier', 'description', 'supplier_doc_ref'];
  else
    v_val := array['customer_id', 'document_id', 'paid_on', 'amount', 'method'];
    v_txt := array['reference', 'notes'];
  end if;

  if tg_op = 'UPDATE' then
    foreach c in array v_val loop
      if o -> c is distinct from n -> c then ch := ch || jsonb_build_object(c, jsonb_build_object('from', o -> c, 'to', n -> c)); end if;
    end loop;
    foreach c in array v_txt loop
      if o -> c is distinct from n -> c then tx := tx || to_jsonb(c); end if;
    end loop;
    if ch = '{}'::jsonb and tx = '[]'::jsonb then return new; end if;
    perform public.lalum_audit_write(old.firm_id, 'FIN_RECORD_CORRECTED', tg_table_name, old.id::text,
      jsonb_build_object('changes', ch, 'text_changed', tx, 'within_undo_window', v_win));
    return new;
  end if;

  foreach c in array v_val loop v_vals := v_vals || jsonb_build_object(c, o -> c); end loop;
  perform public.lalum_audit_write(old.firm_id, 'FIN_RECORD_DELETED', tg_table_name, old.id::text,
    jsonb_build_object('values', v_vals, 'within_undo_window', v_win));
  return old;
end $$;
revoke execute on function public.lalum_fin_record_audit_trg() from public, anon, authenticated;

create trigger lalum_fin_expenses_audit_t after update or delete on public.lalum_fin_expenses for each row execute function public.lalum_fin_record_audit_trg();
create trigger lalum_fin_payments_audit_t after update or delete on public.lalum_fin_payments for each row execute function public.lalum_fin_record_audit_trg();
