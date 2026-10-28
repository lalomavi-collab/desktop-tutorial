begin;
-- Control room (/workspace/control and the strip on the left of every cockpit screen), step 9 of the matters day, 28.10.2026.
--
-- Most of what the control room shows cannot be read by a signed in user, and should not be: the pg_cron run log, the pg_net
-- answers, the second factors in auth, the Outlook sync log and the function privileges. Instead of opening them up through a
-- new SECURITY DEFINER function a session could call, a private function reads them every 15 minutes from pg_cron, as the job's
-- owner, and stores counts in lalum_ops_snapshots. The platform admin with a second factor reads that table, nobody writes to it
-- except the job, and the function itself has no EXECUTE grant for anon or authenticated.
--
-- The snapshot holds counts, dates and statuses only: no name, no email, no document, no client. One firm today; the counts are
-- platform wide, which is what the platform admin sees anyway.
--
-- Retention: every snapshot for 2 days, then one a day (the 06:00 Israel run) for 90 days, so the strip can draw a daily line
-- without the table growing: about 300 rows of 3KB.
--
-- Also here, the matters day item 9.ה: lalum_v_admin_matters showed the matters in the recycle bin (21 instead of 7 on 28.10). Its
-- four readers (the dashboard, the matter list, the admin list and the hours picker) all mean live matters, so the view drops binned
-- rows once, instead of four screens each remembering a filter. Columns and their order are unchanged.
--
-- Paste in the SQL editor as one block. Undo: select cron.unschedule('lalum-ops-snapshot'); drop function lalum_private.ops_snapshot();
-- drop table public.lalum_ops_snapshots; and the view back to 0044 (the same text without the where line).

create table if not exists public.lalum_ops_snapshots (
  id       bigint generated always as identity primary key,
  taken_at timestamptz not null default now(),
  data     jsonb not null
);
create index if not exists lalum_ops_snapshots_taken on public.lalum_ops_snapshots (taken_at desc);

alter table public.lalum_ops_snapshots enable row level security;
revoke all on public.lalum_ops_snapshots from anon, authenticated;
grant select on public.lalum_ops_snapshots to authenticated;
drop policy if exists lalum_ops_snapshots_admin_read on public.lalum_ops_snapshots;
create policy lalum_ops_snapshots_admin_read on public.lalum_ops_snapshots for select to authenticated
  using ((select public.lalum_is_admin()) and (select public.lalum_mfa_ok()));

-- Invoker on purpose: it runs as the cron job's owner, the only role that calls it. Dates are Israel dates.
create or replace function lalum_private.ops_snapshot()
returns bigint
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
declare
  v_today date := (now() at time zone 'Asia/Jerusalem')::date;
  v_data  jsonb;
  v_id    bigint;
