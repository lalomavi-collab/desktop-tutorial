-- Campaign dashboard (/workspace/campaigns). The edge function lalum-campaign-sync pulls Search Console, Cloudflare Web Analytics, the
-- Facebook page and the Meta ad account twice a day and writes daily numbers here in one long table: one row per day, source, scope, key and
-- metric. LinkedIn and paid channels without an API are typed in by the admin (lalum_campaign_manual_post, lalum_campaign_manual_paid).
-- The screen reads everything through lalum_campaign_summary. Nothing here stores a person: the internal counts are per day, never per lead.
-- The cron job is in 20261026072642, applied after the function was deployed and a manual ?dry=1 run looked right. This file was
-- pasted in the SQL editor on 26.10.2026 and recorded under its own version, so the name and the production row match.

create table if not exists public.lalum_campaigns (
  code             text primary key check (code ~ '^[a-z0-9-]{2,40}$'),
  name             text not null,
  starts_on        date not null,
  ends_on          date,
  utm_campaign     text,
  -- Site paths that belong to the campaign, without the language prefix. A path matches its prefix exactly or any page under it.
  landing_prefixes text[] not null default '{}',
  created_at       timestamptz not null default now()
);

create table if not exists public.lalum_campaign_posts (
  id            bigint generated always as identity primary key,
  campaign_code text references public.lalum_campaigns(code) on delete set null,
  post_no       int,
  platform      text not null check (platform in ('facebook', 'linkedin', 'instagram', 'telegram', 'newsletter')),
  external_id   text,
  permalink     text,
  published_at  timestamptz,
  title         text,
  -- The opening words of the post as written in the campaign file. The sync links a published post to its row by these words when the
  -- row has no external_id yet (posts 009 to 015 were published by hand, not through the pipeline).
  match_prefix  text,
  created_at    timestamptz not null default now(),
  unique (platform, external_id)
);
create unique index if not exists lalum_campaign_posts_no on public.lalum_campaign_posts (platform, campaign_code, post_no) where post_no is not null;

create table if not exists public.lalum_campaign_metrics_daily (
  day       date not null,
  source    text not null check (source in ('gsc', 'cloudflare', 'facebook', 'meta_ads', 'internal', 'manual')),
  -- site: the whole site, page or ad account; page: a Search Console page path; query: a search query; path: a Cloudflare or lead page path;
  -- referrer: a referring host; post: a social post by its platform id (a snapshot of its running totals on that day);
  -- paid: an ad campaign (Meta) or a paid channel typed in by hand, on the day its numbers cover (by hand: the last day of the period).
  scope     text not null check (scope in ('site', 'page', 'query', 'path', 'referrer', 'post', 'paid')),
  key       text not null default '',
  metric    text not null,
  value     numeric not null,
  synced_at timestamptz not null default now(),
  primary key (day, source, scope, key, metric)
);
create index if not exists lalum_campaign_metrics_scope_day on public.lalum_campaign_metrics_daily (source, scope, day);
create index if not exists lalum_campaign_metrics_post on public.lalum_campaign_metrics_daily (key, day) where scope = 'post';

create table if not exists public.lalum_campaign_sync_runs (
  id           bigint generated always as identity primary key,
  ran_at       timestamptz not null default now(),
  source       text not null,
  status       text not null,
  rows_written int not null default 0,
  detail       jsonb not null default '{}'::jsonb
);
create index if not exists lalum_campaign_sync_runs_source on public.lalum_campaign_sync_runs (source, ran_at desc);

-- Read by the platform admin with a second factor where the firm asks for one; written only by the function with the service role.
alter table public.lalum_campaigns enable row level security;
alter table public.lalum_campaign_posts enable row level security;
alter table public.lalum_campaign_metrics_daily enable row level security;
alter table public.lalum_campaign_sync_runs enable row level security;
revoke all on public.lalum_campaigns, public.lalum_campaign_posts, public.lalum_campaign_metrics_daily, public.lalum_campaign_sync_runs from anon, authenticated;
grant select on public.lalum_campaigns, public.lalum_campaign_posts, public.lalum_campaign_metrics_daily, public.lalum_campaign_sync_runs to authenticated;

drop policy if exists lalum_campaigns_admin_read on public.lalum_campaigns;
create policy lalum_campaigns_admin_read on public.lalum_campaigns for select to authenticated
  using ((select public.lalum_is_admin()) and (select public.lalum_mfa_ok()));
