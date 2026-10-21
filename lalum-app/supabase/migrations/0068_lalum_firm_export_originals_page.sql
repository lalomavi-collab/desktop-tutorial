-- 0068: the originals of the firm export, one page at a time.
--
-- lalum_firm_export_originals (0066) returns every original of the firm in one answer, and the Edge Function refused more than 1000 (413).
-- A firm with more than that could not be handed over at all. This adds lalum_firm_export_originals_page(firm, after, limit): at most 500
-- originals per call, in document id order, with the id to continue from (next_after, null on the last page) and the total.
--   * the same gate as the rest of the export package (lalum_export_allowed: platform admin aal2, or a partner of that firm behind MFA
--     with financial permission), the same listing rule (originals of live matters only), the same fields;
--   * ONE audit row per page, FIRM_EXPORT_ORIGINALS with the number of originals in the page. Not one per file, and never skipped: a caller
--     that starts from a later cursor still leaves a row, so a page of storage paths cannot be read without a trace;
--   * keyset paging (after the last id), not offset, so a row added or removed during the export does not shift the pages.
-- The old function stays as it is, so the deployed Edge Function keeps working until the new one replaces it; remove it in a later migration.

create or replace function public.lalum_firm_export_originals_page(p_firm uuid, p_after uuid default null, p_limit integer default 500) returns jsonb
language plpgsql security definer set search_path to 'public' as $$
declare
  v_limit integer := least(greatest(coalesce(p_limit, 500), 1), 500);
  v_rows jsonb; v_n integer; v_total bigint; v_next uuid;
begin
  if not public.lalum_export_allowed(p_firm) then raise exception 'FORBIDDEN'; end if;
  if not exists (select 1 from public.lalum_firms where id = p_firm) then raise exception 'NOT_FOUND'; end if;

  select count(*) into v_total
    from public.lalum_matter_documents d join public.lalum_cockpit_matters m on m.id = d.matter_id
   where d.firm_id = p_firm and d.original_path is not null and m.purged_at is null;

  -- one more than the page, to know whether there is a next page
  with q as (
    select d.id, d.matter_id, d.original_path, d.original_sha256, d.original_size, d.original_mime, d.file_name
      from public.lalum_matter_documents d join public.lalum_cockpit_matters m on m.id = d.matter_id
     where d.firm_id = p_firm and d.original_path is not null and m.purged_at is null and (p_after is null or d.id > p_after)
     order by d.id limit v_limit + 1),
  numbered as (select q.*, row_number() over (order by q.id) rn from q)
  select count(*) filter (where rn <= v_limit),
         coalesce(jsonb_agg(jsonb_build_object('document', id, 'matter', matter_id, 'path', original_path, 'sha256', original_sha256,
                                               'size', original_size, 'mime', original_mime, 'file_name', file_name) order by id) filter (where rn <= v_limit), '[]'::jsonb),
         (select id from numbered where rn = v_limit and exists (select 1 from numbered where rn = v_limit + 1))
    into v_n, v_rows, v_next
    from numbered;

  perform public.lalum_append_audit(p_firm, null, auth.uid(), 'FIRM_EXPORT_ORIGINALS', null, jsonb_build_object('originals', v_n));
  return jsonb_build_object('originals', v_rows, 'next_after', v_next, 'total', v_total);
end $$;
revoke execute on function public.lalum_firm_export_originals_page(uuid, uuid, integer) from public, anon;
grant execute on function public.lalum_firm_export_originals_page(uuid, uuid, integer) to authenticated;
