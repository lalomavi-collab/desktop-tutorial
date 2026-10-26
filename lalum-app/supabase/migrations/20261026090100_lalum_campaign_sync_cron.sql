-- Daily campaign sync at 06:30 UTC (08:30 Israel winter time, 09:30 summer time): after the search-console workflow (05:40 UTC)
-- has committed the day's Search Console file, which this sync reads while it has no Google key of its own.
-- Apply only after lalum-campaign-sync is deployed and a manual ?dry=1 call returned the numbers
-- expected. Same gate as the Outlook sync: the worker key from lalum_private.worker_keys. cron.schedule with an existing job name
-- updates that job. Undo: select cron.unschedule('lalum-campaign-sync');
-- The file name is provisional: rename it to the version recorded in production when it is applied.
select cron.schedule(
  'lalum-campaign-sync',
  '30 6 * * *',
  $$select net.http_post(
      url := 'https://meoymkcotomoluwlwues.supabase.co/functions/v1/lalum-campaign-sync',
      headers := jsonb_build_object('Content-Type', 'application/json',
                                    'x-lalum-worker', (select key from lalum_private.worker_keys where id = 1)),
      body := '{}'::jsonb,
      timeout_milliseconds := 120000)$$
);
