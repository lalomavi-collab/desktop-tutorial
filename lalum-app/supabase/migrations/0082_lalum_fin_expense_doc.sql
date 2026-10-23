-- The source document behind an expense (the invoice or receipt it was entered from), stored once the
-- expense already exists, so the row and its proof travel together instead of living in two mailboxes
-- and a local folder. Decision of the owner, 23 October 2026.
--
-- Private bucket, no storage policies: with RLS on storage.objects and no policy, only the service role
-- (the lalum-fin-expense-doc edge function) can read or write it. The function checks the caller's own
-- finance level first (lalum_fin_can, migration 0024: level 3 to attach, same as the level that can write
-- an expense; level 1 to view, same as the level that can read one), using the caller's own JWT against
-- lalum_fin_expenses, before it touches storage with the service role. The object path is deterministic
-- (firm/expense/source.ext), so a replacement overwrites the same object rather than leaving the old one
-- behind; there is deliberately no history of earlier attachments, same as the expense row itself.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('finance-expense-docs', 'finance-expense-docs', false, 15728640,
        array['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/gif'])
on conflict (id) do nothing;

alter table public.lalum_fin_expenses
  add column if not exists source_doc_path text,
  add column if not exists source_doc_mime text,
  add column if not exists source_doc_size bigint,
  add column if not exists source_doc_sha256 text check (source_doc_sha256 is null or source_doc_sha256 ~ '^[0-9a-f]{64}$'),
  add column if not exists source_doc_stored_at timestamptz;
