// Read the Search Console data that search-console.mjs committed, and answer
// the questions that decide what to do next.
//
//   node scripts/search-console-report.mjs [path-to-json]
//
// Five questions, in the order they are worth acting on:
//
//   1. Striking distance. A query sitting at position 5 to 20 already ranks;
//      it is one title, one heading or one paragraph away from page one. This
//      is the cheapest traffic on the list and it is invisible without this
//      data, because nobody searches for their own site at position 14.
//   2. Seen but not clicked. High impressions with a near-zero click rate is
//      not a ranking problem, it is a title and description problem, and it is
//      fixable in one edit.
//   3. Branded against subject. Traffic on the name is people who already know
//      him. Traffic on a subject is new work. The ratio says which one the site
//      is actually earning.
//   4. The two focus areas. Every query is bucketed into real estate, AI,
//      mediation, or none of them, so the traffic can be compared against the
//      positioning rather than assumed to match it.
//   5. Published and invisible. A page in the sitemap with no impressions at
//      all in the window is either not indexed or not competitive.

import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const file = process.argv[2] || join(root, "data", "search-console", "latest.json");
if (!existsSync(file)) {
  console.error(`No data at ${file}.`);
  console.error("The workflow writes it once GSC_SERVICE_ACCOUNT_JSON is set. See docs/search-console-setup.md.");
  process.exit(1);
}
const d = JSON.parse(readFileSync(file, "utf8"));

// He is searched for by name in several spellings, and those are branded even
// when the name is the only word in the query.
const BRAND = /ללום|lalum|לאלום/i;
const AREAS = [
  ["נדל״ן והתחדשות", /נדל|מקרקעין|תמ״א|תמ"א|פינוי|התחדשות|דייר|יזם|קומבינציה|דירה|דירות|משכנת|שכירות|טאבו|היטל השבחה|real.?estate|property|urban.?renewal/i],
  ["בינה מלאכותית", /בינה מלאכותית|\bai\b|אלגורית|llm|מודל שפה|gdpr|תיקון 13|פרטיות|רגולצי|ציות|ממשל|דירקטוריון|eu ai act|governance/i],
  ["גישור", /גישור|מגשר|בורר|בוררות|סכסוך|סכסוכים|מדיאצי|mediation|arbitration/i],
];
const areaOf = (q) => (AREAS.find(([, re]) => re.test(q)) || [null])[0];

const n = (x) => x.toLocaleString("en-US");
const pct = (x) => (x * 100).toFixed(1) + "%";
const bar = (v, max, w = 22) => "█".repeat(Math.max(0, Math.round((v / (max || 1)) * w)));

const q = d.queries || [];
const pages = d.pages || [];
console.log(`Search Console: ${d.site}`);
console.log(`${d.window.start} to ${d.window.end}  (fetched ${String(d.fetchedAt).slice(0, 16).replace("T", " ")})`);
console.log(`${n(d.totals.clicks)} clicks, ${n(d.totals.impressions)} impressions, ${q.length} queries, ${pages.length} pages\n`);

// 1. Striking distance.
const striking = q
  .filter((r) => r.position >= 5 && r.position <= 20 && r.impressions >= 10)
  .sort((a, b) => b.impressions - a.impressions)
  .slice(0, 25);
console.log(`STRIKING DISTANCE  (position 5 to 20, at least 10 impressions): ${striking.length ? striking.length + " shown" : "none"}`);
for (const r of striking) {
  console.log(`  pos ${String(r.position).padStart(5)}  ${String(n(r.impressions)).padStart(6)} impr  ${String(r.clicks).padStart(4)} clicks  ${r.keys[0]}`);
}

// 2. Seen but not clicked.
const unclicked = pages
  .filter((r) => r.impressions >= 100 && r.ctr < 0.01)
  .sort((a, b) => b.impressions - a.impressions)
  .slice(0, 15);
console.log(`\nSEEN BUT NOT CLICKED  (100+ impressions, under 1% click rate): ${unclicked.length ? unclicked.length + " shown" : "none"}`);
for (const r of unclicked) {
  console.log(`  ${String(n(r.impressions)).padStart(7)} impr  ctr ${pct(r.ctr).padStart(6)}  pos ${String(r.position).padStart(5)}  ${r.keys[0].replace(/^https?:\/\/[^/]+/, "")}`);
}

// 3. Branded against subject.
const branded = q.filter((r) => BRAND.test(r.keys[0]));
const bClicks = branded.reduce((a, r) => a + r.clicks, 0);
const bImpr = branded.reduce((a, r) => a + r.impressions, 0);
console.log(`\nBRANDED AGAINST SUBJECT`);
console.log(`  branded (name):  ${String(n(bClicks)).padStart(6)} clicks  ${String(n(bImpr)).padStart(8)} impr  ${branded.length} queries`);
console.log(`  subject:         ${String(n(d.totals.clicks - bClicks)).padStart(6)} clicks  ${String(n(d.totals.impressions - bImpr)).padStart(8)} impr  ${q.length - branded.length} queries`);

// 4. The two focus areas.
console.log(`\nTHE TWO FOCUS AREAS  (subject queries only, branded excluded)`);
const buckets = new Map([...AREAS.map(([name]) => [name, { clicks: 0, impressions: 0, queries: 0 }]), ["אחר", { clicks: 0, impressions: 0, queries: 0 }]]);
for (const r of q) {
  // Branded queries are counted above and excluded here: a search for his name
  // is not a search for a subject, and leaving it in made "other" the biggest
  // bucket on the chart while saying nothing about the areas.
  if (BRAND.test(r.keys[0])) continue;
  const b = buckets.get(areaOf(r.keys[0]) || "אחר");
  b.clicks += r.clicks; b.impressions += r.impressions; b.queries++;
}
const maxClicks = Math.max(...[...buckets.values()].map((b) => b.clicks), 1);
for (const [name, b] of buckets) {
  console.log(`  ${name.padEnd(18)} ${String(n(b.clicks)).padStart(6)} clicks  ${String(n(b.impressions)).padStart(8)} impr  ${String(b.queries).padStart(5)} queries  ${bar(b.clicks, maxClicks)}`);
}

// 5. Published and invisible.
const built = join(root, "lalum-app", "dist", "sitemap.xml");
const smPath = existsSync(built) ? built : join(root, "lalum-app", "public", "sitemap.xml");
if (existsSync(smPath)) {
  const listed = [...readFileSync(smPath, "utf8").matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1].replace(/\/$/, ""));
  const seen = new Set(pages.map((r) => r.keys[0].replace(/\/$/, "")));
  const invisible = listed.filter((u) => !seen.has(u));
  console.log(`\nPUBLISHED AND INVISIBLE  (in the sitemap, no impressions in the window): ${invisible.length} of ${listed.length}`);
  for (const u of invisible.slice(0, 20)) console.log(`  ${u.replace(/^https?:\/\/[^/]+/, "")}`);
  if (invisible.length > 20) console.log(`  ... and ${invisible.length - 20} more`);
}
