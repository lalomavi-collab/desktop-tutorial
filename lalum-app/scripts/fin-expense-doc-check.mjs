// Checks lalum-fin-expense-doc with fakes. Run: npm run fin-expense-doc-check.
import assert from "node:assert/strict";
import { readFileSync, writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import ts from "typescript";

const load = async (rel, name) => {
  const src = readFileSync(new URL(rel, import.meta.url), "utf8");
  const f = join(mkdtempSync(join(tmpdir(), "fin-expense-doc-")), name);
  writeFileSync(f, ts.transpileModule(src, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 } }).outputText);
  return import(pathToFileURL(f).href);
};
const { handle, expenseDocPath, decodeBase64, sha256Hex, MAX_BYTES, SIGNED_SECONDS } =
  await load("../supabase/functions/lalum-fin-expense-doc/handler.ts", "h.mjs");

const EXPENSE = "00000000-aaaa-bbbb-cccc-dddddddddddd";
const DOC = "11111111-aaaa-bbbb-cccc-dddddddddddd";
const OLD = "22222222-aaaa-bbbb-cccc-dddddddddddd";
const FIRM = "f1";
const PDF = new TextEncoder().encode("%PDF-1.7\n....");
const PDF2 = new TextEncoder().encode("%PDF-1.7\n.... a corrected invoice");
const NOT_PDF = new TextEncoder().encode("<html>not a pdf</html>");
const b64 = (bytes) => Buffer.from(bytes).toString("base64");
const H = await sha256Hex(PDF), H2 = await sha256Hex(PDF2);
const P = `${FIRM}/${EXPENSE}/${H}.pdf`, P2 = `${FIRM}/${EXPENSE}/${H2}.pdf`;

// pure helpers: the path is the content's hash, so two different files can never share an object
assert.equal(expenseDocPath(FIRM, EXPENSE, H, "application/pdf"), P);
assert.equal(expenseDocPath(FIRM, EXPENSE, H, "image/jpeg"), `${FIRM}/${EXPENSE}/${H}.jpg`);
assert.notEqual(expenseDocPath(FIRM, EXPENSE, H, "application/pdf"), expenseDocPath(FIRM, EXPENSE, H2, "application/pdf"));
assert.equal(expenseDocPath(FIRM, EXPENSE, H, "text/plain"), null);
assert.equal(expenseDocPath(FIRM, EXPENSE, "not-a-hash", "application/pdf"), null);
assert.deepEqual(decodeBase64(b64(PDF)), PDF);
assert.equal(decodeBase64(""), null);
assert.equal(decodeBase64("not base64!!"), null);
assert.equal(decodeBase64("a".repeat(MAX_BYTES * 2 + 1)), null);
assert.equal(await sha256Hex(new Uint8Array(0)), "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855");

const req = (over = {}) => ({ method: "POST", authorization: "Bearer jwt", origin: "https://app.example", body: {}, ...over });
// The fake bucket refuses to overwrite, as upsert:false does in the real one.
const mk = (over = {}) => {
  const calls = [], store = new Map(over.store ?? []);
  const ports = {
    allowedOrigins: ["https://app.example"],
    access: async (a, id, min) => { calls.push(["access", id, min]); return over.access ?? { ok: true, firmId: FIRM }; },
    upload: async (path, bytes, mime) => {
      calls.push(["upload", path, mime]);
      if (over.upFail || store.has(path)) return { ok: false };
      store.set(path, over.ghost ? bytes.length - 1 : bytes.length); return { ok: true };
    },
    stored: async (path) => (store.has(path) ? store.get(path) : null),
    attach: async (a, x) => { calls.push(["attach", x]); return over.attach ?? { ok: true, id: DOC, duplicate: false, sameFileElsewhere: 0 }; },
    open: async (a, id) => { calls.push(["open", id]); if (over.openThrows) throw new Error("x"); return over.open === undefined ? { path: P, mime: "application/pdf" } : over.open; },
    sign: async (path, name, seconds) => { calls.push(["sign", path, name, seconds]); return over.signFail ? null : `https://signed.example/${path}?n=${name}&s=${seconds}`; },
    ...over.ports,
  };
  return { ports, calls, store };
};
const up = (extra = {}) => ({ expense_id: EXPENSE, action: "upload", media_type: "application/pdf", file_base64: b64(PDF), ...extra });

