-- 0005_lalum_discussions.sql
-- "Discussions" (דיונים): a moderated public Q&A, scoped to the two areas the
-- practice leads with (see lib/topics.ts). A visitor asks a question under one
-- of the two topics; nothing is public until Dr. Lalum reviews it and replies.
-- There is no open posting and no third topic: this is not a forum.
--
-- Visibility model:
--   - Anyone (including anonymous visitors) may read a row once it is answered.
--   - Nobody but a LALUM admin may read a pending or rejected row: a question
--     that has not been approved and answered must not be visible to anyone
--     but the firm, matching the requirement that nothing goes up unreviewed.
--   - Submission does not happen through this table's RLS at all: it goes
--     through the lalum-discussion-submit Edge Function (service role), the
--     same pattern as lalum_booking_requests, so an anonymous client never
--     gets a direct INSERT grant.

create table if not exists public.lalum_discussions (
  id           uuid primary key default gen_random_uuid(),
  -- The two lead topics only (lib/topics.ts TOPICS[].slug where lead = true).
  -- Hardcoded here, not just in the client, so the two-focus-areas rule holds
  -- even if a future caller bypasses the app's own topic list.
  topic        text not null check (topic in ('real-estate', 'ai-governance')),
  question     text not null check (char_length(btrim(question)) between 1 and 1500),
  asker_name   text,
  asker_email  text,
  status       text not null default 'pending'
                 check (status in ('pending', 'answered', 'rejected')),
  reply        text,
  answered_at  timestamptz,
  created_at   timestamptz not null default now()
);

create index if not exists lalum_discussions_topic_status_idx
  on public.lalum_discussions (topic, status, created_at desc);

alter table public.lalum_discussions enable row level security;

-- Public read: answered rows only. Admins additionally see everything, so the
-- review queue (pending) is reachable from the LALUM portal.
drop policy if exists lalum_discussions_public_read on public.lalum_discussions;
create policy lalum_discussions_public_read on public.lalum_discussions
  for select using (
    status = 'answered'
    or exists (select 1 from public.lalum_profiles p where p.id = auth.uid() and p.is_admin = true)
  );
-- No insert policy: only the service-role Edge Function inserts.

-- Only a LALUM admin may answer (or reject) a question.
drop policy if exists lalum_discussions_admin_update on public.lalum_discussions;
create policy lalum_discussions_admin_update on public.lalum_discussions
  for update to authenticated using (
    exists (select 1 from public.lalum_profiles p where p.id = auth.uid() and p.is_admin = true)
  ) with check (
    exists (select 1 from public.lalum_profiles p where p.id = auth.uid() and p.is_admin = true)
  );
