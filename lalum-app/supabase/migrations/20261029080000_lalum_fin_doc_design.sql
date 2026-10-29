-- Document design (owner's request, 29 October 2026): how the firm's invoices, receipts and pro formas look. A brand profile per firm
-- (logo, contact lines, bank details, a footer note) and any number of saved designs, each one a small JSON spec that the app renders
-- (src/lib/cockpit/docDesign.ts, docDesignRender.ts). One design can be the default per document type.
--
-- What this does not do: it does not change the legal document. Every tax document is still produced and digitally signed by the
-- issuing provider, Invoice4U, in the look set in Invoice4U's own settings. A design here drives the preview, the samples and, once
-- the own engine seals documents itself, that document. See lalum-app/docs/finance-doc-design.md.
--
-- The logo is kept in the row as a data URL (PNG, JPEG, WebP, GIF or SVG, at most about 300 KB), not in a bucket: it is small, it is
-- the firm's own record, the firm export carries it with the row, and the page only ever shows it through an <img>, where an SVG
-- cannot run script. No storage policy is needed.
--
-- Reading is finance level 1 (anyone who sees the ledger sees how its documents look). Writing is finance admin (level 4) and goes
-- through three functions that write the audit chain: lalum_fin_doc_brand_set, lalum_fin_doc_design_save, lalum_fin_doc_design_archive.
-- Nothing is deleted: a design that is no longer wanted is archived.
--
-- The firm export (0066) refuses to call a package complete while a table with a firm_id is unclassified, so the classification is
-- re-created with both new tables included. The list is the one of 20261027100000 plus these two, nothing else changed.
-- No data changes. Nothing is backfilled.

create table if not exists public.lalum_fin_doc_brand (
  firm_id       uuid primary key references public.lalum_firms(id) on delete cascade,
  logo_data_url text check (logo_data_url is null or (length(logo_data_url) <= 400000
                  and logo_data_url ~ '^data:image/(png|jpeg|webp|gif|svg\+xml);base64,[A-Za-z0-9+/=]+$')),
  phone         text check (phone is null or length(phone) <= 40),
  email         text check (email is null or length(email) <= 120),
  website       text check (website is null or length(website) <= 120),
  bank          jsonb check (bank is null or (jsonb_typeof(bank) = 'object' and octet_length(bank::text) <= 400)),
  footer_note   text check (footer_note is null or length(footer_note) <= 300),
  updated_by    uuid,
  updated_at    timestamptz not null default now()
);

create table if not exists public.lalum_fin_doc_designs (
  id          uuid primary key default gen_random_uuid(),
  firm_id     uuid not null references public.lalum_firms(id) on delete cascade,
  name        text not null check (length(btrim(name)) between 1 and 80),
  spec        jsonb not null check (jsonb_typeof(spec) = 'object' and spec ->> 'v' = '1' and octet_length(spec::text) <= 8000),
  default_for text[] not null default '{}'
              check (default_for <@ array['PROFORMA', 'INVOICE', 'RECEIPT', 'INVOICE_RECEIPT', 'CREDIT']::text[]),
  created_by  uuid,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  archived_at timestamptz,
  check (archived_at is null or default_for = '{}')
);
create index if not exists lalum_fin_doc_designs_firm on public.lalum_fin_doc_designs (firm_id) where archived_at is null;

alter table public.lalum_fin_doc_brand   enable row level security;
alter table public.lalum_fin_doc_brand   force row level security;
alter table public.lalum_fin_doc_designs enable row level security;
alter table public.lalum_fin_doc_designs force row level security;
revoke all on public.lalum_fin_doc_brand, public.lalum_fin_doc_designs from public, anon, authenticated;
grant select on public.lalum_fin_doc_brand, public.lalum_fin_doc_designs to authenticated;
drop policy if exists lalum_fin_doc_brand_read on public.lalum_fin_doc_brand;
create policy lalum_fin_doc_brand_read on public.lalum_fin_doc_brand for select to authenticated using ((select public.lalum_fin_can(firm_id, 1)));
drop policy if exists lalum_fin_doc_designs_read on public.lalum_fin_doc_designs;
create policy lalum_fin_doc_designs_read on public.lalum_fin_doc_designs for select to authenticated using ((select public.lalum_fin_can(firm_id, 1)));

create or replace function public.lalum_fin_doc_brand_set(p_firm uuid, p_logo text, p_phone text, p_email text, p_website text, p_bank jsonb, p_footer text)
returns void language plpgsql security definer set search_path to 'public' as $$
begin
  if auth.uid() is null or p_firm is null or not coalesce(public.lalum_fin_can(p_firm), false) then raise exception 'FORBIDDEN'; end if;
  insert into public.lalum_fin_doc_brand (firm_id, logo_data_url, phone, email, website, bank, footer_note, updated_by, updated_at)
  values (p_firm, nullif(p_logo, ''), nullif(btrim(p_phone), ''), nullif(btrim(p_email), ''), nullif(btrim(p_website), ''), p_bank, nullif(btrim(p_footer), ''), auth.uid(), now())
  on conflict (firm_id) do update set logo_data_url = excluded.logo_data_url, phone = excluded.phone, email = excluded.email, website = excluded.website,
    bank = excluded.bank, footer_note = excluded.footer_note, updated_by = excluded.updated_by, updated_at = excluded.updated_at;
  -- the logo itself is not copied into the audit chain, only its fingerprint and size
  perform public.lalum_audit_write(p_firm, 'FIN_DOC_BRAND_SET', 'lalum_fin_doc_brand', p_firm::text, jsonb_build_object(
    'logo_md5', case when nullif(p_logo, '') is null then null else md5(p_logo) end, 'logo_chars', length(nullif(p_logo, '')),
    'bank', p_bank is not null, 'footer', nullif(btrim(p_footer), '') is not null));
end $$;
revoke execute on function public.lalum_fin_doc_brand_set(uuid, text, text, text, text, jsonb, text) from public, anon;
grant execute on function public.lalum_fin_doc_brand_set(uuid, text, text, text, text, jsonb, text) to authenticated;

-- Saves a design (p_id null creates one). A type named in p_default_for stops being the default of any other design of the firm,
-- so each document type has at most one default.
create or replace function public.lalum_fin_doc_design_save(p_firm uuid, p_id uuid, p_name text, p_spec jsonb, p_default_for text[])
returns uuid language plpgsql security definer set search_path to 'public' as $$
declare v_id uuid; v_defaults text[] := coalesce(p_default_for, '{}');
begin
  if auth.uid() is null or p_firm is null or not coalesce(public.lalum_fin_can(p_firm), false) then raise exception 'FORBIDDEN'; end if;
  if p_id is null then
    insert into public.lalum_fin_doc_designs (firm_id, name, spec, default_for, created_by)
    values (p_firm, btrim(p_name), p_spec, v_defaults, auth.uid()) returning id into v_id;
  else
    update public.lalum_fin_doc_designs set name = btrim(p_name), spec = p_spec, default_for = v_defaults, updated_at = now()
    where id = p_id and firm_id = p_firm and archived_at is null returning id into v_id;
    if v_id is null then raise exception 'NOT_FOUND'; end if;
  end if;
  if cardinality(v_defaults) > 0 then
    update public.lalum_fin_doc_designs set default_for = array(select unnest(default_for) except select unnest(v_defaults)), updated_at = now()
    where firm_id = p_firm and id <> v_id and default_for && v_defaults;
  end if;
  perform public.lalum_audit_write(p_firm, 'FIN_DOC_DESIGN_SAVED', 'lalum_fin_doc_designs', v_id::text,
    jsonb_build_object('name', btrim(p_name), 'layout', p_spec ->> 'layout', 'default_for', to_jsonb(v_defaults), 'created', p_id is null));
  return v_id;
end $$;
revoke execute on function public.lalum_fin_doc_design_save(uuid, uuid, text, jsonb, text[]) from public, anon;
grant execute on function public.lalum_fin_doc_design_save(uuid, uuid, text, jsonb, text[]) to authenticated;

create or replace function public.lalum_fin_doc_design_archive(p_id uuid) returns void
language plpgsql security definer set search_path to 'public' as $$
declare v_firm uuid;
begin
  select firm_id into v_firm from public.lalum_fin_doc_designs where id = p_id and archived_at is null;
  if auth.uid() is null or v_firm is null or not coalesce(public.lalum_fin_can(v_firm), false) then raise exception 'FORBIDDEN'; end if;
  update public.lalum_fin_doc_designs set archived_at = now(), default_for = '{}', updated_at = now() where id = p_id;
  perform public.lalum_audit_write(v_firm, 'FIN_DOC_DESIGN_ARCHIVED', 'lalum_fin_doc_designs', p_id::text, '{}'::jsonb);
end $$;
revoke execute on function public.lalum_fin_doc_design_archive(uuid) from public, anon;
grant execute on function public.lalum_fin_doc_design_archive(uuid) to authenticated;

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
      'lalum_fin_cashflow_settings','lalum_fin_customers','lalum_fin_doc_brand','lalum_fin_doc_designs','lalum_fin_doc_sends','lalum_fin_document_matters','lalum_fin_documents','lalum_fin_dunning_log',
      'lalum_fin_expense_docs','lalum_fin_expenses','lalum_fin_payments','lalum_fin_permissions','lalum_fin_recon_matches','lalum_fin_revenue_class',
      'lalum_fin_series','lalum_fin_tax_settings','lalum_firm_members','lalum_inquiry_files','lalum_inquiry_replies','lalum_invoices','lalum_kyc_records',
      'lalum_matter_audit_log','lalum_matter_contacts','lalum_matter_documents','lalum_matter_fees','lalum_matter_folders','lalum_matter_inquiries',
      'lalum_matter_messages','lalum_matter_tasks','lalum_matter_team','lalum_milestones','lalum_name_reveal_grants','lalum_rate_cards','lalum_signature_requests',
      'lalum_time_entries','lalum_trust_accounts','lalum_trust_bank_statements','lalum_trust_ledger'))
$$;
