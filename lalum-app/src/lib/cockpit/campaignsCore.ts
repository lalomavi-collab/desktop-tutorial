// The campaign dashboard's arithmetic: parses lalum_campaign_summary and turns its daily rows into the windows, comparisons, funnel and
// channels the screen draws. Each source is read over its own last days, because Search Console lags two to three days behind the others.
// A source that never delivered a number shows as not connected, never as zero. Pure: covered by campaign-sync-check.

const n = (v: unknown): number => (v == null || v === "" ? 0 : Number(v) || 0);
const obj = (v: unknown): Record<string, unknown> | null => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null);
const arr = (v: unknown): Record<string, unknown>[] => (Array.isArray(v) ? v.map(obj).filter((x): x is Record<string, unknown> => !!x) : []);
const str = (v: unknown): string => (v == null ? "" : String(v));

export type SourceId = "gsc" | "cloudflare" | "facebook" | "meta_ads" | "internal" | "manual";
export interface DayRow { day: string; source: string; metric: string; value: number; key?: string }
export interface CampaignPost {
  postNo: number | null; platform: string; title: string; permalink: string | null; publishedAt: string | null;
  linked: boolean; inCampaign: boolean; asOf: string | null; metrics: Record<string, number>;
}
export interface Run { source: string; status: string; ranAt: string | null; rows: number; error: string | null; lastOkAt: string | null; mode: string | null; warning: string | null }
export interface CampaignSummary {
  campaign: { code: string; name: string; startsOn: string; landingPrefixes: string[] } | null;
  today: string; days: number; maxDay: Partial<Record<SourceId, string>>;
  site: DayRow[]; landing: DayRow[]; steps: Array<{ day: string; step: string; value: number }>; paid: DayRow[];
  queries: Array<{ key: string; clicks: number; impressions: number; position: number | null }>;
  pagesGsc: Array<{ key: string; clicks: number; impressions: number; campaign: boolean }>;
  pathsCf: Array<{ key: string; pageviews: number; visits: number; campaign: boolean }>;
  referrers: Array<{ key: string; cur: number; prev: number }>;
  leadPaths: Array<{ key: string; leads: number }>;
  posts: CampaignPost[]; runs: Run[];
}

const dayRows = (v: unknown): DayRow[] => arr(v).map((r) => ({ day: str(r.day), source: str(r.source), metric: str(r.metric), value: n(r.value), ...(r.key != null ? { key: str(r.key) } : {}) }));

/** lalum_campaign_summary(code, days). Null for a caller who is not the admin. */
export function parseSummary(j: unknown): CampaignSummary | null {
  const o = obj(j);
  if (!o) return null;
  const c = obj(o.campaign);
  const max = obj(o.max_day) ?? {};
  return {
    campaign: c ? { code: str(c.code), name: str(c.name), startsOn: str(c.starts_on), landingPrefixes: Array.isArray(c.landing_prefixes) ? c.landing_prefixes.map(str) : [] } : null,
    today: str(o.today), days: n(o.days) || 28,
    maxDay: Object.fromEntries(Object.entries(max).filter(([, v]) => typeof v === "string")) as Partial<Record<SourceId, string>>,
    site: dayRows(o.site), landing: dayRows(o.landing), paid: dayRows(o.paid),
    steps: arr(o.steps).map((r) => ({ day: str(r.day), step: str(r.step), value: n(r.value) })),
    queries: arr(o.queries).map((r) => ({ key: str(r.key), clicks: n(r.clicks), impressions: n(r.impressions), position: r.position == null ? null : n(r.position) })),
    pagesGsc: arr(o.pages_gsc).map((r) => ({ key: str(r.key), clicks: n(r.clicks), impressions: n(r.impressions), campaign: r.campaign === true })),
    pathsCf: arr(o.paths_cf).map((r) => ({ key: str(r.key), pageviews: n(r.pageviews), visits: n(r.visits), campaign: r.campaign === true })),
    referrers: arr(o.referrers).map((r) => ({ key: str(r.key), cur: n(r.cur), prev: n(r.prev) })),
    leadPaths: arr(o.lead_paths).map((r) => ({ key: str(r.key), leads: n(r.leads) })),
    posts: arr(o.posts).map((r) => ({
      postNo: r.post_no == null ? null : n(r.post_no), platform: str(r.platform), title: str(r.title), permalink: r.permalink ? str(r.permalink) : null,
      publishedAt: r.published_at ? str(r.published_at) : null, linked: r.linked === true, inCampaign: r.in_campaign === true,
      asOf: r.as_of ? str(r.as_of) : null,
      metrics: Object.fromEntries(Object.entries(obj(r.metrics) ?? {}).map(([k, v]) => [k, n(v)])),
    })),
    runs: arr(o.runs).map((r) => ({ source: str(r.source), status: str(r.status), ranAt: r.ran_at ? str(r.ran_at) : null, rows: n(r.rows), error: r.error ? str(r.error) : null, lastOkAt: r.last_ok_at ? str(r.last_ok_at) : null, mode: r.mode ? str(r.mode) : null, warning: r.warning ? str(r.warning) : null })),
  };
}

