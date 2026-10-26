-- Campaign sync twice a day, 06:30 and 11:30 UTC (08:30 and 13:30 Israel winter time). The morning run brings the site's own
-- requests and the posts up to date; the midday run picks up the day's Search Console file, which this sync reads while it has
-- no Google key of its own. The search-console workflow is scheduled for 05:40 UTC but GitHub has started it between 09:45 and
-- 10:35 UTC every day from 20.10 to 25.10, so a single morning run would always read the previous day's file.
-- Apply only after lalum-campaign-sync is deployed and a manual ?dry=1 call returned the numbers
-- expected. Same gate as the Outlook sync: the worker key from lalum_private.worker_keys. cron.schedule with an existing job name
-- updates that job. Undo: select cron.unschedule('lalum-campaign-sync');
-- The file name is provisional: rename it to the version recorded in production when it is applied.
select cron.schedule(
  'lalum-campaign-sync',
  '30 6,11 * * *',
  $$select net.http_post(
      url := 'https://meoymkcotomoluwlwues.supabase.co/functions/v1/lalum-campaign-sync',
      headers := jsonb_build_object('Content-Type', 'application/json',
                                    'x-lalum-worker', (select key from lalum_private.worker_keys where id = 1)),
      body := '{}'::jsonb,
      timeout_milliseconds := 120000)$$
);