// request shape
assert.equal((await handle(req({ method: "OPTIONS" }), mk().ports)).status, 204);
assert.equal((await handle(req({ method: "GET" }), mk().ports)).status, 405);
for (const auth of [null, "", "Bearer", "Basic abc"]) assert.equal((await handle(req({ authorization: auth }), mk().ports)).status, 401);
{ const r = await handle(req({ body: { expense_id: EXPENSE, action: "whatever" } }), mk().ports); assert.equal(r.status, 400); assert.equal(r.body.code, "bad_action"); }
for (const bad of [up({ expense_id: "not-a-uuid" }), up({ expense_id: 5 }), up({ supersedes: "nope" }), up({ supersedes: 7 }), { action: "url" }, { action: "url", doc_id: "x" }]) {
  const m = mk(); const r = await handle(req({ body: bad }), m.ports);
  assert.equal(r.status, 400, JSON.stringify(bad)); assert.equal(m.calls.length, 0, "nothing is touched for a malformed request");
}

// upload: validation before touching access or storage
for (const [body, code] of [
  [up({ media_type: "text/plain" }), "bad_type"],
  [up({ file_base64: undefined }), "bad_request"],
  [up({ file_base64: "" }), "bad_request"],
  [up({ file_base64: b64(new Uint8Array(MAX_BYTES + 1)) }), "too_large"],
  [up({ file_base64: b64(NOT_PDF) }), "bad_file"],
]) {
  const m = mk(); const r = await handle(req({ body }), m.ports);
  assert.equal(r.body.code, code, JSON.stringify(body).slice(0, 120)); assert.ok(!m.calls.some((c) => c[0] === "access"), code);
}

// upload: access denied touches nothing
{ const m = mk({ access: { ok: false } }); const r = await handle(req({ body: up() }), m.ports);
  assert.equal(r.status, 403); assert.equal(r.body.code, "forbidden"); assert.ok(!m.calls.some((c) => c[0] === "upload" || c[0] === "attach")); }
// a storage failure with nothing at the path, and a short object, are refused and never recorded
{ const m = mk({ upFail: true }); const r = await handle(req({ body: up() }), m.ports);
  assert.equal(r.body.code, "upload_failed"); assert.ok(!m.calls.some((c) => c[0] === "attach")); }
{ const m = mk({ ghost: true }); const r = await handle(req({ body: up() }), m.ports);
  assert.equal(r.body.code, "not_stored"); assert.ok(!m.calls.some((c) => c[0] === "attach")); }

// the success path: level 3, a content addressed path, upsert never used to replace, the record carries hash and size
{ const m = mk(); const r = await handle(req({ body: up() }), m.ports);
  assert.equal(r.status, 200); assert.equal(r.body.id, DOC); assert.equal(r.body.sha256, H); assert.equal(r.body.size, PDF.length); assert.equal(r.body.duplicate, false);
  assert.ok(m.calls.some((c) => c[0] === "access" && c[2] === 3), "upload needs level 3");
  assert.ok(m.calls.some((c) => c[0] === "upload" && c[1] === P));
  const a = m.calls.find((c) => c[0] === "attach")[1];
  assert.deepEqual(a, { expenseId: EXPENSE, path: P, sha256: H, mime: "application/pdf", size: PDF.length, supersedes: null }); }

// the same file again: the bucket refuses the overwrite, the object at its hash is the same file, so it is recorded (the database dedups)
{ const m = mk({ store: [[P, PDF.length]], attach: { ok: true, id: DOC, duplicate: true, sameFileElsewhere: 0 } });
  const r = await handle(req({ body: up() }), m.ports);
  assert.equal(r.status, 200); assert.equal(r.body.duplicate, true); assert.equal(m.store.get(P), PDF.length); }
// something else of a different size sitting at that path is never taken for this file
{ const m = mk({ store: [[P, 3]] }); const r = await handle(req({ body: up() }), m.ports);
  assert.equal(r.body.code, "upload_failed"); assert.ok(!m.calls.some((c) => c[0] === "attach")); }

// a replacement: a new object at its own hash, the earlier object untouched, the supersession passed to the database
{ const m = mk({ store: [[P, PDF.length]] });
  const r = await handle(req({ body: up({ file_base64: b64(PDF2), supersedes: OLD }) }), m.ports);
  assert.equal(r.status, 200); assert.equal(m.store.get(P), PDF.length, "the earlier object stays"); assert.equal(m.store.get(P2), PDF2.length);
  assert.equal(m.calls.find((c) => c[0] === "attach")[1].supersedes, OLD); }

