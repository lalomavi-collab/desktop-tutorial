// Checks the campaign dashboard's pure code with fakes: the sync function's mapping (supabase/functions/lalum-campaign-sync/map.ts) and
// the screen's arithmetic (src/lib/cockpit/campaignsCore.ts). Run with: npm run campaign-sync-check
import assert from "node:assert/strict";
import { generateKeyPairSync, createVerify } from "node:crypto";
import {
  normPath, normHost, mapGsc, mapGscFiles, mapCf, cfQuery, mapFb, matchPosts, normText, insightValue, leadsOf, mapMetaAds, signJwt, windowFor, dayRange, israelDay,
} from "../supabase/functions/lalum-campaign-sync/map.ts";
import {
  parseSummary, kpis, funnel, channelOf, channels, isAiQuery, paidTotals, health, windowOf, series, pct,
} from "../src/lib/cockpit/campaignsCore.ts";

const t = async (name, fn) => { await fn(); console.log(`[PASS] ${name}`); };

await t("paths and hosts normalise to one key", () => {
  assert.equal(normPath("https://lalumapp.com/en/risk/?utm_source=fb#x"), "/en/risk");
  assert.equal(normPath("/Book/"), "/book");
  assert.equal(normPath("https://lalumapp.com/"), "/");
  assert.equal(normPath("/insights/%D7%91%D7%99%D7%A0%D7%94"), "/insights/בינה");
  assert.equal(normPath("/bad%E0%A4%A"), "/bad%e0%a4%a");
  assert.equal(normHost(""), "(direct)");
  assert.equal(normHost("WWW.Google.com:443"), "google.com");
});

await t("Search Console rows: clicks, impressions and a weighted position, merged per path", () => {
  const site = mapGsc("site", [{ keys: ["2026-10-20"], clicks: 3, impressions: 100, position: 7.5 }]);
  assert.deepEqual(site.map((r) => [r.metric, r.value]), [["clicks", 3], ["impressions", 100], ["pos_x_impr", 750]]);
  const pages = mapGsc("page", [
    { keys: ["2026-10-20", "https://lalumapp.com/risk/"], clicks: 1, impressions: 10, position: 4 },
    { keys: ["2026-10-20", "https://lalumapp.com/risk"], clicks: 2, impressions: 30, position: 8 },
  ]);
  const get = (m) => pages.find((r) => r.metric === m && r.key === "/risk")?.value;
  assert.equal(get("clicks"), 3);
  assert.equal(get("impressions"), 40);
  assert.equal(get("pos_x_impr") / get("impressions"), 7);
  assert.equal(mapGsc("query", [{ keys: ["2026-10-20", "  "], clicks: 1, impressions: 1 }]).length, 0);
  assert.equal(mapGsc("site", [{ keys: ["not a day"], clicks: 1 }]).length, 0);
});

await t("Search Console file: newest file wins a day, page and query totals sit on the window's last day", () => {
  const latest = { fetchedAt: "2026-10-25T10:06:13Z", window: { start: "2026-09-24", end: "2026-10-22" },
    dates: [{ keys: ["2026-10-21"], clicks: 4, impressions: 118, position: 20 }, { keys: ["2026-10-22"], clicks: 1, impressions: 10, position: 3 }],
    pages: [{ keys: ["https://lalumapp.com/risk/"], clicks: 2, impressions: 30, position: 9 }], queries: [{ keys: ["EU AI Act"], clicks: 0, impressions: 12, position: 30 }] };
  const older = { window: { start: "2026-08-27", end: "2026-10-21" }, dates: [{ keys: ["2026-10-20"], clicks: 9, impressions: 90 }, { keys: ["2026-10-21"], clicks: 99, impressions: 999 }] };
  const { rows, from, to } = mapGscFiles([latest, older]);
  const v = (scope, key, metric, day) => rows.find((r) => r.scope === scope && r.key === key && r.metric === metric && (!day || r.day === day))?.value;
  assert.deepEqual([from, to], ["2026-10-20", "2026-10-22"]);
  assert.equal(v("site", "", "clicks", "2026-10-21"), 4, "the newer file wins the day");
  assert.equal(v("site", "", "clicks", "2026-10-20"), 9, "an older file fills days the newer one lacks");
  assert.equal(rows.find((r) => r.scope === "page").day, "2026-10-22");
  assert.equal(v("page", "/risk", "impressions"), 30);
  assert.equal(v("query", "eu ai act", "impressions"), 12);
  assert.deepEqual(mapGscFiles([{}]), { rows: [], from: null, to: null });
});

