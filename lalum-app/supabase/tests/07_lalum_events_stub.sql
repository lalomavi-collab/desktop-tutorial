-- lalum_events as it exists live before migration 0027 (the table was created outside the migrations folder). Test use only.
create table if not exists public.lalum_events (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  kind text not null default 'meeting',
  location text,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  travel_minutes integer not null default 0,
  parent_event_id uuid references public.lalum_events(id) on delete cascade,
  reminders jsonb not null default '[]'::jsonb,
  notes text,
  created_by uuid,
  created_at timestamptz not null default now()
);
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin bypassrls; end if;
end $$;
grant usage on schema public to service_role;
grant all on public.lalum_events to service_role;
