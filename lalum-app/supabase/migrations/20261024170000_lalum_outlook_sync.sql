-- Server-side Outlook sync (T73, plan step 8.1.ב). The edge function lalum-outlook-sync plans the changes and applies them through
-- lalum_outlook_apply in one transaction. The function enforces the delete rules again on its own, so a planner bug cannot widen
-- them: only future Outlook rows, at most 10 per run. Manual events (source null) are never touched. The cron job is in
-- 20261024170100, applied only after the function is deployed and a manual ?dry=1 run looks right.
-- Named by timestamp, not by number: 0077, 0079 and 0081 each exist twice on main.

create table if not exists public.lalum_outlook_sync_runs (
  id     bigint generated always as identity primary key,
  ran_at timestamptz not null default now(),
  status text not null,
  detail jsonb not null default '{}'::jsonb
);
-- Counts only, written by the function with the service role. No policy: read through SQL, not from the app.
alter table public.lalum_outlook_sync_runs enable row level security;
revoke all on public.lalum_outlook_sync_runs from anon, authenticated;

create or replace function public.lalum_outlook_apply(p_rows jsonb, p_rekeys jsonb, p_delete_ids uuid[], p_owner uuid default null)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_rekeyed  int := 0;
  v_inserted int := 0;
  v_updated  int := 0;
  v_deleted  int := 0;
begin
  if coalesce(cardinality(p_delete_ids), 0) > 10 then
    raise exception 'lalum_outlook_apply: % deletions requested, the cap is 10', cardinality(p_delete_ids);
  end if;

  -- The same meeting under a new Outlook id keeps its uuid, notes and links; only external_id moves.
  update public.lalum_events e
     set external_id = k.external_id
    from jsonb_to_recordset(coalesce(p_rekeys, '[]'::jsonb)) as k(id uuid, external_id text)
   where e.id = k.id
     and e.source = 'outlook'
     and not exists (select 1 from public.lalum_events x where x.source = 'outlook' and x.external_id = k.external_id);
  get diagnostics v_rekeyed = row_count;

  -- notes are left alone: the old routine wrote summaries there and the owner may edit them in the cockpit.
  with up as (
    insert into public.lalum_events (title, kind, location, starts_at, ends_at, source, external_id, created_by, travel_minutes, reminders)
    select r.title, r.kind, r.location, r.starts_at, r.ends_at, 'outlook', r.external_id, p_owner, 0, '[1440,120,30]'::jsonb
      from jsonb_to_recordset(coalesce(p_rows, '[]'::jsonb))
        as r(external_id text, title text, kind text, location text, starts_at timestamptz, ends_at timestamptz)
    on conflict (source, external_id) where source is not null and external_id is not null
    do update set title = excluded.title, kind = excluded.kind, location = excluded.location,
                  starts_at = excluded.starts_at, ends_at = excluded.ends_at
    returning (xmax = 0) as inserted
  )
  select count(*) filter (where inserted), count(*) filter (where not inserted) into v_inserted, v_updated from up;

  -- A deleted meeting takes its travel blocks with it (parent_event_id cascades); a task scheduled on it keeps the task.
  delete from public.lalum_events
   where id = any(coalesce(p_delete_ids, '{}'::uuid[]))
     and source = 'outlook'
     and starts_at > now();
  get diagnostics v_deleted = row_count;

  return jsonb_build_object('rekeyed', v_rekeyed, 'inserted', v_inserted, 'updated', v_updated, 'deleted', v_deleted);
end $$;

revoke all on function public.lalum_outlook_apply(jsonb, jsonb, uuid[], uuid) from public, anon, authenticated;
grant execute on function public.lalum_outlook_apply(jsonb, jsonb, uuid[], uuid) to service_role;
