-- Private bucket for the backup of the history archive PDFs (Invoice4U closes access on 5 March 2027).
-- No storage policies on purpose: with RLS on storage.objects and no policy, only the service role (the backup function) can read or write it.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('finance-archive-backup', 'finance-archive-backup', false, 20971520, array['application/pdf'])
on conflict (id) do nothing;
