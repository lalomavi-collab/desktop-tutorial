// Checks the mail routing core and the webhook handler of lalum-mail-intake with fakes. Run with: npm run mail-route-check.
// route.ts and handler.ts are transpiled from supabase/functions/lalum-mail-intake, so the test runs the shipped code.
import assert from "node:assert/strict";
import { readFileSync, writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import ts from "typescript";

const dir = mkdtempSync(join(tmpdir(), "mailroute-"));
for (const f of ["route", "handler"]) {
  const src = readFileSync(new URL(`../supabase/functions/lalum-mail-intake/${f}.ts`, import.meta.url), "utf8").replace(/from "\.\/route\.ts"/g, 'from "./route.mjs"');
  writeFileSync(join(dir, `${f}.mjs`), ts.transpileModule(src, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 } }).outputText);
}
const { routeMessage, aliasCodes, subjectCodes, messageKey } = await import(pathToFileURL(join(dir, "route.mjs")).href);
const { handleRequest } = await import(pathToFileURL(join(dir, "handler.mjs")).href);

const M = (id, over = {}) => ({ id, syncEnabled: true, status: "ACTIVE_REVIEW", conflictStatus: "CLEAN", ...over });
const matters = new Map([["L-2026-0011", M("m11")], ["L-2026-0012", M("m12")], ["L-2026-0013", M("m13", { syncEnabled: false })],
  ["L-2026-0014", M("m14", { status: "ARCHIVED" })], ["L-2026-0015", M("m15", { conflictStatus: "DIRECT_CONFLICT" })]]);
const look = (thread = null) => ({ aliasDomains: ["lalum.co"], matterByCode: (c) => matters.get(c.toUpperCase()), threadMatter: thread });
const msg = (over = {}) => ({ to: [], cc: [], subject: "", ...over });
const r = (m, t) => routeMessage(msg(m), look(t));

// 1. Deterministic matches
assert.deepEqual(r({ to: ["cases+L-2026-0011@lalum.co"] }), { state: "QUEUED", route: "ALIAS", reason: null, matterId: "m11" });
assert.deepEqual(r({ to: ["x@y.com"], cc: ["Cases <cases+l-2026-0011@LALUM.CO>"] }), { state: "QUEUED", route: "ALIAS", reason: null, matterId: "m11" });
assert.deepEqual(r({ subject: "RE: הסכם [L-2026-0011] עדכון" }), { state: "QUEUED", route: "SUBJECT_CODE", reason: null, matterId: "m11" });
assert.deepEqual(r({ subject: "שלום" }, M("m11")), { state: "QUEUED", route: "THREAD", reason: null, matterId: "m11" });
// The same matter found three ways is still one matter, labelled by the strongest route.
assert.equal(r({ to: ["cases+L-2026-0011@lalum.co"], subject: "[L-2026-0011]" }, M("m11")).route, "ALIAS");

// 2. Never a guess
assert.equal(r({ subject: "הסכם L-2026-0011 בלי סוגריים" }).reason, "NO_MATCH");
assert.equal(r({ to: ["cases+L-2026-0011@evil.com"] }).reason, "NO_MATCH");
assert.equal(r({ to: ["cases-L-2026-0011@lalum.co"] }).reason, "NO_MATCH");
assert.equal(r({ subject: "[L-2026-9999]" }).reason, "UNKNOWN_CODE");
assert.equal(r({ to: ["cases+L-2026-0011@lalum.co"], subject: "[L-2026-0012]" }).reason, "AMBIGUOUS");
assert.equal(r({ to: ["cases+L-2026-0011@lalum.co"], subject: "[L-2026-9999]" }).reason, "UNKNOWN_CODE");
assert.equal(r({ subject: "[L-2026-0012]" }, M("m11")).reason, "AMBIGUOUS");
for (const d of [r({ subject: "[L-2026-9999]" }), r({}), r({ subject: "[L-2026-0012]" }, M("m11"))]) { assert.equal(d.state, "TRIAGE"); assert.equal(d.matterId, null); }

// 3. Matter rules
assert.deepEqual(r({ subject: "[L-2026-0013]" }), { state: "TRIAGE", route: "SUBJECT_CODE", reason: "MATTER_NOT_ENABLED", matterId: "m13" });
assert.equal(r({ subject: "[L-2026-0014]" }).reason, "MATTER_CLOSED");
assert.equal(r({ subject: "[L-2026-0015]" }).state, "CONFLICT_HOLD");

