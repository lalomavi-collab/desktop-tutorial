-- Tests for migration 20261028123000 (lalum_ops_snapshots, and live matters only in lalum_v_admin_matters) and 20261028143100 (the bank
-- feed fields). Order: 00_supabase_stubs, 08_ops_snapshot_stub, 20261028123000_lalum_ops_snapshots, 20261028143100_lalum_ops_snapshot_bank_sync,
-- then this file:
--   psql -v ON_ERROR_STOP=1 -f ops_snapshot.sql
-- Every assertion raises on failure; fixtures roll back.
begin;
delete from public.lalum_ops_snapshots;
insert into public.lalum_firms (id, firm_name) values ('00000000-0000-0000-0000-0000000000f1', 'F');
insert into public.lalum_cockpit_matters (id, firm_id, title, risk_summary, deleted_at) values
  ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000f1', 'live high', '{"level":"HIGH_RISK"}', null),
  ('00000000-0000-0000-0000-0000000000a2', '00000000-0000-0000-0000-0000000000f1', 'live unassessed', null, null),
  ('00000000-0000-0000-0000-0000000000a3', '00000000-0000-0000-0000-0000000000f1', 'binned', '{"level":"HIGH_RISK"}', now()),
  ('00000000-0000-0000-0000-0000000000a4', '00000000-0000-0000-0000-0000000000f1', 'no routing', null, null);
insert into public.lalum_intake_routings (matter_id, partner_response, dispatched_at) values
  ('00000000-0000-0000-0000-0000000000a1', 'ACCEPTED', now()), ('00000000-0000-0000-0000-0000000000a2', 'ACCEPTED', now()),
  ('00000000-0000-0000-0000-0000000000a3', 'ACCEPTED', now());
insert into public.lalum_deadlines (due_date, status) values (current_date + 3, 'PENDING'), (current_date - 2, 'PENDING'), (current_date + 1, 'DONE');
insert into auth.users (id) values ('00000000-0000-0000-0000-0000000000b1'), ('00000000-0000-0000-0000-0000000000b2'), ('00000000-0000-0000-0000-0000000000b3');
insert into public.lalum_firm_members (firm_id, user_id, role) values
  ('00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-0000000000b1', 'ADMIN'),
  ('00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-0000000000b2', 'FIRM_PARTNER');
insert into auth.mfa_factors (user_id, factor_type, status) values
  ('00000000-0000-0000-0000-0000000000b1', 'totp', 'verified'), ('00000000-0000-0000-0000-0000000000b2', 'totp', 'unverified');
insert into cron.job (jobid, jobname, schedule) values (901, 'test-every-minute', '* * * * *');
insert into cron.job_run_details (jobid, status, start_time) values
  (901, 'succeeded', now() - interval '2 minutes'), (901, 'failed', now() - interval '1 minute'), (901, 'failed', now() - interval '3 days');
insert into net._http_response (status_code, timed_out) values (200, false), (500, false), (null, true);
insert into public.lalum_outlook_sync_runs (ran_at, status, detail) values
  (now() - interval '1 day', 'ok', '{"fetched": 50, "held": {"deletes": 0, "inserts": 0}}'),
  (now() - interval '1 hour', 'held', '{"fetched": 52, "held": {"deletes": 11, "inserts": 0}}');
insert into public.lalum_campaign_sync_runs (ran_at, source, status) values
  (now() - interval '2 days', 'gsc', 'ok'), (now() - interval '1 hour', 'gsc', 'error'), (now() - interval '1 hour', 'facebook', 'ok');
insert into public.lalum_campaign_metrics_daily (day, source, scope, key, metric, value) values
  (current_date - 3, 'gsc', 'site', '', 'clicks', 5), (current_date - 3, 'gsc', 'page', '/x', 'clicks', 500),
  (current_date - 10, 'meta_ads', 'paid', '123', 'spend', 40.5), (current_date - 200, 'meta_ads', 'paid', '123', 'spend', 999);
insert into public.lalum_fin_import_runs (kind, error, created_at) values
  ('DOCUMENTS', null, now() - interval '7 days'), ('DOCUMENTS', 'type 1 UnauthorizedUser', now() - interval '6 days'), ('CUSTOMERS', null, now());
insert into public.lalum_fin_expenses default values;
insert into public.lalum_fin_archive (issue_date, i4u_doc_type, status_id, total) values
  (current_date - 7, 3, 1, 1180), (current_date - 400, 5, 1, 500000), (current_date - 30, 5, 1, 2000.4), (current_date - 30, 5, 2, 9000);