// ---- days and windows -----------------------------------------------------------------------------------------------------------------

export const addDays = (day: string, k: number): string => new Date(Date.parse(day + "T00:00:00Z") + k * 86_400_000).toISOString().slice(0, 10);
export const shortDay = (day: string): string => `${Number(day.slice(8, 10))}.${Number(day.slice(5, 7))}`;
export interface Win { from: string; to: string; pfrom: string; pto: string }
export const windowEnding = (to: string, days: number): Win => ({ from: addDays(to, -(days - 1)), to, pfrom: addDays(to, -(2 * days - 1)), pto: addDays(to, -days) });

/** The window a source is read over: it ends on that source's last day with data (yesterday for a source that has none). */
export function windowOf(s: CampaignSummary, source: SourceId): Win {
  const fallback = source === "internal" || source === "manual" ? s.today : addDays(s.today, -1);
  return windowEnding(s.maxDay[source] ?? fallback, s.days);
}

export const connected = (s: CampaignSummary, source: SourceId): boolean => Boolean(s.maxDay[source]) || s.runs.some((r) => r.source === source && r.status === "ok");

export function sumRows(rows: DayRow[], source: string, metrics: string[], from: string, to: string): number {
  let t = 0;
  for (const r of rows) if (r.source === source && metrics.includes(r.metric) && r.day >= from && r.day <= to) t += r.value;
  return t;
}

/** Percent change, or null when there is nothing to compare with. */
export const pct = (cur: number, prev: number): number | null => (prev > 0 ? Math.round(((cur - prev) / prev) * 100) : null);

export const REQUEST_METRICS = ["bookings", "consultations", "leads", "site_leads"];

export interface Kpi { key: string; label: string; cur: number | null; prev: number | null; delta: number | null; note: string; money?: boolean; empty?: string }

