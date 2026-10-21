-- 0076: the firm export manifest writes its own audit row BEFORE it counts the tables.
--
-- lalum_firm_export_manifest (0066) counted and hashed every included table, then appended the FIRM_EXPORT_MANIFEST row to the audit chain.
-- The audit tables (lalum_matter_audit_log, and lalum_audit_log which mirrors it) are themselves part of the package, so every export grew them by
-- one row after the count. The page function counts at read time, so it reported one more row than the manifest announced, the client read that as
-- COUNT_CHANGED and refused to produce a file. It failed on every attempt, not only when someone else wrote at the same moment (first real run,
-- 2026-10-21: "הנתונים השתנו בזמן הייצוא").
-- The fix is the order: the row goes in first, then the counts, so the manifest counts its own row and the head of the chain it reports is the
-- last row the package contains. The row's meta no longer carries `rows`, because that total is only known after the count; the total is in
-- the manifest answer itself. Nothing else changes: same gate, same sections, same shape of the answer.
--
-- Signature and grants are unchanged, so create or replace keeps them.

create or replace function public.lalum_firm_export_manifest(p_firm uuid) returns jsonb
language plpgsql security definer set search_path to 'public', 'extensions' as $$
declare
  v_class jsonb := public.lalum_export_classification(); t text; n bigint; h text; v_sections jsonb := '[]'::jsonb; v_rows bigint := 0;
  v_broken bigint; v_head record; v_o_count bigint; v_o_bytes numeric; v_o_nohash bigint; v_unclassified jsonb; v_status text; v_tables integer;
begin
  if not public.lalum_export_allowed(p_firm) then raise exception 'FORBIDDEN'; end if;
  select status into v_status from public.lalum_firms where id = p_firm;
  if v_status is null then raise exception 'NOT_FOUND'; end if;

  -- everything that does not depend on the audit tables is read first, so the row below can describe it
  v_broken := public.lalum_verify_audit_chain(p_firm);
  select count(*) into v_tables from jsonb_array_elements_text(v_class -> 'included') e where to_regclass('public.' || quote_ident(e.value)) is not null;

  select count(*) filter (where d.original_path is not null), coalesce(sum(d.original_size) filter (where d.original_path is not null), 0),
         count(*) filter (where d.original_path is not null and d.original_sha256 is null)
    into v_o_count, v_o_bytes, v_o_nohash
    from public.lalum_matter_documents d join public.lalum_cockpit_matters m on m.id = d.matter_id
   where d.firm_id = p_firm and m.purged_at is null;

  -- the audit row first: the counts below include it
  perform public.lalum_append_audit(p_firm, null, auth.uid(), 'FIRM_EXPORT_MANIFEST', null,
    jsonb_build_object('tables', v_tables, 'originals', v_o_count, 'chain_ok', v_broken is null));

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

  select seq, hash into v_head from public.lalum_matter_audit_log where firm_id = p_firm order by seq desc limit 1;

  select coalesce(jsonb_agg(c.relname order by c.relname), '[]'::jsonb) into v_unclassified
    from pg_class c join pg_attribute a on a.attrelid = c.oid and a.attname = 'firm_id' and not a.attisdropped
   where c.relnamespace = 'public'::regnamespace and c.relkind = 'r' and c.relname like 'lalum\_%'
     and not (v_class -> 'included') ? c.relname and not (v_class -> 'excluded') ? c.relname;

  return jsonb_build_object(
    'firm_status', v_status, 'generated_at', now(), 'format', 'jsonl, one JSON object per line, rows ordered by their JSON text',
    'sections', v_sections, 'rows_total', v_rows,
    'excluded', v_class -> 'excluded', 'unclassified', v_unclassified, 'complete', jsonb_array_length(v_unclassified) = 0,
    'audit_chain', jsonb_build_object('first_broken_seq', v_broken, 'verified', v_broken is null, 'head_seq', v_head.seq, 'head_hash', v_head.hash),
    'originals', jsonb_build_object('count', v_o_count, 'bytes', v_o_bytes, 'without_sha256', v_o_nohash));
end $$;
