-- Stubs for migrations 20261023101711 (bank tables and reconciliation) and 20261028143000 (the bank feed) on plain Postgres 16: the
-- finance tables they reference, only the columns they read, a finance level driven by a setting, and the service role. Run after
-- 00_supabase_stubs. Test use only: never apply to a real project.
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin bypassrls; end if;
end $$;
grant usage on schema public to service_role;
create schema if not exists supabase_migrations;
create table if not exists supabase_migrations.schema_migrations (version text primary key, name text);

create table if not exists public.lalum_firms (id uuid primary key default gen_random_uuid(), firm_name text);
create table if not exists public.lalum_fin_import_runs (id uuid primary key default gen_random_uuid(), kind text, error text,
  created_at timestamptz not null default now());
create table if not exists public.lalum_fin_archive (id uuid primary key default gen_random_uuid(), firm_id uuid, issue_date date,
  i4u_doc_type int, doc_number int, raw jsonb, subject text, subtotal numeric, vat_amount numeric, total numeric, status_id int);
create table if not exists public.lalum_fin_expenses (id uuid primary key default gen_random_uuid(), firm_id uuid, spent_on date,
  supplier text, category text, total numeric, vat_amount numeric, vat_recoverable_pct numeric, income_tax_recognition_pct numeric,
  supplier_doc_ref text);

-- test.fin_level is the signed in user's finance level in every firm (0 when unset).
create or replace function public.lalum_fin_can(p_firm uuid, p_min integer) returns boolean language sql stable as
  $$ select coalesce(nullif(current_setting('test.fin_level', true), ''), '0')::int >= p_min $$;
grant execute on function public.lalum_fin_can(uuid, integer) to authenticated, service_role;
