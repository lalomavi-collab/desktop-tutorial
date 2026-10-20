-- 0066: closing a firm, step 2: the firm wide export package (the database half).
--
-- What the firm is owed on leaving: its own records, complete, in a form it can check. This migration adds the read side:
--   lalum_firm_export_manifest(firm)        what the package contains, with a row count and a sha256 per table, the audit chain check,
--                                           the originals in Storage (count, bytes), and anything it did NOT classify. Writes one chain row.
--   lalum_firm_export_page(firm, table, offset, limit)
--                                           the rows of one table, as the exact JSON text the hash was computed over, so a client can
--                                           join the pages with newlines and get the same sha256 as the manifest (a .jsonl file).
--   lalum_firm_export_originals(firm)       the list of originals (document, matter, path, sha256, size, mime) for a batch signer; one chain row.
-- Building the ZIP and signing the originals are the client and an Edge Function (not in this migration; see docs/firm-closure.md).
--
-- Who may call: a partner or admin of that firm behind MFA with financial permission (lalum_fin_can), or the platform admin in a second factor
-- session. Allowed in any firm status, SUSPENDED and CANCELED included: the handover is the point of the closure.
--
-- Classification, not silence. Every table with a firm_id column is either INCLUDED or EXCLUDED with a stated reason, and the manifest lists
-- `unclassified` (a table added later and not yet decided). A non empty list means the package is incomplete and must not be handed over.
-- Excluded: blind index hashes useless outside the platform, tax connection credentials, delivery queues, counters, platform records, client
-- portal access, running timers, import job logs. Nothing in the included tables is a credential (checked by column name on 2026-10-20).
-- Tables that do not exist in a database are skipped, so this runs on a fresh database too.

create or replace function public.lalum_export_classification() returns jsonb
language sql immutable as $$
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
      'lalum_document_versions','lalum_fin_archive','lalum_fin_business_addresses','lalum_fin_business_profile','lalum_fin_cashflow_settings',
      'lalum_fin_customers','lalum_fin_document_matters','lalum_fin_documents','lalum_fin_dunning_log','lalum_fin_expenses','lalum_fin_payments',
      'lalum_fin_permissions','lalum_fin_series','lalum_firm_members','lalum_inquiry_files','lalum_inquiry_replies','lalum_invoices','lalum_kyc_records',
      'lalum_matter_audit_log','lalum_matter_contacts','lalum_matter_documents','lalum_matter_fees','lalum_matter_folders','lalum_matter_inquiries',
      'lalum_matter_messages','lalum_matter_tasks','lalum_matter_team','lalum_milestones','lalum_rate_cards','lalum_signature_requests',
      'lalum_time_entries','lalum_trust_accounts','lalum_trust_bank_statements','lalum_trust_ledger'))
$$;
revoke all on function public.lalum_export_classification() from public, anon, authenticated;

create or replace function public.lalum_export_allowed(p_firm uuid) returns boolean
language sql stable security definer set search_path to 'public' as $$
  select auth.uid() is not null and p_firm is not null and (
    (coalesce(public.lalum_is_admin(), false) and coalesce(auth.jwt() ->> 'aal', '') = 'aal2')
    or (p_firm = public.lalum_my_firm_id() and public.lalum_my_role() in ('FIRM_PARTNER', 'ADMIN')
        and coalesce(public.lalum_mfa_ok(), false) and coalesce(public.lalum_fin_can(p_firm), false)))
$$;
revoke all on function public.lalum_export_allowed(uuid) from public, anon, authenticated;

create or replace function public.lalum_firm_export_manifest(p_firm uuid) returns jsonb
language plpgsql security definer set search_path to 'public', 'extensions' as $$
declare
  v_class jsonb := public.lalum_export_classification(); t text; n bigint; h text; v_sections jsonb := '[]'::jsonb; v_rows bigint := 0;
  v_broken bigint; v_head record; v_o_count bigint; v_o_bytes numeric; v_o_nohash bigint; v_unclassified jsonb; v_status text;
