-- Finance P1 part 2, step A: fields the Invoice4U mapping showed to be missing, and the date rule.
-- Applied to project meoymkcotomoluwlwues as "lalum_finance_internal_fields_*".
--  * internal_note: never printed, never sent. Invoice4U has only a printed note.
--  * matter_ref: optional free text reference to a matter. A client / matter / document hierarchy was considered and
--    deferred; this keeps the option open at no structural cost.
--  * retainer fields on the customer: the template for a monthly DRAFT (never issued automatically).
--  * date rule at issue: a document cannot be dated in the future (Israel date) or earlier than the latest issued,
--    non test document of the same type. Mirrors the bookkeeping instruction Invoice4U enforces.

alter table public.lalum_fin_documents
  add column if not exists internal_note text check (internal_note is null or length(internal_note) <= 5000),
  add column if not exists matter_ref text check (matter_ref is null or length(matter_ref) <= 100);

alter table public.lalum_fin_customers
  add column if not exists retainer_active boolean not null default false,
  add column if not exists retainer_description text check (retainer_description is null or length(retainer_description) <= 500),
  add column if not exists retainer_amount numeric(14,2) check (retainer_amount is null or retainer_amount > 0),
  add constraint lalum_fin_customers_retainer_complete
    check (not retainer_active or (retainer_description is not null and retainer_amount is not null));

create or replace function public.lalum_fin_date_rule() returns trigger
language plpgsql set search_path to 'public' as $$
begin
  if new.status = 'ISSUED' and old.status = 'DRAFT' and not new.is_test then
    if new.issue_date > (now() at time zone 'Asia/Jerusalem')::date then raise exception 'DATE_IN_FUTURE'; end if;
    if exists (select 1 from public.lalum_fin_documents d
               where d.firm_id = new.firm_id and d.doc_type = new.doc_type and d.status = 'ISSUED'
                 and not d.is_test and d.id <> new.id and d.issue_date > new.issue_date) then
      raise exception 'DATE_BEFORE_LAST';
    end if;
  end if;
  return new;
end $$;
create trigger lalum_fin_documents_date_rule before update on public.lalum_fin_documents
  for each row execute function public.lalum_fin_date_rule();

-- lalum_fin_save_draft now carries internal_note and matter_ref.
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
        subtotal, vat_amount, total, issue_date, due_date, payment_method, payment_ref, related_doc_id, send_email, created_by, internal_note, matter_ref)
    values (v_firm, v_cust, v_type, coalesce(p->>'subject',''), v_inc, v_vat, v_lines, t.subtotal, t.vat_amount, t.total,
        coalesce((p->>'issue_date')::date, current_date), (p->>'due_date')::date, nullif(p->>'payment_method',''),
        nullif(p->>'payment_ref',''), (p->>'related_doc_id')::uuid, coalesce((p->>'send_email')::boolean, false), auth.uid(),
        nullif(btrim(p->>'internal_note'),''), nullif(btrim(p->>'matter_ref'),''))
    returning id into v_id;
  else
    update public.lalum_fin_documents set customer_id = v_cust, doc_type = v_type, subject = coalesce(p->>'subject',''),
        tax_included = v_inc, vat_rate = v_vat, lines = v_lines, subtotal = t.subtotal, vat_amount = t.vat_amount, total = t.total,
        issue_date = coalesce((p->>'issue_date')::date, current_date), due_date = (p->>'due_date')::date,
        payment_method = nullif(p->>'payment_method',''), payment_ref = nullif(p->>'payment_ref',''),
        related_doc_id = (p->>'related_doc_id')::uuid, send_email = coalesce((p->>'send_email')::boolean, false), last_error = null,
        internal_note = nullif(btrim(p->>'internal_note'),''), matter_ref = nullif(btrim(p->>'matter_ref'),'')
    where id = v_id and firm_id = v_firm and status = 'DRAFT';
    if not found then raise exception 'NOT_A_DRAFT'; end if;
  end if;
  return v_id;
end $$;
revoke execute on function public.lalum_fin_save_draft(uuid, jsonb) from public, anon;
grant execute on function public.lalum_fin_save_draft(uuid, jsonb) to authenticated;