drop policy if exists lalum_campaign_posts_admin_read on public.lalum_campaign_posts;
create policy lalum_campaign_posts_admin_read on public.lalum_campaign_posts for select to authenticated
  using ((select public.lalum_is_admin()) and (select public.lalum_mfa_ok()));
drop policy if exists lalum_campaign_metrics_admin_read on public.lalum_campaign_metrics_daily;
create policy lalum_campaign_metrics_admin_read on public.lalum_campaign_metrics_daily for select to authenticated
  using ((select public.lalum_is_admin()) and (select public.lalum_mfa_ok()));
drop policy if exists lalum_campaign_sync_runs_admin_read on public.lalum_campaign_sync_runs;
create policy lalum_campaign_sync_runs_admin_read on public.lalum_campaign_sync_runs for select to authenticated
  using ((select public.lalum_is_admin()) and (select public.lalum_mfa_ok()));

-- '/en/risk/' and '/risk' are the same page for the campaign: the language prefix and a trailing slash are dropped.
create or replace function public.lalum_campaign_base_path(p_path text)
returns text
language sql
immutable
set search_path = public
as $$
  select coalesce(nullif(regexp_replace(regexp_replace(coalesce(p_path, ''), '^/(en|es|fr|ar)(/|$)', '/'), '/+$', ''), ''), '/')
$$;

-- Exact comparisons, not LIKE: an underscore in a path is a character, not a wildcard.
create or replace function public.lalum_campaign_path_in(p_path text, p_prefixes text[])
returns boolean
language sql
immutable
set search_path = public
as $$
  select exists (
    select 1 from unnest(coalesce(p_prefixes, '{}'::text[])) x
     where x <> '' and (p_path = x or left(p_path, length(x) + 1) = x || '/')
  )
$$;

-- Requests and sign-ups per day (Israel time), counted from the lead tables. Called by the function with the service role. The days from
-- p_from on are deleted and written again in the same transaction, so a lead removed later (a test, a purge) drops out of the count too.
-- lalum_leads also gives its page path, the only lead table that records where the visitor was. Smoke tests are left out.
create or replace function public.lalum_campaign_refresh_internal(p_from date, p_dry boolean default false)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_from timestamptz := p_from::timestamp at time zone 'Asia/Jerusalem';
  v_rows jsonb;
  v_n    int;
begin
  with t as (
    select (created_at at time zone 'Asia/Jerusalem')::date d, 'bookings' m, null::text k from public.lalum_booking_requests where created_at >= v_from
    union all
    select (created_at at time zone 'Asia/Jerusalem')::date, 'consultations', null from public.lalum_consultation_requests where created_at >= v_from
    union all
    select (created_at at time zone 'Asia/Jerusalem')::date, 'leads', coalesce(nullif(page_path, ''), '(none)') from public.lalum_leads
     where created_at >= v_from and coalesce(source, '') !~* '^(smoke|test)'
    union all
    select (created_at at time zone 'Asia/Jerusalem')::date, 'site_leads', null from public.lalum_site_leads where created_at >= v_from
    union all
    select (created_at at time zone 'Asia/Jerusalem')::date, 'newsletter', null from public.lalum_newsletter_subscribers where created_at >= v_from
  ), agg as (
    select d, 'site'::text scope, ''::text key, m, count(*)::numeric v from t group by d, m
    union all
    select d, 'path', k, m, count(*)::numeric from t where k is not null group by d, k, m
  )
  select coalesce(jsonb_agg(jsonb_build_object('day', d, 'scope', scope, 'key', key, 'metric', m, 'value', v) order by d, scope, key, m), '[]'::jsonb)
    into v_rows from agg;

  if p_dry then
    return jsonb_build_object('rows', jsonb_array_length(v_rows), 'sample', coalesce((select jsonb_agg(x) from (select x from jsonb_array_elements(v_rows) x limit 5) s), '[]'::jsonb));
  end if;

  delete from public.lalum_campaign_metrics_daily where source = 'internal' and day >= p_from;
  insert into public.lalum_campaign_metrics_daily (day, source, scope, key, metric, value)
  select (r->>'day')::date, 'internal', r->>'scope', r->>'key', r->>'metric', (r->>'value')::numeric
    from jsonb_array_elements(v_rows) r;
  get diagnostics v_n = row_count;
  return jsonb_build_object('rows', v_n);