begin
  v_data :=
    jsonb_build_object(
      'v', 1,
      'cron', (
        select coalesce(jsonb_agg(jsonb_build_object(
                 'job', j.jobname, 'schedule', j.schedule, 'active', j.active,
                 'runs_24h', coalesce(s.runs, 0), 'failed_24h', coalesce(s.failed, 0),
                 'last_at', s.last_at, 'last_status', s.last_status, 'last_ok_at', s.last_ok_at) order by j.jobname), '[]'::jsonb)
          from cron.job j
          left join lateral (
            select count(*) filter (where d.start_time > now() - interval '24 hours') as runs,
                   count(*) filter (where d.start_time > now() - interval '24 hours' and d.status <> 'succeeded') as failed,
                   max(d.start_time) as last_at,
                   (array_agg(d.status order by d.start_time desc))[1] as last_status,
                   max(d.start_time) filter (where d.status = 'succeeded') as last_ok_at
              from cron.job_run_details d
             where d.jobid = j.jobid and d.start_time > now() - interval '8 days'
          ) s on true),
      'cron_failed_7d', (select count(*) from cron.job_run_details d where d.start_time > now() - interval '7 days' and d.status <> 'succeeded'),
      'http', (select jsonb_build_object('total', count(*), 'bad', count(*) filter (where r.status_code is null or r.status_code not between 200 and 299),
                                         'timed_out', count(*) filter (where r.timed_out), 'since', min(r.created))
                 from net._http_response r),
      'outlook', (select jsonb_build_object('last_at', max(o.ran_at), 'status', (array_agg(o.status order by o.ran_at desc))[1],
                                            'last_ok_at', max(o.ran_at) filter (where o.status = 'ok'),
                                            'fetched', ((array_agg(o.detail order by o.ran_at desc))[1] ->> 'fetched')::int,
                                            'held', coalesce(((array_agg(o.detail order by o.ran_at desc))[1] -> 'held' ->> 'deletes')::int, 0)
                                                  + coalesce(((array_agg(o.detail order by o.ran_at desc))[1] -> 'held' ->> 'inserts')::int, 0))
                    from public.lalum_outlook_sync_runs o where o.ran_at > now() - interval '30 days'),
      'campaign', (
        select coalesce(jsonb_object_agg(x.source, jsonb_build_object('last_at', x.last_at, 'status', x.status, 'last_ok_at', x.last_ok_at)), '{}'::jsonb)
          from (select c.source, max(c.ran_at) as last_at, (array_agg(c.status order by c.ran_at desc))[1] as status,
                       max(c.ran_at) filter (where c.status = 'ok') as last_ok_at
                  from public.lalum_campaign_sync_runs c where c.ran_at > now() - interval '30 days' group by c.source) x),
      'web', (
        select jsonb_build_object(
                 'gsc_last_day', max(m.day) filter (where m.source = 'gsc'),
                 'cf_last_day', max(m.day) filter (where m.source = 'cloudflare'),
                 'paid_90d', (select coalesce(sum(p.value), 0) from public.lalum_campaign_metrics_daily p
                               where p.scope = 'paid' and p.metric = 'spend' and p.day > v_today - 90))
          from public.lalum_campaign_metrics_daily m where m.scope = 'site' and m.key = '' and m.day > v_today - 60),
      'fin', (
        select jsonb_build_object(
                 'import_last_at', (select max(r.created_at) from public.lalum_fin_import_runs r where r.kind = 'DOCUMENTS'),
                 'import_ok_at', (select max(r.created_at) from public.lalum_fin_import_runs r where r.kind = 'DOCUMENTS' and r.error is null),
                 'import_last_error', (select left(r.error, 160) from public.lalum_fin_import_runs r where r.kind = 'DOCUMENTS' order by r.created_at desc limit 1),
                 'expenses_rows', (select count(*) from public.lalum_fin_expenses),
                 'expenses_import_key', exists (select 1 from information_schema.columns c
                                                 where c.table_schema = 'public' and c.table_name = 'lalum_fin_expenses' and c.column_name = 'import_key'),
                 'archive_rows', (select count(*) from public.lalum_fin_archive),
                 'archive_last_issue', (select max(a.issue_date) from public.lalum_fin_archive a),
                 -- Pro formas (Invoice4U type 5) still open there (status 1). They close only in Invoice4U, and the app learns of it
                 -- through the next archive import, so these counts are as fresh as import_ok_at and no fresher.
                 'proformas_open', (select count(*) from public.lalum_fin_archive a where a.i4u_doc_type = 5 and a.status_id = 1),
                 'proformas_open_total', (select coalesce(round(sum(a.total)), 0) from public.lalum_fin_archive a where a.i4u_doc_type = 5 and a.status_id = 1),
                 'proformas_open_old', (select count(*) from public.lalum_fin_archive a
                                         where a.i4u_doc_type = 5 and a.status_id = 1 and a.issue_date < v_today - 180),
                 'bank_last_day', (select max(b.value_date) from public.lalum_fin_bank_lines b),
                 'bank_balance', (select b.balance_after from public.lalum_fin_bank_lines b order by b.value_date desc, b.created_at desc limit 1))),
      'sec', jsonb_build_object(
               'definer_callable', (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                                     where n.nspname = 'public' and p.prosecdef and has_function_privilege('authenticated', p.oid, 'EXECUTE')),
               'totp_verified', (select count(*) from auth.mfa_factors f where f.factor_type = 'totp' and f.status = 'verified'),
               'users_total', (select count(*) from auth.users),
               'users_no_firm', (select count(*) from auth.users u where not exists (select 1 from public.lalum_firm_members fm where fm.user_id = u.id)),
               'partners_no_totp', (select count(*) from public.lalum_firm_members fm
                                     where fm.role in ('FIRM_PARTNER', 'ADMIN')
                                       and not exists (select 1 from auth.mfa_factors f where f.user_id = fm.user_id and f.factor_type = 'totp' and f.status = 'verified'))),
      'matters', (
        select jsonb_build_object(
                 'live', count(*) filter (where m.deleted_at is null),
                 'binned', count(*) filter (where m.deleted_at is not null),
                 'high', count(*) filter (where m.deleted_at is null and m.risk_summary ->> 'level' = 'HIGH_RISK'),
                 'caution', count(*) filter (where m.deleted_at is null and m.risk_summary ->> 'level' = 'CAUTION'),
                 'not_assessed', count(*) filter (where m.deleted_at is null and coalesce(m.risk_summary ->> 'level', 'NOT_ASSESSED') = 'NOT_ASSESSED'),
                 'deadlines_total', (select count(*) from public.lalum_deadlines d where d.status = 'PENDING'),
                 'deadlines_14d', (select count(*) from public.lalum_deadlines d where d.status = 'PENDING' and d.due_date between v_today and v_today + 14),
                 'deadlines_overdue', (select count(*) from public.lalum_deadlines d where d.status = 'PENDING' and d.due_date < v_today),
                 'fee_terms', (select count(*) from public.lalum_matter_fees),
                 'time_entries', (select count(*) from public.lalum_time_entries),
                 'inquiries', (select count(*) from public.lalum_matter_inquiries))
          from public.lalum_cockpit_matters m
          join public.lalum_intake_routings r on r.matter_id = m.id),
      'db', jsonb_build_object('bytes', pg_database_size(current_database()))
    )
  ;
  insert into public.lalum_ops_snapshots (data) values (v_data) returning id into v_id;
  delete from public.lalum_ops_snapshots s
   where s.taken_at < now() - interval '90 days'
      or (s.taken_at < now() - interval '2 days'
          and not (extract(hour from s.taken_at at time zone 'Asia/Jerusalem') = 6
                   and extract(minute from s.taken_at at time zone 'Asia/Jerusalem') < 15));
  return v_id;
