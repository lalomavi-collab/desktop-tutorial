// Builds the daily status report sent to Telegram: visits, security, and
// promotion (SEO/GEO). Dependency free (only Node built-ins and global fetch),
// so it runs without an install step. Prints the Hebrew report to stdout.
//
// Visits come from Cloudflare Web Analytics when CLOUDFLARE_API_TOKEN and
// CLOUDFLARE_ZONE_ID are set as environment variables; otherwise the visits
// line explains what to configure.

import { execSync } from "node:child_process";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => (existsSync(join(root, p)) ? readFileSync(join(root, p), "utf8") : "");

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

// ---- Visits (Cloudflare Web Analytics) ----
async function visitsLine() {
  const token = process.env.CLOUDFLARE_API_TOKEN;
  const zone = process.env.CLOUDFLARE_ZONE_ID;
  if (!token || !zone) return "לא מוגדר עדיין (צריך טוקן Cloudflare, ראו הוראות)";
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
    if (!groups.length) return "אין נתונים עדיין";
    const g = groups[0];
    return `${g.uniq?.uniques ?? "?"} מבקרים, ${g.sum?.pageViews ?? "?"} צפיות (${g.dimensions?.date})`;
  } catch {
    return "לא זמין כרגע";
  }
}

const visits = await visitsLine();
const date = new Date().toISOString().slice(0, 10);

const msg = `📊 דוח יומי LALUM, ${date}

👥 כניסות: ${visits}

🔒 אבטחה: ${secStatus}
${secDetail}

🚀 קידום SEO ו-GEO: ${promo}
בדיקות: ${seoSummary}

https://lalumapp.com/`;

console.log(msg);