begin
  if not public.lalum_export_allowed(p_firm) then raise exception 'FORBIDDEN'; end if;
  select status into v_status from public.lalum_firms where id = p_firm;
  if v_status is null then raise exception 'NOT_FOUND'; end if;

  for t in select value from jsonb_array_elements_text(v_class -> 'included') order by 1 loop
    continue when to_regclass('public.' || quote_ident(t)) is null;
    -- a listed table that lost its firm_id would otherwise be exported empty without a word
    if not exists (select 1 from pg_attribute where attrelid = to_regclass('public.' || quote_ident(t)) and attname = 'firm_id' and not attisdropped) then
      raise exception 'TABLE_HAS_NO_FIRM_ID: %', t;
    end if;
    execute format('select count(*), encode(extensions.digest(convert_to(coalesce(string_agg(j, E''\n'' order by j), ''''), ''UTF8''), ''sha256''), ''hex'')
                      from (select to_jsonb(x)::text j from public.%I x where x.firm_id = $1) s', t) into n, h using p_firm;
    v_sections := v_sections || jsonb_build_object('table', t, 'rows', n, 'sha256', h, 'file', t || '.jsonl');
    v_rows := v_rows + n;
  end loop;

  v_broken := public.lalum_verify_audit_chain(p_firm);
  select seq, hash into v_head from public.lalum_matter_audit_log where firm_id = p_firm order by seq desc limit 1;

  select count(*) filter (where d.original_path is not null), coalesce(sum(d.original_size) filter (where d.original_path is not null), 0),
         count(*) filter (where d.original_path is not null and d.original_sha256 is null)
    into v_o_count, v_o_bytes, v_o_nohash
    from public.lalum_matter_documents d join public.lalum_cockpit_matters m on m.id = d.matter_id
   where d.firm_id = p_firm and m.purged_at is null;

  select coalesce(jsonb_agg(c.relname order by c.relname), '[]'::jsonb) into v_unclassified
    from pg_class c join pg_attribute a on a.attrelid = c.oid and a.attname = 'firm_id' and not a.attisdropped
   where c.relnamespace = 'public'::regnamespace and c.relkind = 'r' and c.relname like 'lalum\_%'
     and not (v_class -> 'included') ? c.relname and not (v_class -> 'excluded') ? c.relname;

  perform public.lalum_append_audit(p_firm, null, auth.uid(), 'FIRM_EXPORT_MANIFEST', null,
    jsonb_build_object('tables', jsonb_array_length(v_sections), 'rows', v_rows, 'originals', v_o_count, 'chain_ok', v_broken is null));

  return jsonb_build_object(
    'firm_status', v_status, 'generated_at', now(), 'format', 'jsonl, one JSON object per line, rows ordered by their JSON text',
    'sections', v_sections, 'rows_total', v_rows,
    'excluded', v_class -> 'excluded', 'unclassified', v_unclassified, 'complete', jsonb_array_length(v_unclassified) = 0,
    'audit_chain', jsonb_build_object('first_broken_seq', v_broken, 'verified', v_broken is null, 'head_seq', v_head.seq, 'head_hash', v_head.hash),
    'originals', jsonb_build_object('count', v_o_count, 'bytes', v_o_bytes, 'without_sha256', v_o_nohash));
end $$;
revoke execute on function public.lalum_firm_export_manifest(uuid) from public, anon;
grant execute on function public.lalum_firm_export_manifest(uuid) to authenticated;

create or replace function public.lalum_firm_export_page(p_firm uuid, p_table text, p_offset integer default 0, p_limit integer default 200) returns jsonb
language plpgsql security definer set search_path to 'public', 'extensions' as $$
declare v_class jsonb := public.lalum_export_classification(); v_rows jsonb; v_total bigint; v_limit integer := least(greatest(coalesce(p_limit, 200), 1), 500); v_offset integer := greatest(coalesce(p_offset, 0), 0);
begin
  if not public.lalum_export_allowed(p_firm) then raise exception 'FORBIDDEN'; end if;
  -- the table name reaches the SQL only after it matched the allowlist
  if p_table is null or not ((v_class -> 'included') ? p_table) then raise exception 'TABLE_NOT_EXPORTED'; end if;
  if to_regclass('public.' || quote_ident(p_table)) is null then raise exception 'TABLE_NOT_EXPORTED'; end if;
  execute format('select count(*) from public.%I x where x.firm_id = $1', p_table) into v_total using p_firm;
  execute format('select coalesce(jsonb_agg(j order by j), ''[]''::jsonb) from (select to_jsonb(x)::text j from public.%I x where x.firm_id = $1 order by 1 offset $2 limit $3) s', p_table)
    into v_rows using p_firm, v_offset, v_limit;
  return jsonb_build_object('table', p_table, 'offset', v_offset, 'limit', v_limit, 'total', v_total, 'rows', v_rows);
end $$;
revoke execute on function public.lalum_firm_export_page(uuid, text, integer, integer) from public, anon;
grant execute on function public.lalum_firm_export_page(uuid, text, integer, integer) to authenticated;

create or replace function public.lalum_firm_export_originals(p_firm uuid) returns jsonb
language plpgsql security definer set search_path to 'public' as $$
declare v_list jsonb;
begin
  if not public.lalum_export_allowed(p_firm) then raise exception 'FORBIDDEN'; end if;
  if not exists (select 1 from public.lalum_firms where id = p_firm) then raise exception 'NOT_FOUND'; end if;
  select coalesce(jsonb_agg(jsonb_build_object('document', d.id, 'matter', d.matter_id, 'path', d.original_path, 'sha256', d.original_sha256,
                                               'size', d.original_size, 'mime', d.original_mime, 'file_name', d.file_name) order by d.id), '[]'::jsonb)
    into v_list
    from public.lalum_matter_documents d join public.lalum_cockpit_matters m on m.id = d.matter_id
   where d.firm_id = p_firm and d.original_path is not null and m.purged_at is null;
  perform public.lalum_append_audit(p_firm, null, auth.uid(), 'FIRM_EXPORT_ORIGINALS', null, jsonb_build_object('originals', jsonb_array_length(v_list)));
  return jsonb_build_object('originals', v_list);
end $$;
revoke execute on function public.lalum_firm_export_originals(uuid) from public, anon;
grant execute on function public.lalum_firm_export_originals(uuid) to authenticated;
