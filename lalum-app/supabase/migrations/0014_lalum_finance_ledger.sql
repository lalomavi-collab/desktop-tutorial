-- Finance ledger for the practice: customers, tax documents, receipts, expenses.
-- Phase 1 design boundary: this ledger is the bookkeeping record. The legally numbered tax
-- documents are issued by Invoice4U through the lalum-fin-issue edge function, which stores the
-- returned number, allocation number and PDF link. A document that is ISSUED is immutable here.
-- Totals are computed once, server side, in lalum_fin_save_draft; the client mirror in
-- src/lib/cockpit/finance.ts is verified against the same cases by `npm run finance-check`.
-- Access: firm partners and admins only, behind MFA.
-- Applied to project meoymkcotomoluwlwues as migrations "lalum_finance_ledger_*". lalum_fin_documents_guard
-- carries search_path public (set by a follow-up ALTER).

create table if not exists public.lalum_fin_customers (
  id           uuid primary key default gen_random_uuid(),
  firm_id      uuid not null references public.lalum_firms(id) on delete cascade,
  name         text not null check (length(btrim(name)) between 1 and 200),
  tax_id       text check (tax_id is null or tax_id ~ '^[0-9]{5,9}$'),
  email        text check (email is null or email ~ '^[^@\s]+@[^@\s]+$'),
  phone        text,
  address      text,
  city         text,
  i4u_customer_id bigint,
  notes        text,
  archived     boolean not null default false,
  created_by   uuid,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index if not exists lalum_fin_customers_firm_idx on public.lalum_fin_customers (firm_id, archived, name);

create table if not exists public.lalum_fin_documents (
  id                uuid primary key default gen_random_uuid(),
  firm_id           uuid not null references public.lalum_firms(id) on delete cascade,
  customer_id       uuid not null references public.lalum_fin_customers(id),
  doc_type          text not null check (doc_type in ('PROFORMA','INVOICE','RECEIPT','INVOICE_RECEIPT','CREDIT')),
  status            text not null default 'DRAFT' check (status in ('DRAFT','ISSUED')),
  subject           text not null default '' check (length(subject) <= 300),
  currency          text not null default 'ILS' check (currency = 'ILS'),
  tax_included      boolean not null default false,
  vat_rate          numeric(5,2) not null default 18 check (vat_rate between 0 and 30),
  lines             jsonb not null default '[]'::jsonb check (jsonb_typeof(lines) = 'array'),
  subtotal          numeric(14,2) not null default 0,
  vat_amount        numeric(14,2) not null default 0,
  total             numeric(14,2) not null default 0,
  issue_date        date not null default current_date,
  due_date          date,
  payment_method    text check (payment_method in ('CARD','CHEQUE','TRANSFER','CASH','BIT','PAYBOX')),
  payment_ref       text,
  related_doc_id    uuid references public.lalum_fin_documents(id),
  send_email        boolean not null default false,
  -- set by the edge function when Invoice4U accepts the document
  api_identifier    text unique,
  i4u_doc_id        text,
  doc_number        bigint,
  allocation_number text,
  pdf_url           text,
  is_test           boolean not null default false,
  last_error        text,
  issued_at         timestamptz,
  issued_by         uuid,
  created_by        uuid,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  check (doc_type not in ('RECEIPT','INVOICE_RECEIPT') or status = 'DRAFT' or payment_method is not null),
  check (doc_type <> 'CREDIT' or related_doc_id is not null)
);
create index if not exists lalum_fin_documents_firm_idx on public.lalum_fin_documents (firm_id, issue_date desc);
create index if not exists lalum_fin_documents_customer_idx on public.lalum_fin_documents (customer_id);

-- Money received that is not itself a tax document (a transfer matched to an invoice, for example).
create table if not exists public.lalum_fin_payments (
  id           uuid primary key default gen_random_uuid(),
  firm_id      uuid not null references public.lalum_firms(id) on delete cascade,
  customer_id  uuid references public.lalum_fin_customers(id),
  document_id  uuid references public.lalum_fin_documents(id),
  paid_on      date not null default current_date,
  amount       numeric(14,2) not null check (amount > 0),
  method       text not null check (method in ('CARD','CHEQUE','TRANSFER','CASH','BIT','PAYBOX')),
  reference    text,
  notes        text,
  created_by   uuid,
  created_at   timestamptz not null default now()
);
create index if not exists lalum_fin_payments_firm_idx on public.lalum_fin_payments (firm_id, paid_on desc);

create table if not exists public.lalum_fin_expenses (
  id             uuid primary key default gen_random_uuid(),
  firm_id        uuid not null references public.lalum_firms(id) on delete cascade,
  spent_on       date not null default current_date,
  supplier       text not null check (length(btrim(supplier)) between 1 and 200),
  category       text not null default 'OTHER' check (category in
                   ('OFFICE','SOFTWARE','PROFESSIONAL','TRAVEL','VEHICLE','COMMUNICATION','MARKETING','FEES','EDUCATION','OTHER')),
  description    text,
  total          numeric(14,2) not null check (total > 0),
  vat_amount     numeric(14,2) not null default 0 check (vat_amount >= 0),
  -- share of the VAT that can be claimed back, 0 to 100. The rule differs per category, so the
  -- partner states it explicitly instead of the system guessing.
  vat_recoverable_pct numeric(5,2) not null default 100 check (vat_recoverable_pct between 0 and 100),
  supplier_doc_ref text,
  payment_method text check (payment_method in ('CARD','CHEQUE','TRANSFER','CASH','BIT','PAYBOX')),
  created_by     uuid,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  check (vat_amount <= total)
);
create index if not exists lalum_fin_expenses_firm_idx on public.lalum_fin_expenses (firm_id, spent_on desc);

-- Access gate. One predicate, used by every policy and RPC below.
create or replace function public.lalum_fin_can(p_firm uuid) returns boolean
language sql stable security definer set search_path to 'public' as $$
  select p_firm = public.lalum_my_firm_id()
     and public.lalum_my_role() in ('FIRM_PARTNER','ADMIN')
     and public.lalum_mfa_ok() $$;
revoke execute on function public.lalum_fin_can(uuid) from public, anon;
grant execute on function public.lalum_fin_can(uuid) to authenticated;

alter table public.lalum_fin_customers enable row level security;
alter table public.lalum_fin_documents enable row level security;
alter table public.lalum_fin_payments  enable row level security;
alter table public.lalum_fin_expenses  enable row level security;

create policy lalum_fin_customers_all on public.lalum_fin_customers for all
  using ((select public.lalum_fin_can(firm_id))) with check ((select public.lalum_fin_can(firm_id)));
create policy lalum_fin_payments_all on public.lalum_fin_payments for all
  using ((select public.lalum_fin_can(firm_id))) with check ((select public.lalum_fin_can(firm_id)));
create policy lalum_fin_expenses_all on public.lalum_fin_expenses for all
  using ((select public.lalum_fin_can(firm_id))) with check ((select public.lalum_fin_can(firm_id)));
-- Documents: read only. Every write goes through the RPCs below or the edge function.
create policy lalum_fin_documents_read on public.lalum_fin_documents for select
  using ((select public.lalum_fin_can(firm_id)));

revoke all on public.lalum_fin_customers, public.lalum_fin_documents, public.lalum_fin_payments, public.lalum_fin_expenses from anon, authenticated;
grant select, insert, update, delete on public.lalum_fin_customers, public.lalum_fin_payments, public.lalum_fin_expenses to authenticated;
grant select on public.lalum_fin_documents to authenticated;

create trigger lalum_fin_customers_touch before update on public.lalum_fin_customers
  for each row execute function public.lalum_touch_updated_at();
create trigger lalum_fin_documents_touch before update on public.lalum_fin_documents
  for each row execute function public.lalum_touch_updated_at();
create trigger lalum_fin_expenses_touch before update on public.lalum_fin_expenses
  for each row execute function public.lalum_touch_updated_at();

-- An issued tax document is a legal record: no edit of its content, no delete. Only the
-- edge function (service role) may fill the issuing fields, and only while it is still a draft.
create or replace function public.lalum_fin_documents_guard() returns trigger
language plpgsql set search_path to 'public' as $$
begin
  if tg_op = 'DELETE' then
    if old.status = 'ISSUED' then raise exception 'ISSUED_DOCUMENT_IMMUTABLE'; end if;
    return old;
  end if;
  if old.status = 'ISSUED' and (
       new.doc_type is distinct from old.doc_type or new.customer_id is distinct from old.customer_id
    or new.lines is distinct from old.lines or new.total is distinct from old.total
    or new.subtotal is distinct from old.subtotal or new.vat_amount is distinct from old.vat_amount
    or new.issue_date is distinct from old.issue_date or new.doc_number is distinct from old.doc_number
    or new.i4u_doc_id is distinct from old.i4u_doc_id or new.status is distinct from old.status) then
    raise exception 'ISSUED_DOCUMENT_IMMUTABLE';
  end if;
  return new;
end $$;
create trigger lalum_fin_documents_guard_t before update or delete on public.lalum_fin_documents
  for each row execute function public.lalum_fin_documents_guard();

-- Single source of truth for totals. Rounding: sum the lines first, round once.
--   tax included:  gross = sum; net = round(gross / (1 + r/100), 2); vat = gross - net
--   tax excluded:  net = sum;   vat = round(net * r/100, 2);          total = net + vat
create or replace function public.lalum_fin_totals(p_lines jsonb, p_vat numeric, p_included boolean)
returns table (subtotal numeric, vat_amount numeric, total numeric)
language plpgsql immutable set search_path to 'public' as $$
declare s numeric := 0; l jsonb; net numeric; vat numeric;
begin
  for l in select * from jsonb_array_elements(p_lines) loop
    s := s + (l->>'qty')::numeric * (l->>'price')::numeric;
  end loop;
  if p_included then
    net := round(s / (1 + p_vat / 100), 2);
    vat := round(s, 2) - net;
    return query select net, vat, round(s, 2);
  else
    net := round(s, 2);
    vat := round(net * p_vat / 100, 2);
    return query select net, vat, net + vat;
  end if;
end $$;

-- Create or update a DRAFT. p: customer_id, doc_type, subject, tax_included, vat_rate, lines,
-- issue_date, due_date, payment_method, payment_ref, related_doc_id, send_email.
create or replace function public.lalum_fin_save_draft(p_id uuid, p jsonb) returns uuid
language plpgsql security definer set search_path to 'public' as $$
declare
  v_firm uuid := public.lalum_my_firm_id();
  v_id uuid := p_id; v_lines jsonb := coalesce(p->'lines', '[]'::jsonb);
  v_type text := p->>'doc_type'; v_vat numeric := coalesce((p->>'vat_rate')::numeric, 18);
  v_inc boolean := coalesce((p->>'tax_included')::boolean, false);
  t record; l jsonb; v_cust uuid := (p->>'customer_id')::uuid;
begin
  if not public.lalum_fin_can(v_firm) then raise exception 'FORBIDDEN'; end if;
  if v_type not in ('PROFORMA','INVOICE','RECEIPT','INVOICE_RECEIPT','CREDIT') then raise exception 'BAD_TYPE'; end if;
  if not exists (select 1 from public.lalum_fin_customers where id = v_cust and firm_id = v_firm) then raise exception 'BAD_CUSTOMER'; end if;
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

create or replace function public.lalum_fin_delete_draft(p_id uuid) returns void
language plpgsql security definer set search_path to 'public' as $$
begin
  if not public.lalum_fin_can(public.lalum_my_firm_id()) then raise exception 'FORBIDDEN'; end if;
  delete from public.lalum_fin_documents where id = p_id and firm_id = public.lalum_my_firm_id() and status = 'DRAFT';
  if not found then raise exception 'NOT_A_DRAFT'; end if;
end $$;
revoke execute on function public.lalum_fin_delete_draft(uuid) from public, anon;
grant execute on function public.lalum_fin_delete_draft(uuid) to authenticated;