end
$$;
revoke all on function lalum_private.ops_snapshot() from public, anon, authenticated;

-- Every 15 minutes. cron.schedule with an existing job name updates that job.
select cron.schedule('lalum-ops-snapshot', '*/15 * * * *', $$select lalum_private.ops_snapshot()$$);

create or replace view public.lalum_v_admin_matters with (security_invoker = true) as
 SELECT m.id AS matter_id,
    m.firm_id,
    f.firm_name,
    m.title,
    r.practice_area,
    m.status AS matter_status,
    m.conflict_status,
    r.partner_response,
    r.dispatched_at,
    r.first_viewed_at,
    m.risk_summary ->> 'level'::text AS risk_level,
    r.first_viewed_at IS NULL AND r.partner_response = 'PENDING_REVIEW'::text AND r.dispatched_at < (now() - '02:00:00'::interval) AS sla_breached,
        CASE
            WHEN r.first_viewed_at IS NULL AND r.partner_response = 'PENDING_REVIEW'::text THEN floor(EXTRACT(epoch FROM now() - r.dispatched_at) / 60::numeric)::integer
            ELSE NULL::integer
        END AS minutes_pending,
    m.matter_code
   FROM lalum_cockpit_matters m
     JOIN lalum_intake_routings r ON r.matter_id = m.id
     JOIN lalum_firms f ON f.id = m.firm_id
  WHERE m.deleted_at IS NULL;

-- The first snapshot now, so the screen has something to show before the first quarter hour.
select lalum_private.ops_snapshot();

insert into supabase_migrations.schema_migrations (version, name) values ('20261028123000', 'lalum_ops_snapshots') on conflict (version) do nothing;
commit;

-- What was applied: expected 6 rows (cron, function, migration, policy, snapshot, view).
select 'cron' as what, jobname || ' ' || schedule || ' active=' || active::text as value from cron.job where jobname = 'lalum-ops-snapshot'
union all select 'function', count(*)::text from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'lalum_private' and p.proname = 'ops_snapshot'
union all select 'migration', version || ' ' || name from supabase_migrations.schema_migrations where version = '20261028123000'
union all select 'policy', policyname from pg_policies where tablename = 'lalum_ops_snapshots'
union all select 'snapshot', count(*)::text || ' rows, matters live ' || max(data -> 'matters' ->> 'live') from public.lalum_ops_snapshots
union all select 'view', count(*)::text || ' matters in lalum_v_admin_matters' from public.lalum_v_admin_matters
order by 1, 2;
