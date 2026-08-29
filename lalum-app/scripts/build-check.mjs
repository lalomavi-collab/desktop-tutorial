// Sanity checks on the PRERENDERED OUTPUT in dist/.
//
// seo-check reads the authored source, so it cannot see a defect that the
// prerender introduces. Two such defects reached production before this file
// existed, and both passed every check that was running at the time:
//
//   1. A loop over `QA.a` treated a string as a list of paragraphs and emitted
//      one <p> per character, filling /advisory with 164 single-letter tags.
//   2. Every route shipped the same generic English fallback body, so a crawler
//      that skips JavaScript read the same off-topic H1 on all 161 documents.
//
// Runs as `postbuild`, so `npm run build` fails on a broken output rather than
// deploying it.

import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, relative } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dist = join(root, "dist");
const DOMAIN = "https://lalumapp.com";
// The exact H1 of the template fallback. An earlier, looser marker matched a
// legitimate English sentence in the translated pillar copy.
const FALLBACK_MARKER = "<h1>LALUM, Legal AI and AI Risk Governance</h1>";

const results = [];
const pass = (n) => results.push({ level: "pass", name: n });
const fail = (n, m) => results.push({ level: "fail", name: n, msg: m });

if (!existsSync(dist)) {
  console.error("[FAIL] dist/ missing, run the build first");
  process.exit(1);
}

function walk(dir, out = []) {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (e === "index.html") out.push(p);
  }
  return out;
}
const pages = walk(dist);
const rel = (p) => "/" + relative(dist, p).replace(/\\/g, "/");

// A path is served if the exact file exists or the directory has an index.
function served(urlPath) {
  const p = decodeURIComponent(urlPath.replace(/\/+$/, ""));
  if (p === "" || p === "/") return existsSync(join(dist, "index.html"));
  const f = join(dist, p);
  return existsSync(f) && statSync(f).isFile() ? true : existsSync(join(f, "index.html"));
}

const bodyOf = (h) => {
  const m = /<body[^>]*>([\s\S]*)<\/body>/.exec(h);
  return m ? m[1].replace(/<script[\s\S]*?<\/script>/g, "") : "";
};
const textOf = (b) => b.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();

// 1. One <p> per character.
const charParas = pages.filter((p) => /<p>.<\/p>/.test(readFileSync(p, "utf8")));
charParas.length
  ? fail("no single-character paragraphs", `${charParas.length} file(s), e.g. ${rel(charParas[0])}. A string was iterated as if it were a list of paragraphs.`)
  : pass("no single-character paragraphs");

// 2. The generic app-shell fallback must not survive into a prerendered route.
const stale = pages.filter((p) => rel(p) !== "/index.html" && readFileSync(p, "utf8").includes(FALLBACK_MARKER));
stale.length
  ? fail("no stale app-shell fallback", `${stale.length} route(s) still carry the generic English fallback, e.g. ${rel(stale[0])}`)
  : pass("no stale app-shell fallback");

// 3. Every prerendered route must carry real content, not an empty shell.
// noindex pages (sign-in, client area) are deliberately minimal.
const thin = pages.filter((p) => {
  const h = readFileSync(p, "utf8");
  if (/name="robots" content="noindex/.test(h)) return false;
  return textOf(bodyOf(h)).length < 100;
});
thin.length
  ? fail("every route has body content", `${thin.length} route(s) under 100 chars of visible text, e.g. ${rel(thin[0])}`)
  : pass("every route has body content");

// 4. Every sitemap URL must resolve. There is no SPA catch-all any more, so a
//    stale entry is a real 404 rather than a silently served shell.
const smPath = join(dist, "sitemap.xml");
if (!existsSync(smPath)) {
  fail("sitemap resolves", "dist/sitemap.xml missing");
} else {
  const locs = [...readFileSync(smPath, "utf8").matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
  const dead = locs.filter((u) => !served(u.replace(DOMAIN, "")));
  dead.length
    ? fail("sitemap resolves", `${dead.length} of ${locs.length} sitemap URLs have no file, e.g. ${dead[0]}`)
    : pass(`sitemap resolves (${locs.length} urls)`);
}

// 5. Every hreflang alternate must point at a document that exists, and each
//    language variant must be its own canonical. An alternate whose target
//    declares a different canonical is folded away by Google as a duplicate,
//    which is exactly what happened to the ?lang= URLs.
let altDead = 0, badCanon = 0, altTotal = 0;
for (const p of pages) {
  const h = readFileSync(p, "utf8");
  const alts = [...h.matchAll(/rel="alternate" hreflang="[^"]*" href="([^"]+)"/g)].map((m) => m[1]);
  altTotal += alts.length;
  for (const a of alts) if (!served(a.replace(DOMAIN, ""))) altDead++;
  const canon = (/rel="canonical" href="([^"]+)"/.exec(h) || [])[1];
  if (canon && alts.length) {
    const self = DOMAIN + rel(p).replace(/index\.html$/, "");
    if (canon.replace(/\/$/, "") !== self.replace(/\/$/, "")) badCanon++;
  }
}
altDead ? fail("hreflang targets exist", `${altDead} alternate href(s) have no file`) : pass(`hreflang targets exist (${altTotal})`);
badCanon ? fail("language variants self-canonical", `${badCanon} document(s) claim alternates but canonicalise elsewhere`) : pass("language variants self-canonical");

for (const r of results) console.log(`[${r.level === "pass" ? "PASS" : "FAIL"}] ${r.name}${r.msg ? ": " + r.msg : ""}`);
const fails = results.filter((r) => r.level === "fail");
console.log(`\n${results.length - fails.length} pass, ${fails.length} fail`);
if (fails.length) {
  console.error("\nBuild output check FAILED");
  process.exit(1);
}
console.log("\nBuild output check passed");
