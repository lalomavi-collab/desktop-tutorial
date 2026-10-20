// The gate for the daily updates feed (src/data/updates.json). The daily job writes only to that file,
// and this check decides whether an item may stand: two independent sources, a real date, no dashes as
// punctuation, no duplicates. A failing item fails the build, so it never merges. Run: npm run updates-check.
import { readFileSync } from "node:fs";

const data = JSON.parse(readFileSync(new URL("../src/data/updates.json", import.meta.url), "utf8"));
const errors = [];
const seen = new Set();
const host = (u) => new URL(u).hostname.replace(/^www\./, "");
const stem = (h) => h.split(".").slice(-2).join(".");
const DASH = /[—–]|\s-\s/;
const TITLE_FORMS = /(^|[^א-ת״׳"])(ד״ר ללום|עו״ד אברהם ללום)/;

for (const it of data.items ?? []) {
  const id = it.id ?? "(no id)";
  const bad = (m) => errors.push(`${id}: ${m}`);
  for (const k of ["id", "date", "dateLabel", "title", "summary", "verified"]) if (!it[k] || typeof it[k] !== "string") bad(`missing ${k}`);
  if (seen.has(it.id)) bad("duplicate id");
  seen.add(it.id);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(it.date ?? "") || Number.isNaN(Date.parse(it.date))) bad("date must be a real ISO date");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(it.verified ?? "")) bad("verified must be an ISO date");
  if (it.date && it.verified && it.verified < it.date) bad("verified before the event date");
  const src = Array.isArray(it.sources) ? it.sources : [];
  if (src.length < 2) bad("two independent sources are required");
  const hosts = new Set();
  for (const s of src) {
    if (!s || typeof s.label !== "string" || !s.label.trim() || typeof s.href !== "string" || !s.href.startsWith("https://")) { bad("each source needs a label and an https href"); continue; }
    try { hosts.add(stem(host(s.href))); } catch { bad(`bad url ${s.href}`); }
  }
  if (src.length >= 2 && hosts.size < 2) bad("sources must come from different publishers");
  if (typeof it.summary === "string" && it.summary.length > 600) bad("summary too long");
  for (const k of ["title", "summary", "dateLabel"]) if (DASH.test(it[k] ?? "")) bad(`${k} uses a dash as punctuation`);
  if (TITLE_FORMS.test(`${it.title} ${it.summary}`)) bad("non canonical form of the name");
  if (it.kind && it.kind !== "development") bad("daily items are developments only; rulings and instruments are added by a person");
}
if (errors.length) { console.error("updates-check failed:\n" + errors.map((e) => "  " + e).join("\n")); process.exit(1); }
console.log(`updates-check: ${(data.items ?? []).length} items ok`);
