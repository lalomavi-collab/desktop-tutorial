-- 0001_lalum_portal.sql
-- LALUM app: self-contained backend for the client portal. This schema belongs
-- to the LALUM application only and does NOT depend on, or reference, any other
-- app (no ldr_profiles, no shared bar_registry). All objects are lalum_*.

-- ── Per-user profile (owns the verified flag) ─────────────────────────────────
create table if not exists public.lalum_profiles (
  id                  uuid primary key references auth.users(id) on delete cascade,
  full_name           text,
  verification_status text not null default 'unverified'
                        check (verification_status in ('unverified','pending','verified')),
  is_admin            boolean not null default false,
  created_at          timestamptz not null default now()
);

alter table public.lalum_profiles enable row level security;

drop policy if exists lalum_profiles_self_read on public.lalum_profiles;
create policy lalum_profiles_self_read on public.lalum_profiles
  for select using (id = auth.uid());

-- Users may create/update their own profile, but NOT grant themselves 'verified'
-- (only the lalum-attorney-verify Edge Function, running as service role, may).
drop policy if exists lalum_profiles_self_upsert on public.lalum_profiles;
create policy lalum_profiles_self_upsert on public.lalum_profiles
  for insert with check (id = auth.uid() and verification_status <> 'verified');

drop policy if exists lalum_profiles_self_update on public.lalum_profiles;
create policy lalum_profiles_self_update on public.lalum_profiles
  for update using (id = auth.uid())
  with check (id = auth.uid() and verification_status <> 'verified');

-- ── LALUM's own bar-registry snapshot ─────────────────────────────────────────
create table if not exists public.lalum_bar_registry (
  id              uuid primary key default gen_random_uuid(),
  jurisdiction    text not null default 'IL',
  license_no      text not null,
  full_name       text not null,
  name_normalized text not null,
  status          text not null default 'active'
                    check (status in ('active','suspended','inactive')),
  source_version  text not null default 'seed',
  ingested_at     timestamptz not null default now(),
  unique (jurisdiction, license_no)
);

create index if not exists lalum_bar_registry_juris_license_idx
  on public.lalum_bar_registry (jurisdiction, license_no);

-- Not readable by normal clients (prevents enumeration); only the service-role
-- Edge Function and LALUM admins read it.
alter table public.lalum_bar_registry enable row level security;

drop policy if exists lalum_bar_registry_admin_read on public.lalum_bar_registry;
create policy lalum_bar_registry_admin_read on public.lalum_bar_registry
  for select using (
    exists (select 1 from public.lalum_profiles p where p.id = auth.uid() and p.is_admin = true)
  );

-- ── Verification requests (audit of every submission) ─────────────────────────
create table if not exists public.lalum_verification_requests (
  id                   uuid primary key default gen_random_uuid(),
  user_id              uuid not null references auth.users(id) on delete cascade,
  submitted_name       text not null,
  submitted_license_no text not null,
  jurisdiction         text not null default 'IL',
  match_result         text not null
                         check (match_result in (
                           'auto_matched','name_mismatch','not_found','suspended','pending')),
  matched_registry_id  uuid references public.lalum_bar_registry(id),
  created_at           timestamptz not null default now()
);

create index if not exists lalum_verification_requests_user_idx
  on public.lalum_verification_requests (user_id, created_at desc);

alter table public.lalum_verification_requests enable row level security;

drop policy if exists lalum_verification_requests_owner_read on public.lalum_verification_requests;
create policy lalum_verification_requests_owner_read on public.lalum_verification_requests
  for select using (user_id = auth.uid());
-- Inserts happen only via the service-role Edge Function (no client insert policy).

-- ── Consultation (diagnostics) booking requests ───────────────────────────────
create table if not exists public.lalum_consultation_requests (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null default auth.uid() references auth.users(id) on delete cascade,
  requested_day  date not null,
  requested_slot text not null,
  topic          text,
  status         text not null default 'requested'
                   check (status in ('requested','confirmed','declined','completed')),
  created_at     timestamptz not null default now()
);

create index if not exists lalum_consultation_requests_user_idx
  on public.lalum_consultation_requests (user_id, created_at desc);

alter table public.lalum_consultation_requests enable row level security;

drop policy if exists lalum_consultation_owner_read on public.lalum_consultation_requests;
create policy lalum_consultation_owner_read on public.lalum_consultation_requests
  for select using (user_id = auth.uid());

drop policy if exists lalum_consultation_owner_insert on public.lalum_consultation_requests;
create policy lalum_consultation_owner_insert on public.lalum_consultation_requests
  for insert with check (user_id = auth.uid());
