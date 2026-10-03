// Builds the daily status report sent to Telegram: search entries, security,
// and promotion (SEO/GEO). Dependency free (only Node built-ins), so it runs
// without an install step. Prints the Hebrew report to stdout.
//
// The entries line reads real Google Search Console figures. The workflow
// fetches the data/search-console branch and passes the current snapshot in
// GSC_JSON (and the previous day's snapshot in GSC_PREV_JSON for the trend).
// If those are absent the script falls back to reading the branch itself with
// git, and if that too is unavailable it says so plainly rather than inventing
// a number. Visitor counts from Cloudflare Web Analytics are an optional extra
// line, shown only when CLOUDFLARE_API_TOKEN and CLOUDFLARE_ZONE_ID are set.

import { execSync } from "node:child_process";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => (existsSync(join(root, p)) ? readFileSync(join(root, p), "utf8") : "");

// ---- Search Console data ----
// Load the current snapshot from GSC_JSON, or fall back to reading the data
// branch directly. Returns the parsed object, or null when nothing is readable.
function loadGsc(envVar, gitRef) {
  const p = process.env[envVar];
  if (p && existsSync(p)) {
    try {
      const txt = readFileSync(p, "utf8").trim();
      if (txt) return JSON.parse(txt);
    } catch {
      // fall through to git
    }
  }
  try {
    const txt = execSync(
      `git show ${gitRef}:data/search-console/latest.json`,
      { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] },
    ).trim();
    if (txt) return JSON.parse(txt);
  } catch {
    // not available
  }
  return null;
}

const he = (n) => Number(n).toLocaleString("he-IL");
const shortPath = (url) => {
  try {
    const u = new URL(url);
    return u.pathname === "/" ? "/" : u.pathname;
  } catch {
    return url;
  }
};
const qText = (row) => (Array.isArray(row.keys) ? row.keys[0] : row.keys) || "";

// The real totals are the sum over the date dimension. Search Console hides
// rare queries, so the stored `totals` (historically the query-dimension sum)
// undercounts actual traffic by about threefold. Summing `dates` matches the
// figure shown in the Search Console UI. We derive it here so the report is
// correct even against an older snapshot whose `totals` was query based,
// falling back to the stored `totals` only when no date rows are present.
function realTotals(d) {
  const dates = Array.isArray(d?.dates) ? d.dates : [];
  if (dates.length) {
    return dates.reduce(
      (a, r) => ({ clicks: a.clicks + (r.clicks || 0), impressions: a.impressions + (r.impressions || 0) }),
      { clicks: 0, impressions: 0 },
    );
  }
  return d?.totals || { clicks: 0, impressions: 0 };
}

function trendLine(cur, prev) {
  if (!prev) return "מגמה: אין קובץ קודם להשוואה";
  const c = realTotals(cur);
  const p = realTotals(prev);
  const dc = c.clicks - p.clicks;
  const di = c.impressions - p.impressions;
  const fmt = (d) => (d > 0 ? `עלה ב-${he(d)}` : d < 0 ? `ירד ב-${he(-d)}` : "ללא שינוי");
  return `מגמה מול אתמול: קליקים ${fmt(dc)}, הופעות ${fmt(di)}`;
}

function entriesSection() {
  const cur = loadGsc("GSC_JSON", "origin/data/search-console");
  if (!cur?.dates && !cur?.totals) {
    return "📈 כניסות מחיפוש (Search Console)\nאין נתונים זמינים כרגע, ייתכן שענף הנתונים טרם עודכן. לא ממציאים מספר.";
  }
  const prev = loadGsc("GSC_PREV_JSON", "origin/data/search-console~1");
  const w = cur.window || {};
  const t = realTotals(cur);
  const ctr = t.impressions ? Math.round((t.clicks / t.impressions) * 1000) / 10 : 0;

  const topQ = [...(cur.queries || [])]
    .sort((a, b) => (b.clicks || 0) - (a.clicks || 0))
    .slice(0, 3)
    .map((q) => `${qText(q)} (${he(q.clicks || 0)})`)
    .join(", ");
  const topP = [...(cur.pages || [])]
    .sort((a, b) => (b.clicks || 0) - (a.clicks || 0))
    .slice(0, 3)
    .map((p) => `${shortPath(qText(p))} (${he(p.clicks || 0)})`)
    .join(", ");

  const lines = [
    "📈 כניסות מחיפוש (Search Console)",
    `חלון ${w.start || "?"} עד ${w.end || "?"}: ${he(t.clicks || 0)} קליקים, ${he(t.impressions || 0)} הופעות, CTR ${ctr}%`,
    trendLine(cur, prev),
  ];
  if (topQ) lines.push(`שאילתות מובילות: ${topQ}`);
  if (topP) lines.push(`עמודים מובילים: ${topP}`);
  lines.push("הערה: נתוני Search Console מתעדכנים בפיגור של יומיים עד שלושה, זה תקין.");
  return lines.join("\n");
}

