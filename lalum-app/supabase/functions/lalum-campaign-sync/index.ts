// lalum-campaign-sync: Supabase Edge Function (Deno). pg_cron calls it once a day (migration 20261026090100) and the admin can run it
// from /workspace/campaigns. It reads each campaign source with its own read-only credential and writes daily numbers to
// lalum_campaign_metrics_daily, with one row per source in lalum_campaign_sync_runs. It is NOT deployed.
//
// Secrets (the owner pastes them into the Supabase function secrets; never in the repo, never in chat). A source whose secret is
// missing is logged as not_configured and the other sources still run:
//   GSC_SERVICE_ACCOUNT_JSON   optional. Without it Search Console is read from the file the search-console workflow commits each morning
//                              to the public branch data/search-console (daily site totals, page and query totals for 28 days), so this
//                              source works with no new secret. With it (a key of lalum-search-console@lalum-seo, read-only scope) the
//                              function asks the API itself and gets pages and queries per day.
//   GSC_SITE_URL               optional, default https://lalumapp.com/; GSC_PUBLIC_FILE_BASE optional, the raw URL of that folder
//   CF_ANALYTICS_TOKEN, CF_ACCOUNT_ID, CF_WEB_ANALYTICS_SITE_TAG   an API token with Account Analytics Read only
//   FB_READ_PAGE_TOKEN         a page token with pages_read_engagement and read_insights only. Never the publishing token.
//   FB_PAGE_ID (default 604003069451536), FB_GRAPH_VERSION (default v23.0),
//   FB_POST_INSIGHT_METRICS    optional, default post_media_view,post_impressions_unique; a metric Meta refuses is skipped and named in the run row
//   META_ADS_TOKEN, META_AD_ACCOUNT_ID   ads_read only. Until a paid campaign runs the ad panels stay empty.
// Gate: header x-lalum-worker (pg_cron), or a signed-in platform admin with a second factor (the refresh button), at most once in 10 minutes.
// ?dry=1 fetches and maps but writes nothing and returns counts with a small sample; ?only=gsc,facebook runs only those sources.
// Tokens go in headers, never in a URL, a response, a log line or a run row.
import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  type CfGroup, type FbPost, type GscFile, type GscRow, type MetaAdRow, type MetricRow, type RegistryPost, type Source,
  addDays, cfQuery, chunk, dayRange, israelDay, mapCf, mapFb, mapGsc, mapGscFiles, mapMetaAds, matchPosts, signJwt, windowFor,
} from "./map.ts";

const SOURCES: Source[] = ["gsc", "cloudflare", "facebook", "meta_ads", "internal"];
const COOLDOWN_MS = 10 * 60_000;
const CORS: Record<string, string> = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "authorization, x-client-info, apikey, content-type, x-lalum-worker",
  "access-control-allow-methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "content-type": "application/json" } });
const env = (k: string) => Deno.env.get(k) ?? "";

type Status = "ok" | "not_configured" | "token_failed" | "error";
class SourceError extends Error {
  constructor(readonly status: Status, message: string) { super(message); }
}
interface Outcome {
  source: Source; status: Status; rows: MetricRow[]; detail: Record<string, unknown>;
  /** Rows of these scopes are deleted first (within the days given, or all of them), for sources that restate totals rather than add days. */
  clear?: { scopes: string[]; from?: string; to?: string };
  after?: (sb: SupabaseClient) => Promise<number>;
}

async function getJson(url: string, init: RequestInit, what: string): Promise<Record<string, unknown>> {
  const res = await fetch(url, { ...init, signal: AbortSignal.timeout(25_000) });
  const body = await res.json().catch(() => ({})) as Record<string, unknown>;
  const err = body.error as { code?: number; message?: string } | string | undefined;
  if (!res.ok || err) {
    const code = typeof err === "object" ? err?.code : undefined;
    const msg = typeof err === "object" ? err?.message ?? "" : String(err ?? "");
    const auth = res.status === 401 || res.status === 403 || code === 190;
    throw new SourceError(auth ? "token_failed" : "error", `${what} ${res.status}${code ? " " + code : ""} ${msg}`.trim().slice(0, 200));
  }
  return body;
}

