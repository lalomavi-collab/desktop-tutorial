-- Outlook calendar sync: lets a synced event be matched and updated on the next pull instead of
-- duplicated, without touching anything about a manually created event (source and external_id stay
-- null for those, same as before this migration). RLS and grants on lalum_events are unchanged: the
-- existing lalum_events_admin_all policy (lalum_is_admin()) already covers the owner, who is the only
-- Outlook account this syncs today.

alter table public.lalum_events
  add column if not exists source      text,
  add column if not exists external_id text;

alter table public.lalum_events drop constraint if exists lalum_events_source_check;
alter table public.lalum_events
  add constraint lalum_events_source_check check (source is null or source in ('outlook'));

create unique index if not exists lalum_events_source_external_id_key
  on public.lalum_events (source, external_id) where source is not null and external_id is not null;
