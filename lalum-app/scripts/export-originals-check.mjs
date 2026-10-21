// Checks the request handling of lalum-export-originals with fakes. Run: npm run export-originals-check.
import assert from "node:assert/strict";
import { readFileSync, writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import ts from "typescript";

const src = readFileSync(new URL("../supabase/functions/lalum-export-originals/handler.ts", import.meta.url), "utf8");
const dir = mkdtempSync(join(tmpdir(), "export-originals-"));
const file = join(dir, "handler.mjs");
writeFileSync(file, ts.transpileModule(src, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 } }).outputText);
const { handle, SIGNED_SECONDS, DEFAULT_PAGE, MAX_PAGE } = await import(pathToFileURL(file).href);

const FIRM = "11111111-2222-3333-4444-555555555555";
const item = (n) => ({ document: `d${n}`, matter: `m${n}`, path: `firm/m${n}/d${n}/original.pdf`, sha256: "ab".repeat(32), size: 100 + n, mime: "application/pdf", file_name: `שם ${n}.pdf` });
const mk = (over = {}) => {
  const calls = [];
  const items = over.items ?? [item(1), item(2), item(3)];
  const ports = {
    allowedOrigins: ["https://app.example"],
    list: async (auth, firm, after, limit) => { calls.push(["list", auth, firm, after, limit]); return over.listed ?? { ok: true, items, nextAfter: over.nextAfter ?? null, total: over.total ?? items.length }; },
    signMany: async (paths, secs) => { calls.push(["sign", paths, secs]); return over.signed === undefined ? Object.fromEntries(paths.map((p) => [p, `https://signed.example/${p}`])) : over.signed; },
    ...over.ports,
  };
  return { ports, calls };
};
const req = (over = {}) => ({ method: "POST", authorization: "Bearer jwt", origin: "https://app.example", body: { firm_id: FIRM }, ...over });

// success: the database is asked first with the caller's own token, then exactly the paths it returned are signed once for 15 minutes
{ const { ports, calls } = mk(); const r = await handle(req(), ports);
  assert.equal(r.status, 200); assert.equal(r.body.ok, true); assert.equal(r.body.expires_in, 900); assert.equal(SIGNED_SECONDS, 900);
  assert.deepEqual(calls[0], ["list", "Bearer jwt", FIRM, null, DEFAULT_PAGE], "first page: no cursor, default size");
  assert.equal(calls[1][0], "sign"); assert.deepEqual(calls[1][1], ["firm/m1/d1/original.pdf", "firm/m2/d2/original.pdf", "firm/m3/d3/original.pdf"]); assert.equal(calls[1][2], 900);
  assert.equal(calls.length, 2, "one list and one batch sign, never one call per file");
  assert.equal(r.body.items.length, 3); assert.equal(r.body.items[0].url, "https://signed.example/firm/m1/d1/original.pdf");
  assert.equal(r.headers["cache-control"], "no-store"); assert.equal(r.body.next_after, null); assert.equal(r.body.total, 3); }
// the storage path never leaves the server
{ const r = await handle(req(), mk().ports); assert.ok(r.body.items.every((i) => !("path" in i)), "no path in the response");
  assert.deepEqual(Object.keys(r.body.items[0]).sort(), ["document", "file_name", "matter", "mime", "sha256", "size", "url"]); }
// a path the database did not return is never signed
{ const { ports, calls } = mk({ items: [item(1)] }); await handle(req({ body: { firm_id: FIRM, paths: ["other/secret.pdf"] } }), ports); assert.deepEqual(calls[1][1], ["firm/m1/d1/original.pdf"], "extra body fields are ignored"); }
// refusal by the database: 403, nothing is signed, the body says nothing about why
{ const { ports, calls } = mk({ listed: { ok: false } }); const r = await handle(req(), ports);
  assert.equal(r.status, 403); assert.deepEqual(r.body, { ok: false }); assert.ok(!calls.some((c) => c[0] === "sign"), "never signs without the database's yes"); }
