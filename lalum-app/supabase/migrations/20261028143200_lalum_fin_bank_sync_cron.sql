-- Bank feed twice a day, 05:30 and 12:30 UTC (07:30 and 14:30 Israel winter time). Financy refreshes the bank each morning at a time
-- its docs do not state; the midday run picks up a late refresh. Reads cost no Financy credits; a refresh would, and is never called.
-- Apply after lalum-fin-bank-sync is deployed and a manual call returned not_configured (no key yet) or a ?dry=1 plan. Without the
-- FINANCY_* secrets each run only writes a not_configured row, which is what the control room shows until the key is in.
-- Same gate as the other cron jobs: the worker key from lalum_private.worker_keys. cron.schedule with an existing job name updates that
-- job. Undo: select cron.unschedule('lalum-fin-bank-sync');
select cron.schedule(
  'lalum-fin-bank-sync',
  '30 5,12 * * *',
  $$select net.http_post(
      url := 'https://meoymkcotomoluwlwues.supabase.co/functions/v1/lalum-fin-bank-sync',
      headers := jsonb_build_object('Content-Type', 'application/json',
                                    'x-lalum-worker', (select key from lalum_private.worker_keys where id = 1)),
      body := '{}'::jsonb,
      timeout_milliseconds := 120000)$$
);

insert into supabase_migrations.schema_migrations (version, name) values ('20261028143200', 'lalum_fin_bank_sync_cron') on conflict (version) do nothing;
