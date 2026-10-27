-- Campaign dashboard, second step: the Instagram account linked to the Facebook page becomes a synced source (lalum-campaign-sync writes
-- its media and followers under source 'instagram'), and the summary returns every campaign page on its own (landing_paths), so the
-- Legal AI pages are read one by one instead of only as a total. lalum_campaign_summary is otherwise unchanged from 20261026090000.
-- Named after the version it is recorded under in production.

alter table public.lalum_campaign_metrics_daily drop constraint if exists lalum_campaign_metrics_daily_source_check;
alter table public.lalum_campaign_metrics_daily add constraint lalum_campaign_metrics_daily_source_check
  check (source in ('gsc', 'cloudflare', 'facebook', 'instagram', 'meta_ads', 'internal', 'manual'));

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
    -- Each campaign page on its own (language prefix dropped), so a Legal AI page with no visits shows up as a row, not as a gap in the
    -- site-wide top 12: views and visits over Cloudflare's window and the one before, clicks and impressions over Search Console's.
    'landing_paths', coalesce((
      select jsonb_agg(jsonb_build_object('key', b, 'pageviews', coalesce(pv, 0), 'prev_pageviews', coalesce(ppv, 0), 'visits', coalesce(vi, 0),
                       'clicks', coalesce(c, 0), 'impressions', coalesce(i, 0)) order by pv desc nulls last, i desc nulls last, b)
        from (select public.lalum_campaign_base_path(m.key) b,
                     sum(m.value) filter (where m.source = 'cloudflare' and m.metric = 'pageviews' and m.day between v_cf - v_days + 1 and v_cf) pv,
                     sum(m.value) filter (where m.source = 'cloudflare' and m.metric = 'pageviews' and m.day between v_cf - 2 * v_days + 1 and v_cf - v_days) ppv,
                     sum(m.value) filter (where m.source = 'cloudflare' and m.metric = 'visits' and m.day between v_cf - v_days + 1 and v_cf) vi,
                     sum(m.value) filter (where m.source = 'gsc' and m.metric = 'clicks' and m.day between v_g - v_days + 1 and v_g) c,
                     sum(m.value) filter (where m.source = 'gsc' and m.metric = 'impressions' and m.day between v_g - v_days + 1 and v_g) i
                from public.lalum_campaign_metrics_daily m
               where m.day >= v_since
                 and ((m.source = 'gsc' and m.scope = 'page') or (m.source = 'cloudflare' and m.scope = 'path'))
                 and public.lalum_campaign_path_in(public.lalum_campaign_base_path(m.key), v_c.landing_prefixes)
               group by 1) x), '[]'::jsonb),
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