await t("Cloudflare rows: site totals are the sum of the paths, empty referrer is direct", () => {
  const rows = mapCf(
    [{ count: 5, sum: { visits: 3 }, dimensions: { date: "2026-10-20", requestPath: "/risk/" } }, { count: 2, sum: { visits: 1 }, dimensions: { date: "2026-10-20", requestPath: "/en/risk" } }],
    [{ count: 4, sum: { visits: 2 }, dimensions: { date: "2026-10-20", refererHost: "" } }, { count: 1, sum: { visits: 0 }, dimensions: { date: "2026-10-20", refererHost: "x.com" } }],
  );
  const v = (scope, key, metric) => rows.find((r) => r.scope === scope && r.key === key && r.metric === metric)?.value;
  assert.equal(v("site", "", "pageviews"), 7);
  assert.equal(v("site", "", "visits"), 4);
  assert.equal(v("path", "/risk", "pageviews"), 5);
  assert.equal(v("referrer", "(direct)", "visits"), 2);
  assert.equal(v("referrer", "x.com", "visits"), undefined, "a referrer with no visits is not stored");
  const hex = "a".repeat(32);
  assert.match(cfQuery(hex, hex, "2026-10-20"), /datetime_lt: "2026-10-21T00:00:00Z"/);
  assert.throws(() => cfQuery(hex, `${hex}"}`, "2026-10-20"), /bad CF_WEB_ANALYTICS_SITE_TAG: 34 chars/);
  assert.throws(() => cfQuery(`${hex}\n`, hex, "2026-10-20"), /bad CF_ACCOUNT_ID: 33 chars/);
});

await t("Facebook: posts link to the registry by id or by their opening words, a repost does not steal a row", () => {
  const registry = [
    { id: 1, external_id: null, match_prefix: "האם ה-AI שלכם הוא נכס אסטרטגי," },
    { id: 2, external_id: null, match_prefix: "\"אנחנו חברה ישראלית, ה-EU AI A" },
    { id: 3, external_id: "604003069451536_122247103214783961", match_prefix: "36 הפניות לפסקי דין. חמש מהן," },
    { id: 4, external_id: null, match_prefix: "קצר" },
  ];
  const posts = [
    { id: "p_repost", message: "האם ה AI שלכם הוא נכס אסטרטגי, או פצצת זמן? (שיתוף חוזר)", created_time: "2026-10-01T08:00:00+0000" },
    { id: "p_9", message: "⚠️ האם ה-AI שלכם הוא נכס אסטרטגי, או פצצת זמן משפטית של מיליוני שקלים? ⚠️", created_time: "2026-09-08T08:00:00+0000", permalink_url: "https://facebook.com/p9" },
    { id: "p_13", message: "״אנחנו חברה ישראלית, ה-EU AI Act לא רלוונטי לנו.״\n\nאני שומע", created_time: "2026-09-20T08:00:00+0000" },
    { id: "604003069451536_122247103214783961", message: "36 הפניות", created_time: "2026-10-21T08:00:00+0000", permalink_url: "https://facebook.com/p16" },
    { id: "p_other", message: "\n  פוסט אחר לגמרי על התחדשות עירונית\nשורה שנייה", created_time: "2026-10-10T08:00:00+0000" },
  ];
  const { links, adds } = matchPosts(registry, posts);
  const linkOf = (row) => links.find((l) => l.rowId === row)?.external_id;
  assert.equal(linkOf(1), "p_9", "the earliest post with the opening words wins");
  assert.equal(linkOf(2), "p_13", "Hebrew gershayim and an ASCII quote compare equal");
  assert.equal(linkOf(3), "604003069451536_122247103214783961");
  assert.equal(linkOf(4), undefined, "a prefix under 8 letters never matches");
  assert.deepEqual(adds.map((a) => [a.external_id, a.title]), [["p_repost", "האם ה AI שלכם הוא נכס אסטרטגי, או פצצת זמן? (שיתוף חוזר)"], ["p_other", "פוסט אחר לגמרי על התחדשות עירונית"]]);
  assert.equal(normText("ה-AI, שלכם!"), "הaiשלכם");
});

await t("Facebook rows: running totals per post, insights, followers", () => {
  const rows = mapFb("2026-10-26", [{ id: "p1", reactions: { summary: { total_count: 7 } }, comments: { summary: { total_count: 2 } } }], 412, { p1: { post_media_view: 300 } });
  const v = (k, m) => rows.find((r) => r.key === k && r.metric === m)?.value;
  assert.equal(v("p1", "reactions"), 7);
  assert.equal(v("p1", "shares"), 0);
  assert.equal(v("p1", "ins_post_media_view"), 300);
  assert.equal(v("", "followers"), 412);
  assert.equal(insightValue({ like: 3, love: 2 }), 5);
  assert.equal(insightValue("x"), null);
});

