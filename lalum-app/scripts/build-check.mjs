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

// A path is served if the exact file exists, the directory has an index, or a
// file of the same name with .html appended exists. The third case is how the
// host serves an extension-less page written straight into public/, and leaving
// it out made this check report a page that is live and returns 200.
function served(urlPath) {
  const p = decodeURIComponent(urlPath.replace(/\/+$/, ""));
  if (p === "" || p === "/") return existsSync(join(dist, "index.html"));
  const f = join(dist, p);
  if (existsSync(f) && statSync(f).isFile()) return true;
  if (existsSync(join(f, "index.html"))) return true;
  return existsSync(`${f}.html`);
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

// 6. Two articles must not compete for the same query. Nine of them did: seven
//    titles were variations on each other and two were cut to the same 60
//    characters, so Google picked one and diluted the rest. The bodies were not
//    duplicates at all, which is why nothing before this noticed.
//
//    Scoped to articles. The risk-result pages are deliberately parallel, three
//    bands of the same sentence per track, and they are not competing: each
//    answers a different score.
//
//    The threshold is measured, not guessed. The pairs that had to be rewritten
//    scored 0.50 to 0.67; the closest legitimate pair in the corpus scores 0.44.
const STOP = new Set("של על עם את מה למה איך כיצד מתי האם הוא היא זה זו כל לא אם אבל או גם בין יותר רק lalum".split(" "));
const titleTokens = (t) =>
  new Set(
    (t.toLowerCase().match(/[\p{L}\p{N}"']+/gu) || []).filter((w) => w.length > 2 && !STOP.has(w)),
  );

const articles = [];
for (const p of pages) {
  const r = rel(p);
  if (!r.startsWith("/insights/") || r.startsWith("/insights/topics/") || r === "/insights/index.html") continue;
  const h = readFileSync(p, "utf8");
  const t = (/<title>([\s\S]*?)<\/title>/.exec(h) || [])[1];
  if (t) articles.push({ path: r, title: t, tokens: titleTokens(t) });
}
const clashes = [];
for (let i = 0; i < articles.length; i++) {
  for (let j = i + 1; j < articles.length; j++) {
    const a = articles[i], b = articles[j];
    if (!a.tokens.size || !b.tokens.size) continue;
    let shared = 0;
    for (const w of a.tokens) if (b.tokens.has(w)) shared++;
    const score = shared / (a.tokens.size + b.tokens.size - shared);
    if (score >= 0.5) clashes.push(`${a.title} || ${b.title}`);
  }
}
clashes.length
  ? fail("no two articles compete for one query", `${clashes.length} near-duplicate title pair(s), e.g. ${clashes[0]}`)
  : pass(`no two articles compete for one query (${articles.length} articles)`);

// 7. Two documents with the same meta description are the same page under two
//    addresses. That is how the article published twice under two titles was
//    found, after every other check passed it.
const byDesc = new Map();
for (const p of pages) {
  const h = readFileSync(p, "utf8");
  if (/name="robots" content="noindex/.test(h)) continue;
  const d = (/name="description" content="([^"]*)"/.exec(h) || [])[1];
  if (!d) continue;
  byDesc.set(d, [...(byDesc.get(d) || []), rel(p)]);
}
const sharedDesc = [...byDesc.values()].filter((v) => v.length > 1);
sharedDesc.length
  ? fail("every description is unique", `${sharedDesc.length} description(s) shared, e.g. ${sharedDesc[0].join(" and ")}`)
  : pass(`every description is unique (${byDesc.size})`);

// 8. One form of the name, everywhere the site speaks. The app used
//    "ד״ר אברהם ללום" and the article metadata used "עו״ד אברהם ללום", so the
//    same person appeared under two titles depending on which page you landed
//    on. Any titled mention must now be the canonical form.
//
//    Untitled mentions are left alone: repeating the full form in every
//    sentence is not consistency, it is unreadable Hebrew. And JSON-LD is
//    skipped, because alternateName deliberately carries the other spellings:
//    those are what people type into a search box, and the entity needs them.
const CANON_NAME = "ד״ר עו״ד אברהם ללום";
// A later mention in the same piece may be the short form. Repeating the full
// form in every sentence is not consistency, it is unreadable Hebrew.
const SHORT_NAME = "ד״ר ללום";
const TITLED = /(?:(?:ד["״]ר|עו["״]ד|ו?דוקטורנט)(?:\s+למשפטים)?\s+)+(?:אברהם\s+)?ללום/g;
let nameOff = 0;
const nameSample = [];
for (const p of pages) {
  // &quot; is decoded first. The prerender escapes an ASCII quote, so a name
  // written "ד&quot;ר אברהם ללום" read as unmatched text and slipped past this
  // check for as long as it has existed. Two meta descriptions carried it.
  const h = readFileSync(p, "utf8").replace(/<script[\s\S]*?<\/script>/g, "").replace(/&quot;/g, '"');
  for (const m of h.matchAll(TITLED)) {
    if (m[0] !== CANON_NAME && m[0] !== SHORT_NAME) {
      nameOff++;
      if (nameSample.length < 3) nameSample.push(`${rel(p)}: ${m[0]}`);
    }
  }
}
nameOff
  ? fail("one form of the name", `${nameOff} titled mention(s) differ from ${CANON_NAME}, e.g. ${nameSample.join("; ")}`)
  : pass(`one form of the name (${CANON_NAME})`);

// 9. The two areas the practice leads with must be reachable from every
//    document, and must not be outranked by the one it does not lead with.
//
//    The navigation linked neither of them. /advisory ("Advisory") sat in the
//    top bar, the two pillar pages carrying the whole positioning were
//    reachable only from the footer and from the middle of the home page, and
//    the mediation pillar carried the same sitemap priority as both. Every
//    check above passed the whole time, because each one asks whether a page is
//    correct, and none asks what the site says it is about.
const LEAD_PILLARS = ["/real-estate-legal-advisory/", "/ai-legal-advisory/"];
const MEDIATION_PILLAR = "/mediation-dispute-resolution/";

const unlinked = [];
for (const p of pages) {
  const h = readFileSync(p, "utf8");
  // The sign-in form and the client area are deliberately minimal and carry no
  // site navigation at all, so there is nothing there to lead with.
  if (/name="robots" content="noindex/.test(h)) continue;
  const missing = LEAD_PILLARS.filter((u) => !h.includes(`href="${u}"`));
  if (missing.length) unlinked.push(`${rel(p)} (${missing.join(", ")})`);
}
unlinked.length
  ? fail("every page links both focus areas", `${unlinked.length} document(s) link neither or only one, e.g. ${unlinked[0]}`)
  : pass(`every page links both focus areas (${pages.length - unlinked.length})`);

// Sitemap priority is a weak signal on its own, but it is the site stating its
// own order of importance, and it stated the wrong one.
if (existsSync(smPath)) {
  const xml = readFileSync(smPath, "utf8");
  const priorityOf = (path) => {
    const m = new RegExp(`<loc>${DOMAIN}${path}</loc>[^<]*(?:<[^>]+>[^<]*)*?<priority>([\\d.]+)</priority>`).exec(xml);
    return m ? Number(m[1]) : null;
  };
  const med = priorityOf(MEDIATION_PILLAR);
  const leads = LEAD_PILLARS.map((u) => priorityOf(u));
  if (med === null || leads.some((v) => v === null)) {
    fail("the two focus areas outrank mediation", "a pillar page is missing from the sitemap");
  } else if (leads.some((v) => v <= med)) {
    fail("the two focus areas outrank mediation", `mediation is at ${med}, the focus areas at ${leads.join(" and ")}`);
  } else {
    pass(`the two focus areas outrank mediation (${leads.join(" and ")} vs ${med})`);
  }
}

// 10. The mediation cluster does not grow. It holds 64 pieces, which is more
//     than any other subject on the site, and the practice does not lead with
//     it: the pages stay live and keep working, and nothing new is written for
//     them. The daily writing task picks its own topic, so this is the line
//     that stops a drift back, rather than a sentence in a document that a
//     future run may or may not weigh.
//
//     A legitimate article can also trip this by being classified into
//     mediation when it belongs elsewhere, and that is worth catching too: it
//     would have landed on the wrong hub and next to the wrong related pieces.
const MEDIATION_CAP = 64;
const medHub = `href="/insights/topics/mediation/"`;
const medArticles = pages.filter((p) => {
  const r = rel(p);
  if (!r.startsWith("/insights/") || r.startsWith("/insights/topics/") || r === "/insights/index.html") return false;
  return readFileSync(p, "utf8").includes(medHub);
});
medArticles.length > MEDIATION_CAP
  ? fail("the mediation cluster does not grow", `${medArticles.length} articles, ${MEDIATION_CAP} allowed. Either a new mediation piece was written, which the positioning rules out, or a piece belonging to one of the two focus areas was classified into mediation and needs its title or its keywords looked at.`)
  : pass(`the mediation cluster does not grow (${medArticles.length}/${MEDIATION_CAP})`);

// 11. Hebrew acronyms carry gershayim, not an ASCII double quote. The corpus
//     held both forms of the same word, 1133 occurrences of one and 570 of the
//     other, sometimes inside a single article: נדל"ן next to נדל״ן. It is the
//     wrong character (a screen reader announces a quotation where the text
//     means an abbreviation), and it hid a real defect: the prerender escapes
//     an ASCII quote to &quot;, so "ד&quot;ר אברהם ללום" slipped past the name
//     check above and sat in two meta descriptions.
//
//     A single letter followed by a two letter word is a prefix and an opening
//     quotation mark (ש"יש), not an acronym, and is left alone. Every genuine
//     one letter acronym takes exactly one letter after the marker: ד"ר, ת"א,
//     ש"ח, מ"ר.
const HEB = "\u05d0-\u05ea";
const ASCII_GERSHAYIM = new RegExp(`(?<![${HEB}])([${HEB}]+)&quot;([${HEB}]{1,2})(?![${HEB}]|&quot;)`, "g");
let gersh = 0;
const gershSample = [];
for (const p of pages) {
  for (const m of readFileSync(p, "utf8").matchAll(ASCII_GERSHAYIM)) {
    if (m[1].length === 1 && m[2].length === 2) continue;
    gersh++;
    if (gershSample.length < 3) gershSample.push(`${rel(p)}: ${m[1]}"${m[2]}`);
  }
}
gersh
  ? fail("Hebrew acronyms use gershayim", `${gersh} acronym(s) written with an ASCII quote, e.g. ${gershSample.join("; ")}`)
  : pass("Hebrew acronyms use gershayim");

// 12. Structured data must parse, and every article must carry the markup that
//     earns it a rich result: BlogPosting for the headline, author and date,
//     BreadcrumbList for the trail Google prints under the title. A single
//     malformed block silently drops a page out of rich results, and nothing
//     visible on the page changes, so this is invisible without a parser.
//
//     The audit that led to this check first read the site as having no article
//     markup at all: its regex assumed one attribute order and the documents use
//     another. The lesson is in the pattern below, which does not care.
const LD = /<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g;
const collectTypes = (node, out = []) => {
  if (Array.isArray(node)) { for (const n of node) collectTypes(n, out); return out; }
  if (!node || typeof node !== "object") return out;
  if (node["@type"]) out.push(...[].concat(node["@type"]));
  for (const k of ["@graph", "mainEntity", "itemListElement"]) if (node[k]) collectTypes(node[k], out);
  return out;
};
const malformed = [];
const missingMarkup = [];
let ldBlocks = 0, articleNodes = 0;
for (const p of pages) {
  const h = readFileSync(p, "utf8");
  const r = rel(p);
  const found = [];
  for (const m of h.matchAll(LD)) {
    ldBlocks++;
    try { found.push(...collectTypes(JSON.parse(m[1]))); }
    catch (e) { malformed.push(`${r}: ${e.message.slice(0, 60)}`); }
  }
  const isArticle = r.startsWith("/insights/") && !r.startsWith("/insights/topics/") && r !== "/insights/index.html";
  if (isArticle) {
    if (found.includes("BlogPosting") && found.includes("BreadcrumbList")) articleNodes++;
    else missingMarkup.push(`${r} (has ${found.join(", ") || "nothing"})`);
  }
}
malformed.length
  ? fail("structured data parses", `${malformed.length} malformed block(s), e.g. ${malformed[0]}`)
  : pass(`structured data parses (${ldBlocks} blocks)`);
missingMarkup.length
  ? fail("every article carries article markup", `${missingMarkup.length} article(s) without BlogPosting and BreadcrumbList, e.g. ${missingMarkup[0]}`)
  : pass(`every article carries article markup (${articleNodes})`);

for (const r of results) console.log(`[${r.level === "pass" ? "PASS" : "FAIL"}] ${r.name}${r.msg ? ": " + r.msg : ""}`);
const fails = results.filter((r) => r.level === "fail");
console.log(`\n${results.length - fails.length} pass, ${fails.length} fail`);
if (fails.length) {
  console.error("\nBuild output check FAILED");
  process.exit(1);
}
console.log("\nBuild output check passed");
