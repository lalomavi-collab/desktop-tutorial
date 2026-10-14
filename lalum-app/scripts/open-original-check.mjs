// Checks the request handling of lalum-open-original with fakes. Run: npm run open-original-check.
import assert from "node:assert/strict";
import { readFileSync, writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import ts from "typescript";

const src = readFileSync(new URL("../supabase/functions/lalum-open-original/handler.ts", import.meta.url), "utf8");
const dir = mkdtempSync(join(tmpdir(), "open-original-"));
const file = join(dir, "handler.mjs");
writeFileSync(file, ts.transpileModule(src, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 } }).outputText);
const { handle, downloadName, SIGNED_SECONDS } = await import(pathToFileURL(file).href);

const DOC = "11111111-2222-3333-4444-555555555555";
const mk = (over = {}) => {
  const calls = [];
  const ports = {
    allowedOrigins: ["https://app.example"],
    openOriginal: async (auth, id) => { calls.push(["open", auth, id]); return over.opened ?? { ok: true, path: "firm/matter/doc/original.pdf", mime: "application/pdf", matterCode: "L-2026-0018" }; },
    sign: async (path, name, secs) => { calls.push(["sign", path, name, secs]); return over.signed === undefined ? "https://signed.example/x" : over.signed; },
    ...over.ports,
  };
  return { ports, calls };
};
const req = (over = {}) => ({ method: "POST", authorization: "Bearer jwt", origin: "https://app.example", body: { document_id: DOC }, ...over });

// success: the database is asked first, with the caller's own token, then exactly that path is signed for 60 seconds
{ const { ports, calls } = mk(); const r = await handle(req(), ports);
  assert.equal(r.status, 200); assert.equal(r.body.ok, true); assert.equal(r.body.url, "https://signed.example/x"); assert.equal(r.body.expires_in, 60);
  assert.deepEqual(calls[0], ["open", "Bearer jwt", DOC]);
  assert.deepEqual(calls[1], ["sign", "firm/matter/doc/original.pdf", "L-2026-0018-11111111.pdf", SIGNED_SECONDS]); assert.equal(calls.length, 2);
  assert.equal(r.headers["cache-control"], "no-store"); }
// refusal by the database: 403, nothing is signed, the body says nothing about why
{ const { ports, calls } = mk({ opened: { ok: false } }); const r = await handle(req(), ports);
  assert.equal(r.status, 403); assert.deepEqual(r.body, { ok: false }); assert.ok(!calls.some((c) => c[0] === "sign"), "never signs without the database's yes"); }
// the database call throws: 500, nothing is signed
{ const { ports, calls } = mk({ ports: { openOriginal: async () => { throw new Error("db"); } } }); const r = await handle(req(), ports);
  assert.equal(r.status, 500); assert.equal(calls.length, 0); }
// signing fails or throws: 500, no url
{ const r = await handle(req(), mk({ signed: null }).ports); assert.equal(r.status, 500); assert.equal(r.body.url, undefined); }
{ const r = await handle(req(), mk({ ports: { sign: async () => { throw new Error("x"); } } }).ports); assert.equal(r.status, 500); }
// request shape
for (const bad of [{ document_id: "nope" }, { document_id: 5 }, {}, null, { document_id: DOC + "x" }, { document_id: "../" + DOC }]) {
  const { ports, calls } = mk(); const r = await handle(req({ body: bad }), ports); assert.equal(r.status, 400, JSON.stringify(bad)); assert.equal(calls.length, 0);
}
for (const auth of [null, "", "Bearer", "Basic abc", "bearer"]) { const { ports, calls } = mk(); const r = await handle(req({ authorization: auth }), ports); assert.equal(r.status, 401, String(auth)); assert.equal(calls.length, 0); }
{ const r = await handle(req({ method: "GET" }), mk().ports); assert.equal(r.status, 405); }
// CORS: only listed origins are echoed
{ const r = await handle(req(), mk().ports); assert.equal(r.headers["access-control-allow-origin"], "https://app.example"); }
{ const r = await handle(req({ origin: "https://evil.example" }), mk().ports); assert.equal(r.headers["access-control-allow-origin"], undefined); }
{ const r = await handle(req({ method: "OPTIONS", authorization: null, body: null }), mk().ports); assert.equal(r.status, 204); assert.equal(r.headers["access-control-allow-origin"], "https://app.example"); }
// download names never carry the original file name and are safe
assert.equal(downloadName("L-2026-0018", DOC, "application/pdf"), "L-2026-0018-11111111.pdf");
assert.equal(downloadName("L-2026-0018", DOC, "application/vnd.openxmlformats-officedocument.wordprocessingml.document"), "L-2026-0018-11111111.docx");
assert.equal(downloadName("L-2026-0018", DOC, "text/plain"), "L-2026-0018-11111111.txt");
assert.equal(downloadName("L-2026-0018", DOC, null), "L-2026-0018-11111111.bin");
assert.equal(downloadName("L-2026-0018", DOC, "application/x-evil"), "L-2026-0018-11111111.bin");
assert.equal(downloadName("../שם לקוח\\x", DOC, "application/pdf"), "x-11111111.pdf", "hostile or Hebrew characters are dropped");
assert.equal(downloadName("", DOC, "application/pdf"), "matter-11111111.pdf");
console.log("open-original-check: ok");
