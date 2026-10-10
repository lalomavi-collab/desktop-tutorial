-- Casual (one-off) customers for the finance ledger.
-- Evidence from the practice's own history: 42 of 145 invoice-receipts and one credit went to a customer with no card in
-- Invoice4U (a "general customer": a name and an optional id on the document). Invoices, receipts and pro formas never did,
-- so the ledger allows a casual customer only on invoice-receipts and credits. A casual customer is never linked to an
-- Invoice4U customer id. Applied to project meoymkcotomoluwlwues as "lalum_finance_casual_customers_*".

alter table public.lalum_fin_customers add column if not exists is_casual boolean not null default false;
alter table public.lalum_fin_customers add constraint lalum_fin_customers_casual_unlinked
  check (not is_casual or i4u_customer_id is null);

create or replace function public.lalum_fin_save_draft(p_id uuid, p jsonb) returns uuid
language plpgsql security definer set search_path to 'public' as $$
declare
  v_firm uuid := public.lalum_my_firm_id();
  v_id uuid := p_id; v_lines jsonb := coalesce(p->'lines', '[]'::jsonb);
  v_type text := p->>'doc_type'; v_vat numeric := coalesce((p->>'vat_rate')::numeric, 18);
  v_inc boolean := coalesce((p->>'tax_included')::boolean, false);
  t record; l jsonb; v_cust uuid := (p->>'customer_id')::uuid; v_casual boolean;
begin
  if not public.lalum_fin_can(v_firm) then raise exception 'FORBIDDEN'; end if;
  if v_type not in ('PROFORMA','INVOICE','RECEIPT','INVOICE_RECEIPT','CREDIT') then raise exception 'BAD_TYPE'; end if;
  select is_casual into v_casual from public.lalum_fin_customers where id = v_cust and firm_id = v_firm;
  if not found then raise exception 'BAD_CUSTOMER'; end if;
  if v_casual and v_type not in ('INVOICE_RECEIPT','CREDIT') then raise exception 'CASUAL_NOT_ALLOWED'; end if;
  if jsonb_array_length(v_lines) not between 1 and 60 then raise exception 'BAD_LINES'; end if;
  for l in select * from jsonb_array_elements(v_lines) loop
    if length(btrim(coalesce(l->>'name',''))) = 0 or length(l->>'name') > 200 then raise exception 'BAD_LINE_NAME'; end if;
    if coalesce((l->>'qty')::numeric, 0) <= 0 or coalesce((l->>'price')::numeric, 0) <= 0 then raise exception 'BAD_LINE_AMOUNT'; end if;
  end loop;
  select * into t from public.lalum_fin_totals(v_lines, v_vat, v_inc);
  if v_id is null then
    insert into public.lalum_fin_documents (firm_id, customer_id, doc_type, subject, tax_included, vat_rate, lines,
        subtotal, vat_amount, total, issue_date, due_date, payment_method, payment_ref, related_doc_id, send_email, created_by)
    values (v_firm, v_cust, v_type, coalesce(p->>'subject',''), v_inc, v_vat, v_lines, t.subtotal, t.vat_amount, t.total,
        coalesce((p->>'issue_date')::date, current_date), (p->>'due_date')::date, nullif(p->>'payment_method',''),
        nullif(p->>'payment_ref',''), (p->>'related_doc_id')::uuid, coalesce((p->>'send_email')::boolean, false), auth.uid())
    returning id into v_id;
  else
    update public.lalum_fin_documents set customer_id = v_cust, doc_type = v_type, subject = coalesce(p->>'subject',''),
        tax_included = v_inc, vat_rate = v_vat, lines = v_lines, subtotal = t.subtotal, vat_amount = t.vat_amount, total = t.total,
        issue_date = coalesce((p->>'issue_date')::date, current_date), due_date = (p->>'due_date')::date,
        payment_method = nullif(p->>'payment_method',''), payment_ref = nullif(p->>'payment_ref',''),
        related_doc_id = (p->>'related_doc_id')::uuid, send_email = coalesce((p->>'send_email')::boolean, false), last_error = null
    where id = v_id and firm_id = v_firm and status = 'DRAFT';
    if not found then raise exception 'NOT_A_DRAFT'; end if;
  end if;
  return v_id;
end $$;
revoke execute on function public.lalum_fin_save_draft(uuid, jsonb) from public, anon;
grant execute on function public.lalum_fin_save_draft(uuid, jsonb) to authenticated;
