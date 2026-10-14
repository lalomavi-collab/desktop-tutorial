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
const { eligibleDocs, isAssessed, reanalyzeDocs, ASSESSED_TYPES } = await import(pathToFileURL(join(dir, "reanalyze.mjs")).href);

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
console.log("reanalyze-check: ok");
