-- Live only objects that migration 0014 and 0040 call, so they can run on plain Postgres. Test use only: never apply to a real project.
-- Run after 00_supabase_stubs, 01_live_only_stubs and 0018, and before 0014.
create table if not exists public.lalum_matter_team (matter_id uuid not null, user_id uuid not null, primary key (matter_id, user_id));
alter table public.lalum_matter_documents add column if not exists deleted_at timestamptz;
alter table public.lalum_matter_documents enable row level security;
drop policy if exists lalum_documents_read on public.lalum_matter_documents;
create policy lalum_documents_read on public.lalum_matter_documents for select using (true);
create table if not exists public.lalum_audit_stub (firm_id uuid, matter_id uuid, actor uuid, action text, detail jsonb);
create or replace function public.lalum_append_audit(p_firm uuid, p_matter uuid, p_actor uuid, p_action text, p_x text, p_detail jsonb) returns void
language sql as $$ insert into public.lalum_audit_stub values (p_firm, p_matter, p_actor, p_action, p_detail) $$;

-- For 0041: the service role, the vault object table and the original columns the filing functions write.
do $$ begin if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin; end if; end $$;
grant usage on schema public to service_role;
create schema if not exists storage;
create table if not exists storage.objects (bucket_id text, name text);
alter table public.lalum_matter_documents add column if not exists original_path text, add column if not exists original_sha256 text,
  add column if not exists original_size bigint, add column if not exists original_mime text, add column if not exists original_stored_at timestamptz,
  add column if not exists doc_type text;
