// Checks the bulk helper used for multi select move to bin. Run with: npm run bulk-check.
import assert from "node:assert/strict";
import { readFileSync, writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import ts from "typescript";

const src = readFileSync(new URL("../src/lib/cockpit/bulk.ts", import.meta.url), "utf8");
const dir = mkdtempSync(join(tmpdir(), "bulk-"));
const file = join(dir, "bulk.mjs");
writeFileSync(file, ts.transpileModule(src, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 } }).outputText);
const { runBulk, toggle, setAll } = await import(pathToFileURL(file).href);

// all succeed, order kept, sequential
const order = []; let live = 0, maxLive = 0;
const r1 = await runBulk(["a", "b", "c"], async (id) => { live++; maxLive = Math.max(maxLive, live); order.push(id); await Promise.resolve(); live--; return { ok: true }; });
assert.deepEqual(r1.done, ["a", "b", "c"]); assert.equal(r1.failed.length, 0); assert.deepEqual(order, ["a", "b", "c"]); assert.equal(maxLive, 1);

// one failure does not stop the rest and is reported with its reason
const r2 = await runBulk(["a", "b", "c"], async (id) => (id === "b" ? { ok: false, error: "hold" } : { ok: true }));
assert.deepEqual(r2.done, ["a", "c"]); assert.deepEqual(r2.failed, [{ id: "b", error: "hold" }]);

// a thrown error is a failure, not a crash
const r3 = await runBulk(["a", "b"], async (id) => { if (id === "a") throw new Error("x"); return { ok: true }; });
assert.deepEqual(r3.done, ["b"]); assert.equal(r3.failed[0].id, "a");

// duplicates act once
let calls = 0; await runBulk(["a", "a", "a"], async () => { calls++; return { ok: true }; }); assert.equal(calls, 1);

// progress and empty input
const steps = []; await runBulk(["a", "b"], async () => ({ ok: true }), (n, t) => steps.push([n, t])); assert.deepEqual(steps, [[1, 2], [2, 2]]);
assert.deepEqual(await runBulk([], async () => ({ ok: true })), { done: [], failed: [] });

// selection helpers do not mutate their input
const s = new Set(["a"]); const s2 = toggle(s, "b"); assert.equal(s.size, 1); assert.deepEqual([...s2], ["a", "b"]); assert.equal(toggle(s2, "a").has("a"), false);
assert.deepEqual([...setAll(["x", "y"], true)], ["x", "y"]); assert.equal(setAll(["x"], false).size, 0);
console.log("bulk-check: ok");
