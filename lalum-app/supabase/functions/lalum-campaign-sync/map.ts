// Pure part of lalum-campaign-sync: API answers in, metric rows out. No Deno API and no network, so scripts/campaign-sync-check.mjs
// runs it under Node. Every row is one number for one day, source, scope, key and metric, the shape of lalum_campaign_metrics_daily.

export type Source = "gsc" | "cloudflare" | "facebook" | "instagram" | "meta_ads" | "internal";
export type Scope = "site" | "page" | "query" | "path" | "referrer" | "post" | "paid";
export interface MetricRow { day: string; source: Source; scope: Scope; key: string; metric: string; value: number }

const DAY_MS = 86_400_000;
export const isoDay = (d: Date) => d.toISOString().slice(0, 10);
export const addDays = (day: string, n: number) => isoDay(new Date(Date.parse(day + "T00:00:00Z") + n * DAY_MS));
/** Today in Israel, the day the owner reads the dashboard on. */
export const israelDay = (d: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jerusalem" }).format(d);

/** Every day from `from` to `to`, both included. */
export function dayRange(from: string, to: string): string[] {
  const out: string[] = [];
  for (let d = from; d <= to && out.length < 400; d = addDays(d, 1)) out.push(d);
  return out;
}

/** How far back each source reads. The first successful run backfills; later runs re-read a few days, because Search Console and
 *  Meta still revise recent days. Search Console and Cloudflare stop at yesterday: today is not over. */
export function windowFor(source: Source, firstRun: boolean, today: string): { from: string; to: string } {
  const back: Record<Source, [number, number]> = { gsc: [90, 10], cloudflare: [28, 3], facebook: [90, 90], instagram: [90, 90], meta_ads: [90, 7], internal: [180, 3] };
  const [first, later] = back[source];
  const to = source === "internal" || source === "facebook" || source === "instagram" ? today : addDays(today, -1);
  return { from: addDays(to, -((firstRun ? first : later) - 1)), to };
}

/** A page as one key: no origin, query or fragment, escapes decoded, lower case, no trailing slash except on the root. */
export function normPath(u: string): string {
  let p = (u ?? "").trim();
  if (/^https?:\/\//i.test(p)) { try { p = new URL(p).pathname; } catch { /* keep it as given */ } }
  p = p.split(/[?#]/)[0] ?? "";
  try { p = decodeURIComponent(p); } catch { /* malformed escape: keep the raw text */ }
  if (!p.startsWith("/")) p = "/" + p;
  p = p.replace(/\/{2,}/g, "/").toLowerCase();
  if (p.length > 1) p = p.replace(/\/+$/, "");
  return (p || "/").slice(0, 300);
}

/** A referring host: lower case, no www, no port. Cloudflare reports a visit with no referrer as an empty host. */
export function normHost(h: string | null | undefined): string {
  const x = (h ?? "").trim().toLowerCase().replace(/:\d+$/, "").replace(/^www\./, "");
  return x ? x.slice(0, 200) : "(direct)";
}

/** Sums rows that land on the same key (two URLs that normalise to one path, a query in two cases). */
export function mergeRows(rows: MetricRow[]): MetricRow[] {
  const m = new Map<string, MetricRow>();
  for (const r of rows) {
    if (!Number.isFinite(r.value)) continue;
    const k = `${r.day}|${r.source}|${r.scope}|${r.key}|${r.metric}`;
    const had = m.get(k);
    if (had) had.value += r.value;
    else m.set(k, { ...r });
  }
  return [...m.values()].map((r) => ({ ...r, value: Math.round(r.value * 10_000) / 10_000 }));
}

export function chunk<T>(a: T[], n: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < a.length; i += n) out.push(a.slice(i, i + n));
  return out;
}

// ---- Search Console -------------------------------------------------------------------------------------------------------------------

export interface GscRow { keys?: string[]; clicks?: number; impressions?: number; position?: number }

/** Position is an average, so it is kept as position times impressions: summed over days and divided by summed impressions it gives
 *  the impression-weighted average the Search Console report shows. */
export function mapGsc(kind: "site" | "page" | "query", rows: GscRow[]): MetricRow[] {
  const out: MetricRow[] = [];
  for (const r of rows) {
    const day = r.keys?.[0];
    if (!day || !/^\d{4}-\d{2}-\d{2}$/.test(day)) continue;
    const scope: Scope = kind;
    const key = kind === "site" ? "" : kind === "page" ? normPath(r.keys?.[1] ?? "") : (r.keys?.[1] ?? "").trim().toLowerCase().slice(0, 200);
    if (kind === "query" && !key) continue;
    const clicks = Number(r.clicks ?? 0), impressions = Number(r.impressions ?? 0), position = Number(r.position ?? 0);
    out.push({ day, source: "gsc", scope, key, metric: "clicks", value: clicks });
    out.push({ day, source: "gsc", scope, key, metric: "impressions", value: impressions });
    if (impressions > 0 && position > 0) out.push({ day, source: "gsc", scope, key, metric: "pos_x_impr", value: position * impressions });
  }
  return mergeRows(out);
}

/** The file the Search Console workflow commits every morning to the public data branch: daily site totals for its window, and page
 *  and query totals for the whole window. Used while the function has no key of its own, so this source needs no new secret.
 *  Files come newest first; a day present in two files takes the newer one. Page and query totals have no day, so they are kept on
 *  the newest window's last day, and the caller clears the previous ones before writing (otherwise windows would add up). */
export interface GscFile { fetchedAt?: string; window?: { start?: string; end?: string }; dates?: GscRow[]; pages?: GscRow[]; queries?: GscRow[] }
export function mapGscFiles(files: GscFile[]): { rows: MetricRow[]; from: string | null; to: string | null } {
  const newest = files.find((f) => f.window?.end && /^\d{4}-\d{2}-\d{2}$/.test(f.window.end));
  if (!newest) return { rows: [], from: null, to: null };
  const seen = new Set<string>();
  const daily: GscRow[] = [];
  for (const f of files) {
    for (const r of f.dates ?? []) {
      const day = r.keys?.[0];
      if (!day || seen.has(day)) continue;
      seen.add(day);
      daily.push(r);
    }
  }
  const end = newest.window!.end as string;
  const atEnd = (rows: GscRow[] | undefined) => (rows ?? []).map((r) => ({ ...r, keys: [end, r.keys?.[0] ?? ""] }));
  const rows = [...mapGsc("site", daily), ...mapGsc("page", atEnd(newest.pages)), ...mapGsc("query", atEnd(newest.queries))];
  const days = [...seen].sort();
  return { rows, from: days[0] ?? null, to: days[days.length - 1] ?? null };
}

// ---- Cloudflare Web Analytics ---------------------------------------------------------------------------------------------------------

export interface CfGroup { count?: number; sum?: { visits?: number }; dimensions?: { date?: string; requestPath?: string; refererHost?: string } }

/** Page views and visits per path, the site totals summed from them (a visit belongs to the one page view that began it, so the sum is
 *  the site's visits), and visits per referring host. */
export function mapCf(paths: CfGroup[], refs: CfGroup[]): MetricRow[] {
  const out: MetricRow[] = [];
  for (const g of paths) {
    const day = g.dimensions?.date;
    if (!day) continue;
    const key = normPath(g.dimensions?.requestPath ?? "/");
    const pv = Number(g.count ?? 0), vi = Number(g.sum?.visits ?? 0);
    out.push({ day, source: "cloudflare", scope: "path", key, metric: "pageviews", value: pv });
    out.push({ day, source: "cloudflare", scope: "path", key, metric: "visits", value: vi });
    out.push({ day, source: "cloudflare", scope: "site", key: "", metric: "pageviews", value: pv });
    out.push({ day, source: "cloudflare", scope: "site", key: "", metric: "visits", value: vi });
  }
  for (const g of refs) {
    const day = g.dimensions?.date;
    if (!day) continue;
    const vi = Number(g.sum?.visits ?? 0);
    if (vi > 0) out.push({ day, source: "cloudflare", scope: "referrer", key: normHost(g.dimensions?.refererHost), metric: "visits", value: vi });
  }
  return mergeRows(out);
}

/** The GraphQL query for one UTC day. The ids are checked to be hex before they reach the text, so nothing else can be injected. */
export function cfQuery(accountTag: string, siteTag: string, day: string): string {
  // The error names the secret and its length, never its value, so a bad paste can be fixed without guessing which one.
  if (!/^[a-f0-9]{32}$/i.test(accountTag)) throw new Error(`bad CF_ACCOUNT_ID: ${accountTag.length} chars, expected 32 hex`);
  if (!/^[a-f0-9]{32}$/i.test(siteTag)) throw new Error(`bad CF_WEB_ANALYTICS_SITE_TAG: ${siteTag.length} chars, expected 32 hex`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) throw new Error("bad cloudflare day");
  const filter = `{AND: [{datetime_geq: "${day}T00:00:00Z", datetime_lt: "${addDays(day, 1)}T00:00:00Z"}, {siteTag: "${siteTag}"}]}`;
  return `query { viewer { accounts(filter: {accountTag: "${accountTag}"}) {
  paths: rumPageloadEventsAdaptiveGroups(limit: 5000, orderBy: [count_DESC], filter: ${filter}) { count sum { visits } dimensions { date requestPath } }
  refs: rumPageloadEventsAdaptiveGroups(limit: 1000, orderBy: [count_DESC], filter: ${filter}) { count sum { visits } dimensions { date refererHost } }
} } }`;
}

// ---- Facebook page --------------------------------------------------------------------------------------------------------------------

export interface FbPost {
  id: string; message?: string; permalink_url?: string; created_time?: string;
  shares?: { count?: number }; reactions?: { summary?: { total_count?: number } }; comments?: { summary?: { total_count?: number } };
}

/** An insight value is a number, or for some metrics an object of numbers by type; the object counts as its sum. */
export function insightValue(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (v && typeof v === "object") {
    const nums = Object.values(v as Record<string, unknown>).filter((x): x is number => typeof x === "number" && Number.isFinite(x));
    return nums.length ? nums.reduce((a, b) => a + b, 0) : null;
  }
  return null;
}

/** Running totals of each post as of `day`, the page's followers, and post insights under ins_<metric>. */
export function mapFb(day: string, posts: FbPost[], followers: number | null, insights: Record<string, Record<string, number>>): MetricRow[] {
  const out: MetricRow[] = [];
  for (const p of posts) {
    if (!p.id) continue;
    out.push({ day, source: "facebook", scope: "post", key: p.id, metric: "reactions", value: Number(p.reactions?.summary?.total_count ?? 0) });
    out.push({ day, source: "facebook", scope: "post", key: p.id, metric: "comments", value: Number(p.comments?.summary?.total_count ?? 0) });
    out.push({ day, source: "facebook", scope: "post", key: p.id, metric: "shares", value: Number(p.shares?.count ?? 0) });
    for (const [m, v] of Object.entries(insights[p.id] ?? {})) out.push({ day, source: "facebook", scope: "post", key: p.id, metric: `ins_${m}`, value: v });
  }
  if (followers != null && Number.isFinite(followers)) out.push({ day, source: "facebook", scope: "site", key: "", metric: "followers", value: followers });
  return mergeRows(out);
}

/** Text compared without spaces, punctuation, symbols, marks or format characters (an emoji with its variation selector, niqqud, a
 *  direction mark) and without case, so a quote mark or an emoji added on Facebook still matches. */
export const normText = (s: string) => (s ?? "").normalize("NFC").toLowerCase().replace(/[\s\p{P}\p{S}\p{M}\p{Cf}]+/gu, "");

export interface RegistryPost { id: number; external_id: string | null; match_prefix: string | null }
export interface PostLink { rowId: number; external_id: string; permalink: string | null; published_at: string | null }
export interface PostAdd { external_id: string; permalink: string | null; published_at: string | null; title: string | null }

/** Ties published posts to the registry. A row with the post's id is refreshed; a row without an id takes the earliest post whose text
 *  begins with its opening words (a repost of the same text later does not steal it); any other post is added outside the campaign. */
export function matchPosts(registry: RegistryPost[], posts: FbPost[]): { links: PostLink[]; adds: PostAdd[] } {
  const links: PostLink[] = [], adds: PostAdd[] = [];
  const byId = new Map(registry.filter((r) => r.external_id).map((r) => [r.external_id as string, r]));
  const open = registry.filter((r) => !r.external_id && r.match_prefix && normText(r.match_prefix).length >= 8);
  const taken = new Set<number>();
  const sorted = [...posts].filter((p) => p.id).sort((a, b) => (a.created_time ?? "").localeCompare(b.created_time ?? ""));
  for (const p of sorted) {
    const base = { permalink: p.permalink_url ?? null, published_at: p.created_time ?? null };
    const known = byId.get(p.id);
    if (known) { links.push({ rowId: known.id, external_id: p.id, ...base }); continue; }
    const text = normText(p.message ?? "");
    const hit = text ? open.find((r) => !taken.has(r.id) && text.startsWith(normText(r.match_prefix as string))) : undefined;
    if (hit) { taken.add(hit.id); links.push({ rowId: hit.id, external_id: p.id, ...base }); continue; }
    const first = (p.message ?? "").split("\n").map((l) => l.trim()).find(Boolean) ?? null;
    adds.push({ external_id: p.id, ...base, title: first ? first.slice(0, 120) : null });
  }
  return { links, adds };
}

// ---- Instagram professional account -----------------------------------------------------------------------------------------------------

export interface IgMedia {
  id: string; caption?: string; permalink?: string; timestamp?: string; like_count?: number; comments_count?: number;
  media_type?: string; media_product_type?: string;
}

/** Running totals of each media as of `day` (likes under reactions, so one column of the posts table reads both networks), the
 *  account's followers, and media insights under ins_<metric>. A hidden like count comes back missing and counts as zero. */
export function mapIg(day: string, media: IgMedia[], followers: number | null, insights: Record<string, Record<string, number>>): MetricRow[] {
  const out: MetricRow[] = [];
  for (const m of media) {
    if (!m.id) continue;
    out.push({ day, source: "instagram", scope: "post", key: m.id, metric: "reactions", value: Number(m.like_count ?? 0) });
    out.push({ day, source: "instagram", scope: "post", key: m.id, metric: "comments", value: Number(m.comments_count ?? 0) });
    for (const [k, v] of Object.entries(insights[m.id] ?? {})) out.push({ day, source: "instagram", scope: "post", key: m.id, metric: `ins_${k}`, value: v });
  }
  if (followers != null && Number.isFinite(followers)) out.push({ day, source: "instagram", scope: "site", key: "", metric: "followers", value: followers });
  return mergeRows(out);
}

export interface IgKnown { id: number; external_id: string | null; post_no: number | null; campaign_code: string | null }
export interface IgTemplate { campaign_code: string; post_no: number; match_prefix: string }
export interface IgAdd extends PostAdd { campaign_code: string | null; post_no: number | null }

/** Instagram posts are published by hand with the campaign's text, so a new one is tied to the campaign by the opening words of a
 *  campaign post on Facebook and takes that post's number, once (the earliest media wins, as on Facebook). Known media are refreshed;
 *  any other media is added outside the campaign. */
export function matchIg(known: IgKnown[], templates: IgTemplate[], media: IgMedia[]): { links: PostLink[]; adds: IgAdd[] } {
  const links: PostLink[] = [], adds: IgAdd[] = [];
  const byId = new Map(known.filter((r) => r.external_id).map((r) => [r.external_id as string, r]));
  const slot = (code: string | null, no: number | null) => `${code ?? ""}|${no ?? ""}`;
  const taken = new Set(known.filter((r) => r.post_no != null).map((r) => slot(r.campaign_code, r.post_no)));
  const open = templates.filter((t) => normText(t.match_prefix).length >= 8);
  const sorted = [...media].filter((m) => m.id).sort((a, b) => (a.timestamp ?? "").localeCompare(b.timestamp ?? ""));
  for (const m of sorted) {
    const base = { permalink: m.permalink ?? null, published_at: m.timestamp ?? null };
    const had = byId.get(m.id);
    if (had) { links.push({ rowId: had.id, external_id: m.id, ...base }); continue; }
    const text = normText(m.caption ?? "");
    const hit = text ? open.find((t) => !taken.has(slot(t.campaign_code, t.post_no)) && text.startsWith(normText(t.match_prefix))) : undefined;
    if (hit) taken.add(slot(hit.campaign_code, hit.post_no));
    const first = (m.caption ?? "").split("\n").map((l) => l.trim()).find(Boolean) ?? null;
    adds.push({ external_id: m.id, ...base, title: first ? first.slice(0, 120) : null, campaign_code: hit?.campaign_code ?? null, post_no: hit?.post_no ?? null });
  }
  return { links, adds };
}

// ---- Meta ad account ------------------------------------------------------------------------------------------------------------------

export interface MetaAdRow {
  date_start?: string; campaign_name?: string; spend?: string | number; impressions?: string | number; clicks?: string | number;
  reach?: string | number; actions?: Array<{ action_type?: string; value?: string | number }>;
}

// Meta reports one lead under several names; the first one present is the count, so a lead is never counted twice.
const LEAD_ACTIONS = ["lead", "onsite_conversion.lead_grouped", "offsite_conversion.fb_pixel_lead", "onsite_web_lead"];
export function leadsOf(actions: MetaAdRow["actions"]): number {
  for (const t of LEAD_ACTIONS) {
    const a = (actions ?? []).find((x) => x.action_type === t);
    if (a) return Number(a.value ?? 0) || 0;
  }
  return 0;
}

/** Per ad campaign per day, and the account totals per day (reach is not added up: one person reached by two campaigns is one person). */
export function mapMetaAds(rows: MetaAdRow[]): MetricRow[] {
  const out: MetricRow[] = [];
  for (const r of rows) {
    const day = r.date_start;
    if (!day || !/^\d{4}-\d{2}-\d{2}$/.test(day)) continue;
    const key = (r.campaign_name ?? "").trim().slice(0, 120) || "(ללא שם)";
    const vals: Record<string, number> = {
      spend: Number(r.spend ?? 0) || 0, impressions: Number(r.impressions ?? 0) || 0, clicks: Number(r.clicks ?? 0) || 0, leads: leadsOf(r.actions),
    };
    for (const [metric, value] of Object.entries(vals)) {
      out.push({ day, source: "meta_ads", scope: "paid", key, metric, value });
      out.push({ day, source: "meta_ads", scope: "site", key: "", metric, value });
    }
    const reach = Number(r.reach ?? 0) || 0;
    if (reach > 0) out.push({ day, source: "meta_ads", scope: "paid", key, metric: "reach", value: reach });
  }
  return mergeRows(out);
}

// ---- Google service account sign-in --------------------------------------------------------------------------------------------------

export function b64url(data: Uint8Array | string): string {
  const bytes = typeof data === "string" ? new TextEncoder().encode(data) : data;
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function pemToDer(pem: string): Uint8Array {
  const body = pem.replace(/\\n/g, "\n").replace(/-----(BEGIN|END) PRIVATE KEY-----/g, "").replace(/\s+/g, "");
  const bin = atob(body);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/** A signed JWT the Google token endpoint exchanges for an access token (RS256, one hour). */
export async function signJwt(sa: { client_email: string; private_key: string }, scope: string, nowMs = Date.now()): Promise<string> {
  const iat = Math.floor(nowMs / 1000);
  const head = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claims = b64url(JSON.stringify({ iss: sa.client_email, scope, aud: "https://oauth2.googleapis.com/token", iat, exp: iat + 3600 }));
  const key = await crypto.subtle.importKey("pkcs8", pemToDer(sa.private_key), { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"]);
  const sig = new Uint8Array(await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(`${head}.${claims}`)));
  return `${head}.${claims}.${b64url(sig)}`;
}
