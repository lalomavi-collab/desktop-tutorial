-- 0001_bar_registry.sql
-- Bar-registry verification: source-of-truth table + verification requests.
-- See docs/11-verification-bar-registry.md.
--
-- The "verified" badge is granted ONLY by the verify-attorney Edge Function
-- (service role). Clients can, at most, move themselves to 'pending' — enforced
-- by RLS on ldr_profiles (defined alongside the profiles table).

-- ── Official registry snapshot (ingested in batches) ───────────────────────────
create table if not exists public.bar_registry (
  id              uuid primary key default gen_random_uuid(),
  jurisdiction    text not null default 'IL',
  license_no      text not null,
  full_name       text not null,
  name_normalized text not null,
  status          text not null default 'active'
                    check (status in ('active','suspended','inactive')),
  license_year    int,
  source_version  text not null,
  ingested_at     timestamptz not null default now(),
  unique (jurisdiction, license_no)
);

create index if not exists bar_registry_juris_license_idx
  on public.bar_registry (jurisdiction, license_no);
create index if not exists bar_registry_juris_name_idx
  on public.bar_registry (jurisdiction, name_normalized);

-- ── Verification requests (full audit of every submission) ────────────────────
create table if not exists public.verification_requests (
  id                   uuid primary key default gen_random_uuid(),
  user_id              uuid not null references auth.users(id) on delete cascade,
  submitted_name       text not null,
  submitted_license_no text not null,
  jurisdiction         text not null default 'IL',
  match_result         text not null
                         check (match_result in (
                           'auto_matched','name_mismatch','not_found',
                           'suspended','manual_approved','manual_rejected')),
  matched_registry_id  uuid references public.bar_registry(id),
  reviewer_id          uuid references auth.users(id),
  reason               text,
  created_at           timestamptz not null default now()
);

create index if not exists verification_requests_user_idx
  on public.verification_requests (user_id, created_at desc);

-- ── RLS ───────────────────────────────────────────────────────────────────────
alter table public.bar_registry enable row level security;
alter table public.verification_requests enable row level security;

-- bar_registry: not readable by normal clients (prevents name/number
-- enumeration). Only the service role (Edge Function) and platform admins read.
drop policy if exists bar_registry_admin_read on public.bar_registry;
create policy bar_registry_admin_read on public.bar_registry
  for select using (
    exists (
      select 1 from public.ldr_profiles p
      where p.id = auth.uid() and p.is_admin = true
    )
  );
-- (No client INSERT/UPDATE/DELETE policies → only service role can write.)

-- verification_requests: a user may read their own; admins read all.
drop policy if exists vr_self_read on public.verification_requests;
create policy vr_self_read on public.verification_requests
  for select using (
    user_id = auth.uid()
    or exists (
      select 1 from public.ldr_profiles p
      where p.id = auth.uid() and p.is_admin = true
    )
  );
-- Writes happen via the Edge Function (service role) and admin review only.