// ---- sources ---------------------------------------------------------------------------------------------------------------------------

const GSC_FILE_BASE = "https://raw.githubusercontent.com/lalomavi-collab/desktop-tutorial/refs/heads/data/search-console/data/search-console/";

/** The workflow's files: latest.json, and on the first run also the snapshots of 28, 56 and 84 days earlier for three months of daily totals. */
async function syncGscFile(firstRun: boolean): Promise<Outcome> {
  const base = env("GSC_PUBLIC_FILE_BASE") || GSC_FILE_BASE;
  if (!base.startsWith("https://raw.githubusercontent.com/")) throw new SourceError("error", "GSC_PUBLIC_FILE_BASE must be a raw.githubusercontent.com URL");
  const latest = await getJson(base + "latest.json", {}, "search console file") as GscFile;
  const files: GscFile[] = [latest];
  const fetched = (latest.fetchedAt ?? "").slice(0, 10);
  if (firstRun && /^\d{4}-\d{2}-\d{2}$/.test(fetched)) {
    for (const back of [28, 56, 84]) {
      try { files.push(await getJson(`${base}${addDays(fetched, -back)}.json`, {}, "search console file") as GscFile); } catch { /* that day's snapshot is missing: fine */ }
    }
  }
  const { rows, from, to } = mapGscFiles(files);
  if (!to) throw new SourceError("error", "search console file has no window");
  const stale = Date.now() - Date.parse((latest.fetchedAt ?? "1970-01-01")) > 3 * 86_400_000;
  return {
    source: "gsc", status: "ok", rows, clear: { scopes: ["page", "query"] },
    detail: { mode: "public_file", from, to, files: files.length, fetched_at: latest.fetchedAt ?? null, ...(stale ? { warning: "the workflow file is over 3 days old" } : {}) },
  };
}

async function syncGsc(win: { from: string; to: string }, firstRun: boolean): Promise<Outcome> {
  const raw = env("GSC_SERVICE_ACCOUNT_JSON");
  if (!raw) return syncGscFile(firstRun);
  let sa: { client_email: string; private_key: string };
  try { sa = JSON.parse(raw); } catch { throw new SourceError("token_failed", "GSC_SERVICE_ACCOUNT_JSON is not valid JSON"); }
  const assertion = await signJwt(sa, "https://www.googleapis.com/auth/webmasters.readonly");
  const tok = await getJson("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion }),
  }, "token");
  const site = encodeURIComponent(env("GSC_SITE_URL") || "https://lalumapp.com/");
  const query = async (dimensions: string[]): Promise<GscRow[]> => {
    const out: GscRow[] = [];
    for (let startRow = 0, page = 0; page < 4; page++, startRow += 25_000) {
      const body = await getJson(`https://searchconsole.googleapis.com/webmasters/v3/sites/${site}/searchAnalytics/query`, {
        method: "POST",
        headers: { authorization: `Bearer ${tok.access_token}`, "content-type": "application/json" },
        body: JSON.stringify({ startDate: win.from, endDate: win.to, dimensions, type: "web", rowLimit: 25_000, startRow }),
      }, "search analytics");
      const rows = (body.rows ?? []) as GscRow[];
      out.push(...rows);
      if (rows.length < 25_000) break;
    }
    return out;
  };
  const [site_, pages, queries] = await Promise.all([query(["date"]), query(["date", "page"]), query(["date", "query"])]);
  const rows = [...mapGsc("site", site_), ...mapGsc("page", pages), ...mapGsc("query", queries)];
  // Per-day rows replace whatever the file left in these days (its whole-window totals sit on one day).
  return { source: "gsc", status: "ok", rows, clear: { scopes: ["page", "query"], from: win.from, to: win.to }, detail: { mode: "api", ...win, days_with_data: site_.length } };
}

