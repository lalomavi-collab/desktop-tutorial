// Checks the mail routing core and the webhook handler of lalum-mail-intake with fakes. Run with: npm run mail-route-check.
// route.ts and handler.ts are transpiled from supabase/functions/lalum-mail-intake, so the test runs the shipped code.
import assert from "node:assert/strict";
import { readFileSync, writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import ts from "typescript";

const dir = mkdtempSync(join(tmpdir(), "mailroute-"));
for (const f of ["route", "file", "handler"]) {
  const src = readFileSync(new URL(`../supabase/functions/lalum-mail-intake/${f}.ts`, import.meta.url), "utf8").replace(/from "\.\/route\.ts"/g, 'from "./route.mjs"');
  writeFileSync(join(dir, `${f}.mjs`), ts.transpileModule(src, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 } }).outputText);
}
const { routeMessage, aliasCodes, subjectCodes, messageKey } = await import(pathToFileURL(join(dir, "route.mjs")).href);
const { handleRequest } = await import(pathToFileURL(join(dir, "handler.mjs")).href);
const { fileOne } = await import(pathToFileURL(join(dir, "file.mjs")).href);

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
{ // filing runs only for QUEUED rows; the outcome is counted
  const calls = [];
  const { p } = ports({ file: async (x) => { calls.push(x); return "FILED"; } });
  const s = await (await handleRequest(post({ value: [note("g1"), note("g2")] }), p)).json();
  assert.equal(calls.length, 1); assert.equal(calls[0].matterId, "m11"); assert.equal(calls[0].documentId, null); assert.equal(calls[0].graphId, "g1");
  assert.equal(s.filed, 1);
  const retry = ports({ file: async () => "RETRY" });
  assert.equal((await (await handleRequest(post({ value: [note("g1")] }), retry.p)).json()).retry, 1);
}
{ // drain: shared secret, only pending rows, counts only
  const pend = [{ messageKey: "k1", graphId: "g1", matterId: "m11", receivedAt: "2026-10-14T07:00:00Z", documentId: "d1" }];
  const filed = [];
  const { p } = ports({ drainSecret: "drain-secret", pending: async (n) => { assert.equal(n, 20); return pend; }, file: async (x) => { filed.push(x); return "FILED"; } });
  const drain = (secret) => handleRequest(new Request("https://f.example/?drain=1", { method: "POST", headers: secret ? { "x-drain-secret": secret } : {} }), p);
  assert.equal((await drain()).status, 401); assert.equal((await drain("wrong")).status, 401); assert.equal(filed.length, 0);
  const ok = await drain("drain-secret"); assert.equal(ok.status, 200); assert.equal((await ok.json()).filed, 1); assert.equal(filed[0].documentId, "d1");
  const none = ports(); assert.equal((await handleRequest(new Request("https://f.example/?drain=1", { method: "POST", headers: { "x-drain-secret": "x" } }), none.p)).status, 401);   // not configured: never open
}
{ // not a created notification, an unknown message, bad JSON, wrong method
  const { p } = ports();
  const s = await (await handleRequest(post({ value: [{ clientState: SECRET, changeType: "deleted", resourceData: { id: "g1" } }, note("zzz")] }), p)).json();
  assert.equal(s.unreadable, 2);
  assert.equal((await handleRequest(new Request("https://f.example/", { method: "POST", body: "{" }), p)).status, 400);
  assert.equal((await handleRequest(new Request("https://f.example/", { method: "GET" }), p)).status, 405);
}