// ---- Promotion (SEO and GEO) ----
let seoOut = "";
try {
  seoOut = execSync("node scripts/seo-check.mjs", { cwd: root, encoding: "utf8" });
} catch (e) {
  seoOut = (e.stdout || "") + (e.stderr || "");
}
const seoSummary = (seoOut.match(/\d+ pass, \d+ warn, \d+ fail/) || ["לא זמין"])[0];
const seoFails = Number((seoOut.match(/(\d+) fail/) || [])[1] || 0);
const seoWarns = Number((seoOut.match(/(\d+) warn/) || [])[1] || 0);
const promo = seoFails ? "❌ יש כשלים לתיקון" : seoWarns ? "⚠️ תקין עם אזהרות" : "✅ תקין";

// ---- Security ----
const headers = read("public/_headers");
const hasHsts = /Strict-Transport-Security/i.test(headers);
const html = read("index.html");
const mixed = (html.match(/http:\/\/(?!www\.w3\.org|schema\.org|localhost|127\.0\.0\.1)/g) || []).length;
const secOk = hasHsts && mixed === 0;
const secStatus = secOk ? "✅ תקין" : "⚠️ דורש בדיקה";
const secDetail = `${hasHsts ? "HSTS פעיל" : "HSTS חסר"}, ${mixed ? `תוכן מעורב: ${mixed}` : "אין תוכן מעורב"}`;

// ---- Visitors (Cloudflare Web Analytics, optional) ----
async function visitsLine() {
  const token = process.env.CLOUDFLARE_API_TOKEN;
  const zone = process.env.CLOUDFLARE_ZONE_ID;
  if (!token || !zone) return "";
  const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString().slice(0, 10);
  const query =
    "query($zone:String!,$since:String!){viewer{zones(filter:{zoneTag:$zone})" +
    "{httpRequests1dGroups(limit:2,filter:{date_geq:$since},orderBy:[date_DESC])" +
    "{dimensions{date} sum{pageViews} uniq{uniques}}}}}";
  try {
    const res = await fetch("https://api.cloudflare.com/client/v4/graphql", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
      body: JSON.stringify({ query, variables: { zone, since } }),
    });
    const data = await res.json();
    const groups = data?.data?.viewer?.zones?.[0]?.httpRequests1dGroups || [];
    if (!groups.length) return "👥 מבקרים (Cloudflare): אין נתונים עדיין";
    const g = groups[0];
    return `👥 מבקרים (Cloudflare): ${g.uniq?.uniques ?? "?"} מבקרים, ${g.sum?.pageViews ?? "?"} צפיות (${g.dimensions?.date})`;
  } catch {
    return "👥 מבקרים (Cloudflare): לא זמין כרגע";
  }
}

const entries = entriesSection();
const visits = await visitsLine();
const date = new Date().toISOString().slice(0, 10);

const blocks = [
  `📊 דוח יומי LALUM, ${date}`,
  entries,
  visits,
  `🔒 אבטחה: ${secStatus}\n${secDetail}`,
  `🚀 קידום SEO ו-GEO: ${promo}\nבדיקות: ${seoSummary}`,
  "https://lalumapp.com/",
].filter(Boolean);

console.log(blocks.join("\n\n"));