async function syncCloudflare(win: { from: string; to: string }): Promise<Outcome> {
  const token = env("CF_ANALYTICS_TOKEN"), account = env("CF_ACCOUNT_ID"), siteTag = env("CF_WEB_ANALYTICS_SITE_TAG");
  if (!token || !account || !siteTag) return { source: "cloudflare", status: "not_configured", rows: [], detail: { missing: "CF_ANALYTICS_TOKEN, CF_ACCOUNT_ID or CF_WEB_ANALYTICS_SITE_TAG" } };
  const paths: CfGroup[] = [], refs: CfGroup[] = [];
  // One UTC day per request: the adaptive datasets cap the time range a single query may cover.
  for (const day of dayRange(win.from, win.to)) {
    const body = await getJson("https://api.cloudflare.com/client/v4/graphql", {
      method: "POST",
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: JSON.stringify({ query: cfQuery(account, siteTag, day) }),
    }, "cloudflare");
    const errors = body.errors as Array<{ message?: string }> | null | undefined;
    if (errors?.length) {
      const msg = String(errors[0]?.message ?? "graphql error");
      throw new SourceError(/auth|permission|token/i.test(msg) ? "token_failed" : "error", `cloudflare ${msg}`.slice(0, 200));
    }
    const acct = ((body.data as { viewer?: { accounts?: Array<{ paths?: CfGroup[]; refs?: CfGroup[] }> } })?.viewer?.accounts ?? [])[0];
    paths.push(...(acct?.paths ?? []));
    refs.push(...(acct?.refs ?? []));
  }
  return { source: "cloudflare", status: "ok", rows: mapCf(paths, refs), detail: { ...win, path_groups: paths.length } };
}

async function syncFacebook(win: { from: string; to: string }, today: string): Promise<Outcome> {
  const token = env("FB_READ_PAGE_TOKEN");
  if (!token) return { source: "facebook", status: "not_configured", rows: [], detail: { missing: "FB_READ_PAGE_TOKEN" } };
  const ver = /^v\d+\.\d+$/.test(env("FB_GRAPH_VERSION")) ? env("FB_GRAPH_VERSION") : "v23.0";
  const pageId = /^\d+$/.test(env("FB_PAGE_ID")) ? env("FB_PAGE_ID") : "604003069451536";
  const headers = { authorization: `Bearer ${token}` };
  const graph = (path: string, params: Record<string, string>) =>
    getJson(`https://graph.facebook.com/${ver}/${path}?${new URLSearchParams(params)}`, { headers }, "graph");

  const posts: FbPost[] = [];
  let body = await graph(`${pageId}/published_posts`, {
    fields: "id,message,permalink_url,created_time,shares,reactions.summary(total_count).limit(0),comments.summary(total_count).limit(0)",
    since: String(Math.floor(Date.parse(win.from + "T00:00:00Z") / 1000)),
    limit: "50",
  });
  for (let page = 0; page < 5; page++) {
    posts.push(...((body.data ?? []) as FbPost[]));
    const next = (body.paging as { next?: string } | undefined)?.next;
    if (!next || !next.startsWith("https://graph.facebook.com/")) break;
    body = await getJson(next, { headers }, "graph");
  }
  const page = await graph(pageId, { fields: "followers_count" });
  const followers = typeof page.followers_count === "number" ? page.followers_count : null;

  // Post insights need read_insights, and Meta renames these metrics from time to time: a metric it refuses is dropped for the run.
  const wanted = (env("FB_POST_INSIGHT_METRICS") || "post_media_view,post_impressions_unique").split(",").map((m) => m.trim()).filter((m) => /^[a-z_]+$/.test(m));
  const unsupported = new Set<string>();
  const insights: Record<string, Record<string, number>> = {};
  for (const group of chunk(posts, 4)) {
    await Promise.all(group.map(async (p) => {
      for (const m of wanted) {
        if (unsupported.has(m)) continue;
        try {
          const r = await graph(`${p.id}/insights`, { metric: m });
          const v = ((r.data ?? []) as Array<{ name?: string; values?: Array<{ value?: unknown }> }>)[0]?.values?.[0]?.value;
          const n = typeof v === "number" ? v : v && typeof v === "object" ? Object.values(v as Record<string, number>).reduce((a, b) => a + (Number(b) || 0), 0) : null;
          if (n != null) (insights[p.id] ??= {})[m] = n;
        } catch (e) {
          if (e instanceof SourceError && e.status === "token_failed") throw e;
          unsupported.add(m);
        }
      }
    }));
  }

  const after = async (sb: SupabaseClient) => {
    const { data, error } = await sb.from("lalum_campaign_posts").select("id, external_id, match_prefix").eq("platform", "facebook");
    if (error) throw new Error(`read posts ${error.code}`);
    const { links, adds } = matchPosts((data ?? []) as RegistryPost[], posts);
    for (const l of links) {
      const { error: e } = await sb.from("lalum_campaign_posts").update({ external_id: l.external_id, permalink: l.permalink, published_at: l.published_at }).eq("id", l.rowId);
      if (e) throw new Error(`link post ${e.code}`);
    }
    if (adds.length) {
      const { error: e } = await sb.from("lalum_campaign_posts").upsert(adds.map((a) => ({ platform: "facebook", ...a })), { onConflict: "platform,external_id", ignoreDuplicates: true });
      if (e) throw new Error(`add posts ${e.code}`);
    }
    return links.length + adds.length;
  };
  return {
    source: "facebook", status: "ok", rows: mapFb(today, posts, followers, insights), after,
    detail: { ...win, posts: posts.length, insights_skipped: [...unsupported] },
  };
}