// 4. Helpers
assert.deepEqual(aliasCodes(["a@b.com", "<cases+L-2026-0011@lalum.co>"], ["lalum.co"]), ["L-2026-0011"]);
assert.deepEqual(subjectCodes("[ l-2026-0011 ] and [L-2026-0012]"), ["L-2026-0011", "L-2026-0012"]);
assert.equal(await messageKey("<ABC@x.com>"), await messageKey("abc@x.com"));
assert.match(await messageKey("<abc@x.com>"), /^[0-9a-f]{64}$/);

// 5. Webhook handler with fakes
const SECRET = "s3cret-state";
function ports(over = {}) {
  const rows = []; const logs = [];
  const metaById = { g1: { internetMessageId: "<one@x>", conversationId: "c1", subject: "[L-2026-0011] בדיקה", to: [], cc: [], receivedAt: "2026-10-14T07:00:00Z" },
    g2: { internetMessageId: "<two@x>", conversationId: "c2", subject: "בלי קוד", to: [], cc: [], receivedAt: "2026-10-14T07:01:00Z" } };
  return { rows, logs, p: { clientState: SECRET, aliasDomains: ["lalum.co"], firmId: "firm", fetchMeta: async (id) => metaById[id] ?? null,
    lookupMatterByCode: async (c) => matters.get(c), lookupThread: async () => null,
    recordIntake: async (row) => { if (rows.some((x) => x.messageKey === row.messageKey)) return "duplicate"; rows.push(row); return "inserted"; },
    log: (e, d) => logs.push([e, d]), ...over } };
}
const post = (body, q = "") => new Request(`https://f.example/${q}`, { method: "POST", body: JSON.stringify(body) });
const note = (id, state = SECRET) => ({ clientState: state, changeType: "created", resourceData: { id } });

{ // validation handshake
  const { p } = ports(); const res = await handleRequest(post({}, "?validationToken=abc%20123"), p);
  assert.equal(res.status, 200); assert.equal(await res.text(), "abc 123"); assert.match(res.headers.get("content-type"), /text\/plain/);
}
{ // wrong clientState: nothing read, nothing recorded
  const { p, rows } = ports({ fetchMeta: async () => assert.fail("must not fetch") });
  const res = await handleRequest(post({ value: [note("g1", "wrong")] }), p);
  assert.equal(res.status, 401); assert.equal(rows.length, 0);
}
{ // a routed message and a triaged one; counts only in the log; stays QUEUED because filing is not wired
  const { p, rows, logs } = ports();
  const res = await handleRequest(post({ value: [note("g1"), note("g2")] }), p);
  assert.equal(res.status, 202);
  const s = await res.json();
  assert.deepEqual([s.queued, s.triage, s.filed, s.duplicates], [1, 1, 0, 0]);
  assert.equal(rows[0].decision.state, "QUEUED"); assert.equal(rows[1].decision.reason, "NO_MATCH");
  assert.ok(!JSON.stringify(rows).includes("בדיקה") && !JSON.stringify(rows).includes("one@x"), "no subject and no raw message id stored");
  assert.ok(!JSON.stringify(logs).includes("one@x") && !JSON.stringify(logs).includes("בדיקה"), "no content in the log");
}
{ // the same notification twice is idempotent
  const { p, rows } = ports();
  await handleRequest(post({ value: [note("g1")] }), p);
  const s = await (await handleRequest(post({ value: [note("g1")] }), p)).json();
  assert.equal(s.duplicates, 1); assert.equal(rows.length, 1);
}
{ // filing runs only for QUEUED rows, and a failure leaves the row QUEUED
  let filed = 0; let marked = 0;
  const { p } = ports({ fileMessage: async () => { filed++; return true; }, markFiled: async () => { marked++; } });
  const s = await (await handleRequest(post({ value: [note("g1"), note("g2")] }), p)).json();
  assert.deepEqual([filed, marked, s.filed], [1, 1, 1]);
  const bad = ports({ fileMessage: async () => false, markFiled: async () => assert.fail("must not mark") });
  assert.equal((await (await handleRequest(post({ value: [note("g1")] }), bad.p)).json()).filed, 0);
}
{ // not a created notification, an unknown message, bad JSON, wrong method
  const { p } = ports();
  const s = await (await handleRequest(post({ value: [{ clientState: SECRET, changeType: "deleted", resourceData: { id: "g1" } }, note("zzz")] }), p)).json();
  assert.equal(s.unreadable, 2);
  assert.equal((await handleRequest(new Request("https://f.example/", { method: "POST", body: "{" }), p)).status, 400);
  assert.equal((await handleRequest(new Request("https://f.example/", { method: "GET" }), p)).status, 405);
}
console.log("mail-route-check: all assertions passed");