// the same invoice behind another expense is reported, so a duplicate expense shows
{ const m = mk({ attach: { ok: true, id: DOC, duplicate: false, sameFileElsewhere: 2 } }); const r = await handle(req({ body: up() }), m.ports);
  assert.equal(r.body.same_file_elsewhere, 2); }

// the database's refusals keep their meaning; anything unknown is a record failure, never a success
for (const [code, status] of [["forbidden", 403], ["bad_supersedes", 409], ["already_superseded", 409], ["not_stored", 500], ["record_failed", 500], ["something_new", 500]]) {
  const m = mk({ attach: { ok: false, code } }); const r = await handle(req({ body: up() }), m.ports);
  assert.equal(r.status, status, code); assert.equal(r.body.ok, false); assert.equal(r.body.code, code === "something_new" ? "record_failed" : code);
}
{ const m = mk({ ports: { attach: async () => { throw new Error("x"); } } }); const r = await handle(req({ body: up() }), m.ports);
  assert.equal(r.status, 500); assert.equal(r.body.code, "record_failed"); }

// url: the database decides and audits; only the path it returned is signed, for 60 seconds
{ const m = mk({ open: null }); const r = await handle(req({ body: { action: "url", doc_id: DOC } }), m.ports);
  assert.equal(r.status, 403); assert.ok(!m.calls.some((c) => c[0] === "sign")); }
{ const m = mk({ openThrows: true }); const r = await handle(req({ body: { action: "url", doc_id: DOC } }), m.ports);
  assert.equal(r.status, 500); assert.ok(!m.calls.some((c) => c[0] === "sign")); }
{ const m = mk({ signFail: true }); const r = await handle(req({ body: { action: "url", doc_id: DOC } }), m.ports); assert.equal(r.status, 500); }
{ const m = mk(); const r = await handle(req({ body: { action: "url", doc_id: DOC, path: "someone/else/file.pdf" } }), m.ports);
  assert.equal(r.status, 200); assert.equal(r.body.expires_in, SIGNED_SECONDS);
  const s = m.calls.find((c) => c[0] === "sign");
  assert.equal(s[1], P, "a path the caller names is never signed"); assert.equal(s[3], SIGNED_SECONDS);
  assert.ok(String(r.body.url).includes(`expense-doc-${DOC.replace(/-/g, "").slice(0, 8)}.pdf`), r.body.url);
  assert.ok(!m.calls.some((c) => c[0] === "access"), "reading is decided by the database alone"); }
// a document with a mime the extension table does not know still signs, with a generic extension
{ const m = mk({ open: { path: P, mime: "application/octet-stream" } }); const r = await handle(req({ body: { action: "url", doc_id: DOC } }), m.ports);
  assert.ok(String(r.body.url).includes(".bin")); }

// CORS
assert.equal((await handle(req({ origin: "https://evil.example" }), mk().ports)).headers["access-control-allow-origin"], undefined);
assert.equal((await handle(req({ body: { action: "url", doc_id: DOC } }), mk().ports)).headers["access-control-allow-origin"], "https://app.example");

// The function never asks storage to overwrite, and the migration keeps the earlier rows.
const index = readFileSync(new URL("../supabase/functions/lalum-fin-expense-doc/index.ts", import.meta.url), "utf8");
assert.ok(/upsert:\s*false/.test(index) && !/upsert:\s*true/.test(index), "upload runs with upsert off");
const sql = readFileSync(new URL("../supabase/migrations/20261027100000_lalum_fin_expense_docs.sql", import.meta.url), "utf8");
assert.ok(/raise exception 'TAX_RETENTION/.test(sql) && /EXPENSE_DOC_IMMUTABLE/.test(sql), "no deletion in retention, no edits but one supersession");
assert.ok(!/grant (insert|update|delete)[^;]*lalum_fin_expense_docs[^;]*to authenticated/i.test(sql), "no client role writes the table directly");
for (const t of ["lalum_fin_expense_docs", "lalum_fin_bank_accounts", "lalum_fin_bank_lines", "lalum_fin_recon_matches", "lalum_fin_revenue_class", "lalum_fin_tax_settings"])
  assert.ok(sql.includes(`'${t}'`), `${t} is classified for the firm export`);

console.log("fin-expense-doc-check: ok");