async function syncMetaAds(win: { from: string; to: string }): Promise<Outcome> {
  const token = env("META_ADS_TOKEN"), account = env("META_AD_ACCOUNT_ID").replace(/^act_/, "");
  if (!token || !account) return { source: "meta_ads", status: "not_configured", rows: [], detail: { missing: "META_ADS_TOKEN or META_AD_ACCOUNT_ID" } };
  if (!/^\d{5,20}$/.test(account)) throw new SourceError("error", "META_AD_ACCOUNT_ID is not a numeric account id");
  const ver = /^v\d+\.\d+$/.test(env("FB_GRAPH_VERSION")) ? env("FB_GRAPH_VERSION") : "v23.0";
  const headers = { authorization: `Bearer ${token}` };
  const acct = await getJson(`https://graph.facebook.com/${ver}/act_${account}?fields=currency`, { headers }, "ads");
  const rows: MetaAdRow[] = [];
  let url: string | undefined = `https://graph.facebook.com/${ver}/act_${account}/insights?${new URLSearchParams({
    level: "campaign", time_increment: "1", limit: "500",
    fields: "campaign_name,spend,impressions,clicks,reach,actions",
    time_range: JSON.stringify({ since: win.from, until: win.to }),
  })}`;
  for (let page = 0; url && page < 10; page++) {
    const body = await getJson(url, { headers }, "ads");
    rows.push(...((body.data ?? []) as MetaAdRow[]));
    const next = (body.paging as { next?: string } | undefined)?.next;
    url = next && next.startsWith("https://graph.facebook.com/") ? next : undefined;
  }
  return { source: "meta_ads", status: "ok", rows: mapMetaAds(rows), detail: { ...win, currency: acct.currency ?? null, ad_rows: rows.length } };
}

async function syncInternal(sb: SupabaseClient, win: { from: string; to: string }, dry: boolean): Promise<Outcome> {
  const { data, error } = await sb.rpc("lalum_campaign_refresh_internal", { p_from: win.from, p_dry: dry });
  if (error) throw new SourceError("error", `refresh internal ${error.code}`);
  return { source: "internal", status: "ok", rows: [], detail: { ...win, ...(data as Record<string, unknown>) } };
}

// ---- gate and run ----------------------------------------------------------------------------------------------------------------------