/** The strip of headline numbers. cur is null when its source is not connected yet. */
export function kpis(s: CampaignSummary): Kpi[] {
  const g = windowOf(s, "gsc"), c = windowOf(s, "cloudflare"), i = windowOf(s, "internal");
  const k = (key: string, label: string, on: boolean, cur: number, prev: number, note: string, money = false): Kpi =>
    ({ key, label, cur: on ? cur : null, prev: on ? prev : null, delta: on ? pct(cur, prev) : null, note, money });
  const gscOn = connected(s, "gsc"), cfOn = connected(s, "cloudflare"), inOn = connected(s, "internal");
  const posts = s.posts.filter((p) => p.inCampaign);
  const engagement = posts.reduce((a, p) => a + (p.metrics.reactions ?? 0) + (p.metrics.comments ?? 0) + (p.metrics.shares ?? 0), 0);
  const followers = [...s.site].reverse().find((r) => r.source === "facebook" && r.metric === "followers")?.value ?? null;
  const p = paidTotals(s);
  const pos = (from: string, to: string) => {
    const im = sumRows(s.site, "gsc", ["impressions"], from, to);
    const px = sumRows(s.site, "gsc", ["pos_x_impr"], from, to);
    return im > 0 && px > 0 ? Math.round((px / im) * 10) / 10 : null;
  };
  const pc = gscOn ? pos(g.from, g.to) : null, pp = gscOn ? pos(g.pfrom, g.pto) : null;
  return [
    k("gsc_impr", "חשיפות בגוגל", gscOn, sumRows(s.site, "gsc", ["impressions"], g.from, g.to), sumRows(s.site, "gsc", ["impressions"], g.pfrom, g.pto), `עד ${shortDay(g.to)}`),
    k("gsc_clicks", "כניסות מגוגל", gscOn, sumRows(s.site, "gsc", ["clicks"], g.from, g.to), sumRows(s.site, "gsc", ["clicks"], g.pfrom, g.pto), `עד ${shortDay(g.to)}`),
    { key: "gsc_pos", label: "מיקום ממוצע בגוגל", cur: pc, prev: pp, delta: null, note: pp != null ? `קודם ${pp}, נמוך יותר עדיף` : "נמוך יותר עדיף", empty: gscOn ? "אין נתון" : undefined },
    k("cf_visits", "ביקורים באתר", cfOn, sumRows(s.site, "cloudflare", ["visits"], c.from, c.to), sumRows(s.site, "cloudflare", ["visits"], c.pfrom, c.pto), `עד ${shortDay(c.to)}`),
    k("landing", "צפיות בדפי הקמפיין", cfOn, sumRows(s.landing, "cloudflare", ["pageviews"], c.from, c.to), sumRows(s.landing, "cloudflare", ["pageviews"], c.pfrom, c.pto), "risk, book, ייעוץ AI ומאמרי הקמפיין"),
    k("requests", "פניות ופגישות", inOn, sumRows(s.site, "internal", REQUEST_METRICS, i.from, i.to), sumRows(s.site, "internal", REQUEST_METRICS, i.pfrom, i.pto), "מהטפסים באתר"),
    { key: "fb", label: "מעורבות בפוסטים", cur: connected(s, "facebook") || posts.some((p) => p.asOf) ? engagement : null, prev: null, delta: null, note: followers != null ? `${followers.toLocaleString("he-IL")} עוקבים בדף` : "תגובות, לייקים ושיתופים, מצטבר" },
    { key: "spend", label: "הוצאה על ממומן", cur: p.any ? p.spend : null, prev: null, delta: null, money: true, note: p.any ? (p.leads > 0 ? `${Math.round(p.spend / p.leads).toLocaleString("he-IL")} לליד` : "אין לידים ממומנים") : "לא רץ קמפיין ממומן" },
  ];
}

// ---- funnel --------------------------------------------------------------------------------------------------------------------------

export interface Stage { key: string; label: string; value: number | null; rate: number | null }

/** From a search result to a request. A stage whose source is not connected is null and is skipped when the next rate is computed. */
export function funnel(s: CampaignSummary): Stage[] {
  const g = windowOf(s, "gsc"), c = windowOf(s, "cloudflare"), i = windowOf(s, "internal");
  const cfOn = connected(s, "cloudflare");
  const step = (name: string) => (cfOn ? s.steps.filter((x) => x.step === name && x.day >= c.from && x.day <= c.to).reduce((a, x) => a + x.value, 0) : null);
  const raw: Array<[string, string, number | null]> = [
    ["impr", "חשיפות של דפי הקמפיין בגוגל", connected(s, "gsc") ? sumRows(s.landing, "gsc", ["impressions"], g.from, g.to) : null],
    ["views", "צפיות בדפי הקמפיין", cfOn ? sumRows(s.landing, "cloudflare", ["pageviews"], c.from, c.to) : null],
    ["risk", "פתחו את בדיקת הסיכון", step("risk")],
    ["result", "הגיעו לתוצאה", step("risk_result")],
    ["book", "דף קביעת פגישה", step("book")],
    ["requests", "פניות ופגישות", connected(s, "internal") ? sumRows(s.site, "internal", REQUEST_METRICS, i.from, i.to) : null],
  ];
  let last: number | null = null;
  return raw.map(([key, label, value]) => {
    const rate = value != null && last != null && last > 0 ? Math.round((value / last) * 1000) / 10 : null;
    if (value != null) last = value;
    return { key, label, value, rate };
  });
}

