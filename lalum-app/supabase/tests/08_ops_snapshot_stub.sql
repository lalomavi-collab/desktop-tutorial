-- Stubs for migration 20261028123000 (lalum_ops_snapshots) on plain Postgres 16: the pg_cron and pg_net catalogs, auth.mfa_factors,
-- the migration log, and the shape of every live table the snapshot counts (only the columns it reads). Run after 00_supabase_stubs.
-- Test use only: never apply to a real project.
create schema if not exists cron;
create table if not exists cron.job (jobid bigserial primary key, jobname text unique, schedule text, command text, active boolean not null default true);
create table if not exists cron.job_run_details (runid bigserial primary key, jobid bigint, status text, start_time timestamptz);
create or replace function cron.schedule(p_name text, p_schedule text, p_command text) returns bigint language sql as $$
  insert into cron.job (jobname, schedule, command) values (p_name, p_schedule, p_command)
  on conflict (jobname) do update set schedule = excluded.schedule, command = excluded.command returning jobid
$$;
create schema if not exists net;
create table if not exists net._http_response (id bigserial primary key, status_code int, timed_out boolean, created timestamptz not null default now());
create table if not exists auth.mfa_factors (id uuid primary key default gen_random_uuid(), user_id uuid, factor_type text, status text);
create schema if not exists supabase_migrations;
create table if not exists supabase_migrations.schema_migrations (version text primary key, name text);
create schema if not exists lalum_private;

create table if not exists public.lalum_firms (id uuid primary key default gen_random_uuid(), firm_name text);
create table if not exists public.lalum_firm_members (firm_id uuid, user_id uuid, role text);
create table if not exists public.lalum_cockpit_matters (id uuid primary key default gen_random_uuid(), firm_id uuid, title text, status text,
  conflict_status text, risk_summary jsonb, matter_code text, deleted_at timestamptz);
create table if not exists public.lalum_intake_routings (matter_id uuid);
alter table public.lalum_intake_routings add column if not exists practice_area text, add column if not exists partner_response text,
  add column if not exists dispatched_at timestamptz, add column if not exists first_viewed_at timestamptz;
create table if not exists public.lalum_deadlines (id uuid primary key default gen_random_uuid(), due_date date, status text);
create table if not exists public.lalum_matter_fees (id uuid primary key default gen_random_uuid());
create table if not exists public.lalum_time_entries (id uuid primary key default gen_random_uuid());
create table if not exists public.lalum_matter_inquiries (id uuid primary key default gen_random_uuid());
create table if not exists public.lalum_outlook_sync_runs (id bigserial primary key, ran_at timestamptz not null default now(), status text, detail jsonb);
create table if not exists public.lalum_campaign_sync_runs (id bigserial primary key, ran_at timestamptz not null default now(), source text, status text);
create table if not exists public.lalum_campaign_metrics_daily (day date, source text, scope text, key text default '', metric text, value numeric);
create table if not exists public.lalum_fin_import_runs (id uuid primary key default gen_random_uuid(), kind text, error text, created_at timestamptz not null default now());
create table if not exists public.lalum_fin_expenses (id uuid primary key default gen_random_uuid());
create table if not exists public.lalum_fin_archive (id uuid primary key default gen_random_uuid(), issue_date date, i4u_doc_type int, status_id int,
  total numeric);
create table if not exists public.lalum_fin_bank_lines (id uuid primary key default gen_random_uuid(), value_date date, balance_after numeric,
  created_at timestamptz not null default now());

-- The two gates the read policy uses, driven by settings so a test can be the admin with or without a second factor.
create or replace function public.lalum_is_admin() returns boolean language sql stable as
  $$ select coalesce(current_setting('test.is_admin', true), 'false')::boolean $$;
create or replace function public.lalum_mfa_ok() returns boolean language sql stable as
  $$ select coalesce(current_setting('test.mfa_ok', true), 'false')::boolean $$;
