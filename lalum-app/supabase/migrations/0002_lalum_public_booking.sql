-- 0002_lalum_public_booking.sql
-- Public booking requests (no login required). Written only by the lalum-book
-- Edge Function (service role); readable by LALUM admins. This powers the
-- public /book page so anyone can request a consultation without an account.

create table if not exists public.lalum_booking_requests (
  id             uuid primary key default gen_random_uuid(),
  full_name      text,
  email          text not null,
  requested_day  date not null,
  requested_slot text not null,
  topic          text,
  status         text not null default 'requested'
                   check (status in ('requested','confirmed','declined','completed')),
  created_at     timestamptz not null default now()
);

create index if not exists lalum_booking_requests_created_idx
  on public.lalum_booking_requests (created_at desc);

alter table public.lalum_booking_requests enable row level security;

drop policy if exists lalum_booking_admin_read on public.lalum_booking_requests;
create policy lalum_booking_admin_read on public.lalum_booking_requests
  for select using (
    exists (select 1 from public.lalum_profiles p where p.id = auth.uid() and p.is_admin = true)
  );
-- No public insert policy: inserts happen only via the service-role function.
