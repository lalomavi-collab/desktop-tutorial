// Ask Google, URL by URL, whether each sitemap page is indexed and why not.
//
// Why this exists: the Search Console "Pages" report says how many URLs are not
// indexed (874 on 2026-10-16) but the API that powers the other pull
// (search-console.mjs) only returns performance, so the reasons stayed hidden
// in a web UI nobody can query. The URL Inspection API returns the same
// verdict per URL: coverageState ("Crawled - currently not indexed",
// "Discovered - currently not indexed", "Submitted and indexed", ...), the
// canonical Google chose against the one the page declares, and the last crawl
// time. One run turns "874 pages are not indexed" into a list of which pages,
// and for each, the reason.
//
// It reuses the service account of search-console.mjs (readonly scope is
// enough for inspection). Quota is 2000 inspections a day per property and 600
// a minute, so the run is capped and paced.
//
//   GSC_SERVICE_ACCOUNT_JSON='{...}' node scripts/gsc-inspect.mjs
//   INSPECT_LIMIT=300 INSPECT_SITEMAP=dist/sitemap.xml node scripts/gsc-inspect.mjs
//
// Output: data/search-console/inspection-latest.json and a printed summary
// grouped by coverageState.

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { accessToken } from "./search-console.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const SITE = process.env.GSC_SITE_URL || "https://lalumapp.com/";
const LIMIT = Number(process.env.INSPECT_LIMIT || 1900);
const CONCURRENCY = 4;
const ENDPOINT = "https://searchconsole.googleapis.com/v1/urlInspection/index:inspect";

async function sitemapUrls() {
  const local = process.env.INSPECT_SITEMAP;
  const xml = local && existsSync(local)
    ? readFileSync(local, "utf8")
    : await (await fetch(`${new URL(SITE).origin}/sitemap.xml`)).text();
  return [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1].trim());
}

async function inspect(token, url) {
  for (let attempt = 0; attempt < 4; attempt++) {
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: JSON.stringify({ inspectionUrl: url, siteUrl: SITE, languageCode: "en-US" }),
    });
    if (res.status === 429 || res.status >= 500) {
      await new Promise((r) => setTimeout(r, 2000 * (attempt + 1)));
      continue;
    }
    const body = await res.json().catch(() => ({}));
    if (!res.ok) return { url, error: `${res.status} ${JSON.stringify(body).slice(0, 200)}` };
    const r = body.inspectionResult?.indexStatusResult || {};
    return {
      url,
      verdict: r.verdict,
      coverageState: r.coverageState,
      indexingState: r.indexingState,
      robotsTxtState: r.robotsTxtState,
      pageFetchState: r.pageFetchState,
      lastCrawlTime: r.lastCrawlTime,
      googleCanonical: r.googleCanonical,
      userCanonical: r.userCanonical,
      sitemap: r.sitemap,
    };
  }
  return { url, error: "rate limited after retries" };
}

async function main() {
  const raw = process.env.GSC_SERVICE_ACCOUNT_JSON;
  if (!raw) { console.error("GSC_SERVICE_ACCOUNT_JSON is not set. See docs/search-console-setup.md."); process.exit(1); }
  const token = await accessToken(JSON.parse(raw));

  const urls = (await sitemapUrls()).slice(0, LIMIT);
  console.log(`inspecting ${urls.length} sitemap URLs against ${SITE}`);

  const results = [];
  let next = 0;
  await Promise.all(Array.from({ length: CONCURRENCY }, async () => {
    while (next < urls.length) {
      const url = urls[next++];
      results.push(await inspect(token, url));
      if (results.length % 50 === 0) console.log(`  ${results.length}/${urls.length}`);
    }
  }));

  const groups = {};
  for (const r of results) {
    const k = r.error ? `ERROR: ${r.error.slice(0, 60)}` : r.coverageState || "unknown";
    (groups[k] ||= []).push(r.url);
  }
  const out = {
    site: SITE,
    inspectedAt: new Date().toISOString(),
    count: results.length,
    summary: Object.fromEntries(Object.entries(groups).map(([k, v]) => [k, v.length])),
    // A canonical Google picked that differs from the one the page declares is
    // the signal that two pages were judged duplicates of each other.
    canonicalMismatch: results.filter((r) => r.googleCanonical && r.userCanonical && r.googleCanonical !== r.userCanonical)
      .map((r) => ({ url: r.url, declared: r.userCanonical, chosen: r.googleCanonical })),
    results: results.sort((a, b) => a.url.localeCompare(b.url)),
  };
  const dir = join(root, "data", "search-console");
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "inspection-latest.json"), JSON.stringify(out, null, 1), "utf8");

  console.log("\ncoverage of the sitemap, by Google's own state:");
  for (const [k, v] of Object.entries(groups).sort((a, b) => b[1].length - a[1].length)) console.log(`  ${String(v.length).padStart(4)}  ${k}`);
  console.log(`  canonical chosen by Google differs from declared: ${out.canonicalMismatch.length}`);
}

if (process.argv[1] && process.argv[1].endsWith("gsc-inspect.mjs")) await main();
