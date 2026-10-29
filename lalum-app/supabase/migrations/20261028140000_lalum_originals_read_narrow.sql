-- Wednesday plan, step 4.1 (T48, 28.10.2026): a signed in user may no longer read an original straight from storage.
-- Until now lalum_originals_read let a partner, an attorney or an admin of the firm sign a link to any original in
-- the firm's folder, which skips lalum_open_original and leaves no line in the audit log. Every real read already
-- goes through lalum-open-original or lalum-export-originals, and both sign with the service role, which RLS
-- does not touch. The app itself only uploads and removes.
--
-- The policy is narrowed, not dropped: storage remove() needs SELECT on the rows it deletes, and upload reads back
-- the row it inserted. What stays readable is the current condition AND the delete condition, so nothing becomes
-- readable that was not readable before, and the set of rows a user can delete does not change:
--   an original the firm's partner asked to purge (lalum_original_purge_allowed), or
--   an upload of this user's own that no document points to (a failed upload, removed by storeOriginal).
-- On 28.10 all 250 objects in the bucket were referenced by a document, so after this none is readable directly.
drop policy if exists lalum_originals_read on storage.objects;
create policy lalum_originals_read on storage.objects for select to authenticated using (
  bucket_id = 'matter-originals'
  and (storage.foldername(name))[1] = (select public.lalum_my_firm_id())::text
  and (select public.lalum_mfa_ok())
  and (select public.lalum_my_role()) = any (array['FIRM_PARTNER', 'ATTORNEY', 'ADMIN'])
  and (public.lalum_original_purge_allowed(name)
       or (owner = (select auth.uid()) and not public.lalum_original_referenced(name)))
);
