-- CoPartner AI: confidential domain-leadership applications.
-- Run against the app's own Supabase project (see .env.example); not shared
-- with lalum-app or ldr/web.

create table if not exists public.copartner_applications (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  full_name text not null,
  professional_title text not null,
  primary_domain text not null,
  years_of_practice text not null,
  academic_background text,
  current_practice text,
  client_profile text,
  email text not null,
  phone text,
  website text,
  transform_note text
);

alter table public.copartner_applications enable row level security;

-- Public (anon) can submit an application, but never read one back: this is
-- a confidential intake funnel, not a public directory. Reviewing
-- applications happens from the Supabase dashboard / service role, not the
-- browser.
create policy "anon can submit applications"
  on public.copartner_applications
  for insert
  to anon
  with check (true);
