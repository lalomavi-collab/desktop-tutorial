-- Baseline for the firm core that existed only in the live Supabase project.
-- The tables and role helpers below were created outside the repo, yet migrations 0007 onward
-- reference them. This file records their live definition so the repo can describe the schema.
-- Everything is idempotent: applying it to the live project changes nothing.
--
-- Known limit: other tables used by the app (lalum_tasks, lalum_events, lalum_invoices,
-- lalum_matter_documents and more) are also live only. A from-scratch replay of the repo is
-- not possible until each is captured the same way. Tracked in docs/billing-model.md.

create table if not exists public.lalum_firms (
  id                   uuid primary key default gen_random_uuid(),
  firm_name            text not null,
  registration_no      text not null,
  primary_contact      text not null,
  email                text not null unique,
  phone                text not null,
  subscription_tier    text not null default 'PROFESSIONAL' check (subscription_tier in ('STARTER','PROFESSIONAL','ENTERPRISE')),
  monthly_fee          numeric not null check (monthly_fee >= 0),
  seat_limit           integer not null default 5 check (seat_limit > 0),
  status               text not null default 'ACTIVE' check (status in ('ACTIVE','SUSPENDED','CANCELED')),
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  require_mfa          boolean not null default false,
  response_sla_minutes integer not null default 240 check (response_sla_minutes between 15 and 10080),
  inquiry_alias        text unique default substr(encode(gen_random_bytes(8), 'hex'), 1, 10)
);

create table if not exists public.lalum_firm_members (
  id         uuid primary key default gen_random_uuid(),
  firm_id    uuid not null references public.lalum_firms(id) on delete cascade,
  user_id    uuid not null unique references auth.users(id) on delete cascade,
  name       text not null,
  email      text not null,
  role       text not null default 'ATTORNEY' check (role in ('FIRM_PARTNER','ATTORNEY','COMPLIANCE_OFFICER','ADMIN')),
  created_at timestamptz not null default now(),
  phone      text check (phone is null or phone ~ '^[0-9]{9,15}$')
);

create table if not exists public.lalum_cockpit_matters (
  id                  uuid primary key default gen_random_uuid(),
  firm_id             uuid not null references public.lalum_firms(id) on delete cascade,
  title               text not null,
  practice_area       text not null default 'COMMERCIAL_MA' check (practice_area in ('REAL_ESTATE','COMMERCIAL_MA','LABOR_LAW','AI_GOVERNANCE','LITIGATION')),
  status              text not null default 'ACTIVE_REVIEW' check (status in ('INTAKE_PENDING','ACTIVE_REVIEW','APPROVED_BY_PARTNER','ARCHIVED')),
  conflict_status     text not null default 'CLEAN' check (conflict_status in ('CLEAN','POTENTIAL','DIRECT_CONFLICT')),
  source              text not null default 'UPLOAD' check (source in ('UPLOAD','INTAKE_WEBHOOK','CHAT')),
  risk_summary        jsonb not null default '{}'::jsonb,
  created_by          uuid references auth.users(id) on delete set null,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  retention_basis     text not null default 'STATUTORY' check (retention_basis in ('STATUTORY','CLIENT_CONSENT_30D')),
  client_consent_at   date,
  handling_ended_at   date,
  legal_hold          boolean not null default false,
  legal_hold_reason   text,
  legal_hold_at       timestamptz,
  legal_hold_by       uuid references auth.users(id) on delete set null,
  deleted_at          timestamptz,
  deleted_by          uuid,
  deleted_reason      text,
  purge_requested_at  timestamptz,
  purged_at           timestamptz
);

create or replace function public.lalum_my_firm_id() returns uuid
language sql stable security definer set search_path to 'public' as $$
  select firm_id from public.lalum_firm_members where user_id = auth.uid() limit 1 $$;

create or replace function public.lalum_my_role() returns text
language sql stable security definer set search_path to 'public' as $$
  select role from public.lalum_firm_members where user_id = auth.uid() limit 1 $$;

create or replace function public.lalum_mfa_ok() returns boolean
language sql stable security definer set search_path to 'public' as $$
  select coalesce(not (select f.require_mfa from public.lalum_firms f where f.id = public.lalum_my_firm_id()), true)
      or coalesce(auth.jwt() ->> 'aal', '') = 'aal2' $$;

create or replace function public.lalum_is_admin() returns boolean
language sql stable security definer set search_path to 'public', 'auth' as $$
  select exists (select 1 from public.lalum_profiles p where p.id = auth.uid() and p.is_admin)
      or exists (select 1 from auth.users u where u.id = auth.uid() and lower(u.email) = 'avraham@lalum.co') $$;

create or replace function public.lalum_touch_updated_at() returns trigger
language plpgsql set search_path to '' as $$
begin new.updated_at := now(); return new; end $$;

alter table public.lalum_firms enable row level security;
alter table public.lalum_firm_members enable row level security;
alter table public.lalum_cockpit_matters enable row level security;

drop policy if exists lalum_firms_read on public.lalum_firms;
create policy lalum_firms_read on public.lalum_firms for select
  using ((id = public.lalum_my_firm_id()) or public.lalum_is_admin());
drop policy if exists lalum_members_read on public.lalum_firm_members;
create policy lalum_members_read on public.lalum_firm_members for select
  using ((firm_id = public.lalum_my_firm_id()) or public.lalum_is_admin());
drop policy if exists lalum_matters_read on public.lalum_cockpit_matters;
create policy lalum_matters_read on public.lalum_cockpit_matters for select
  using ((deleted_at is null) and ((firm_id = public.lalum_my_firm_id()) or public.lalum_is_admin()));
