-- 0004_lalum_group_chat.sql
-- LALUM app: a single shared, open chat room inside the client portal. Every
-- signed-in user (client or firm) can read the whole room and post their own
-- message; nobody can edit or delete a message that is not their own.

create table if not exists public.lalum_group_chat_messages (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  author_name text not null,
  body        text not null check (char_length(body) between 1 and 2000),
  created_at  timestamptz not null default now()
);

create index if not exists lalum_group_chat_messages_created_idx
  on public.lalum_group_chat_messages (created_at);

alter table public.lalum_group_chat_messages enable row level security;

-- Every signed-in user reads the whole room (it is a shared, open chat, not a
-- per-client thread like lalum_client_messages).
drop policy if exists lalum_group_chat_read on public.lalum_group_chat_messages;
create policy lalum_group_chat_read on public.lalum_group_chat_messages
  for select using (auth.uid() is not null);

-- Everyone can post, only ever as themselves.
drop policy if exists lalum_group_chat_insert on public.lalum_group_chat_messages;
create policy lalum_group_chat_insert on public.lalum_group_chat_messages
  for insert with check (user_id = auth.uid());

-- No update/delete policy: messages are permanent once posted, matching the
-- rest of the portal's audit-friendly, append-only tables.
