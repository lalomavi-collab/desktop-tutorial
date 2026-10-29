begin;
-- The control room's snapshot (20261028143100) with one change, the bank balance it shows. It took the running balance of the newest
-- line by created_at, but lines loaded in one statement share one created_at, so the pick within a day was arbitrary: on 28.10 the
-- tile read 21,768.02 for a day that closed at 30,618.02. It now takes the newest stored balance (since 20261029100100 a statement's
-- daily closings are stored too), or else the newest day's closing by the chain of running balances (lalum_fin_bank_closing). A stored
-- balance wins on the same day, and a line without a running balance never counts.
-- Every other field is the text of 20261028143100, unchanged. Apply after 20261029100000 and 20261029100100.
-- Paste in the SQL editor as one block. Undo: the function block of 20261028143100.

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
  v_bal   numeric;
  v_bal_d date;
begin
  -- The newest balance: a stored balance (the feed's booked balance, a statement's daily closing), or else the closing of the newest
  -- day on file lines with a running balance, by their chain (lalum_fin_bank_closing), never by the order they were stored in. On the
  -- same day a stored balance wins. A line without a running balance (a feed line) never counts.
  select x.bal, x.d into v_bal, v_bal_d
    from ((select bb.as_of as d, bb.balance as bal, 1 as pri, bb.fetched_at as t from public.lalum_fin_bank_balances bb
            order by bb.as_of desc, bb.fetched_at desc limit 1)
          union all
          (select b.value_date, public.lalum_fin_bank_closing(jsonb_agg(jsonb_build_object('amount', b.amount, 'balance_after', b.balance_after)
                                                                       order by b.created_at, b.id)), 0, null
             from public.lalum_fin_bank_lines b where b.balance_after is not null
            group by b.bank_account_id, b.value_date
            order by b.value_date desc limit 1)) x
   where x.bal is not null
   order by x.d desc, x.pri desc, x.t desc nulls last
   limit 1;
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
                 'bank_balance', v_bal,
                 'bank_balance_day', v_bal_d,
                 -- The bank feed (lalum-fin-bank-sync): its last run, and data_at, when Financy last read the bank, from the last good run.
                 -- A quiet account with a fresh read is fresh; a run that succeeds on a consent that stopped refreshing is not.
                 'bank_sync', (select jsonb_build_object('last_at', max(r.ran_at), 'status', (array_agg(r.status order by r.ran_at desc))[1],
                                                         'last_ok_at', max(r.ran_at) filter (where r.status = 'ok'),
                                                         'data_at', (array_agg(r.detail ->> 'data_at' order by r.ran_at desc) filter (where r.status = 'ok'))[1])
                                 from public.lalum_fin_bank_sync_runs r where r.ran_at > now() - interval '30 days'))),
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

-- A snapshot now, so the tile reads the new fields before the next quarter hour.
select lalum_private.ops_snapshot();

insert into supabase_migrations.schema_migrations (version, name) values ('20261029100200', 'lalum_ops_snapshot_bank_closing') on conflict (version) do nothing;
commit;

-- What was applied: the newest snapshot's balance and its day (30618.02 on 28.10 for the Leumi file of 29.10).
select data -> 'fin' -> 'bank_balance' as balance, data -> 'fin' -> 'bank_balance_day' as balance_day
  from public.lalum_ops_snapshots order by taken_at desc, id desc limit 1;