end $$;

revoke all on function public.lalum_campaign_refresh_internal(date, boolean) from public, anon, authenticated;
grant execute on function public.lalum_campaign_refresh_internal(date, boolean) to service_role;

-- Everything the screen shows, in one call. Daily rows come back raw for twice the window plus a week, so the screen can draw each source
-- over its own days (Search Console lags two to three days) and compare with the window before. Rankings are cut here, for the current window.
-- Security invoker: the reads go through the policies above, and a caller who is not the admin gets null.
create or replace function public.lalum_campaign_summary(p_code text default 'legal-ai', p_days int default 28)
returns jsonb
language plpgsql
stable
security invoker
set search_path = public
as $$
declare
  v_days  int := least(greatest(coalesce(p_days, 28), 7), 180);
  v_today date := (now() at time zone 'Asia/Jerusalem')::date;
  v_c     public.lalum_campaigns%rowtype;
  v_max   jsonb;
  v_g     date;
  v_cf    date;
  v_since date;
begin
  if not (coalesce(public.lalum_is_admin(), false) and coalesce(public.lalum_mfa_ok(), false)) then
    return null;
  end if;
  select * into v_c from public.lalum_campaigns where code = p_code;
  select coalesce(jsonb_object_agg(source, mx), '{}'::jsonb) into v_max
    from (select source, max(day) mx from public.lalum_campaign_metrics_daily where scope = 'site' group by source) s;
  v_g  := coalesce((v_max->>'gsc')::date, v_today - 3);
  v_cf := coalesce((v_max->>'cloudflare')::date, v_today - 1);
  v_since := least(v_g, v_cf, v_today) - 2 * v_days - 7;

  return jsonb_build_object(
    'campaign', case when v_c.code is null then null else jsonb_build_object(
      'code', v_c.code, 'name', v_c.name, 'starts_on', v_c.starts_on, 'ends_on', v_c.ends_on, 'utm_campaign', v_c.utm_campaign,
      'landing_prefixes', to_jsonb(v_c.landing_prefixes)) end,
    'today', v_today,
    'days', v_days,
    'max_day', v_max,
    'site', coalesce((
      select jsonb_agg(jsonb_build_object('day', day, 'source', source, 'metric', metric, 'value', value) order by day)
        from public.lalum_campaign_metrics_daily
       where scope = 'site' and day >= v_since), '[]'::jsonb),
    'landing', coalesce((
      select jsonb_agg(jsonb_build_object('day', day, 'source', source, 'metric', metric, 'value', v) order by day)
        from (select m.day, m.source, m.metric, sum(m.value) v
                from public.lalum_campaign_metrics_daily m
               where m.day >= v_since
                 and ((m.source = 'gsc' and m.scope = 'page') or (m.source = 'cloudflare' and m.scope = 'path'))
                 and public.lalum_campaign_path_in(public.lalum_campaign_base_path(m.key), v_c.landing_prefixes)
               group by 1, 2, 3) x), '[]'::jsonb),
    -- The way into a consultation on the site: the risk check, its result pages, the booking page.
    'steps', coalesce((
      select jsonb_agg(jsonb_build_object('day', day, 'step', step, 'value', v) order by day)
        from (select m.day,
                     case when b = '/risk' then 'risk' when left(b, 6) = '/risk/' then 'risk_result' else 'book' end step,
                     sum(m.value) v
                from public.lalum_campaign_metrics_daily m
                cross join lateral (select public.lalum_campaign_base_path(m.key) b) p
               where m.day >= v_since and m.source = 'cloudflare' and m.scope = 'path' and m.metric = 'pageviews'
                 and (b = '/risk' or left(b, 6) = '/risk/' or b = '/book' or left(b, 6) = '/book/')
               group by 1, 2) x), '[]'::jsonb),
    'queries', coalesce((
      select jsonb_agg(jsonb_build_object('key', key, 'clicks', c, 'impressions', i, 'position', round(px / nullif(i, 0), 1)) order by i desc, c desc)
        from (select key, sum(value) filter (where metric = 'clicks') c, sum(value) filter (where metric = 'impressions') i,
                     sum(value) filter (where metric = 'pos_x_impr') px
                from public.lalum_campaign_metrics_daily
               where source = 'gsc' and scope = 'query' and day between v_g - v_days + 1 and v_g
               group by key order by 3 desc nulls last, 2 desc nulls last limit 20) x), '[]'::jsonb),
    'pages_gsc', coalesce((
      select jsonb_agg(jsonb_build_object('key', key, 'clicks', c, 'impressions', i,
                       'campaign', public.lalum_campaign_path_in(public.lalum_campaign_base_path(key), v_c.landing_prefixes)) order by c desc, i desc)
        from (select key, sum(value) filter (where metric = 'clicks') c, sum(value) filter (where metric = 'impressions') i
                from public.lalum_campaign_metrics_daily
               where source = 'gsc' and scope = 'page' and day between v_g - v_days + 1 and v_g
               group by key order by 2 desc nulls last, 3 desc nulls last limit 12) x), '[]'::jsonb),
    'paths_cf', coalesce((
      select jsonb_agg(jsonb_build_object('key', key, 'pageviews', pv, 'visits', vi,
                       'campaign', public.lalum_campaign_path_in(public.lalum_campaign_base_path(key), v_c.landing_prefixes)) order by pv desc)
        from (select key, sum(value) filter (where metric = 'pageviews') pv, sum(value) filter (where metric = 'visits') vi
                from public.lalum_campaign_metrics_daily
               where source = 'cloudflare' and scope = 'path' and day between v_cf - v_days + 1 and v_cf
               group by key order by 2 desc nulls last limit 12) x), '[]'::jsonb),
    'referrers', coalesce((
      select jsonb_agg(jsonb_build_object('key', key, 'cur', cur, 'prev', prev) order by cur desc)
        from (select key,
                     coalesce(sum(value) filter (where day between v_cf - v_days + 1 and v_cf), 0) cur,
                     coalesce(sum(value) filter (where day between v_cf - 2 * v_days + 1 and v_cf - v_days), 0) prev
                from public.lalum_campaign_metrics_daily
               where source = 'cloudflare' and scope = 'referrer' and metric = 'visits' and day between v_cf - 2 * v_days + 1 and v_cf
               group by key order by 2 desc limit 20) x), '[]'::jsonb),
    -- Paid rows come back raw, like site: Meta per ad campaign per day, and the periods typed in by hand.
    'paid', coalesce((
      select jsonb_agg(jsonb_build_object('day', day, 'source', source, 'key', key, 'metric', metric, 'value', value) order by day)
        from public.lalum_campaign_metrics_daily
       where scope = 'paid' and day >= v_since), '[]'::jsonb),
    'lead_paths', coalesce((
      select jsonb_agg(jsonb_build_object('key', key, 'leads', v) order by v desc)
        from (select key, sum(value) v from public.lalum_campaign_metrics_daily
               where source = 'internal' and scope = 'path' and day between v_today - v_days + 1 and v_today
               group by key order by 2 desc limit 10) x), '[]'::jsonb),
    -- Campaign posts, and any other page post published since the campaign began (in_campaign false), with their latest snapshot.
    'posts', coalesce((
      select jsonb_agg(jsonb_build_object('post_no', p.post_no, 'platform', p.platform, 'title', p.title, 'permalink', p.permalink,
                       'published_at', p.published_at, 'linked', p.external_id is not null, 'in_campaign', p.campaign_code is not distinct from p_code,
                       'as_of', s.as_of, 'metrics', coalesce(s.metrics, '{}'::jsonb))
                       order by p.post_no nulls last, p.published_at desc nulls last)
        from public.lalum_campaign_posts p
        left join lateral (
          select m.day as_of, jsonb_object_agg(m.metric, m.value) metrics
            from public.lalum_campaign_metrics_daily m
           where m.scope = 'post' and m.key = p.external_id
             and m.day = (select max(x.day) from public.lalum_campaign_metrics_daily x where x.scope = 'post' and x.key = p.external_id)
           group by m.day) s on true
       where p.campaign_code = p_code or (p.campaign_code is null and p.published_at >= v_c.starts_on)), '[]'::jsonb),
    'runs', coalesce((
      select jsonb_agg(jsonb_build_object('source', r.source, 'status', r.status, 'ran_at', r.ran_at, 'rows', r.rows_written,
                       'error', r.detail->>'error', 'mode', r.detail->>'mode', 'warning', r.detail->>'warning',
                       'last_ok_at', (select max(o.ran_at) from public.lalum_campaign_sync_runs o where o.source = r.source and o.status = 'ok')))
        from (select distinct on (source) * from public.lalum_campaign_sync_runs order by source, ran_at desc) r), '[]'::jsonb)
  );
