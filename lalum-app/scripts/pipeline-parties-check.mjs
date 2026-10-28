// Checks the parties route of the repo copy of the deployed lalum-pipeline function (4.3, T50, version 28).
// Run with: npm run pipeline-parties-check
// The conflict engine and the new parseParties and declareParties are cut out of
// supabase/functions/lalum-pipeline/index.js, like pipeline-shield-check does, and run against an in-memory store,
// so the test runs the deployed code, not a model of it. The source of the change is in lalomavi-collab/LALUMap
// (lib/services/matterParties.ts), with the same cases in tests/matter-parties.test.ts. All names are invented.
import assert from "node:assert/strict";
import { readFileSync, writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const src = readFileSync(new URL("../supabase/functions/lalum-pipeline/index.js", import.meta.url), "utf8");
const from = src.indexOf("var enc=new TextEncoder");
const to = src.indexOf("var BADGE=");
assert.ok(from > 0 && to > from, "engine markers not found");
const dir = mkdtempSync(join(tmpdir(), "parties-"));
const file = join(dir, "parties.mjs");
writeFileSync(file, `${src.slice(from, to)};export{parseParties,declareParties,NEUTRAL_REJECTION_MESSAGE,MAX_PARTIES};`);
const { parseParties, declareParties, NEUTRAL_REJECTION_MESSAGE, MAX_PARTIES } = await import(pathToFileURL(file).href);

class MemParties {
  rows = []; checks = []; audits = []; status = new Map(); failAudit = false;
  async find(firmId, indexes, exclude) { return this.rows.filter((r) => r.firm === firmId && indexes.includes(r.blind_index) && r.matter !== exclude); }
  async addParties(firmId, matterId, parties) { for (const p of parties) for (const i of p.indexes) this.rows.push({ firm: firmId, matter: matterId, party_id: p.partyId, role: p.role, kind: i.kind, blind_index: i.blind_index, matter_active: true }); }
  async removeParties(matterId, ids) { this.rows = this.rows.filter((r) => !(r.matter === matterId && ids.includes(r.party_id))); }
  async logCheck(row) { this.checks.push(row); }
  async raiseToPotential(matterId) { if ((this.status.get(matterId) ?? "CLEAN") === "CLEAN") this.status.set(matterId, "POTENTIAL"); }
  async appendAudit(_f, matter, _u, action, _h, meta) { if (this.failAudit) throw new Error("audit down"); this.audits.push({ matter, action, meta }); }
  async counts(matterId) { const n = (role) => new Set(this.rows.filter((r) => r.matter === matterId && r.role === role).map((r) => r.party_id)).size; return { CLIENT: n("CLIENT"), ADVERSE: n("ADVERSE") }; }
  async declaredOn(matterId) { return new Set(this.rows.filter((r) => r.matter === matterId && r.kind !== "NAME_TOKEN" && r.role !== "OTHER").map((r) => `${r.role}|${r.blind_index}`)); }
}
const KEY = "aa".repeat(32);
const ctx = (matterId) => ({ firmId: "F1", userId: "u1", matterId });
let n = 0;
const check = async (name, fn) => { await fn(); n++; console.log(`ok ${n} - ${name}`); };

await check("parseParties accepts a client and an adverse party, by name or by number", async () => {
  assert.deepEqual(parseParties([{ role: "CLIENT", name: " ישראל ישראלי " }, { role: "ADVERSE", companyReg: "51-234567-8" }]), [
    { role: "CLIENT", name: "ישראל ישראלי" }, { role: "ADVERSE", companyReg: "512345678" },
  ]);
  assert.deepEqual(parseParties(undefined), []);
});
await check("parseParties refuses anything malformed", async () => {
  for (const bad of ["x", [{ role: "OTHER", name: "ישראל ישראלי" }], [{ role: "CLIENT" }], [{ role: "CLIENT", name: "א" }],
    [{ role: "CLIENT", name: "ישראל", idNumber: "12" }], [{ role: "CLIENT", name: 5 }],
    Array.from({ length: MAX_PARTIES + 1 }, () => ({ role: "CLIENT", name: "ישראל ישראלי" }))]) assert.equal(parseParties(bad), null);
});
await check("an adverse party who is an active client elsewhere halts and stores nothing", async () => {
  const db = new MemParties();
  await declareParties(db, KEY, ctx("M1"), [{ role: "CLIENT", name: "ישראל ישראלי" }]);
  const before = db.rows.length;
  const r = await declareParties(db, KEY, ctx("M2"), [{ role: "ADVERSE", name: "ישראל ישראלי" }]);
  assert.equal(r.halted, true);
  assert.equal(r.neutralMessage, NEUTRAL_REJECTION_MESSAGE);
  assert.equal(db.rows.length, before);
  assert.equal(db.checks.at(-1).status, "DIRECT_CONFLICT");
  assert.equal(db.checks.at(-1).matter_id, "M2");
  assert.equal(db.audits.at(-1).action, "CONFLICT_HALT");
});
await check("a clean declaration stores blind indexes only", async () => {
  const db = new MemParties();
  const r = await declareParties(db, KEY, ctx("M1"), [{ role: "CLIENT", name: "ישראל ישראלי", idNumber: "000000018" }, { role: "ADVERSE", name: "Acme Holdings Ltd" }]);
  assert.equal(r.light, "GREEN");
  assert.deepEqual(r.counts, { CLIENT: 1, ADVERSE: 1 });
  const stored = JSON.stringify([db.rows, db.checks, db.audits]);
  for (const raw of ["ישראלי", "000000018", "Acme"]) assert.ok(!stored.includes(raw), `leaked ${raw}`);
  assert.deepEqual(db.audits.at(-1), { matter: "M1", action: "MATTER_PARTIES_DECLARED", meta: { clients: 1, adverse: 1, conflict: "CLEAN", source: "PARTIES" } });
});
await check("a repeat on the same matter is not stored twice", async () => {
  const db = new MemParties();
  await declareParties(db, KEY, ctx("M1"), [{ role: "CLIENT", name: "ישראל ישראלי" }]);
  const r = await declareParties(db, KEY, ctx("M1"), [{ role: "CLIENT", name: "ישראל ישראלי" }]);
  assert.equal(r.added, 0);
  assert.deepEqual(r.counts, { CLIENT: 1, ADVERSE: 0 });
});
await check("a match with an archived matter is YELLOW and raises the matter to POTENTIAL", async () => {
  const db = new MemParties();
  await declareParties(db, KEY, ctx("M1"), [{ role: "CLIENT", name: "ישראל ישראלי" }]);
  for (const r of db.rows) r.matter_active = false;
  const r = await declareParties(db, KEY, ctx("M2"), [{ role: "ADVERSE", name: "ישראל ישראלי" }]);
  assert.equal(r.light, "YELLOW");
  assert.equal(db.status.get("M2"), "POTENTIAL");
});
await check("if the audit line fails, the parties just stored are taken back", async () => {
  const db = new MemParties();
  db.failAudit = true;
  await assert.rejects(declareParties(db, KEY, ctx("M1"), [{ role: "CLIENT", name: "ישראל ישראלי" }]));
  assert.equal(db.rows.length, 0);
});
await check("the route is wired: dispatch, caller-side access check, anon key", async () => {
  assert.ok(src.includes('path.endsWith("/api/v1/matters/parties"))res=await partiesRoute(req)'));
  assert.ok(src.includes('asUser.rpc("lalum_is_staff_on",{p_matter:matter_id})'));
  assert.ok(src.includes('var ANON=Deno.env.get("SUPABASE_ANON_KEY")'));
  assert.ok(/^\/\/ lalum-pipeline version 28:/.test(src));
});
console.log(`pipeline-parties-check: ${n} checks passed`);
