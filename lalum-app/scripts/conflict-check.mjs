// Checks the role policy of the conflict engine in the repo copy of the deployed lalum-pipeline function.
// Run with: npm run conflict-check
// Policy under test: a name that repeats across matters is flagged only when at least one side is a
// DECLARED party (CLIENT or ADVERSE). Two undeclared mentions (role OTHER on both sides) say nothing about
// who is a party, and flagging them buried the real signal (in production 8 of 10 matters were POTENTIAL
// for that reason alone, none involving a declared party).
// The engine is cut out of supabase/functions/lalum-pipeline/index.js and run against an in-memory store
// that behaves like lalum_conflict_find, so the test runs the deployed code, not a model of it.
import assert from "node:assert/strict";
import { readFileSync, writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const src = readFileSync(new URL("../supabase/functions/lalum-pipeline/index.js", import.meta.url), "utf8");
const from = src.indexOf("var enc=new TextEncoder");
const to = src.indexOf("var BADGE=");
assert.ok(from > 0 && to > from, "engine markers not found");
const dir = mkdtempSync(join(tmpdir(), "conflict-"));
const file = join(dir, "engine.mjs");
writeFileSync(file, `${src.slice(from, to)};export{ConflictEngine};`);
const { ConflictEngine } = await import(pathToFileURL(file).href);

const KEY = "ab".repeat(32);
const FIRM = "firm-1";
const stored = []; // rows like lalum_conflict_parties joined with matter activity
const store = { find: async (_firm, indexes, exclude) => stored.filter((r) => indexes.includes(r.blind_index) && r.matter_id !== exclude) };
const engine = new ConflictEngine(store, KEY);

/** Runs a check as the pipeline does, then stores the parties of a non-halted check under `matter`. */
async function intake(matter, declared, detectedNames = [], active = true) {
  const detections = detectedNames.map((value) => ({ kind: "CLIENT_NAME", value }));
  const r = await engine.check(FIRM, declared, detections, { excludeMatterId: matter });
  for (const p of r.parties) for (const i of p.indexes) stored.push({ matter_id: matter, party_id: p.partyId, role: p.role, kind: i.kind, blind_index: i.blind_index, matter_active: active });
  return r;
}
const reset = () => { stored.length = 0; };
const t = async (name, fn) => { reset(); await fn(); console.log(`[PASS] ${name}`); };

await t("the same undeclared name in two documents is not flagged", async () => {
  await intake("m1", [], ["דנה כהן"]);
  const r = await intake("m2", [], ["דנה כהן"]);
  assert.equal(r.light, "GREEN");
  assert.equal(r.matchCount, 0);
});

await t("a partial name overlap between two undeclared mentions is not flagged", async () => {
  await intake("m1", [], ["דנה כהן לוי"]);
  const r = await intake("m2", [], ["כהן לוי רונית"]);
  assert.equal(r.light, "GREEN");
});

await t("a declared adverse party that was only mentioned before is YELLOW", async () => {
  await intake("m1", [], ["דנה כהן"]);
  const r = await intake("m2", [{ role: "ADVERSE", name: "דנה כהן" }]);
  assert.equal(r.light, "YELLOW");
  assert.ok(r.reasonCodes.includes("ROLE_UNKNOWN_MATCH"));
});

await t("an undeclared mention of a name that was a declared client is YELLOW", async () => {
  await intake("m1", [{ role: "CLIENT", name: "דנה כהן" }]);
  const r = await intake("m2", [], ["דנה כהן"]);
  assert.equal(r.light, "YELLOW");
});

await t("a declared adverse party who is an active client is RED and halts", async () => {
  await intake("m1", [{ role: "CLIENT", name: "דנה כהן" }]);
  const r = await intake("m2", [{ role: "ADVERSE", name: "דנה כהן" }]);
  assert.equal(r.light, "RED");
  assert.ok(r.halted);
});

await t("a declared adverse party who was a client in an archived matter is YELLOW", async () => {
  await intake("m1", [{ role: "CLIENT", name: "דנה כהן" }], [], false);
  const r = await intake("m2", [{ role: "ADVERSE", name: "דנה כהן" }]);
  assert.equal(r.light, "YELLOW");
  assert.ok(r.reasonCodes.includes("OPPOSING_HISTORICAL_MATTER"));
});

await t("a returning client is not flagged", async () => {
  await intake("m1", [{ role: "CLIENT", name: "דנה כהן" }]);
  const r = await intake("m2", [{ role: "CLIENT", name: "דנה כהן" }]);
  assert.equal(r.light, "GREEN");
});

await t("an id number match behaves the same way (undeclared on both sides is not flagged)", async () => {
  await intake("m1", [{ role: "OTHER", idNumber: "123456782" }]);
  const r = await intake("m2", [{ role: "OTHER", idNumber: "123456782" }]);
  assert.equal(r.light, "GREEN");
});

console.log("\nAll conflict checks passed");
