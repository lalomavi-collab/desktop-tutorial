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
const FIRM = "f1";
const PDF = new TextEncoder().encode("%PDF-1.7\n....");
const NOT_PDF = new TextEncoder().encode("<html>not a pdf</html>");
const b64 = (bytes) => Buffer.from(bytes).toString("base64");

// pure helpers
assert.equal(expenseDocPath(FIRM, EXPENSE, "application/pdf"), `${FIRM}/${EXPENSE}/source.pdf`);
assert.equal(expenseDocPath(FIRM, EXPENSE, "image/jpeg"), `${FIRM}/${EXPENSE}/source.jpg`);
assert.equal(expenseDocPath(FIRM, EXPENSE, "text/plain"), null);
assert.deepEqual(decodeBase64(b64(PDF)), PDF);
assert.equal(decodeBase64(""), null);
assert.equal(decodeBase64("not base64!!"), null);
assert.equal(decodeBase64("a".repeat(MAX_BYTES * 2 + 1)), null);
assert.equal(await sha256Hex(new Uint8Array(0)), "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855");

const req = (over = {}) => ({ method: "POST", authorization: "Bearer jwt", origin: "https://app.example", body: {}, ...over });
const mk = (over = {}) => {
  const calls = [], store = new Map();
  const ports = {
    allowedOrigins: ["https://app.example"],
    access: async (a, id, min) => { calls.push(["access", id, min]); return over.access ?? { ok: true, firmId: FIRM }; },
    upload: async (path, bytes, mime) => { calls.push(["upload", path, mime]); if (over.upFail) return { ok: false }; store.set(path, over.ghost ? bytes.length - 1 : bytes.length); return { ok: true }; },
    stored: async (path) => (store.has(path) ? store.get(path) : null),
    recordAttachment: async (a, id, path, mime, size, sha256) => { calls.push(["record", path, mime, size, sha256]); return over.recordFail ? false : true; },
    attached: async () => over.attached ?? null,
    sign: async (path, name, seconds) => { calls.push(["sign", path, name, seconds]); return over.signFail ? null : `https://signed.example/${path}?n=${name}&s=${seconds}`; },
    ...over.ports,
  };
  return { ports, calls, store };
};

// request shape
assert.equal((await handle(req({ method: "OPTIONS" }), mk().ports)).status, 204);
assert.equal((await handle(req({ method: "GET" }), mk().ports)).status, 405);
for (const auth of [null, "", "Bearer", "Basic abc"]) assert.equal((await handle(req({ authorization: auth }), mk().ports)).status, 401);
for (const bad of [{}, { expense_id: "not-a-uuid" }, { expense_id: 5 }]) assert.equal((await handle(req({ body: bad }), mk().ports)).status, 400);
{ const r = await handle(req({ body: { expense_id: EXPENSE, action: "whatever" } }), mk().ports); assert.equal(r.status, 400); assert.equal(r.body.code, "bad_action"); }

// upload: validation before touching access or storage
for (const [body, code] of [
  [{ expense_id: EXPENSE, action: "upload", media_type: "text/plain", file_base64: b64(PDF) }, "bad_type"],
  [{ expense_id: EXPENSE, action: "upload", media_type: "application/pdf" }, "bad_request"],
  [{ expense_id: EXPENSE, action: "upload", media_type: "application/pdf", file_base64: "" }, "bad_request"],
  [{ expense_id: EXPENSE, action: "upload", media_type: "application/pdf", file_base64: b64(new Uint8Array(MAX_BYTES + 1)) }, "too_large"],
  [{ expense_id: EXPENSE, action: "upload", media_type: "application/pdf", file_base64: b64(NOT_PDF) }, "bad_file"],
]) {
  const m = mk(); const r = await handle(req({ body }), m.ports);
  assert.equal(r.body.code, code, JSON.stringify(body)); assert.ok(!m.calls.some((c) => c[0] === "access"), code);
}