// ---- daily series --------------------------------------------------------------------------------------------------------------------

/** One value per day of the source's window, zero on a day with no row. */
export function series(rows: DayRow[], source: string, metrics: string[], w: Win): { labels: string[]; values: number[][] } {
  const days: string[] = [];
  for (let d = w.from; d <= w.to; d = addDays(d, 1)) days.push(d);
  const idx = new Map(days.map((d, i) => [d, i]));
  const values = metrics.map(() => days.map(() => 0));
  for (const r of rows) {
    if (r.source !== source) continue;
    const at = idx.get(r.day), m = metrics.indexOf(r.metric);
    if (at != null && m >= 0) values[m][at] += r.value;
  }
  return { labels: days.map(shortDay), values };
}

// ---- channels and queries ------------------------------------------------------------------------------------------------------------

export type Channel = "ai" | "search" | "social" | "email" | "direct" | "internal" | "other";
export const CHANNEL_HE: Record<Channel, string> = {
  ai: "עוזרי AI", search: "מנועי חיפוש", social: "רשתות חברתיות", email: "דוא\"ל", direct: "ישיר או לא ידוע", internal: "מתוך האתר", other: "אתרים אחרים",
};

/** The kind of place a visit came from. AI assistants are checked before search, so gemini.google.com is not counted as Google search. */
export function channelOf(host: string): Channel {
  const h = host.toLowerCase();
  if (h === "(direct)" || h === "") return "direct";
  if (/(^|\.)lalumapp\.com$/.test(h)) return "internal";
  if (/(^|\.)(chatgpt\.com|openai\.com|perplexity\.ai|claude\.ai|gemini\.google\.com|copilot\.microsoft\.com|you\.com|phind\.com)$/.test(h)) return "ai";
  if (/(^|\.)(google\.[a-z.]+|bing\.com|duckduckgo\.com|yahoo\.com|yandex\.[a-z]+|ecosia\.org|baidu\.com)$/.test(h)) return "search";
  if (/(^|\.)(facebook\.com|fb\.com|fb\.me|instagram\.com|linkedin\.com|lnkd\.in|t\.co|x\.com|twitter\.com|whatsapp\.com|wa\.me|t\.me|telegram\.org|youtube\.com|tiktok\.com)$/.test(h)) return "social";
  if (/(^|\.)(mail\.google\.com|outlook\.live\.com|outlook\.office\.com|outlook\.office365\.com|mail\.yahoo\.com)$/.test(h) || /^(mail|webmail)\./.test(h)) return "email";
  return "other";
}

export function channels(refs: CampaignSummary["referrers"]): Array<{ channel: Channel; label: string; cur: number; prev: number }> {
  const m = new Map<Channel, { cur: number; prev: number }>();
  for (const r of refs) {
    const ch = channelOf(r.key);
    const had = m.get(ch) ?? { cur: 0, prev: 0 };
    had.cur += r.cur; had.prev += r.prev;
    m.set(ch, had);
  }
  return [...m.entries()].map(([channel, v]) => ({ channel, label: CHANNEL_HE[channel], ...v })).sort((a, b) => b.cur - a.cur);
}

/** A search query about AI and its law: the campaign's subject, not the firm's name. */
export const isAiQuery = (q: string): boolean => /(^|[^a-z])(ai|llm|gpt|chatgpt|claude|gemini|copilot)([^a-z]|$)|בינה מלאכותית|ai act|בינה|אלגוריתם|רגולציית ai/i.test(q);