// 6. fileOne: the secure path with fakes
const KEY = "ab".repeat(32);
const MIME = new TextEncoder().encode("From: a@b\r\nSubject: x\r\n\r\nbody");
function deps(over = {}) {
  const calls = []; const logs = []; const states = [];
  const d = { firmId: "firm", maxBytes: 1000,
    getText: async () => ({ subject: "נושא סודי", text: "גוף ההודעה" }),
    getMime: async () => MIME,
    callPipeline: async (i) => { calls.push(["pipeline", i]); return { status: 200, body: { ok: true, matter_id: i.matterId, document_id: "doc1" } }; },
    upload: async (path, bytes) => { calls.push(["upload", path, bytes.byteLength]); return "ok"; },
    setDocument: async (k, doc) => { calls.push(["setDocument", k, doc]); return true; },
    attachOriginal: async (k, path, sha, size) => { calls.push(["attach", k, path, sha, size]); return true; },
    setState: async (k, st, reason) => { states.push([st, reason]); },
    log: (e, x) => logs.push([e, x]), ...over };
  return { d, calls, logs, states };
}
const pend = (over = {}) => ({ messageKey: KEY, graphId: "g1", matterId: "m11", receivedAt: "2026-10-14T07:00:00Z", documentId: null, ...over });
{ // the happy path, in order, with the hash of exactly the bytes that were uploaded
  const { d, calls, logs } = deps();
  assert.equal(await fileOne(d, pend()), "FILED");
  assert.deepEqual(calls.map((c) => c[0]), ["pipeline", "setDocument", "upload", "attach"]);
  assert.equal(calls[0][1].fileName, "mail-20261014-abababab.eml"); assert.equal(calls[0][1].matterId, "m11");
  assert.ok(calls[0][1].text.includes("נושא סודי") && calls[0][1].text.includes("גוף ההודעה"));
  assert.equal(calls[2][1], "firm/m11/doc1/original.txt"); assert.equal(calls[3][2], "firm/m11/doc1/original.txt");
  const { createHash } = await import("node:crypto");
  assert.equal(calls[3][3], createHash("sha256").update(MIME).digest("hex")); assert.equal(calls[3][4], MIME.byteLength);
  assert.ok(!JSON.stringify(logs).includes("סודי") && !JSON.stringify(logs).includes("גוף") && !JSON.stringify(logs).includes("firm/m11"), "nothing readable in the log");
}
{ // a retry that already has the document never calls the pipeline again
  const { d, calls } = deps();
  assert.equal(await fileOne(d, pend({ documentId: "doc1" })), "FILED");
  assert.deepEqual(calls.map((c) => c[0]), ["upload", "attach"]);
}
{ // an object that an earlier attempt already wrote is not a failure
  const { d, calls } = deps({ upload: async () => "exists" });
  assert.equal(await fileOne(d, pend({ documentId: "doc1" })), "FILED"); assert.ok(calls.some((c) => c[0] === "attach"));
}
{ // conflict halt: hold, nothing stored in the vault
  const { d, calls, states } = deps({ callPipeline: async () => ({ status: 200, body: { ok: false, code: "CONFLICT_HALT" } }) });
  assert.equal(await fileOne(d, pend()), "CONFLICT_HOLD"); assert.deepEqual(states, [["CONFLICT_HOLD", null]]); assert.ok(!calls.some((c) => c[0] === "upload"));
}
{ // the shield blocked the text: failed, with its reason, nothing stored
  const { d, calls, states } = deps({ callPipeline: async () => ({ status: 422, body: { ok: false, code: "PII_LEAK_BLOCKED" } }) });
  assert.equal(await fileOne(d, pend()), "FAILED"); assert.deepEqual(states, [["FAILED", "PII_BLOCKED"]]); assert.ok(!calls.some((c) => c[0] === "upload"));
}
{ // too large or empty: failed before anything is created
  for (const bytes of [new Uint8Array(1001), new Uint8Array(0)]) {
    const { d, calls, states } = deps({ getMime: async () => bytes });
    assert.equal(await fileOne(d, pend()), "FAILED"); assert.deepEqual(states, [["FAILED", "TOO_LARGE"]]); assert.equal(calls.length, 0);
  }
}
{ // transient trouble retries without creating anything; a 4xx or the wrong matter stops
  for (const [name, over, want] of [
    ["mime unavailable", { getMime: async () => null }, "RETRY"],
    ["text unavailable", { getText: async () => null }, "RETRY"],
    ["pipeline 503", { callPipeline: async () => ({ status: 503, body: null }) }, "RETRY"],
    ["pipeline 429", { callPipeline: async () => ({ status: 429, body: null }) }, "RETRY"],
    ["pipeline 401", { callPipeline: async () => ({ status: 401, body: { ok: false } }) }, "FAILED"],
    ["other matter", { callPipeline: async () => ({ status: 200, body: { ok: true, matter_id: "OTHER", document_id: "doc1" } }) }, "FAILED"],
    ["no document id", { callPipeline: async () => ({ status: 200, body: { ok: true, matter_id: "m11" } }) }, "FAILED"],
  ]) { const { d, calls } = deps(over); assert.equal(await fileOne(d, pend()), want, name); assert.ok(!calls.some((c) => c[0] === "upload"), name + ": no vault write"); }
}
{ // the document was created but could not be linked: stop, never retry into a second document
  const { d, states, logs } = deps({ setDocument: async () => false });
  assert.equal(await fileOne(d, pend()), "FAILED"); assert.deepEqual(states, [["FAILED", null]]); assert.ok(logs.some(([, x]) => x.outcome === "orphan_document"));
}
{ // vault trouble leaves the row pending with its document, so the next try resumes
  assert.equal(await fileOne(deps({ upload: async () => "error" }).d, pend()), "RETRY");
  assert.equal(await fileOne(deps({ attachOriginal: async () => false }).d, pend({ documentId: "doc1" })), "RETRY");
}
console.log("mail-route-check: all assertions passed");
