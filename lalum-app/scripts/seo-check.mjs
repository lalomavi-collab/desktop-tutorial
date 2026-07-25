// Comprehensive SEO and GEO (AI-engine) checks for the LALUM app.
// Runs against the authored source (index.html and public/*), so it is fast
// and needs no build. Exits non-zero if any critical check fails, so the daily
// audit and CI can gate on it. Warnings are advisory and do not fail the run.
//
// Usage: node scripts/seo-check.mjs  (or: npm run seo-check)

import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => (existsSync(join(root, p)) ? readFileSync(join(root, p), "utf8") : null);

const DOMAIN = "https://lalumapp.com";
const results = [];
const pass = (name) => results.push({ level: "pass", name });
const warn = (name, msg) => results.push({ level: "warn", name, msg });
const fail = (name, msg) => results.push({ level: "fail", name, msg });

// ---------- index.html: meta, social, structured data ----------
const html = read("index.html");
if (!html) {
  fail("index.html", "file missing");
} else {
  const present = (re) => re.test(html);

  const title = (html.match(/<title>([^<]*)<\/title>/) || [])[1] || "";
  if (!title.trim()) fail("title", "empty <title>");
  else if (title.length > 65) warn("title", `${title.length} chars, aim for under 60`);
  else pass("title");

  const desc = (html.match(/<meta\s+name="description"\s+content="([^"]*)"/) || [])[1] || "";
  if (!desc.trim()) fail("meta description", "missing");
  else if (desc.length < 70 || desc.length > 175) warn("meta description", `${desc.length} chars, aim for 120 to 160`);
  else pass("meta description");

  present(/rel="canonical"/) ? pass("canonical") : fail("canonical", "missing");
  present(/<html[^>]+lang=/) ? pass("html lang") : fail("html lang", "missing");
  present(/name="viewport"/) ? pass("viewport") : fail("viewport", "missing");
  present(/name="robots"/) ? pass("robots meta") : warn("robots meta", "missing (optional but recommended)");

  for (const p of ["og:title", "og:description", "og:image", "og:url", "og:type"]) {
    present(new RegExp(`property="${p}"`)) ? pass(`OpenGraph ${p}`) : fail(`OpenGraph ${p}`, "missing");
  }
  present(/name="twitter:card"/) ? pass("twitter:card") : warn("twitter:card", "missing");

  const ld = (html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/) || [])[1];
  if (!ld) {
    fail("JSON-LD", "no structured data (critical for Google and AI engines)");
  } else {
    try {
      const parsed = JSON.parse(ld);
      const graph = parsed["@graph"] || [parsed];
      const types = graph.flatMap((n) => [].concat(n["@type"] || [])).join(",");
      if (!parsed["@context"]) warn("JSON-LD", "no @context");
      else pass("JSON-LD valid");
      /Organization|LegalService|ProfessionalService/.test(types) ? pass("JSON-LD organization") : warn("JSON-LD organization", "no Organization type found");
    } catch (e) {
      fail("JSON-LD", "invalid JSON: " + e.message);
    }
  }

  const mixed = html.match(/http:\/\/(?!www\.w3\.org|schema\.org|localhost|127\.0\.0\.1)/g) || [];
  mixed.length ? fail("mixed content", `${mixed.length} insecure http:// reference(s)`) : pass("no mixed content");
}

// ---------- robots.txt: crawlability and AI bots ----------
const robots = read("public/robots.txt");
if (!robots) {
  fail("robots.txt", "missing");
} else {
  /^\s*Disallow:\s*\/\s*$/m.test(robots) ? fail("robots.txt", "Disallow: / blocks the whole site") : pass("robots.txt not blocking");
  /Sitemap:\s*https:\/\//i.test(robots) ? pass("robots.txt sitemap link") : fail("robots.txt sitemap link", "no Sitemap line");
  const aiBots = ["GPTBot", "OAI-SearchBot", "ClaudeBot", "PerplexityBot", "Google-Extended"];
  const missing = aiBots.filter((b) => !new RegExp(`User-agent:\\s*${b}`, "i").test(robots));
  missing.length ? warn("AI crawlers welcomed", "not listed: " + missing.join(", ")) : pass("AI crawlers welcomed");
}

// ---------- sitemap.xml ----------
const sitemap = read("public/sitemap.xml");
if (!sitemap) {
  fail("sitemap.xml", "missing");
} else {
  const locs = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1].trim());
  locs.length ? pass(`sitemap.xml urls (${locs.length})`) : fail("sitemap.xml urls", "none found");
  const badDomain = locs.filter((u) => !u.startsWith(DOMAIN));
  badDomain.length ? fail("sitemap.xml domain", `${badDomain.length} url(s) not on ${DOMAIN}`) : pass("sitemap.xml domain");
  const insecure = locs.filter((u) => u.startsWith("http://"));
  insecure.length ? fail("sitemap.xml https", `${insecure.length} insecure url(s)`) : pass("sitemap.xml https");
  const dupes = locs.length - new Set(locs).size;
  dupes ? warn("sitemap.xml duplicates", `${dupes} duplicate url(s)`) : pass("sitemap.xml no duplicates");
}

// ---------- llms.txt (GEO) ----------
const llms = read("public/llms.txt");
if (!llms) {
  fail("llms.txt", "missing (needed for AI-engine discoverability)");
} else {
  /^#\s+\S/m.test(llms) ? pass("llms.txt heading") : warn("llms.txt", "no H1 heading");
  /^>\s+\S/m.test(llms) ? pass("llms.txt summary") : warn("llms.txt", "no summary blockquote");
  llms.includes(DOMAIN) ? pass("llms.txt links") : warn("llms.txt", "no links to key pages");
}

// ---------- report ----------
const fails = results.filter((r) => r.level === "fail");
const warns = results.filter((r) => r.level === "warn");
const passes = results.filter((r) => r.level === "pass");
for (const r of results) {
  const tag = r.level === "pass" ? "PASS" : r.level === "warn" ? "WARN" : "FAIL";
  console.log(`[${tag}] ${r.name}${r.msg ? ": " + r.msg : ""}`);
}
console.log(`\n${passes.length} pass, ${warns.length} warn, ${fails.length} fail`);
if (fails.length) {
  console.error("\nSEO/GEO check FAILED");
  process.exit(1);
}
console.log("\nSEO/GEO check passed");
