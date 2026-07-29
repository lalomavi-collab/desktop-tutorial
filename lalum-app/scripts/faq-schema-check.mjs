// Validates the FAQPage JSON-LD contract against Google's Rich Results
// requirements, without needing a build or a browser. Runs in plain node like
// seo-check.mjs. Exits non-zero on any failure so CI and the daily audit gate.
//
// Usage: node scripts/faq-schema-check.mjs  (or: npm run faq-check)
//
// It does three things:
//   1. Unit-checks the FAQPage builder contract (shape, skip-empty, dedupe).
//   2. Guards the architecture: no page/component may hand-roll an inline
//      FAQPage block; all schema must go through src/lib/faqSchema.ts.
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

// Mirror of src/lib/faqSchema.ts buildFaqPage (kept in sync; that file is the
// app's source of truth). Reproduced here so this validator stays a dependency
// free plain-node script, matching the repo's existing check tooling.
function buildFaqPage(pairs) {
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
  return mainEntity.length ? { "@context": "https://schema.org", "@type": "FAQPage", mainEntity } : null;
}

// Google's FAQPage requirements: a FAQPage with a non-empty mainEntity, where
// every item is a Question with non-empty name and a nested Answer with
// non-empty text. Returns an array of problems (empty means valid).
function validateFaqPage(obj) {
  const problems = [];
  if (obj["@context"] !== "https://schema.org") problems.push("wrong @context");
  if (obj["@type"] !== "FAQPage") problems.push("wrong @type");
  if (!Array.isArray(obj.mainEntity) || obj.mainEntity.length === 0) {
    problems.push("empty mainEntity");
    return problems;
  }
  obj.mainEntity.forEach((q, i) => {
    if (q["@type"] !== "Question") problems.push(`item ${i}: not a Question`);
    if (!q.name || !q.name.trim()) problems.push(`item ${i}: empty name`);
    const ans = q.acceptedAnswer;
    if (!ans || ans["@type"] !== "Answer") problems.push(`item ${i}: no Answer`);
    else if (!ans.text || !ans.text.trim()) problems.push(`item ${i}: empty answer text`);
  });
  // JSON must round-trip (guards against non-serializable content).
  try { JSON.parse(JSON.stringify(obj)); } catch (e) { problems.push("not JSON-serializable: " + e.message); }
  return problems;
}

// ---------- 1. builder contract ----------
{
  const valid = buildFaqPage([{ q: "Q1", a: "A1" }, { q: "Q2", a: "A2" }]);
  const problems = valid ? validateFaqPage(valid) : ["returned null for valid input"];
  problems.length ? fail("builder: valid input", problems.join("; ")) : pass("builder: valid input");

  buildFaqPage([]) === null ? pass("builder: empty -> null (skips block)") : fail("builder: empty -> null", "expected null");
  buildFaqPage([{ q: " ", a: "x" }, { q: "x", a: " " }]) === null
    ? pass("builder: blank q/a dropped -> null")
    : fail("builder: blank q/a dropped", "expected null");

  const deduped = buildFaqPage([{ q: "Same", a: "A1" }, { q: "same", a: "A2" }]);
  deduped && deduped.mainEntity.length === 1
    ? pass("builder: duplicate question deduped")
    : fail("builder: duplicate question deduped", `expected 1 entity, got ${deduped ? deduped.mainEntity.length : "null"}`);
}

// ---------- 2. architecture guard: no inline FAQPage outside the builder ----------
{
  const srcDir = join(root, "src");
  const offenders = [];
  const walk = (dir) => {
    for (const name of readdirSync(dir)) {
      const full = join(dir, name);
      if (statSync(full).isDirectory()) { walk(full); continue; }
      if (!/\.(ts|tsx)$/.test(name)) continue;
      if (full.endsWith(join("lib", "faqSchema.ts"))) continue; // the one allowed definition
      const src = readFileSync(full, "utf8");
      if (/["']@type["']\s*:\s*["']FAQPage["']/.test(src)) offenders.push(full.replace(root + "/", ""));
    }
  };
  if (existsSync(srcDir)) walk(srcDir);
  offenders.length
    ? fail("no inline FAQPage blocks", `use buildFaqPage instead in: ${offenders.join(", ")}`)
    : pass("no inline FAQPage blocks (all via buildFaqPage)");
}

// ---------- 3. real homepage content smoke test ----------
{
  const strings = read("src/lib/strings.ts") || "";
  // Pull every { q: "...", a: "..." } pair from the data.faqs arrays (he + en).
  const pairs = [...strings.matchAll(/\{\s*q:\s*"((?:[^"\\]|\\.)*)"\s*,\s*a:\s*"((?:[^"\\]|\\.)*)"\s*\}/g)]
    .map((m) => ({ q: m[1], a: m[2] }));
  if (pairs.length < 2) {
    fail("homepage FAQ content", "could not extract data.faqs pairs from strings.ts");
  } else {
    const built = buildFaqPage(pairs);
    const problems = built ? validateFaqPage(built) : ["built null from real content"];
    problems.length
      ? fail("homepage FAQ content", problems.slice(0, 4).join("; "))
      : pass(`homepage FAQ content (${built.mainEntity.length} valid Q&A)`);
  }
}

// ---------- report ----------
const fails = results.filter((r) => r.level === "fail");
for (const r of results) console.log(`[${r.level === "pass" ? "PASS" : "FAIL"}] ${r.name}${r.msg ? ": " + r.msg : ""}`);
console.log(`\n${results.length - fails.length} pass, ${fails.length} fail`);
if (fails.length) { console.error("\nFAQPage schema check FAILED"); process.exit(1); }
console.log("\nFAQPage schema check passed");
