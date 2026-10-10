-- Own document engine, phase 3 (numbering and sealing), per lalum-app/docs/finance-engine-design.md.
-- This migration builds the database layer only: a per-type number series and a DRAFT -> SEALING ->
-- VOID state machine with tamper-evident hash chaining. It does NOT call the Tax Authority. The
-- SEALING -> ALLOCATED -> SEALED transition (the live Shaam/gov.il call) is a future edge function,
-- built only after the six open questions in the design doc are answered. Until then this is inert:
-- existing documents keep issuing through Invoice4U via lalum-fin-issue exactly as before.

-- One counter per firm and document type. A number, once handed out, is never reused or deleted,
-- even if the document that consumed it is later voided.
create table if not exists public.lalum_fin_series (
  firm_id     uuid not null references public.lalum_firms(id) on delete cascade,
  doc_type    text not null check (doc_type in ('PROFORMA','INVOICE','RECEIPT','INVOICE_RECEIPT','CREDIT')),
  last_number bigint not null default 0 check (last_number >= 0),
  updated_at  timestamptz not null default now(),
  primary key (firm_id, doc_type)
);
alter table public.lalum_fin_series enable row level security;
create policy lalum_fin_series_read on public.lalum_fin_series for select
  using ((select public.lalum_fin_can(firm_id)));
revoke all on public.lalum_fin_series from anon, authenticated;
grant select on public.lalum_fin_series to authenticated;
-- No insert, update or delete grant to authenticated: the only writer is lalum_fin_seal_document below.

-- Sealing lifecycle fields. doc_number and allocation_number already exist (shared with the
-- Invoice4U path); content_hash and prev_hash are new, set only when the own engine seals a document.
alter table public.lalum_fin_documents
  add column if not exists content_hash text,
  add column if not exists prev_hash    text,
  add column if not exists void_reason  text,
  add column if not exists sealing_at   timestamptz,
  add column if not exists allocated_at timestamptz,
  add column if not exists sealed_at    timestamptz,
  add column if not exists voided_at    timestamptz;

alter table public.lalum_fin_documents drop constraint if exists lalum_fin_documents_status_check;
alter table public.lalum_fin_documents
  add constraint lalum_fin_documents_status_check
  check (status in ('DRAFT','ISSUED','SEALING','ALLOCATED','SEALED','VOID'));

-- Extend immutability: everything from SEALING onward is frozen content, same as ISSUED today.
-- VOID is terminal too (the number stays consumed; only the reason and timestamp may be set, by
-- lalum_fin_void_document, not by a client update).
create or replace function public.lalum_fin_documents_guard() returns trigger
language plpgsql set search_path to 'public' as $$
begin
  if tg_op = 'DELETE' then
    if old.status <> 'DRAFT' then raise exception 'ISSUED_DOCUMENT_IMMUTABLE'; end if;
    return old;
  end if;
  if old.status <> 'DRAFT' and (
       new.doc_type is distinct from old.doc_type or new.customer_id is distinct from old.customer_id
    or new.lines is distinct from old.lines or new.total is distinct from old.total
    or new.subtotal is distinct from old.subtotal or new.vat_amount is distinct from old.vat_amount
    or new.issue_date is distinct from old.issue_date or new.doc_number is distinct from old.doc_number
    or new.i4u_doc_id is distinct from old.i4u_doc_id or new.content_hash is distinct from old.content_hash
    or new.prev_hash is distinct from old.prev_hash) then
    raise exception 'ISSUED_DOCUMENT_IMMUTABLE';
  end if;
  return new;
end $$;

-- Seal a DRAFT: assign the next series number, freeze content, and chain it to the previous sealed
-- document of the same type with a SHA-256 hash. Content and number become immutable the moment this
-- returns. This is the last step this migration performs; moving on to ALLOCATED (the Tax Authority
-- call) and SEALED (PDF) is a separate, not-yet-built edge function.
create or replace function public.lalum_fin_seal_document(p_id uuid) returns uuid
language plpgsql security definer set search_path to 'public' as $$
declare
  v_firm uuid := public.lalum_my_firm_id();
  d public.lalum_fin_documents%rowtype;
  v_number bigint;
  v_prev_hash text;
  v_content text;
  v_hash text;
begin
  if not public.lalum_fin_can(v_firm) then raise exception 'FORBIDDEN'; end if;
  select * into d from public.lalum_fin_documents where id = p_id and firm_id = v_firm for update;
  if not found then raise exception 'NOT_FOUND'; end if;
  if d.status <> 'DRAFT' then raise exception 'NOT_A_DRAFT'; end if;

  insert into public.lalum_fin_series (firm_id, doc_type, last_number)
    values (v_firm, d.doc_type, 1)
    on conflict (firm_id, doc_type) do update set last_number = public.lalum_fin_series.last_number + 1,
      updated_at = now()
    returning last_number into v_number;

  select content_hash into v_prev_hash from public.lalum_fin_documents
    where firm_id = v_firm and doc_type = d.doc_type and content_hash is not null
    order by doc_number desc nulls last limit 1;

  -- Canonical content: the fields that make the document what it legally is. Order is fixed so the
  -- same document always hashes the same way.
  v_content := v_number || '|' || d.doc_type || '|' || d.customer_id || '|' || d.issue_date || '|'
    || d.subtotal || '|' || d.vat_amount || '|' || d.total || '|' || d.lines::text || '|' || coalesce(v_prev_hash, '');
  -- Built-in sha256(bytea), no pgcrypto dependency.
  v_hash := encode(sha256(convert_to(v_content, 'UTF8')), 'hex');

  update public.lalum_fin_documents
    set status = 'SEALING', doc_number = v_number, content_hash = v_hash, prev_hash = v_prev_hash,
        sealing_at = now(), issued_by = auth.uid()
    where id = p_id;
  return p_id;
end $$;
revoke execute on function public.lalum_fin_seal_document(uuid) from public, anon;
grant execute on function public.lalum_fin_seal_document(uuid) to authenticated;

-- Void a document stuck in SEALING: the number stays consumed (never reused), the content stays
-- frozen, only a reason and timestamp are added. ALLOCATED and SEALED documents are real tax
-- documents and cannot be voided this way; a credit document is the only way to reverse those.
create or replace function public.lalum_fin_void_document(p_id uuid, p_reason text) returns uuid
language plpgsql security definer set search_path to 'public' as $$
declare v_firm uuid := public.lalum_my_firm_id();
begin
  if not public.lalum_fin_can(v_firm) then raise exception 'FORBIDDEN'; end if;
  if length(btrim(coalesce(p_reason, ''))) = 0 then raise exception 'REASON_REQUIRED'; end if;
  update public.lalum_fin_documents
    set status = 'VOID', void_reason = p_reason, voided_at = now()
    where id = p_id and firm_id = v_firm and status = 'SEALING';
  if not found then raise exception 'NOT_VOIDABLE'; end if;
  return p_id;
end $$;
revoke execute on function public.lalum_fin_void_document(uuid, text) from public, anon;
grant execute on function public.lalum_fin_void_document(uuid, text) to authenticated;
