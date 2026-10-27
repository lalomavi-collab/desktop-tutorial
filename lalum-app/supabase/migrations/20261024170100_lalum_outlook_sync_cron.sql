-- Daily Outlook sync at 04:15 UTC (06:15 Israel winter time, 07:15 summer time), the hour the old Claude routine ran.
-- Apply only after lalum-outlook-sync is deployed, its secrets are set and a manual ?dry=1 call returned a plan (step 8.1.ב).
-- Same gate as lalum-dispatch-worker: the worker key from lalum_private.worker_keys. cron.schedule with an existing job name
-- updates that job. Undo: select cron.unschedule('lalum-outlook-sync');
select cron.schedule(
  'lalum-outlook-sync',
  '15 4 * * *',
  $$select net.http_post(
      url := 'https://meoymkcotomoluwlwues.supabase.co/functions/v1/lalum-outlook-sync',
      headers := jsonb_build_object('Content-Type', 'application/json',
                                    'x-lalum-worker', (select key from lalum_private.worker_keys where id = 1)),
      body := '{}'::jsonb,
      timeout_milliseconds := 60000)$$
);
