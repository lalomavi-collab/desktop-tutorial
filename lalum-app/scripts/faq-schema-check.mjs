// Validates the per-page structured-data contract (FAQPage + HowTo) against
// Google's Rich Results requirements, without a build or a browser. Runs in
// plain node like seo-check.mjs. Exits non-zero on any failure so CI and the
// daily audit gate.
//
// Usage: node scripts/faq-schema-check.mjs  (or: npm run faq-check)
//
// It does three things:
//   1. Unit-checks the node builders and page composer (shape, skip-empty,
//      dedupe, @graph composition).
//   2. Guards the architecture: no page/component may hand-roll an inline
//      FAQPage or HowTo block; all schema must go through src/lib/schema.ts.
//   3. Smoke-checks the real homepage Q&A content in strings.ts so a blank
//      question or answer can never ship an invalid entry.

import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => (existsSync(join(root, p)) ? readFileSync(join(root, p), "utf8") : null);

const results = [];
const pass = (name) => results.push({ level: "pass", name });
const fail = (name, msg) => results.push({ level: "fail", name, msg });

// Mirror of src/lib/schema.ts (kept in sync; that file is the app's source of
// truth). Reproduced here so this validator stays a dependency-free plain-node
// script, matching the repo's existing check tooling.
function faqPageNode(pairs) {
  const seen = new Set();
  const mainEntity = pairs
    .map((p) => ({ q: (p?.q ?? "").trim(), a: (p?.a ?? "").trim() }))
    .filter((p) => {
      if (!p.q || !p.a) return false;
      const key = p.q.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .map((p) => ({ "@type": "Question", name: p.q, acceptedAnswer: { "@type": "Answer", text: p.a } }));
  return mainEntity.length ? { "@type": "FAQPage", mainEntity } : null;
}
function howToNode(name, steps) {
  const cleanName = (name ?? "").trim();
  const cleaned = steps
    .map((s) => ({ name: (s?.name ?? "").trim(), text: (s?.text ?? "").trim() }))
    .filter((s) => s.name || s.text);
  if (!cleanName || cleaned.length === 0) return null;
  return {
    "@type": "HowTo",
    name: cleanName,
    step: cleaned.map((s, i) => ({ "@type": "HowToStep", position: i + 1, ...(s.name ? { name: s.name } : {}), text: s.text || s.name })),
  };
}
function pageJsonLd(nodes) {
  const real = nodes.filter(Boolean);
  if (real.length === 0) return null;
  if (real.length === 1) return { "@context": "https://schema.org", ...real[0] };
  return { "@context": "https://schema.org", "@graph": real };
}

// Google's requirements, per type. Returns an array of problems (empty = valid).
function validateNode(node) {
  const problems = [];
  if (node["@type"] === "FAQPage") {
    if (!Array.isArray(node.mainEntity) || node.mainEntity.length === 0) problems.push("FAQPage: empty mainEntity");
    else node.mainEntity.forEach((q, i) => {
      if (q["@type"] !== "Question") problems.push(`FAQPage item ${i}: not a Question`);
      if (!q.name || !q.name.trim()) problems.push(`FAQPage item ${i}: empty name`);
      const ans = q.acceptedAnswer;
      if (!ans || ans["@type"] !== "Answer") problems.push(`FAQPage item ${i}: no Answer`);
      else if (!ans.text || !ans.text.trim()) problems.push(`FAQPage item ${i}: empty answer text`);
    });
  } else if (node["@type"] === "HowTo") {
    if (!node.name || !node.name.trim()) problems.push("HowTo: empty name");
    if (!Array.isArray(node.step) || node.step.length === 0) problems.push("HowTo: no steps");
    else node.step.forEach((s, i) => {
      if (s["@type"] !== "HowToStep") problems.push(`HowTo step ${i}: not a HowToStep`);
      if (!s.text || !s.text.trim()) problems.push(`HowTo step ${i}: empty text`);
    });
  } else {
    problems.push(`unexpected @type: ${node["@type"]}`);
  }
  return problems;
}

// Validate a composed page object (single node or @graph), including @context.
function validatePage(obj) {
  const problems = [];
  if (obj["@context"] !== "https://schema.org") problems.push("wrong @context");
  const nodes = obj["@graph"] || [obj];
  for (const n of nodes) problems.push(...validateNode(n));
  try { JSON.parse(JSON.stringify(obj)); } catch (e) { problems.push("not JSON-serializable: " + e.message); }
  return problems;
}

// ---------- 1. builder + composer contract ----------
{
  const faq = pageJsonLd([faqPageNode([{ q: "Q1", a: "A1" }, { q: "Q2", a: "A2" }])]);
  let p = faq ? validatePage(faq) : ["null for valid FAQ"];
  p.length ? fail("FAQPage: valid input", p.join("; ")) : pass("FAQPage: valid input");

  faqPageNode([]) === null ? pass("FAQPage: empty -> null (skips block)") : fail("FAQPage: empty -> null", "expected null");
  const deduped = faqPageNode([{ q: "Same", a: "A1" }, { q: "same", a: "A2" }]);
  deduped && deduped.mainEntity.length === 1 ? pass("FAQPage: duplicate question deduped") : fail("FAQPage: dedupe", "expected 1 entity");

  const how = pageJsonLd([howToNode("How to X", [{ name: "S1", text: "Do 1" }, { name: "S2", text: "Do 2" }])]);
  p = how ? validatePage(how) : ["null for valid HowTo"];
  p.length ? fail("HowTo: valid input", p.join("; ")) : pass("HowTo: valid input");
  const positions = how && !how["@graph"] ? how.step.map((s) => s.position).join(",") : "";
  positions === "1,2" ? pass("HowTo: steps ordered 1..n") : fail("HowTo: step order", `got ${positions}`);
  howToNode("X", []) === null ? pass("HowTo: no steps -> null") : fail("HowTo: no steps", "expected null");
  howToNode("", [{ name: "s", text: "t" }]) === null ? pass("HowTo: no name -> null") : fail("HowTo: no name", "expected null");

  // Composition: two nodes -> one @graph with @context once.
  const graph = pageJsonLd([faqPageNode([{ q: "Q", a: "A" }]), howToNode("H", [{ name: "s", text: "t" }])]);
  graph && Array.isArray(graph["@graph"]) && graph["@graph"].length === 2 && graph["@context"]
    ? pass("compose: FAQPage + HowTo -> single @graph")
    : fail("compose: @graph", "expected a 2-node @graph with @context");
  pageJsonLd([null, null]) === null ? pass("compose: all-empty -> null") : fail("compose: all-empty", "expected null");
}

// ---------- 2. architecture guard: no inline FAQPage/HowTo outside schema.ts ----------
{
  const srcDir = join(root, "src");
  const offenders = [];
  const walk = (dir) => {
    for (const name of readdirSync(dir)) {
      const full = join(dir, name);
      if (statSync(full).isDirectory()) { walk(full); continue; }
      if (!/\.(ts|tsx)$/.test(name)) continue;
      if (full.endsWith(join("lib", "schema.ts"))) continue; // the one allowed definition
      const src = readFileSync(full, "utf8");
      if (/["']@type["']\s*:\s*["'](FAQPage|HowTo)["']/.test(src)) offenders.push(full.replace(root + "/", ""));
    }
  };
  if (existsSync(srcDir)) walk(srcDir);
  offenders.length
    ? fail("no inline FAQPage/HowTo blocks", `use schema.ts builders instead in: ${offenders.join(", ")}`)
    : pass("no inline FAQPage/HowTo blocks (all via schema.ts)");
}

// ---------- 3. real homepage content smoke test ----------
{
  const strings = read("src/lib/strings.ts") || "";
  const pairs = [...strings.matchAll(/\{\s*q:\s*"((?:[^"\\]|\\.)*)"\s*,\s*a:\s*"((?:[^"\\]|\\.)*)"\s*\}/g)]
    .map((m) => ({ q: m[1], a: m[2] }));
  if (pairs.length < 2) {
    fail("homepage FAQ content", "could not extract data.faqs pairs from strings.ts");
  } else {
    const built = pageJsonLd([faqPageNode(pairs)]);
    const problems = built ? validatePage(built) : ["built null from real content"];
    problems.length
      ? fail("homepage FAQ content", problems.slice(0, 4).join("; "))
      : pass(`homepage FAQ content (${built.mainEntity.length} valid Q&A)`);
  }
}

// ---------- report ----------
const fails = results.filter((r) => r.level === "fail");
for (const r of results) console.log(`[${r.level === "pass" ? "PASS" : "FAIL"}] ${r.name}${r.msg ? ": " + r.msg : ""}`);
console.log(`\n${results.length - fails.length} pass, ${fails.length} fail`);
if (fails.length) { console.error("\nStructured-data check FAILED"); process.exit(1); }
console.log("\nStructured-data check passed");
