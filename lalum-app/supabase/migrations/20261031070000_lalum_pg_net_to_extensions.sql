/* Advisor close-out (30.10.2026), lint 0014 extension_in_public: pg_net is registered in schema public.
   Only the registration is in public. The extension's own objects (http_post, http_get, the request queue, the
   response log) live in schema net and stay there, so every caller keeps working by name: five cron jobs
   (lalum-dispatch-worker every minute, lalum-daily-report, lalum-campaign-sync, lalum-outlook-sync,
   lalum-fin-bank-sync) and lalum_private.ops_snapshot, which reads net._http_response. Read on 30.10.2026: no
   database object outside the extension depends on its objects, and no trigger calls supabase_functions.
   pg_net cannot be moved with ALTER EXTENSION SET SCHEMA (it is not relocatable), so it is dropped and created again
   in schema extensions, beside pgcrypto, pg_trgm and uuid-ossp, at the same version.
   What is lost: net._http_response, a log kept for 6 hours (pg_net.ttl). The queue is checked empty under an
   exclusive lock first, so no queued request is lost; if a request is waiting, nothing changes and it can run again
   seconds later. lock_timeout keeps the cron jobs from waiting on this for more than 5 seconds.
   Grants: the platform's event trigger issue_pg_net_access (extensions.grant_pg_net_access) grants USAGE on schema
   net again to postgres, anon, authenticated, service_role and supabase_functions_admin on CREATE EXTENSION; the
   tables and functions get the extension script's own grants, as before.
   Applied by hand from the SQL editor, inside one transaction (paste file pg-net-move-2026-10-31.sql). */

set local lock_timeout = '5s';
lock table net.http_request_queue, net._http_response in access exclusive mode;
do $$ begin
  if exists (select 1 from net.http_request_queue) then
    raise exception 'pg_net queue is not empty: wait 10 seconds and run again';
  end if;
end $$;
drop extension pg_net;
create extension pg_net with schema extensions version '0.20.4';
