-- Converting a pro forma. A pro forma is the step before most tax documents in this practice. The new tax invoice or invoice-receipt
-- points at the pro forma it settles (source_proforma_id); a pro forma is open until a document pointing at it is ISSUED.
-- The check lives in lalum_fin_save_draft: the source must be an ISSUED pro forma of the same firm and customer, and the new
-- document an invoice or invoice-receipt. Invoice4U is not told about the link, so close the pro forma there by hand
-- ("close marked documents") until the own engine issues. Applied as "lalum_finance_proforma_link_*".

alter table public.lalum_fin_documents add column if not exists source_proforma_id uuid references public.lalum_fin_documents(id);
create index if not exists lalum_fin_documents_source_idx on public.lalum_fin_documents (source_proforma_id) where source_proforma_id is not null;

create or replace function public.lalum_fin_save_draft(p_id uuid, p jsonb) returns uuid
language plpgsql security definer set search_path to 'public' as $$
declare
  v_firm uuid := public.lalum_my_firm_id();
  v_id uuid := p_id; v_lines jsonb := coalesce(p->'lines', '[]'::jsonb);
  v_type text := p->>'doc_type'; v_vat numeric := coalesce((p->>'vat_rate')::numeric, 18);
  v_inc boolean := coalesce((p->>'tax_included')::boolean, false);
  t record; l jsonb; v_cust uuid := (p->>'customer_id')::uuid; v_casual boolean;
  v_src uuid := nullif(p->>'source_proforma_id','')::uuid;
begin
  if not public.lalum_fin_can(v_firm, 2) then raise exception 'FORBIDDEN'; end if;
  if v_type not in ('PROFORMA','INVOICE','RECEIPT','INVOICE_RECEIPT','CREDIT') then raise exception 'BAD_TYPE'; end if;
  select is_casual into v_casual from public.lalum_fin_customers where id = v_cust and firm_id = v_firm;
  if not found then raise exception 'BAD_CUSTOMER'; end if;
  if v_casual and v_type not in ('INVOICE_RECEIPT','CREDIT') then raise exception 'CASUAL_NOT_ALLOWED'; end if;
  if v_src is not null and (v_type not in ('INVOICE','INVOICE_RECEIPT') or not exists (
       select 1 from public.lalum_fin_documents s where s.id = v_src and s.firm_id = v_firm and s.doc_type = 'PROFORMA'
          and s.status = 'ISSUED' and s.customer_id = v_cust)) then raise exception 'BAD_SOURCE'; end if;
  if jsonb_array_length(v_lines) not between 1 and 60 then raise exception 'BAD_LINES'; end if;
  for l in select * from jsonb_array_elements(v_lines) loop
    if length(btrim(coalesce(l->>'name',''))) = 0 or length(l->>'name') > 200 then raise exception 'BAD_LINE_NAME'; end if;
    if coalesce((l->>'qty')::numeric, 0) <= 0 or coalesce((l->>'price')::numeric, 0) <= 0 then raise exception 'BAD_LINE_AMOUNT'; end if;
  end loop;
  select * into t from public.lalum_fin_totals(v_lines, v_vat, v_inc);
  if v_id is null then
    insert into public.lalum_fin_documents (firm_id, customer_id, doc_type, subject, tax_included, vat_rate, lines,
        subtotal, vat_amount, total, issue_date, due_date, payment_method, payment_ref, related_doc_id, send_email, created_by, internal_note, matter_ref, source_proforma_id)
    values (v_firm, v_cust, v_type, coalesce(p->>'subject',''), v_inc, v_vat, v_lines, t.subtotal, t.vat_amount, t.total,
        coalesce((p->>'issue_date')::date, current_date), (p->>'due_date')::date, nullif(p->>'payment_method',''),
        nullif(p->>'payment_ref',''), (p->>'related_doc_id')::uuid, coalesce((p->>'send_email')::boolean, false), auth.uid(),
        nullif(btrim(p->>'internal_note'),''), nullif(btrim(p->>'matter_ref'),''), v_src)
    returning id into v_id;
  else
    update public.lalum_fin_documents set customer_id = v_cust, doc_type = v_type, subject = coalesce(p->>'subject',''),
        tax_included = v_inc, vat_rate = v_vat, lines = v_lines, subtotal = t.subtotal, vat_amount = t.vat_amount, total = t.total,
        issue_date = coalesce((p->>'issue_date')::date, current_date), due_date = (p->>'due_date')::date,
        payment_method = nullif(p->>'payment_method',''), payment_ref = nullif(p->>'payment_ref',''),
        related_doc_id = (p->>'related_doc_id')::uuid, send_email = coalesce((p->>'send_email')::boolean, false), last_error = null,
        internal_note = nullif(btrim(p->>'internal_note'),''), matter_ref = nullif(btrim(p->>'matter_ref'),''), source_proforma_id = v_src
    where id = v_id and firm_id = v_firm and status = 'DRAFT';
    if not found then raise exception 'NOT_A_DRAFT'; end if;
  end if;
  return v_id;
end $$;
revoke execute on function public.lalum_fin_save_draft(uuid, jsonb) from public, anon;
grant execute on function public.lalum_fin_save_draft(uuid, jsonb) to authenticated;