await t("Meta Ads: a lead is counted once, reach stays per campaign", () => {
  assert.equal(leadsOf([{ action_type: "onsite_conversion.lead_grouped", value: "2" }, { action_type: "lead", value: "2" }]), 2);
  assert.equal(leadsOf([{ action_type: "link_click", value: "9" }]), 0);
  const rows = mapMetaAds([
    { date_start: "2026-10-20", campaign_name: "AI Risk", spend: "100.5", impressions: "1000", clicks: "20", reach: "800", actions: [{ action_type: "lead", value: "1" }] },
    { date_start: "2026-10-20", campaign_name: "EU AI Act", spend: "50", impressions: "500", clicks: "5", reach: "400" },
  ]);
  const site = (m) => rows.find((r) => r.scope === "site" && r.metric === m)?.value;
  assert.equal(site("spend"), 150.5);
  assert.equal(site("leads"), 1);
  assert.equal(site("reach"), undefined);
  assert.equal(rows.find((r) => r.scope === "paid" && r.key === "AI Risk" && r.metric === "reach")?.value, 800);
});

await t("windows: the first run backfills, later runs re-read a few days, nothing reads today from Google or Cloudflare", () => {
  assert.deepEqual(windowFor("gsc", true, "2026-10-26"), { from: "2026-07-28", to: "2026-10-25" });
  assert.deepEqual(windowFor("gsc", false, "2026-10-26"), { from: "2026-10-16", to: "2026-10-25" });
  assert.deepEqual(windowFor("cloudflare", false, "2026-10-26"), { from: "2026-10-23", to: "2026-10-25" });
  assert.equal(windowFor("internal", false, "2026-10-26").to, "2026-10-26");
  assert.equal(dayRange("2026-10-30", "2026-11-02").length, 4);
  assert.equal(israelDay(new Date("2026-10-25T22:30:00Z")), "2026-10-26", "after midnight in Israel it is the next day");
});

await t("Google sign-in: the JWT is RS256 and verifies with the service account's public key", async () => {
  const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048, privateKeyEncoding: { type: "pkcs8", format: "pem" }, publicKeyEncoding: { type: "spki", format: "pem" } });
  const jwt = await signJwt({ client_email: "sa@x.iam.gserviceaccount.com", private_key: privateKey.replace(/\n/g, "\\n") }, "scope-x", Date.UTC(2026, 9, 26));
  const [h, c, sig] = jwt.split(".");
  const claims = JSON.parse(Buffer.from(c, "base64url").toString());
  assert.equal(claims.iss, "sa@x.iam.gserviceaccount.com");
  assert.equal(claims.exp - claims.iat, 3600);
  assert.ok(createVerify("RSA-SHA256").update(`${h}.${c}`).verify(publicKey, Buffer.from(sig, "base64url")));
});

// ---- the screen ------------------------------------------------------------------------------------------------------------------------

const days = (from, to) => { const out = []; for (let d = from; d <= to; d = new Date(Date.parse(d) + 86_400_000).toISOString().slice(0, 10)) out.push(d); return out; };
const rows = (source, metric, from, to, value) => days(from, to).map((day) => ({ day, source, metric, value }));
const raw = {
  campaign: { code: "legal-ai", name: "Legal AI", starts_on: "2026-09-01", landing_prefixes: ["/risk", "/book"] },
  today: "2026-10-26", days: 7,
  max_day: { gsc: "2026-10-23", cloudflare: "2026-10-25", internal: "2026-10-26" },
  site: [
    ...rows("gsc", "impressions", "2026-10-10", "2026-10-23", 10), ...rows("gsc", "clicks", "2026-10-17", "2026-10-23", 1),
    ...rows("gsc", "pos_x_impr", "2026-10-17", "2026-10-23", 50),
    ...rows("cloudflare", "visits", "2026-10-19", "2026-10-25", 4),
    { day: "2026-10-25", source: "internal", metric: "bookings", value: 2 }, { day: "2026-10-26", source: "internal", metric: "newsletter", value: 5 },
  ],
  landing: [...rows("gsc", "impressions", "2026-10-17", "2026-10-23", 2), ...rows("cloudflare", "pageviews", "2026-10-19", "2026-10-25", 3)],
  steps: [{ day: "2026-10-24", step: "risk", value: 6 }, { day: "2026-10-24", step: "risk_result", value: 3 }],
  paid: [{ day: "2026-10-25", source: "manual", key: "google_ads", metric: "spend", value: 200 }, { day: "2026-10-25", source: "manual", key: "google_ads", metric: "leads", value: 2 }],
  queries: [], pages_gsc: [], paths_cf: [], lead_paths: [],
  referrers: [{ key: "gemini.google.com", cur: 3, prev: 0 }, { key: "google.com", cur: 5, prev: 4 }, { key: "lalumapp.com", cur: 9, prev: 9 }, { key: "(direct)", cur: 2, prev: 1 }],
  posts: [{ post_no: 16, platform: "facebook", title: "36", linked: true, in_campaign: true, metrics: { reactions: 5, comments: 1 } }, { post_no: null, platform: "facebook", title: "x", linked: true, in_campaign: false, metrics: { reactions: 100 } }],
  runs: [
    { source: "gsc", status: "ok", last_ok_at: "2026-10-26T03:20:00Z", mode: "public_file" }, { source: "cloudflare", status: "ok", last_ok_at: "2026-10-22T03:20:00Z" },
    { source: "facebook", status: "not_configured" }, { source: "meta_ads", status: "token_failed" },
  ],
};