// ---- paid ----------------------------------------------------------------------------------------------------------------------------

export const PAID_CHANNEL_HE: Record<string, string> = { google_ads: "Google Ads", linkedin_ads: "LinkedIn Ads", meta_ads_manual: "Meta (הוזן ידנית)", other: "ערוץ ממומן אחר" };

/** Paid totals over the internal window (it ends today): Meta from its own rows per ad campaign, other channels as typed in. */
export function paidTotals(s: CampaignSummary): { any: boolean; spend: number; clicks: number; impressions: number; leads: number; rows: Array<{ label: string; spend: number; clicks: number; leads: number }> } {
  const w = windowOf(s, "internal");
  const by = new Map<string, { label: string; spend: number; clicks: number; impressions: number; leads: number }>();
  for (const r of s.paid) {
    if (r.day < w.from || r.day > w.to) continue;
    const id = `${r.source}|${r.key ?? ""}`;
    const label = r.source === "manual" ? PAID_CHANNEL_HE[r.key ?? ""] ?? str(r.key) : `Meta: ${r.key ?? ""}`;
    const t = by.get(id) ?? { label, spend: 0, clicks: 0, impressions: 0, leads: 0 };
    if (r.metric === "spend" || r.metric === "clicks" || r.metric === "impressions" || r.metric === "leads") t[r.metric] += r.value;
    by.set(id, t);
  }
  const rows = [...by.values()].sort((a, b) => b.spend - a.spend);
  const sum = (k: "spend" | "clicks" | "impressions" | "leads") => rows.reduce((a, r) => a + r[k], 0);
  return { any: s.paid.length > 0, spend: sum("spend"), clicks: sum("clicks"), impressions: sum("impressions"), leads: sum("leads"), rows: rows.map(({ label, spend, clicks, leads }) => ({ label, spend, clicks, leads })) };
}

// ---- posts and data health ------------------------------------------------------------------------------------------------------------

/** Views of a post: Meta's view metric when the token has insights, else the reach metric, else the impressions typed in by hand. */
export const postViews = (m: Record<string, number>): number | null => m.ins_post_media_view ?? m.ins_post_impressions_unique ?? m.impressions ?? null;

export const SOURCE_HE: Record<string, string> = {
  gsc: "Google Search Console", cloudflare: "Cloudflare Web Analytics", facebook: "דף הפייסבוק", meta_ads: "Meta Ads", internal: "טפסים באתר",
};

export interface Health { source: string; label: string; tone: "ok" | "warn" | "bad" | "off"; text: string }

/** Where each source stands, from its latest run. A source that has not delivered for two days is flagged even when its last run said ok. */
export function health(s: CampaignSummary, nowMs: number): Health[] {
  return ["gsc", "cloudflare", "facebook", "meta_ads", "internal"].map((source) => {
    const r = s.runs.find((x) => x.source === source);
    const label = SOURCE_HE[source];
    if (!r) return { source, label, tone: "off", text: "טרם רץ" };
    if (r.status === "not_configured") return { source, label, tone: "off", text: "לא מחובר: חסר סוד" };
    if (r.status === "token_failed") return { source, label, tone: "bad", text: "הטוקן נדחה, צריך טוקן חדש" };
    if (r.status !== "ok") return { source, label, tone: "bad", text: `שגיאה${r.error ? `: ${r.error}` : ""}` };
    const age = r.lastOkAt ? (nowMs - Date.parse(r.lastOkAt)) / 3_600_000 : Infinity;
    if (age > 48) return { source, label, tone: "warn", text: `לא התעדכן ${Math.floor(age / 24)} ימים` };
    if (r.warning) return { source, label, tone: "warn", text: "הקובץ היומי לא התעדכן" };
    return { source, label, tone: "ok", text: r.mode === "public_file" ? "מעודכן, מהקובץ היומי" : "מעודכן" };
  });
}
