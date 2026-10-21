// Checks the request handling of lalum-fin-archive-pdf with fakes. Run: npm run fin-archive-pdf-check.
import assert from "node:assert/strict";
import { readFileSync, writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import ts from "typescript";

const src = readFileSync(new URL("../supabase/functions/lalum-fin-archive-pdf/handler.ts", import.meta.url), "utf8");
const dir = mkdtempSync(join(tmpdir(), "fin-archive-pdf-"));
const file = join(dir, "handler.mjs");
writeFileSync(file, ts.transpileModule(src, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 } }).outputText);
const { handle, safeLink } = await import(pathToFileURL(file).href);

const ID = "11111111-2222-3333-4444-555555555555";
const mk = (over = {}) => {
  const calls = [];
  const ports = {
    allowedOrigins: ["https://app.example"],
    allow: async (auth, id) => { calls.push(["allow", auth, id]); return over.allowed ?? { ok: true, row: { i4uDocId: "42", docType: 3, docNumber: 7 } }; },
    fetchLinks: async (row) => { calls.push(["fetch", row]); return over.fetched ?? { original: "https://api.invoice4u.co.il/pdf/abc", certified: null, tried: [{ op: "GetDocument", http: 200, errors: [], filled: true }] }; },
    ...over.ports,
  };
  return { ports, calls };
};
const req = (over = {}) => ({ method: "POST", authorization: "Bearer jwt", origin: "https://app.example", body: { archive_id: ID }, ...over });

// success: the database is asked first with the caller's token, then the provider, and the link comes back
{ const { ports, calls } = mk(); const r = await handle(req(), ports);
  assert.equal(r.status, 200); assert.deepEqual(r.body, { ok: true, url: "https://api.invoice4u.co.il/pdf/abc" });
  assert.equal(calls[0][0], "allow"); assert.equal(calls[0][1], "Bearer jwt"); assert.equal(calls[1][0], "fetch"); assert.deepEqual(calls[1][1], { i4uDocId: "42", docType: 3, docNumber: 7 });
  assert.equal(r.headers["cache-control"], "no-store"); }
// refusal by the database: 403, the provider is never asked
{ const { ports, calls } = mk({ allowed: { ok: false } }); const r = await handle(req(), ports); assert.equal(r.status, 403); assert.ok(!calls.some((c) => c[0] === "fetch")); }
{ const { ports, calls } = mk({ ports: { allow: async () => { throw new Error("db"); } } }); const r = await handle(req(), ports); assert.equal(r.status, 500); assert.equal(calls.length, 0); }
// the certified copy is the fallback when no original link came back
{ const r = await handle(req(), mk({ fetched: { original: null, certified: "https://x.invoice4u.co.il/c", tried: [] } }).ports); assert.equal(r.body.url, "https://x.invoice4u.co.il/c"); }
// a link off the provider's domain, or not https, is never returned
for (const bad of ["http://api.invoice4u.co.il/a", "https://evil.example/a", "https://invoice4u.co.il.evil.example/a", "javascript:alert(1)", "not a url", ""]) {
  assert.equal(safeLink(bad), null, bad);
  const r = await handle(req(), mk({ fetched: { original: bad, certified: null, tried: [{ op: "GetDocument", http: 200, errors: [], filled: true }] } }).ports);
  assert.equal(r.body.ok, false); assert.equal(r.body.code, "no_link");
}
// no link: ok false, with the operations tried and their status, trimmed
{ const tried = [{ op: "GetDocument", http: 404, errors: ["a", "b", "c", "d"], filled: false }, { op: "GetDocumentByID", http: null, errors: ["x"], filled: false }];
  const r = await handle(req(), mk({ fetched: { original: null, certified: null, tried } }).ports);
  assert.equal(r.status, 200); assert.equal(r.body.ok, false); assert.equal(r.body.tried.length, 2); assert.equal(r.body.tried[0].errors.length, 3); }
// the diagnostics carry names, lengths and hosts of link like fields, trimmed, and never a value
{ const tried = [{ op: "GetDocument", http: 200, errors: [], filled: false, keys: Array.from({ length: 60 }, (_, i) => "k" + i), linkFields: [{ key: "Doc.PdfLink", length: 120, host: "files.example" }], shape: "object" }];
  const r = await handle(req(), mk({ fetched: { original: null, certified: null, tried } }).ports);
  assert.equal(r.body.tried[0].keys.length, 40); assert.deepEqual(r.body.tried[0].linkFields, [{ key: "Doc.PdfLink", length: 120, host: "files.example" }]); assert.equal(r.body.tried[0].shape, "object");
  assert.ok(!JSON.stringify(r.body).includes("https://")); }
// provider call throws: 502
{ const r = await handle(req(), mk({ ports: { fetchLinks: async () => { throw new Error("x"); } } }).ports); assert.equal(r.status, 502); }
// request shape
for (const bad of [{ archive_id: "nope" }, { archive_id: 5 }, {}, null, { archive_id: ID + "x" }]) {
  const { ports, calls } = mk(); const r = await handle(req({ body: bad }), ports); assert.equal(r.status, 400, JSON.stringify(bad)); assert.equal(calls.length, 0);
}
for (const auth of [null, "", "Bearer", "Basic abc"]) { const { ports, calls } = mk(); const r = await handle(req({ authorization: auth }), ports); assert.equal(r.status, 401, String(auth)); assert.equal(calls.length, 0); }
assert.equal((await handle(req({ method: "GET" }), mk().ports)).status, 405);
// CORS: only listed origins are echoed
assert.equal((await handle(req(), mk().ports)).headers["access-control-allow-origin"], "https://app.example");
assert.equal((await handle(req({ origin: "https://evil.example" }), mk().ports)).headers["access-control-allow-origin"], undefined);
{ const r = await handle(req({ method: "OPTIONS", authorization: null, body: null }), mk().ports); assert.equal(r.status, 204); }
console.log("fin-archive-pdf-check: ok");