// the database call throws: 500, nothing is signed
{ const { ports, calls } = mk({ ports: { list: async () => { throw new Error("db"); } } }); const r = await handle(req(), ports); assert.equal(r.status, 500); assert.equal(calls.length, 0); }
// no originals: 200 with an empty list and nothing to sign
{ const { ports, calls } = mk({ items: [] }); const r = await handle(req(), ports); assert.equal(r.status, 200); assert.deepEqual(r.body.items, []); assert.ok(!calls.some((c) => c[0] === "sign")); }
// paging: the cursor and the size reach the database, the answer carries the next cursor and the total
{ const AFTER = "99999999-2222-3333-4444-555555555555"; const { ports, calls } = mk({ nextAfter: "aaaaaaaa-2222-3333-4444-555555555555", total: 7 });
  const r = await handle(req({ body: { firm_id: FIRM, after: AFTER, limit: 3 } }), ports);
  assert.deepEqual(calls[0], ["list", "Bearer jwt", FIRM, AFTER, 3]); assert.equal(r.body.next_after, "aaaaaaaa-2222-3333-4444-555555555555"); assert.equal(r.body.total, 7);
  assert.equal(calls.filter((c) => c[0] === "sign").length, 1, "one batch sign per page"); }
// the size is clamped to the ceiling, never above it
{ const { ports, calls } = mk(); await handle(req({ body: { firm_id: FIRM, limit: 100000 } }), ports); assert.equal(calls[0][4], MAX_PAGE); }
// there is no ceiling on the firm's total: a page of exactly the ceiling is fine, and a reply larger than asked is refused unsigned
{ const full = Array.from({ length: MAX_PAGE }, (_, i) => item(i)); const r = await handle(req({ body: { firm_id: FIRM, limit: MAX_PAGE } }), mk({ items: full, nextAfter: "aaaaaaaa-2222-3333-4444-555555555555", total: 5000 }).ports);
  assert.equal(r.status, 200); assert.equal(r.body.items.length, MAX_PAGE); assert.equal(r.body.total, 5000);
  const over = Array.from({ length: 4 }, (_, i) => item(i)); const m = mk({ items: over }); const r2 = await handle(req({ body: { firm_id: FIRM, limit: 3 } }), m.ports);
  assert.equal(r2.status, 500); assert.ok(!m.calls.some((c) => c[0] === "sign"), "an oversized reply is never signed"); }
// an empty last page still carries the cursor and the total
{ const r = await handle(req({ body: { firm_id: FIRM, after: "99999999-2222-3333-4444-555555555555" } }), mk({ items: [], total: 7 }).ports); assert.equal(r.status, 200); assert.equal(r.body.next_after, null); assert.equal(r.body.total, 7); }
// a bad cursor or size is a 400 and reaches nothing
for (const bad of [{ after: "nope" }, { after: 5 }, { after: FIRM + "x" }, { limit: 0 }, { limit: -1 }, { limit: 1.5 }, { limit: "3" }]) {
  const { ports, calls } = mk(); const r = await handle(req({ body: { firm_id: FIRM, ...bad } }), ports); assert.equal(r.status, 400, JSON.stringify(bad)); assert.equal(calls.length, 0);
}
// signing fails or throws: 500, no urls
{ const r = await handle(req(), mk({ signed: null }).ports); assert.equal(r.status, 500); assert.equal(r.body.items, undefined); }
{ const r = await handle(req(), mk({ ports: { signMany: async () => { throw new Error("x"); } } }).ports); assert.equal(r.status, 500); }
// one path that could not be signed gives a null url for that document only
{ const r = await handle(req(), mk({ signed: { "firm/m1/d1/original.pdf": "https://s/1", "firm/m3/d3/original.pdf": "https://s/3" } }).ports);
  assert.equal(r.status, 200); assert.deepEqual(r.body.items.map((i) => i.url), ["https://s/1", null, "https://s/3"]); }
// request shape
for (const bad of [{ firm_id: "nope" }, { firm_id: 5 }, {}, null, { firm_id: FIRM + "x" }, { firm_id: "../" + FIRM }, { document_id: FIRM }]) {
  const { ports, calls } = mk(); const r = await handle(req({ body: bad }), ports); assert.equal(r.status, 400, JSON.stringify(bad)); assert.equal(calls.length, 0);
}
for (const auth of [null, "", "Bearer", "Basic abc", "bearer"]) { const { ports, calls } = mk(); const r = await handle(req({ authorization: auth }), ports); assert.equal(r.status, 401, String(auth)); assert.equal(calls.length, 0); }
{ const r = await handle(req({ method: "GET" }), mk().ports); assert.equal(r.status, 405); }
// CORS: only listed origins are echoed
{ const r = await handle(req(), mk().ports); assert.equal(r.headers["access-control-allow-origin"], "https://app.example"); }
{ const r = await handle(req({ origin: "https://evil.example" }), mk().ports); assert.equal(r.headers["access-control-allow-origin"], undefined); }
{ const r = await handle(req({ method: "OPTIONS", authorization: null, body: null }), mk().ports); assert.equal(r.status, 204); assert.equal(r.headers["access-control-allow-origin"], "https://app.example"); }
console.log("export-originals-check: ok");
