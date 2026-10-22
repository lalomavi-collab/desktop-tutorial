// Checks lalum-fin-archive-backup with fakes. Run: npm run fin-archive-backup-check.
import assert from "node:assert/strict";
import { readFileSync, writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import ts from "typescript";

const load = async (rel, name) => {
  const src = readFileSync(new URL(rel, import.meta.url), "utf8");
  const f = join(mkdtempSync(join(tmpdir(), "fin-backup-")), name);
  writeFileSync(f, ts.transpileModule(src, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 } }).outputText);
  return import(pathToFileURL(f).href);
};
const { handle, backupOne, backupPath, isPdf, pdfLinkFromCipher, MAX_BATCH } = await load("../supabase/functions/lalum-fin-archive-backup/handler.ts", "h.mjs");
const pdfMod = await load("../supabase/functions/lalum-fin-archive-pdf/handler.ts", "p.mjs");

const C = "AbC123%2BxYz%3D%3D-_.~";
const PDF = new TextEncoder().encode("%PDF-1.7\n....");
const row = (n, over = {}) => ({ id: `0000000${n}-aaaa-bbbb-cccc-dddddddddddd`, firmId: "f1", docType: 3, docNumber: 70000 + n, cipher: C, ...over });
const mk = (over = {}) => {
  const calls = [], store = new Set(over.have ?? []);
  const ports = {
    allowedOrigins: ["https://app.example"],
    allow: async () => over.allowed ?? { ok: true },
    listRows: async (a, o, l) => { calls.push(["list", o, l]); const all = over.rows ?? [row(1), row(2), row(3)]; return { rows: all.slice(o, o + l), total: all.length }; },
    exists: async (p) => store.has(p),
    download: async (u) => { calls.push(["dl", u]); return over.dl ?? { status: 200, bytes: PDF }; },
    upload: async (p) => { if (over.upFail) return false; store.add(p); calls.push(["up", p]); return true; },
    ...over.ports,
  };
  return { ports, calls, store };
};
const req = (over = {}) => ({ method: "POST", authorization: "Bearer jwt", origin: "https://app.example", body: {}, ...over });

// the two link builders agree, and refuse the same inputs
for (const c of [C, "short", "has space12345", "a&b=c12345", "%zz123456", null, "a".repeat(2001)]) assert.equal(pdfLinkFromCipher(c), pdfMod.pdfLinkFromCipher(c), String(c));
assert.equal(pdfLinkFromCipher(C), "https://newview.invoice4u.co.il/Views/PDF.aspx?cipher=" + C);
assert.ok(isPdf(PDF)); assert.ok(!isPdf(new TextEncoder().encode("<html>not a pdf</html>"))); assert.ok(!isPdf(new Uint8Array(0)));
assert.equal(backupPath(row(1)), "f1/3-70001-00000001.pdf");

// a batch saves each document once, and a second run skips them
{ const m = mk(); const r = await handle(req(), m.ports);
  assert.equal(r.status, 200); assert.equal(r.body.saved, 3); assert.equal(r.body.failed, 0); assert.equal(r.body.total, 3); assert.equal(r.body.next, null);
  const again = await handle(req(), m.ports); assert.equal(again.body.saved, 0); assert.equal(again.body.skipped, 3); }
// paging
{ const m = mk({ rows: [1, 2, 3, 4, 5].map((n) => row(n)) }); const r = await handle(req({ body: { offset: 0, limit: 2 } }), m.ports);
  assert.equal(r.body.next, 2); assert.equal(r.body.results.length, 2); const r2 = await handle(req({ body: { offset: 4, limit: 2 } }), m.ports); assert.equal(r2.body.next, null); }
// failures are named and counted; nothing is stored
for (const [over, outcome] of [[{ dl: { status: 500, bytes: null } }, "download_failed"], [{ dl: { status: 200, bytes: new TextEncoder().encode("<html>login</html>") } }, "not_pdf"], [{ upFail: true }, "upload_failed"]]) {
  const m = mk({ ...over, rows: [row(1)] }); const r = await handle(req(), m.ports); assert.equal(r.body.results[0].outcome, outcome); assert.equal(r.body.failed, 1); assert.equal(m.store.size, 0);
}
{ const m = mk({ rows: [row(1, { cipher: null })] }); const r = await handle(req(), m.ports); assert.equal(r.body.results[0].outcome, "no_cipher"); assert.ok(!m.calls.some((c) => c[0] === "dl")); }
{ const big = { status: 200, bytes: Object.assign(new Uint8Array(20 * 1024 * 1024 + 1), PDF) }; assert.equal(await backupOne(row(1), mk({ dl: big }).ports), "too_large"); }
// a thrown download is a failure of that document, not of the batch
{ const m = mk({ ports: { download: async () => { throw new Error("net"); } } }); const r = await handle(req(), m.ports); assert.equal(r.status, 200); assert.equal(r.body.failed, 3); }
// the answer never carries a cipher or a link
{ const r = await handle(req(), mk().ports); const s = JSON.stringify(r.body); assert.ok(!s.includes(C) && !s.includes("https://")); }
// refusal and request shape
{ const m = mk({ allowed: { ok: false } }); const r = await handle(req(), m.ports); assert.equal(r.status, 403); assert.ok(!m.calls.length); }
for (const bad of [{ offset: -1 }, { offset: 1.5 }, { limit: 0 }, { limit: MAX_BATCH + 1 }, { limit: "5" }]) assert.equal((await handle(req({ body: bad }), mk().ports)).status, 400, JSON.stringify(bad));
for (const auth of [null, "", "Bearer", "Basic abc"]) assert.equal((await handle(req({ authorization: auth }), mk().ports)).status, 401);
assert.equal((await handle(req({ method: "GET" }), mk().ports)).status, 405);
assert.equal((await handle(req({ origin: "https://evil.example" }), mk().ports)).headers["access-control-allow-origin"], undefined);
console.log("fin-archive-backup-check: ok");
