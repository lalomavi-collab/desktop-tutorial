-- 0079: classify the two firm tables the export refused to pass.
--
-- The first real firm export (2026-10-22) ran past the manifest and stopped with "the package is incomplete: a table has not been classified for
-- export". lalum_firm_export_manifest lists every public.lalum_* table that has a firm_id and is in neither list of lalum_export_classification(), and
-- the client refuses to produce a package while that list is not empty (a package that silently left a firm table out would be a false handover).
-- Two tables were added to the schema after 0066 and never classified:
--   lalum_fin_doc_sends       what the firm sent to its clients from the finance screens: channel, recipient, subject, body, delivery status. The
--                             firm's own correspondence record, the same kind of thing as lalum_fin_dunning_log, which is exported. INCLUDED.
--   lalum_name_reveal_grants  which users the administrator allowed to see real client names (firm, user, granted by, when). Access governance of the
--                             firm, the same kind of thing as lalum_fin_permissions, which is exported. INCLUDED.
-- Neither holds credentials, counters or platform internals, which is what the excluded list is for.
--
-- Only the function body changes (the two names added to `included`); the excluded list, the signature and the revoke are as in 0066.
-- A table added to the schema in future still has to be classified here or the export stops, which is the intended behaviour.

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
      'lalum_fin_customers','lalum_fin_doc_sends','lalum_fin_document_matters','lalum_fin_documents','lalum_fin_dunning_log','lalum_fin_expenses','lalum_fin_payments',
      'lalum_fin_permissions','lalum_fin_series','lalum_firm_members','lalum_inquiry_files','lalum_inquiry_replies','lalum_invoices','lalum_kyc_records',
      'lalum_matter_audit_log','lalum_matter_contacts','lalum_matter_documents','lalum_matter_fees','lalum_matter_folders','lalum_matter_inquiries',
      'lalum_matter_messages','lalum_matter_tasks','lalum_matter_team','lalum_milestones','lalum_name_reveal_grants','lalum_rate_cards','lalum_signature_requests',
      'lalum_time_entries','lalum_trust_accounts','lalum_trust_bank_statements','lalum_trust_ledger'))
$$;
revoke all on function public.lalum_export_classification() from public, anon, authenticated;