insert into public.lalum_fin_bank_lines (value_date, balance_after, created_at) values
  (current_date - 60, 100, now() - interval '2 hours'), (current_date - 57, 41369.21, now() - interval '1 hour');

select lalum_private.ops_snapshot() is not null as took \gset
do $$
declare d jsonb := (select data from public.lalum_ops_snapshots order by taken_at desc, id desc limit 1);
begin
  -- matters: the routed ones only, as the view, with the bin counted apart
  assert (d -> 'matters' ->> 'live')::int = 2, 'live matters ' || (d -> 'matters')::text;
  assert (d -> 'matters' ->> 'binned')::int = 1, 'binned';
  assert (d -> 'matters' ->> 'high')::int = 1, 'binned high risk is not counted as live';
  assert (d -> 'matters' ->> 'not_assessed')::int = 1, 'no risk summary is not assessed';
  assert (d -> 'matters' ->> 'deadlines_total')::int = 2 and (d -> 'matters' ->> 'deadlines_14d')::int = 1
     and (d -> 'matters' ->> 'deadlines_overdue')::int = 1, 'deadlines ' || (d -> 'matters')::text;
  -- security
  assert (d -> 'sec' ->> 'totp_verified')::int = 1, 'totp';
  assert (d -> 'sec' ->> 'partners_no_totp')::int = 1, 'a partner with an unverified factor has no second factor';
  assert (d -> 'sec' ->> 'users_no_firm')::int = 1, 'users without a firm';
  -- cron and http
  assert exists (select 1 from jsonb_array_elements(d -> 'cron') j where j ->> 'job' = 'test-every-minute'
                  and (j ->> 'runs_24h')::int = 2 and (j ->> 'failed_24h')::int = 1 and j ->> 'last_status' = 'failed'), 'cron ' || (d -> 'cron')::text;
  assert (d ->> 'cron_failed_7d')::int = 2, 'failed in 7 days';
  assert (d -> 'http' ->> 'total')::int = 3 and (d -> 'http' ->> 'bad')::int = 2 and (d -> 'http' ->> 'timed_out')::int = 1, 'http';
  -- syncs: the last run's status, and the last good one apart
  assert d -> 'outlook' ->> 'status' = 'held' and (d -> 'outlook' ->> 'held')::int = 11 and (d -> 'outlook' ->> 'fetched')::int = 52, 'outlook';
  assert (d -> 'outlook' ->> 'last_ok_at')::timestamptz < now() - interval '23 hours', 'outlook last good run';
  assert d -> 'campaign' -> 'gsc' ->> 'status' = 'error' and d -> 'campaign' -> 'gsc' ? 'last_ok_at', 'campaign gsc';
  -- web: the summary row only; paid spend over 90 days only
  assert (d -> 'web' ->> 'gsc_last_day')::date = current_date - 3, 'gsc day';
  assert (d -> 'web' ->> 'paid_90d')::numeric = 40.5, 'paid 90 days';
  -- finance: the documents import, not the customers one
  assert (d -> 'fin' ->> 'import_ok_at')::timestamptz < now() - interval '6 days 12 hours', 'import ok is the documents run';
  assert d -> 'fin' ->> 'import_last_error' like '%UnauthorizedUser%', 'last documents error';
  assert (d -> 'fin' ->> 'expenses_import_key')::boolean = false, 'no import key column yet';
  assert (d -> 'fin' ->> 'proformas_open')::int = 2 and (d -> 'fin' ->> 'proformas_open_total')::numeric = 502000
     and (d -> 'fin' ->> 'proformas_open_old')::int = 1, 'open pro formas ' || (d -> 'fin')::text;
  assert (d -> 'fin' ->> 'bank_balance')::numeric = 41369.21 and (d -> 'fin' ->> 'bank_last_day')::date = current_date - 57, 'bank';
  assert (d -> 'fin' ->> 'bank_balance_day')::date = current_date - 57, 'a file balance is dated by its line';
  assert d -> 'fin' -> 'bank_sync' ->> 'last_at' is null, 'no bank feed run yet';
  -- nothing that names a person
  assert d::text !~* '(email|title|firm_name)', 'no personal field in the snapshot';
end $$;

