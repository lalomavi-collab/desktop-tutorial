// Checks which documents a re-analysis covers and how it walks them (src/lib/cockpit/reanalyze.ts). Run: npm run reanalyze-check.
import assert from "node:assert/strict";
import { readFileSync, writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import ts from "typescript";

const dir = mkdtempSync(join(tmpdir(), "reanalyze-"));
for (const n of ["bulk", "reanalyze"]) {
  const src = readFileSync(new URL(`../src/lib/cockpit/${n}.ts`, import.meta.url), "utf8").replace('from "./bulk"', 'from "./bulk.mjs"');
  writeFileSync(join(dir, `${n}.mjs`), ts.transpileModule(src, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 } }).outputText);
}
const { eligibleDocs, isAssessed, reanalyzeDocs, reanalyzePlan, buildPlan, countByType, UNTYPED, ASSESSED_TYPES } = await import(pathToFileURL(join(dir, "reanalyze.mjs")).href);

assert.deepEqual(ASSESSED_TYPES, ["CONTRACT", "COURT_FILING"], "same types as the matter rollup in migration 0042");
assert.equal(isAssessed(null), true); assert.equal(isAssessed(undefined), true); assert.equal(isAssessed(""), true);
for (const t of ["CONTRACT", "COURT_FILING"]) assert.equal(isAssessed(t), true);
for (const t of ["OPINION", "CORRESPONDENCE", "EVIDENCE", "AUTHORITY"]) assert.equal(isAssessed(t), false, t);

const docs = [
  { id: "a", doc_type: "CONTRACT", editor_content: "x" }, { id: "b", doc_type: "OPINION", editor_content: "x" },
  { id: "c", doc_type: null, editor_content: "x" }, { id: "d", doc_type: "CONTRACT", editor_content: "   " }, { id: "e", doc_type: "COURT_FILING", editor_content: "x" },
];
assert.deepEqual(eligibleDocs(docs).map((d) => d.id), ["a", "c", "e"], "typed as inputs and empty documents are left out");

const A = { findings: [], risk: { level: "COMPLIANT", score: 100, red: 0, yellow: 0, green: 1 } };
const calls = [], stored = [];
const analyze = async (text, area) => { calls.push([text, area]); return { ok: true, analysis: A }; };
const store = async (id, an, area) => { stored.push([id, area]); return { ok: true }; };
const r = await reanalyzeDocs(eligibleDocs(docs), "REAL_ESTATE", analyze, store);
assert.deepEqual(r.done, ["a", "c", "e"]); assert.equal(r.failed.length, 0);
assert.ok(calls.every((c) => c[1] === "REAL_ESTATE"), "the chosen area goes to every analysis");
assert.deepEqual(stored, [["a", "REAL_ESTATE"], ["c", "REAL_ESTATE"], ["e", "REAL_ESTATE"]], "each result is stored with its area, in order");

// analysis fails for one document: nothing is stored for it, the rest continue
stored.length = 0;
const r2 = await reanalyzeDocs(eligibleDocs(docs), "REAL_ESTATE", async (t, a) => (t === "x" && calls.length++ % 2 === 0 ? { ok: false, error: "pii" } : { ok: true, analysis: A }), store);
assert.equal(r2.failed.length + r2.done.length, 3);
assert.ok(r2.failed.every((f) => !stored.some((s) => s[0] === f.id)), "a failed analysis is never stored");

// store refuses one: reported by id with the reason
const r3 = await reanalyzeDocs(eligibleDocs(docs), "LITIGATION", analyze, async (id) => (id === "c" ? { ok: false, error: "not allowed" } : { ok: true }));
assert.deepEqual(r3.failed, [{ id: "c", error: "not allowed" }]); assert.deepEqual(r3.done, ["a", "e"]);
// analyze says ok but returns nothing: a failure, not a store of nothing
const r4 = await reanalyzeDocs([{ id: "z", editor_content: "x" }], "REAL_ESTATE", async () => ({ ok: true }), store);
assert.equal(r4.failed.length, 1);
// nothing to do
assert.deepEqual(await reanalyzeDocs([], "REAL_ESTATE", analyze, store), { done: [], failed: [] });

// --- plan by type and by document ---
const pd = [
  { id: "p1", doc_type: "CONTRACT", editor_content: "x" }, { id: "p2", doc_type: "CONTRACT", editor_content: "x" },
  { id: "p3", doc_type: "OPINION", editor_content: "x" }, { id: "p4", doc_type: null, editor_content: "x" },
  { id: "p5", doc_type: "CONTRACT", editor_content: "  " }, { id: "p6", doc_type: "EVIDENCE", editor_content: "x" },
];
assert.deepEqual(countByType(pd), [["CONTRACT", 3], ["OPINION", 1], [UNTYPED, 1], ["EVIDENCE", 1]], "counts by type, untyped under the empty key");
assert.deepEqual(buildPlan(pd, {}, {}), [], "no choice, nothing runs");
assert.deepEqual(buildPlan(pd, { CONTRACT: "REAL_ESTATE" }, {}).map((p) => [p.doc.id, p.area]), [["p1", "REAL_ESTATE"], ["p2", "REAL_ESTATE"]], "a type choice covers that type only; empty text is skipped");
assert.deepEqual(buildPlan(pd, { CONTRACT: "REAL_ESTATE" }, { p2: "AI_GOVERNANCE" }).map((p) => [p.doc.id, p.area]), [["p1", "REAL_ESTATE"], ["p2", "AI_GOVERNANCE"]], "a document choice beats its type");
assert.deepEqual(buildPlan(pd, {}, { p3: "AI_GOVERNANCE", p4: "LITIGATION" }).map((p) => [p.doc.id, p.area]), [["p3", "AI_GOVERNANCE"], ["p4", "LITIGATION"]], "documents can be chosen alone, any type");
assert.deepEqual(buildPlan(pd, { [UNTYPED]: "LABOR_LAW" }, {}).map((p) => [p.doc.id, p.area]), [["p4", "LABOR_LAW"]], "untyped documents have their own row");
assert.deepEqual(buildPlan(pd, { CONTRACT: "REAL_ESTATE" }, { p1: "" }).map((p) => p.doc.id), ["p1", "p2"], "clearing a document choice falls back to its type");
// the plan runs each document under its own area and stores that area with the result
const seen = [], put = [];
const rp = await reanalyzePlan(buildPlan(pd, { CONTRACT: "REAL_ESTATE" }, { p2: "AI_GOVERNANCE" }),
  async (t, a) => { seen.push(a); return { ok: true, analysis: A }; }, async (id, an, a) => { put.push([id, a]); return { ok: true }; });
assert.deepEqual(rp.done, ["p1", "p2"]); assert.deepEqual(seen, ["REAL_ESTATE", "AI_GOVERNANCE"]); assert.deepEqual(put, [["p1", "REAL_ESTATE"], ["p2", "AI_GOVERNANCE"]]);
const rp2 = await reanalyzePlan(buildPlan(pd, { CONTRACT: "REAL_ESTATE" }, {}), analyze, async (id) => (id === "p1" ? { ok: false, error: "no" } : { ok: true }));
assert.deepEqual(rp2.failed, [{ id: "p1", error: "no" }]); assert.deepEqual(rp2.done, ["p2"]);
assert.deepEqual(await reanalyzePlan([], analyze, store), { done: [], failed: [] });
console.log("reanalyze-check: ok");