end $$;

revoke all on function public.lalum_campaign_summary(text, int) from public, anon;
grant execute on function public.lalum_campaign_summary(text, int) to authenticated;

-- Typed in by the admin from the cockpit: a LinkedIn post (no API without Community Management approval) and its numbers as of a day,
-- and a paid channel without an API (Google Ads, LinkedIn Ads) for a period. Security definer because the tables take no writes from
-- users; the first statement admits the platform admin with a second factor only, and only source 'manual' rows are ever written.
-- A metric sent as null deletes that metric for the day, so a typo can be taken back.
create or replace function public.lalum_campaign_manual_post(
  p_platform text, p_permalink text, p_title text, p_published_on date, p_day date, p_metrics jsonb, p_campaign text default 'legal-ai')
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_key text := nullif(btrim(coalesce(p_permalink, '')), '');
  v_n   int := 0;
  v_val numeric;
  r     record;
begin
  if not (coalesce(public.lalum_is_admin(), false) and coalesce(public.lalum_mfa_ok(), false)) then
    raise exception 'lalum_campaign_manual_post: not allowed' using errcode = '42501';
  end if;
  if p_platform not in ('linkedin', 'instagram', 'telegram', 'newsletter') then
    raise exception 'lalum_campaign_manual_post: platform % is synced, not typed in', p_platform;
  end if;
  if v_key is null or length(v_key) > 500 or v_key !~ '^https://' then
    raise exception 'lalum_campaign_manual_post: a post link starting with https:// is required';
  end if;
  if p_day is null or p_day > (now() at time zone 'Asia/Jerusalem')::date then
    raise exception 'lalum_campaign_manual_post: the day must be today or earlier';
  end if;

  insert into public.lalum_campaign_posts (campaign_code, platform, external_id, permalink, published_at, title)
  values (p_campaign, p_platform, v_key, v_key, p_published_on::timestamp at time zone 'Asia/Jerusalem', left(nullif(btrim(coalesce(p_title, '')), ''), 200))
  on conflict (platform, external_id) do update
    set title = coalesce(excluded.title, lalum_campaign_posts.title),
        published_at = coalesce(excluded.published_at, lalum_campaign_posts.published_at);

  for r in select key, value from jsonb_each(coalesce(p_metrics, '{}'::jsonb)) loop
    if r.key not in ('impressions', 'reactions', 'comments', 'shares', 'clicks') then
      raise exception 'lalum_campaign_manual_post: unknown metric %', r.key;
    end if;
    if jsonb_typeof(r.value) = 'null' then
      delete from public.lalum_campaign_metrics_daily
       where day = p_day and source = 'manual' and scope = 'post' and key = v_key and metric = r.key;
      continue;
    end if;
    if jsonb_typeof(r.value) <> 'number' then
      raise exception 'lalum_campaign_manual_post: % must be a number', r.key;
    end if;
    v_val := (r.value #>> '{}')::numeric;
    if v_val < 0 or v_val > 1e9 then
      raise exception 'lalum_campaign_manual_post: % is out of range', r.key;
    end if;
    insert into public.lalum_campaign_metrics_daily (day, source, scope, key, metric, value)
    values (p_day, 'manual', 'post', v_key, r.key, v_val)
    on conflict (day, source, scope, key, metric) do update set value = excluded.value, synced_at = now();
    v_n := v_n + 1;
  end loop;
  return jsonb_build_object('written', v_n);
end $$;

create or replace function public.lalum_campaign_manual_paid(p_channel text, p_period_end date, p_metrics jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_n   int := 0;
  v_val numeric;
  r     record;
begin
  if not (coalesce(public.lalum_is_admin(), false) and coalesce(public.lalum_mfa_ok(), false)) then
    raise exception 'lalum_campaign_manual_paid: not allowed' using errcode = '42501';
  end if;
  if p_channel not in ('google_ads', 'linkedin_ads', 'meta_ads_manual', 'other') then
    raise exception 'lalum_campaign_manual_paid: unknown channel %', p_channel;
  end if;
  if p_period_end is null or p_period_end > (now() at time zone 'Asia/Jerusalem')::date then
    raise exception 'lalum_campaign_manual_paid: the period must end today or earlier';
  end if;
  for r in select key, value from jsonb_each(coalesce(p_metrics, '{}'::jsonb)) loop
    if r.key not in ('spend', 'impressions', 'clicks', 'leads') then
      raise exception 'lalum_campaign_manual_paid: unknown metric %', r.key;
    end if;
    if jsonb_typeof(r.value) = 'null' then
      delete from public.lalum_campaign_metrics_daily
       where day = p_period_end and source = 'manual' and scope = 'paid' and key = p_channel and metric = r.key;
      continue;
    end if;
    if jsonb_typeof(r.value) <> 'number' then
      raise exception 'lalum_campaign_manual_paid: % must be a number', r.key;
    end if;
    v_val := (r.value #>> '{}')::numeric;
    if v_val < 0 or v_val > 1e9 then
      raise exception 'lalum_campaign_manual_paid: % is out of range', r.key;
    end if;
    insert into public.lalum_campaign_metrics_daily (day, source, scope, key, metric, value)
    values (p_period_end, 'manual', 'paid', p_channel, r.key, v_val)
    on conflict (day, source, scope, key, metric) do update set value = excluded.value, synced_at = now();
    v_n := v_n + 1;
  end loop;
  return jsonb_build_object('written', v_n);
end $$;

revoke all on function public.lalum_campaign_manual_post(text, text, text, date, date, jsonb, text) from public, anon;
revoke all on function public.lalum_campaign_manual_paid(text, date, jsonb) from public, anon;
grant execute on function public.lalum_campaign_manual_post(text, text, text, date, date, jsonb, text) to authenticated;
grant execute on function public.lalum_campaign_manual_paid(text, date, jsonb) to authenticated;

-- The Legal AI campaign (September 2026 onward) and its eight Facebook posts. Post 016 went out through the pipeline, so its id is known;
-- the others are linked by their opening words on the first sync. Landing pages: the links the posts carried, and the advisory page.
insert into public.lalum_campaigns (code, name, starts_on, utm_campaign, landing_prefixes)
values ('legal-ai', 'Legal AI', '2026-09-01', 'legal-ai',
        array['/ai-legal-advisory', '/risk', '/book', '/insights/effective-human-oversight-ai-systems', '/insights/ip-value-collapse-ai-acquisition'])
on conflict (code) do nothing;

insert into public.lalum_campaign_posts (campaign_code, post_no, platform, title, match_prefix, external_id)
select 'legal-ai', v.no, 'facebook', v.title, v.prefix, v.ext
  from (values
    (9,  'האם ה-AI שלכם הוא נכס אסטרטגי, או פצצת זמן משפטית של מיליוני שקלים?', 'האם ה-AI שלכם הוא נכס אסטרטגי,', null),
    (10, 'אף אחד לא ייתבע על זה שהשתמש בבינה מלאכותית.', 'אף אחד לא ייתבע על זה שהשתמש ב', null),
    (11, 'החשיפה המשפטית שלכם ל-AI לא נמצאת במודל.', 'החשיפה המשפטית שלכם ל-AI לא נמ', null),
    (12, 'הסכם התחדשות עירונית. מאה חמישים עמודים.', 'הסכם התחדשות עירונית. מאה חמיש', null),
    (13, '"אנחנו חברה ישראלית, ה-EU AI Act לא רלוונטי לנו."', '"אנחנו חברה ישראלית, ה-EU AI A', null),
    (14, 'בשבועיים האחרונים כתבתי כאן על החשיפה שנוצרת סביב AI', 'בשבועיים האחרונים כתבתי כאן על', null),
    (15, 'מקרה בוחן: איך קיצור דרך אחד עם AI מחק 40% משווי עסקה.', 'מקרה בוחן: איך קיצור דרך אחד ע', null),
    (16, '36 הפניות לפסקי דין. חמש מהן, לפסקי דין שאינם קיימים.', '36 הפניות לפסקי דין. חמש מהן,', '604003069451536_122247103214783961')
  ) as v(no, title, prefix, ext)
 where not exists (select 1 from public.lalum_campaign_posts p where p.platform = 'facebook' and p.campaign_code = 'legal-ai' and p.post_no = v.no);
