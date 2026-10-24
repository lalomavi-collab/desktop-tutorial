-- Tests for migration 20261024170000 (lalum_outlook_apply). Order: 00_supabase_stubs, 07_lalum_events_stub, 0027_lalum_events_outlook_sync,
-- 20261024170000_lalum_outlook_sync, then this file:
--   psql -v ON_ERROR_STOP=1 -f outlook_sync_apply.sql
-- Every assertion raises on failure; fixtures roll back.
begin;
insert into public.lalum_events (id, title, kind, starts_at, ends_at, source, external_id, notes) values
  ('00000000-0000-0000-0000-000000000001', 'old id', 'block', now() + interval '1 day', now() + interval '1 day 1 hour', 'outlook', 'AAkALgAAAA1', 'kept note'),
  ('00000000-0000-0000-0000-000000000002', 'cancelled', 'block', now() + interval '2 days', now() + interval '2 days 1 hour', 'outlook', 'gone', null),
  ('00000000-0000-0000-0000-000000000003', 'yesterday', 'block', now() - interval '1 day', now() - interval '23 hours', 'outlook', 'past', null),
  ('00000000-0000-0000-0000-000000000004', 'manual', 'meeting', now() + interval '3 days', now() + interval '3 days 1 hour', null, null, null),
  ('00000000-0000-0000-0000-000000000005', 'same', 'block', now() + interval '4 days', now() + interval '4 days 1 hour', 'outlook', 'g5', 'note 5');
insert into public.lalum_events (id, title, starts_at, ends_at, parent_event_id) values
  ('00000000-0000-0000-0000-000000000006', 'travel', now() + interval '2 days', now() + interval '2 days', '00000000-0000-0000-0000-000000000002');

set local role service_role;

-- 1. Over the cap: the whole call fails and nothing changes.
do $$ begin
  perform public.lalum_outlook_apply('[]', '[]', array_fill(gen_random_uuid(), array[11]));
  raise exception 'cap not enforced';
exception when raise_exception then
  if sqlerrm not like '%cap is 10%' then raise; end if;
end $$;

-- 2. One normal run: adopt a new id, update a known row, insert a new one, delete the cancelled one, and try to delete rows the
--    function must refuse (a past row and a manual one).
do $$
declare r jsonb;
begin
  r := public.lalum_outlook_apply(
    jsonb_build_array(
      jsonb_build_object('external_id', 'g1', 'title', 'old id', 'kind', 'zoom', 'location', 'https://zoom.us/j/1',
                         'starts_at', now() + interval '1 day', 'ends_at', now() + interval '1 day 1 hour'),
      jsonb_build_object('external_id', 'g5', 'title', 'same, renamed', 'kind', 'meeting', 'location', 'office',
                         'starts_at', now() + interval '4 days', 'ends_at', now() + interval '4 days 2 hours'),
      jsonb_build_object('external_id', 'g7', 'title', 'new', 'kind', 'block', 'location', null,
                         'starts_at', now() + interval '5 days', 'ends_at', now() + interval '5 days 1 hour')),
    jsonb_build_array(jsonb_build_object('id', '00000000-0000-0000-0000-000000000001', 'external_id', 'g1')),
    array['00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000004']::uuid[]);
  if r <> '{"rekeyed": 1, "inserted": 1, "updated": 2, "deleted": 1}'::jsonb then raise exception 'counts %', r; end if;
end $$;

reset role;
do $$ begin
  -- The adopted row kept its uuid and note and took the new id and fields.
  perform 1 from public.lalum_events where id = '00000000-0000-0000-0000-000000000001'
    and external_id = 'g1' and kind = 'zoom' and notes = 'kept note';
  if not found then raise exception 'rekey'; end if;
  perform 1 from public.lalum_events where id = '00000000-0000-0000-0000-000000000005' and title = 'same, renamed' and notes = 'note 5';
  if not found then raise exception 'update kept notes'; end if;
  perform 1 from public.lalum_events where external_id = 'g7' and reminders = '[1440,120,30]'::jsonb and travel_minutes = 0;
  if not found then raise exception 'insert defaults'; end if;
  -- The cancelled meeting is gone with its travel block; the past and manual rows stay.
  if exists (select 1 from public.lalum_events where id in ('00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000006')) then
    raise exception 'delete';
  end if;
  if (select count(*) from public.lalum_events where id in ('00000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000004')) <> 2 then
    raise exception 'refused rows deleted';
  end if;
end $$;

-- 3. Only the service role may call it.
do $$ begin
  if has_function_privilege('authenticated', 'public.lalum_outlook_apply(jsonb, jsonb, uuid[], uuid)', 'execute')
     or has_function_privilege('anon', 'public.lalum_outlook_apply(jsonb, jsonb, uuid[], uuid)', 'execute') then
    raise exception 'grant';
  end if;
  if has_table_privilege('authenticated', 'public.lalum_outlook_sync_runs', 'select') then raise exception 'runs grant'; end if;
end $$;
rollback;
select 'outlook_sync_apply: ok';
