-- 0003_consultation_requests.sql
-- Client-area booking: a signed-in user requests a Tech-Legal Diagnostics slot.
-- Backs the "Book a diagnostics session" panel in the LALUM client portal
-- (lalum-app). Each row is owned by the user who created it, enforced by RLS.

create table if not exists public.consultation_requests (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null default auth.uid() references auth.users(id) on delete cascade,
  requested_day  date not null,
  requested_slot text not null,
  topic          text,
  status         text not null default 'requested'
                   check (status in ('requested','confirmed','declined','completed')),
  created_at     timestamptz not null default now()
);

create index if not exists consultation_requests_user_idx
  on public.consultation_requests (user_id, created_at desc);

-- ── RLS ───────────────────────────────────────────────────────────────────────
alter table public.consultation_requests enable row level security;

-- A user can read their own requests.
drop policy if exists consultation_requests_owner_read on public.consultation_requests;
create policy consultation_requests_owner_read on public.consultation_requests
  for select using (user_id = auth.uid());

-- A user can create a request only for themselves.
drop policy if exists consultation_requests_owner_insert on public.consultation_requests;
create policy consultation_requests_owner_insert on public.consultation_requests
  for insert with check (user_id = auth.uid());
