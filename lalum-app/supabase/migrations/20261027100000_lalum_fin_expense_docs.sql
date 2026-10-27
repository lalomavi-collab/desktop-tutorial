-- The source documents behind an expense (the supplier's invoice, its receipt, a credit note), kept next to the row they prove.
-- Decision of the owner, 23 October 2026. In an audit an expense without its document is not recognised.
--
-- Storage: the private bucket finance-expense-docs, with no storage policies on purpose. With RLS on storage.objects and no policy, only the
-- service role (the lalum-fin-expense-doc edge function) can read or write it. The object path is content addressed,
-- firm/expense/<sha256>.<ext>, and the function uploads with upsert off: the same file twice is the same object, and a different file can never
-- overwrite an earlier one.
--
-- Record: lalum_fin_expense_docs, one row per document, several per expense. A replacement does not remove anything: the earlier row gets
-- superseded_at and superseded_by and its object stays in the bucket. A document cannot be deleted while the expense it proves is still in the
-- tax retention period (0070: 31 December of the expense's year plus 7), and no field of a row can change except that one supersession, once.
-- An expense that has a document cannot be deleted (the foreign key), so its proof never loses its subject; a wrong entry is corrected, and
-- a correction is audited by 0071.
--
-- Writes go through two functions that check the caller's own finance level (lalum_fin_can, 0024) with the caller's own JWT:
--   lalum_fin_expense_doc_attach(expense, path, sha256, mime, size, supersedes)   level 3, the level that writes an expense. Checks that the
--     path is the one the content dictates and that the object is really in the bucket with that size, records the row (idempotent on the
--     same file for the same expense), supersedes the earlier one if asked, and writes FIN_EXPENSE_DOC_ATTACHED to the audit log. Returns how
--     many other expenses of the firm already carry the same file: the same invoice behind two expenses is how a duplicate expense shows.
--   lalum_fin_expense_doc_open(doc)   level 1, the level that reads an expense (a bookkeeper included). Writes FIN_EXPENSE_DOC_VIEWED and
--     returns the path, which only the edge function can turn into a 60 second link.
-- The table itself is readable at level 1 and writable by no client role at all.
--
-- Also: the firm export (0066) refuses to call a package complete while a table with a firm_id is neither included nor excluded. Six such
-- tables exist now (this one, the bank reconciliation of 20261023101711, and the tax engine settings of 0082/0083), so the classification
-- is re-created with all six included: each is the firm's own accounting record. The source files themselves are not yet in the package
-- (the originals list of 0068 covers matter originals only); the rows, with each file's sha256, are.
-- No data changes. Nothing is backfilled.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('finance-expense-docs', 'finance-expense-docs', false, 15728640,
        array['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/gif'])
on conflict (id) do nothing;

create table if not exists public.lalum_fin_expense_docs (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid not null references public.lalum_firms(id) on delete cascade,
  expense_id uuid not null references public.lalum_fin_expenses(id),
  path text not null unique,
  sha256 text not null check (sha256 ~ '^[0-9a-f]{64}$'),
  mime text not null check (mime in ('application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/gif')),
  size_bytes bigint not null check (size_bytes > 0 and size_bytes <= 15728640),
  uploaded_by uuid,
  uploaded_at timestamptz not null default now(),
  superseded_at timestamptz,
  superseded_by uuid references public.lalum_fin_expense_docs(id),
  unique (expense_id, sha256),
  check ((superseded_at is null) = (superseded_by is null))
);
create index if not exists lalum_fin_expense_docs_firm_sha on public.lalum_fin_expense_docs (firm_id, sha256);

alter table public.lalum_fin_expense_docs enable row level security;
revoke all on public.lalum_fin_expense_docs from public, anon, authenticated;
grant select on public.lalum_fin_expense_docs to authenticated;
drop policy if exists lalum_fin_expense_docs_read on public.lalum_fin_expense_docs;
create policy lalum_fin_expense_docs_read on public.lalum_fin_expense_docs for select to authenticated using ((select public.lalum_fin_can(firm_id, 1)));

create or replace function public.lalum_fin_expense_doc_guard() returns trigger
language plpgsql set search_path to 'public' as $$
declare v_spent date;
begin
  if tg_op = 'DELETE' then
    select spent_on into v_spent from public.lalum_fin_expenses where id = old.expense_id;
    if v_spent is not null and current_date <= public.lalum_tax_retention_until(v_spent) then
      raise exception 'TAX_RETENTION: this document must be kept until the end of %', public.lalum_tax_retention_until(v_spent);
    end if;
    return old;
  end if;
  -- the one change a row may take: being superseded, once, by another row
  if old.superseded_at is not null or new.superseded_at is null or new.superseded_by is null or new.superseded_by = old.id
     or new.id <> old.id or new.firm_id <> old.firm_id or new.expense_id <> old.expense_id or new.path <> old.path or new.sha256 <> old.sha256
     or new.mime <> old.mime or new.size_bytes <> old.size_bytes or new.uploaded_by is distinct from old.uploaded_by or new.uploaded_at <> old.uploaded_at then
    raise exception 'EXPENSE_DOC_IMMUTABLE';
  end if;
  return new;
end $$;
revoke execute on function public.lalum_fin_expense_doc_guard() from public, anon, authenticated;
drop trigger if exists lalum_fin_expense_docs_guard_t on public.lalum_fin_expense_docs;
create trigger lalum_fin_expense_docs_guard_t before update or delete on public.lalum_fin_expense_docs for each row execute function public.lalum_fin_expense_doc_guard();

create or replace function public.lalum_fin_expense_doc_attach(p_expense uuid, p_path text, p_sha256 text, p_mime text, p_size bigint, p_supersedes uuid default null)
returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare v_firm uuid; v_ext text; v_obj bigint; v_id uuid; v_old record; v_dup boolean := false; v_elsewhere integer;
begin
  if auth.uid() is null or p_expense is null then raise exception 'FORBIDDEN'; end if;
  select firm_id into v_firm from public.lalum_fin_expenses where id = p_expense;
  -- one answer for "no such expense" and "not enough level": a refusal reveals nothing about which
  if v_firm is null or not coalesce(public.lalum_fin_can(v_firm, 3), false) then raise exception 'FORBIDDEN'; end if;
  if p_sha256 is null or p_sha256 !~ '^[0-9a-f]{64}$' then raise exception 'BAD_HASH'; end if;
  v_ext := case p_mime when 'application/pdf' then 'pdf' when 'image/jpeg' then 'jpg' when 'image/png' then 'png' when 'image/webp' then 'webp' when 'image/gif' then 'gif' end;
  if v_ext is null then raise exception 'BAD_TYPE'; end if;
  if p_path is distinct from v_firm::text || '/' || p_expense::text || '/' || p_sha256 || '.' || v_ext then raise exception 'BAD_PATH'; end if;
  select (o.metadata ->> 'size')::bigint into v_obj from storage.objects o where o.bucket_id = 'finance-expense-docs' and o.name = p_path;
  if v_obj is null or v_obj is distinct from p_size then raise exception 'OBJECT_MISSING'; end if;

  if p_supersedes is not null then
    select id, expense_id, superseded_at into v_old from public.lalum_fin_expense_docs where id = p_supersedes for update;
    if v_old.id is null or v_old.expense_id <> p_expense then raise exception 'BAD_SUPERSEDES'; end if;
    if v_old.superseded_at is not null then raise exception 'ALREADY_SUPERSEDED'; end if;
  end if;

  insert into public.lalum_fin_expense_docs (firm_id, expense_id, path, sha256, mime, size_bytes, uploaded_by)
  values (v_firm, p_expense, p_path, p_sha256, p_mime, p_size, auth.uid())
  on conflict (expense_id, sha256) do nothing
  returning id into v_id;
  if v_id is null then
    -- the same file for the same expense is already recorded: nothing new to keep, and nothing to supersede with it
    select id into v_id from public.lalum_fin_expense_docs where expense_id = p_expense and sha256 = p_sha256;
    v_dup := true;
  else
    if p_supersedes is not null then
      update public.lalum_fin_expense_docs set superseded_at = now(), superseded_by = v_id where id = p_supersedes;
    end if;
    perform public.lalum_audit_write(v_firm, 'FIN_EXPENSE_DOC_ATTACHED', 'lalum_fin_expense_docs', v_id::text,
      jsonb_build_object('expense_id', p_expense, 'sha256', p_sha256, 'mime', p_mime, 'size', p_size, 'supersedes', p_supersedes));
  end if;
  select count(distinct expense_id) into v_elsewhere from public.lalum_fin_expense_docs where firm_id = v_firm and sha256 = p_sha256 and expense_id <> p_expense;
  return jsonb_build_object('id', v_id, 'duplicate', v_dup, 'same_file_elsewhere', v_elsewhere);
end $$;
revoke execute on function public.lalum_fin_expense_doc_attach(uuid, text, text, text, bigint, uuid) from public, anon;
grant execute on function public.lalum_fin_expense_doc_attach(uuid, text, text, text, bigint, uuid) to authenticated;

create or replace function public.lalum_fin_expense_doc_open(p_doc uuid) returns jsonb
language plpgsql security definer set search_path to 'public' as $$
declare d record;
begin
  if auth.uid() is null or p_doc is null then raise exception 'FORBIDDEN'; end if;
  select id, firm_id, expense_id, path, mime into d from public.lalum_fin_expense_docs where id = p_doc;
  if d.id is null or not coalesce(public.lalum_fin_can(d.firm_id, 1), false) then raise exception 'FORBIDDEN'; end if;
  perform public.lalum_audit_write(d.firm_id, 'FIN_EXPENSE_DOC_VIEWED', 'lalum_fin_expense_docs', d.id::text, jsonb_build_object('expense_id', d.expense_id));
  return jsonb_build_object('path', d.path, 'mime', d.mime, 'expense_id', d.expense_id);
end $$;
revoke execute on function public.lalum_fin_expense_doc_open(uuid) from public, anon;
grant execute on function public.lalum_fin_expense_doc_open(uuid) to authenticated;

-- search_path pinned here too: create or replace resets it, and the security day pins it (advisor: mutable search_path).
create or replace function public.lalum_export_classification() returns jsonb
language sql immutable set search_path = public as $$
  select jsonb_build_object(
    'excluded', jsonb_build_object(
      'lalum_conflict_parties',       'blind index hashes of party names, meaningless outside the platform',
      'lalum_tax_connections',        'references to credentials in the vault; revoked by hand, never exported',
      'lalum_tax_api_log',            'operational log of calls to the tax authority API',
      'lalum_dispatch_outbox',        'delivery queue of the platform',
      'lalum_matter_code_counters',   'counter of the platform',
      'lalum_trust_receipt_counters', 'counter of the platform',
      'lalum_firm_closures',          'record of the platform about the closure itself',
      'lalum_tier_change_requests',   'record of the platform about the subscription',
      'lalum_matter_client_access',   'access credentials of the client portal',
      'lalum_time_timers',            'running timers, ephemeral',
      'lalum_fin_import_runs',        'log of import jobs'),
    'included', jsonb_build_array(
      'lalum_attendance','lalum_audit_log','lalum_cash_forecast_items','lalum_client_submissions','lalum_cockpit_matters','lalum_conflict_checks',
      'lalum_conflict_notes','lalum_deadlines','lalum_disbursements','lalum_doc_annexes','lalum_doc_checklist','lalum_doc_templates',
      'lalum_document_versions','lalum_fin_archive','lalum_fin_bank_accounts','lalum_fin_bank_lines','lalum_fin_business_addresses','lalum_fin_business_profile',
      'lalum_fin_cashflow_settings','lalum_fin_customers','lalum_fin_doc_sends','lalum_fin_document_matters','lalum_fin_documents','lalum_fin_dunning_log',
      'lalum_fin_expense_docs','lalum_fin_expenses','lalum_fin_payments','lalum_fin_permissions','lalum_fin_recon_matches','lalum_fin_revenue_class',
      'lalum_fin_series','lalum_fin_tax_settings','lalum_firm_members','lalum_inquiry_files','lalum_inquiry_replies','lalum_invoices','lalum_kyc_records',
      'lalum_matter_audit_log','lalum_matter_contacts','lalum_matter_documents','lalum_matter_fees','lalum_matter_folders','lalum_matter_inquiries',
      'lalum_matter_messages','lalum_matter_tasks','lalum_matter_team','lalum_milestones','lalum_name_reveal_grants','lalum_rate_cards','lalum_signature_requests',
      'lalum_time_entries','lalum_trust_accounts','lalum_trust_bank_statements','lalum_trust_ledger'))
$$;
revoke all on function public.lalum_export_classification() from public, anon, authenticated;