// upload: access denied, upload failure, read-back mismatch, record failure, and the success path
{ const m = mk({ access: { ok: false } }); const r = await handle(req({ body: { expense_id: EXPENSE, action: "upload", media_type: "application/pdf", file_base64: b64(PDF) } }), m.ports);
  assert.equal(r.status, 403); assert.equal(r.body.code, "forbidden"); assert.ok(!m.calls.some((c) => c[0] === "upload")); }
{ const m = mk({ upFail: true }); const r = await handle(req({ body: { expense_id: EXPENSE, action: "upload", media_type: "application/pdf", file_base64: b64(PDF) } }), m.ports);
  assert.equal(r.body.code, "upload_failed"); }
{ const m = mk({ ghost: true }); const r = await handle(req({ body: { expense_id: EXPENSE, action: "upload", media_type: "application/pdf", file_base64: b64(PDF) } }), m.ports);
  assert.equal(r.body.code, "not_stored"); assert.ok(!m.calls.some((c) => c[0] === "record")); }
{ const m = mk({ recordFail: true }); const r = await handle(req({ body: { expense_id: EXPENSE, action: "upload", media_type: "application/pdf", file_base64: b64(PDF) } }), m.ports);
  assert.equal(r.body.code, "record_failed"); }
{ const m = mk(); const r = await handle(req({ body: { expense_id: EXPENSE, action: "upload", media_type: "application/pdf", file_base64: b64(PDF) } }), m.ports);
  assert.equal(r.status, 200); assert.equal(r.body.sha256, await sha256Hex(PDF)); assert.equal(r.body.size, PDF.length);
  assert.ok(m.calls.some((c) => c[0] === "access" && c[2] === 3), "upload needs level 3");
  assert.ok(m.calls.some((c) => c[0] === "upload" && c[1] === `${FIRM}/${EXPENSE}/source.pdf`));
  assert.ok(m.calls.some((c) => c[0] === "record" && c[1] === `${FIRM}/${EXPENSE}/source.pdf` && c[2] === "application/pdf" && c[3] === PDF.length)); }

// url: access denied, nothing attached, signing failure, and the success path
{ const m = mk({ access: { ok: false } }); const r = await handle(req({ body: { expense_id: EXPENSE, action: "url" } }), m.ports);
  assert.equal(r.status, 403); assert.ok(!m.calls.some((c) => c[0] === "sign")); }
{ const m = mk({ attached: null }); const r = await handle(req({ body: { expense_id: EXPENSE, action: "url" } }), m.ports);
  assert.equal(r.status, 404); assert.equal(r.body.code, "no_document"); assert.ok(m.calls.some((c) => c[0] === "access" && c[2] === 1), "url needs only level 1"); }
{ const m = mk({ attached: { path: `${FIRM}/${EXPENSE}/source.pdf`, mime: "application/pdf" }, signFail: true });
  const r = await handle(req({ body: { expense_id: EXPENSE, action: "url" } }), m.ports); assert.equal(r.status, 500); }
{ const m = mk({ attached: { path: `${FIRM}/${EXPENSE}/source.pdf`, mime: "application/pdf" } });
  const r = await handle(req({ body: { expense_id: EXPENSE, action: "url" } }), m.ports);
  assert.equal(r.status, 200); assert.equal(r.body.expires_in, SIGNED_SECONDS);
  assert.ok(String(r.body.url).includes(`expense-${EXPENSE.replace(/-/g, "").slice(0, 8)}.pdf`), r.body.url); }
// a document attached with a mime the extension table does not know still signs, with a generic extension
{ const m = mk({ attached: { path: `${FIRM}/${EXPENSE}/source.bin`, mime: "application/octet-stream" } });
  const r = await handle(req({ body: { expense_id: EXPENSE, action: "url" } }), m.ports); assert.ok(String(r.body.url).includes(".bin")); }

// CORS
assert.equal((await handle(req({ origin: "https://evil.example" }), mk().ports)).headers["access-control-allow-origin"], undefined);
assert.equal((await handle(req({ body: { expense_id: EXPENSE, action: "url" } }), mk().ports)).headers["access-control-allow-origin"], "https://app.example");

console.log("fin-expense-doc-check: ok");
