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
