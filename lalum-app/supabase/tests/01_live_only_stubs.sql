-- Tables that exist only in the live project and that 0018 references. Test use only.
create table if not exists public.lalum_matter_documents (
  id uuid primary key default gen_random_uuid(),
  matter_id uuid not null, firm_id uuid not null, file_name text not null
);