async function allowed(sb: SupabaseClient, req: Request): Promise<"worker" | "admin" | Response> {
  const workerKey = req.headers.get("x-lalum-worker");
  if (workerKey) {
    const { data } = await sb.rpc("lalum_verify_worker_key", { p_key: workerKey });
    return data === true ? "worker" : json({ ok: false }, 403);
  }
  const auth = req.headers.get("authorization") ?? "";
  const jwt = auth.replace(/^Bearer\s+/i, "");
  if (!jwt) return json({ ok: false, code: "unauthorized" }, 401);
  const { data: who } = await sb.auth.getUser(jwt);
  if (!who?.user) return json({ ok: false, code: "unauthorized" }, 401);
  const asUser = createClient(env("SUPABASE_URL"), env("SUPABASE_ANON_KEY"), { global: { headers: { Authorization: `Bearer ${jwt}` } }, auth: { persistSession: false } });
  const [{ data: admin }, { data: mfa }] = await Promise.all([asUser.rpc("lalum_is_admin"), asUser.rpc("lalum_mfa_ok")]);
  return admin === true && mfa === true ? "admin" : json({ ok: false, code: "forbidden" }, 403);
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ ok: false, code: "method_not_allowed" }, 405);
  const sb = createClient(env("SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"), { auth: { persistSession: false } });
  const who = await allowed(sb, req);
  if (who instanceof Response) return who;

  const params = new URL(req.url).searchParams;
  const dry = params.get("dry") === "1";
  const only = (params.get("only") ?? "").split(",").filter((s): s is Source => (SOURCES as string[]).includes(s));
  const sources = only.length ? only : SOURCES;

  if (who === "admin" && !dry) {
    const { data: last } = await sb.from("lalum_campaign_sync_runs").select("ran_at").order("ran_at", { ascending: false }).limit(1).maybeSingle();
    const since = last?.ran_at ? Date.now() - Date.parse(last.ran_at) : Infinity;
    if (since < COOLDOWN_MS) return json({ ok: false, code: "cooldown", retry_in_s: Math.ceil((COOLDOWN_MS - since) / 1000) }, 429);
  }

  const today = israelDay(new Date());
  const { data: okRuns } = await sb.from("lalum_campaign_sync_runs").select("source").eq("status", "ok").in("source", sources);
  const hadOk = new Set((okRuns ?? []).map((r: { source: string }) => r.source));

  const outcomes = await Promise.all(sources.map(async (source): Promise<Outcome> => {
    const win = windowFor(source, !hadOk.has(source), today);
    try {
      switch (source) {
        case "gsc": return await syncGsc(win, !hadOk.has(source));
        case "cloudflare": return await syncCloudflare(win);
        case "facebook": return await syncFacebook(win, today);
        case "meta_ads": return await syncMetaAds(win);
        case "internal": return await syncInternal(sb, win, dry);
      }
    } catch (e) {
      const status: Status = e instanceof SourceError ? e.status : "error";
      return { source, status, rows: [], detail: { ...win, error: String((e as Error)?.message ?? e).slice(0, 200) } };
    }
  }));

  const report: Record<string, unknown> = {};
  for (const o of outcomes) {
    let written = o.source === "internal" ? Number(o.detail.rows ?? 0) : o.rows.length;
    let status = o.status;
    const detail = { ...o.detail };
    if (!dry && o.status === "ok") {
      try {
        const synced_at = new Date().toISOString();
        if (o.clear) {
          let q = sb.from("lalum_campaign_metrics_daily").delete().eq("source", o.source).in("scope", o.clear.scopes);
          if (o.clear.from) q = q.gte("day", o.clear.from);
          if (o.clear.to) q = q.lte("day", o.clear.to);
          const { error } = await q;
          if (error) throw new Error(`clear ${error.code}`);
        }
        for (const part of chunk(o.rows, 1000)) {
          const { error } = await sb.from("lalum_campaign_metrics_daily").upsert(part.map((r) => ({ ...r, synced_at })), { onConflict: "day,source,scope,key,metric" });
          if (error) throw new Error(`write ${error.code}`);
        }
        if (o.after) detail.posts_linked_or_added = await o.after(sb);
      } catch (e) {
        status = "error";
        written = 0;
        detail.error = String((e as Error)?.message ?? e).slice(0, 200);
      }
    }
    if (!dry) {
      const { error } = await sb.from("lalum_campaign_sync_runs").insert({ source: o.source, status, rows_written: written, detail });
      if (error) console.error("run log", o.source, error.code);
    }
    report[o.source] = { status, rows: written, ...detail, ...(dry ? { sample: o.rows.slice(0, 5) } : {}) };
  }
  return json({ ok: true, dry, by: who, today, sources: report });
});
