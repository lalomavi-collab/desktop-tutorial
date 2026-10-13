-- Follow-up to 0024_lalum_finance_permissions.sql: two gates that migration did not reach, plus the
-- audit coverage its own decision calls for but that landed only on permission changes.
--
-- lalum_fin_seal_document (issuing) and lalum_fin_void_document (cancelling through a credit) still
-- called the single-argument lalum_fin_can(firm), which 0024 redefined to mean level 4 (admin). The
-- decision gives both of these to "issue" (3): "issue: draft, plus issue, cancel through a credit,
-- record payments and expenses". Unlike lalum_fin_delete_draft (0024's comment: left at admin on
-- purpose, deleting a draft is rare), nothing here says sealing or voiding should need admin, and
-- today it silently does: invisible only because the sole user is always level 4.
--
-- The decision also requires an audit row for "every issue, cancel, export and permission change".
-- 0024 covers permission change (FIN_PERMISSION_SET). Sealing and voiding wrote nothing; this adds
-- FIN_DOCUMENT_SEALED and FIN_DOCUMENT_VOIDED. Export had no RPC to write from at all, since the
-- uniform-structure-file screen (ShaamExportTab.tsx) is a pure client-side download with no server
-- round trip; lalum_fin_log_export gives it one, called right before the download starts.
--
-- Also: lalum_fin_archive_read was never moved off the single-arg call either, so reading the archive
-- needs admin today, where "view: Read documents, customers, reports" (level 1) is what 0024 already
-- set for lalum_fin_documents_read. This brings the archive in line with that.

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
  if not public.lalum_fin_can(v_firm, 3) then raise exception 'FORBIDDEN'; end if;
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

  v_content := v_number || '|' || d.doc_type || '|' || d.customer_id || '|' || d.issue_date || '|'
    || d.subtotal || '|' || d.vat_amount || '|' || d.total || '|' || d.lines::text || '|' || coalesce(v_prev_hash, '');
  v_hash := encode(sha256(convert_to(v_content, 'UTF8')), 'hex');

  update public.lalum_fin_documents
    set status = 'SEALING', doc_number = v_number, content_hash = v_hash, prev_hash = v_prev_hash,
        sealing_at = now(), issued_by = auth.uid()
    where id = p_id;
  perform public.lalum_audit_write(v_firm, 'FIN_DOCUMENT_SEALED', 'lalum_fin_documents', p_id::text,
    jsonb_build_object('doc_type', d.doc_type, 'doc_number', v_number));
  return p_id;
end $$;

create or replace function public.lalum_fin_void_document(p_id uuid, p_reason text) returns uuid
language plpgsql security definer set search_path to 'public' as $$
declare v_firm uuid := public.lalum_my_firm_id();
begin
  if not public.lalum_fin_can(v_firm, 3) then raise exception 'FORBIDDEN'; end if;
  if length(btrim(coalesce(p_reason, ''))) = 0 then raise exception 'REASON_REQUIRED'; end if;
  update public.lalum_fin_documents
    set status = 'VOID', void_reason = p_reason, voided_at = now()
    where id = p_id and firm_id = v_firm and status = 'SEALING';
  if not found then raise exception 'NOT_VOIDABLE'; end if;
  perform public.lalum_audit_write(v_firm, 'FIN_DOCUMENT_VOIDED', 'lalum_fin_documents', p_id::text,
    jsonb_build_object('reason', p_reason));
  return p_id;
end $$;

alter policy lalum_fin_archive_read on public.lalum_fin_archive using ((select public.lalum_fin_can(firm_id, 1)));

-- A client-triggered export logs itself. View level: anyone who could see the data may record that
-- they exported it; RLS on the underlying tables is what actually gated what they could read.
create or replace function public.lalum_fin_log_export(p_kind text, p_meta jsonb default '{}'::jsonb) returns void
language plpgsql security definer set search_path to 'public' as $$
declare v_firm uuid := public.lalum_my_firm_id();
begin
  if v_firm is null or not public.lalum_fin_can(v_firm, 1) then raise exception 'FORBIDDEN'; end if;
  perform public.lalum_audit_write(v_firm, 'FIN_EXPORT', p_kind, null, coalesce(p_meta, '{}'::jsonb));
end $$;
revoke execute on function public.lalum_fin_log_export(text, jsonb) from public, anon;
grant execute on function public.lalum_fin_log_export(text, jsonb) to authenticated;
