/* Opening the original of a document (direction C of docs/vault-and-folder-link-plan.md).
   The vault bucket holds the files exactly as they were uploaded, with the real names inside them. Opening one is the
   most revealing act in the product, so it is allowed only to those who may see client names (partner or attorney, fresh MFA),
   only for a live document of a matter they may view, and every open is written to the hash chained audit log.
   - lalum_open_original(doc): checks all of that, appends DOCUMENT_ORIGINAL_OPENED (matter id and a hash of the stored
     file, never the file name or any content) and returns what the edge function needs to sign a download: the storage
     path, the mime type, the size and the matter code. The edge function (lalum-open-original) then signs a 60 second link
     with the service role. Closing the direct read path to the bucket is a separate step that must be tested on a Supabase branch first (storage deletes may rely on the read policy); until then audit coverage is complete only for opens made through the application.
   Not applied to production until approved. */

create or replace function public.lalum_open_original(p_doc uuid) returns table (path text, mime text, size bigint, matter_code text)
language plpgsql security definer set search_path to 'public' as $$
declare v_firm uuid; v_matter uuid; v_path text; v_mime text; v_size bigint; v_hash text; v_code text;
begin
  select d.firm_id, d.matter_id, d.original_path, d.original_mime, d.original_size, d.original_sha256, m.matter_code
    into v_firm, v_matter, v_path, v_mime, v_size, v_hash, v_code
    from public.lalum_matter_documents d join public.lalum_cockpit_matters m on m.id = d.matter_id
   where d.id = p_doc and d.deleted_at is null and m.deleted_at is null;
  if v_firm is null
     or not coalesce(public.lalum_can_see_client_names(), false)
     or v_firm is distinct from public.lalum_my_firm_id()
     or not coalesce(public.lalum_can_view_matter(v_matter), false)
     or v_path is null then
    raise exception 'not allowed';
  end if;
  perform public.lalum_append_audit(v_firm, v_matter, auth.uid(), 'DOCUMENT_ORIGINAL_OPENED', coalesce(v_hash, ''), '{}'::jsonb);
  return query select v_path, v_mime, v_size, v_code;
end $$;
revoke execute on function public.lalum_open_original(uuid) from public, anon;
grant execute on function public.lalum_open_original(uuid) to authenticated;
