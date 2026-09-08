-- 0007_discussion_rooms.sql
-- "Discussions" (דיונים): an open, topic-scoped group chat for every signed-in
-- LAWDin user (attorneys and clients alike). Rooms are not a separate table:
-- the `room` column holds a practice-area key from the existing PRACTICE_AREAS
-- taxonomy in ldr/web/src/lib/supabase.ts (plus 'general'), so this feature
-- reuses the one topic list the app already has instead of growing a second.
-- See docs/02-feature-map.md, section B ("Professional discussions").

create table if not exists public.ldr_discussion_messages (
  id         uuid primary key default gen_random_uuid(),
  room       text not null check (char_length(room) between 1 and 60),
  author_id  uuid not null references public.ldr_profiles(id) on delete cascade,
  body       text not null check (char_length(btrim(body)) between 1 and 2000),
  created_at timestamptz not null default now()
);

create index if not exists ldr_discussion_messages_room_idx
  on public.ldr_discussion_messages (room, created_at desc);

alter table public.ldr_discussion_messages enable row level security;

-- Any signed-in user (attorney or client) may read every room: this is the
-- open/group chat the product calls for, not a private DM.
drop policy if exists discussion_messages_read on public.ldr_discussion_messages;
create policy discussion_messages_read on public.ldr_discussion_messages
  for select to authenticated using (true);

-- A user may only ever post as themselves.
drop policy if exists discussion_messages_insert on public.ldr_discussion_messages;
create policy discussion_messages_insert on public.ldr_discussion_messages
  for insert to authenticated with check (auth.uid() = author_id);

-- Light moderation: the author can retract their own message, and admins can
-- remove anyone's (matches the ldr_profiles.is_admin check used elsewhere).
drop policy if exists discussion_messages_delete on public.ldr_discussion_messages;
create policy discussion_messages_delete on public.ldr_discussion_messages
  for delete to authenticated using (
    auth.uid() = author_id
    or exists (
      select 1 from public.ldr_profiles p
      where p.id = auth.uid() and p.is_admin = true
    )
  );

-- Live delivery: add the table to the realtime publication (idempotent —
-- Supabase provisions `supabase_realtime` on every project by default).
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'ldr_discussion_messages'
  ) then
    alter publication supabase_realtime add table public.ldr_discussion_messages;
  end if;
end $$;