-- the bank feed: its balance wins when newer, a line without a running balance does not blank it, and data_at is the last good run's
insert into public.lalum_fin_bank_lines (value_date, balance_after) values (current_date - 1, null);
insert into public.lalum_fin_bank_balances (as_of, balance, fetched_at) values
  (current_date - 2, 50000, now() - interval '1 day'), (current_date - 1, 52000.5, now() - interval '1 hour');
insert into public.lalum_fin_bank_sync_runs (ran_at, status, detail) values
  (now() - interval '1 day', 'ok', '{"data_at": "2026-10-27T05:10:00Z"}'),
  (now() - interval '2 hours', 'ok', '{"data_at": "2026-10-28T05:12:00Z"}'),
  (now() - interval '1 hour', 'consent_expired', '{}'),
  (now() - interval '40 days', 'ok', '{"data_at": "2026-09-01T05:00:00Z"}');
select lalum_private.ops_snapshot() is not null as took \gset
do $$
declare d jsonb := (select data from public.lalum_ops_snapshots order by taken_at desc, id desc limit 1);
begin
  assert (d -> 'fin' ->> 'bank_balance')::numeric = 52000.5 and (d -> 'fin' ->> 'bank_balance_day')::date = current_date - 1, 'feed balance ' || (d -> 'fin')::text;
  assert (d -> 'fin' ->> 'bank_last_day')::date = current_date - 1, 'last movement';
  assert d -> 'fin' -> 'bank_sync' ->> 'status' = 'consent_expired', 'last run status';
  assert d -> 'fin' -> 'bank_sync' ->> 'data_at' = '2026-10-28T05:12:00Z', 'data_at of the last good run';
  assert (d -> 'fin' -> 'bank_sync' ->> 'last_ok_at')::timestamptz between now() - interval '3 hours' and now() - interval '1 hour', 'last good run';
end $$;

-- the view: live and routed only, columns unchanged
do $$ begin
  assert (select count(*) from public.lalum_v_admin_matters) = 2, 'view shows live matters only';
  assert (select column_name from information_schema.columns where table_name = 'lalum_v_admin_matters' order by ordinal_position desc limit 1) = 'matter_code', 'last column unchanged';
  assert (select reloptions::text from pg_class where relname = 'lalum_v_admin_matters') like '%security_invoker=true%', 'still security invoker';
end $$;

-- retention: two days in full, then the 06:00 Israel snapshot each day, nothing past 90 days
insert into public.lalum_ops_snapshots (taken_at, data) values
  (((current_date - 3) + time '10:00') at time zone 'Asia/Jerusalem', '{"t":"drop"}'),
  (((current_date - 3) + time '06:00') at time zone 'Asia/Jerusalem', '{"t":"keep daily"}'),
  (now() - interval '1 day', '{"t":"keep recent"}'),
  (now() - interval '100 days', '{"t":"drop old"}');
select lalum_private.ops_snapshot() is not null as took \gset
do $$ begin
  assert not exists (select 1 from public.lalum_ops_snapshots where data ->> 't' in ('drop', 'drop old')), 'old rows dropped';
  assert (select count(*) from public.lalum_ops_snapshots where data ->> 't' in ('keep daily', 'keep recent')) = 2, 'daily and recent kept';
end $$;

-- the job is scheduled every 15 minutes
do $$ begin
  assert (select schedule from cron.job where jobname = 'lalum-ops-snapshot') = '*/15 * * * *', 'cron job';
end $$;

-- reading: the platform admin with a second factor only; nobody can run the function or write a row
set local role authenticated;
do $$ begin
  assert (select count(*) from public.lalum_ops_snapshots) = 0, 'a member sees nothing';
  perform set_config('test.is_admin', 'true', true);
  assert (select count(*) from public.lalum_ops_snapshots) = 0, 'the admin without a second factor sees nothing';
  perform set_config('test.mfa_ok', 'true', true);
  assert (select count(*) from public.lalum_ops_snapshots) > 0, 'the admin with a second factor reads';
end $$;
do $$ begin
  insert into public.lalum_ops_snapshots (data) values ('{}');
  raise exception 'authenticated wrote a snapshot';
exception when insufficient_privilege then null;
end $$;
do $$ begin
  perform lalum_private.ops_snapshot();
  raise exception 'authenticated ran the snapshot';
exception when insufficient_privilege then null;
end $$;
reset role;
rollback;
select 'ops_snapshot: all assertions passed' as result;