await t("summary: each source over its own window, unconnected sources are null, not zero", () => {
  const s = parseSummary(raw);
  assert.equal(parseSummary(null), null);
  assert.deepEqual(windowOf(s, "gsc"), { from: "2026-10-17", to: "2026-10-23", pfrom: "2026-10-10", pto: "2026-10-16" });
  const k = Object.fromEntries(kpis(s).map((x) => [x.key, x]));
  assert.equal(k.gsc_impr.cur, 70);
  assert.equal(k.gsc_impr.delta, 0);
  assert.equal(k.gsc_clicks.delta, null, "no clicks before: nothing to compare with");
  assert.equal(k.gsc_pos.cur, 5);
  assert.equal(k.requests.cur, 2, "a newsletter sign-up is not a request");
  assert.equal(k.fb.cur, null, "Facebook never delivered: not connected");
  assert.equal(k.spend.cur, 200);
  assert.match(k.spend.note, /100 לליד/);
  assert.equal(pct(5, 4), 25);
});

await t("funnel: a stage without data is skipped when the next rate is computed", () => {
  const s = parseSummary(raw);
  const f = Object.fromEntries(funnel(s).map((x) => [x.key, x]));
  assert.equal(f.impr.value, 14);
  assert.equal(f.views.value, 21);
  assert.equal(f.risk.value, 6);
  assert.equal(f.result.rate, 50);
  assert.equal(f.requests.value, 2);
  const noCf = parseSummary({ ...raw, max_day: { gsc: "2026-10-23", internal: "2026-10-26" }, runs: [] });
  const g = Object.fromEntries(funnel(noCf).map((x) => [x.key, x]));
  assert.equal(g.views.value, null);
  assert.equal(g.requests.rate, 14.3, "requests compared with the last stage that has data");
});

await t("channels: AI assistants before search, the site itself apart", () => {
  assert.equal(channelOf("gemini.google.com"), "ai");
  assert.equal(channelOf("google.co.il"), "search");
  assert.equal(channelOf("m.facebook.com"), "social");
  assert.equal(channelOf("lnkd.in"), "social");
  assert.equal(channelOf("lalumapp.com"), "internal");
  assert.equal(channelOf("example.org"), "other");
  const c = channels(parseSummary(raw).referrers);
  assert.deepEqual(c.map((x) => x.channel), ["internal", "search", "ai", "direct"]);
  assert.ok(isAiQuery("EU AI Act ישראל"));
  assert.ok(isAiQuery("עורך דין בינה מלאכותית"));
  assert.ok(!isAiQuery("lalum"));
  assert.ok(!isAiQuery("said אביב"));
});

await t("paid and data health", () => {
  const s = parseSummary(raw);
  const p = paidTotals(s);
  assert.deepEqual([p.spend, p.leads, p.rows[0].label], [200, 2, "Google Ads"]);
  const h = Object.fromEntries(health(s, Date.parse("2026-10-26T06:00:00Z")).map((x) => [x.source, x]));
  assert.equal(h.gsc.tone, "ok");
  assert.equal(h.gsc.text, "מעודכן, מהקובץ היומי");
  assert.equal(h.cloudflare.tone, "warn", "an ok run four days ago is stale");
  assert.equal(h.facebook.tone, "off");
  assert.equal(h.meta_ads.tone, "bad");
  assert.equal(h.internal.text, "טרם רץ");
  const ser = series(s.site, "cloudflare", ["visits"], windowOf(s, "cloudflare"));
  assert.equal(ser.labels[0], "19.10");
  assert.deepEqual(ser.values[0], [4, 4, 4, 4, 4, 4, 4]);
});

console.log("campaign-sync-check: ok");
