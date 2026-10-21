// Checks the originals step of the per matter client export with fakes. Run: npm run matter-originals-check.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { pullMatterOriginals, originalsReadme, extFor, MAX_FILES, MAX_BYTES } from "../src/lib/cockpit/matterOriginalsCore.ts";

const sha = (s) => createHash("sha256").update(Buffer.from(s, "utf8")).digest("hex");
const bytes = (s) => new Uint8Array(Buffer.from(s, "utf8"));
const D = (n) => `${String(n).padStart(8, "0")}-0000-4000-8000-000000000000`;
const doc = (n, body, over = {}) => ({ id: D(n), fileName: `שם ${n}.pdf`, size: body === null ? null : Buffer.byteLength(body), sha256: body === null ? null : sha(body), mime: "application/pdf", ...over });
const nameOf = (i, d) => `originals/${String(i + 1).padStart(2, "0")}-doc${i + 1}`;
function mk(bodies, over = {}) {
  const opens = [], fetches = [];
  const port = {
    open: async (id) => { opens.push(id); if (over.open) return over.open(id); return { ok: true, url: `https://signed/${id}` }; },
    fetchBytes: async (url) => { fetches.push(url); if (over.fetch) return over.fetch(url, fetches); const id = url.split("/").pop(); return bytes(bodies[id]); },
    digestBytes: async (b) => createHash("sha256").update(b).digest("hex"),
  };
  return { port, opens, fetches };
}
let n = 0;
const t = async (name, fn) => { await fn(); n += 1; console.log(`[PASS] ${name}`); };

await t("every original is opened once, fetched, verified and placed next to its document by index", async () => {
  const docs = [doc(1, "one"), doc(2, "two", { fileName: "contract.docx", mime: null })];
  const { port, opens } = mk({ [D(1)]: "one", [D(2)]: "two" });
  const r = await pullMatterOriginals(docs, port, nameOf);
  assert.equal(r.complete, true); assert.equal(r.verified, 2); assert.equal(r.requested, 2); assert.equal(r.without, 0); assert.equal(r.skipped, null);
  assert.deepEqual(r.files.map((f) => f.path), ["originals/01-doc1.pdf", "originals/02-doc2.docx"]);
  assert.deepEqual([...opens].sort(), [D(1), D(2)], "one open, so one chain row, per file");
  assert.ok(r.rows.every((x) => x.verified && x.reason === null));
});
await t("a document with no stored original is counted and never opened", async () => {
  const docs = [doc(1, "one"), doc(2, null)];
  const { port, opens } = mk({ [D(1)]: "one" });
  const r = await pullMatterOriginals(docs, port, nameOf);
  assert.equal(r.requested, 1); assert.equal(r.without, 1); assert.deepEqual(opens, [D(1)]); assert.equal(r.complete, true);
  assert.match(originalsReadme(r).join("\n"), /1 מסמכים נקלטו בלי קובץ מקור שמור/);
});
await t("a refused open (no second factor, no right) is listed, not fatal, and the set is incomplete", async () => {
  const { port } = mk({ [D(1)]: "one", [D(2)]: "two" }, { open: async (id) => (id === D(2) ? { ok: false } : { ok: true, url: `https://signed/${id}` }) });
  const r = await pullMatterOriginals([doc(1, "one"), doc(2, "two")], port, nameOf);
  assert.equal(r.complete, false); assert.equal(r.verified, 1); assert.deepEqual(r.rows.find((x) => x.document === D(2)).reason, "OPEN"); assert.equal(r.files.length, 1);
  const open = mk({}, { open: async () => { throw new Error("net"); } });
  assert.equal((await pullMatterOriginals([doc(1, "one")], open.port, nameOf)).rows[0].reason, "OPEN");
});
await t("a fetch that fails once is retried on the same link, never by opening again", async () => {
  let k = 0;
  const { port, opens, fetches } = mk({ [D(1)]: "one" }, { fetch: async (url) => { k += 1; if (k === 1) throw new Error("x"); return bytes("one"); } });
  const r = await pullMatterOriginals([doc(1, "one")], port, nameOf);
  assert.equal(r.complete, true); assert.equal(opens.length, 1); assert.equal(fetches.length, 2);
  const dead = mk({}, { fetch: async () => { throw new Error("x"); } });
  const r2 = await pullMatterOriginals([doc(1, "one")], dead.port, nameOf); assert.equal(r2.rows[0].reason, "FETCH"); assert.equal(dead.fetches.length, 2, "two attempts, no more"); assert.equal(dead.opens.length, 1);
});
await t("a wrong size, a wrong hash or no recorded hash keeps the file, flags it and makes the set incomplete", async () => {
  const docs = [doc(1, "ok"), doc(2, "tampered", { sha256: sha("original") }), doc(3, "short", { size: 99 }), doc(4, "nohash", { sha256: null })];
  const { port } = mk({ [D(1)]: "ok", [D(2)]: "tampered", [D(3)]: "short", [D(4)]: "nohash" });
  const r = await pullMatterOriginals(docs, port, nameOf);
  assert.equal(r.complete, false); assert.equal(r.verified, 1); assert.equal(r.files.length, 4);
  assert.deepEqual(r.rows.filter((x) => !x.verified).map((x) => x.reason).sort(), ["NO_HASH", "SHA256", "SIZE"]);
  const text = originalsReadme(r).join("\n"); assert.match(text, /3 קבצים לא נכללו או לא אומתו/); assert.match(text, /אומתו 1/);
});
await t("too many files or too many bytes leaves the originals out and says so, opening nothing", async () => {
  const many = Array.from({ length: MAX_FILES + 1 }, (_, i) => doc(i + 1, "x"));
  const a = mk({}); const ra = await pullMatterOriginals(many, a.port, nameOf);
  assert.equal(ra.skipped, "TOO_LARGE"); assert.equal(ra.complete, false); assert.equal(a.opens.length, 0); assert.equal(ra.files.length, 0);
  const big = mk({}); const rb = await pullMatterOriginals([doc(1, "x", { size: MAX_BYTES + 1 })], big.port, nameOf);
  assert.equal(rb.skipped, "TOO_LARGE"); assert.equal(big.opens.length, 0);
  const edge = mk({ [D(1)]: "x" }); assert.equal((await pullMatterOriginals([doc(1, "x")], edge.port, nameOf)).skipped, null);
  assert.match(originalsReadme(ra).join("\n"), /גדולים מדי/);
});
await t("originals are opened at most two at a time", async () => {
  let live = 0, peak = 0;
  const docs = Array.from({ length: 8 }, (_, i) => doc(i + 1, `b${i}`));
  const bodies = Object.fromEntries(docs.map((d, i) => [d.id, `b${i}`]));
  const { port } = mk(bodies, { fetch: async (url) => { live += 1; peak = Math.max(peak, live); await new Promise((r) => setTimeout(r, 5)); live -= 1; return bytes(bodies[url.split("/").pop()]); } });
  const r = await pullMatterOriginals(docs, port, nameOf); assert.equal(r.complete, true); assert.ok(peak <= 2 && peak > 1, `peak ${peak}`);
});
await t("a matter with no stored originals asks nothing and is complete", async () => {
  const { port, opens } = mk({});
  const r = await pullMatterOriginals([doc(1, null), doc(2, null)], port, nameOf);
  assert.equal(r.requested, 0); assert.equal(opens.length, 0); assert.equal(r.complete, true);
  assert.match(originalsReadme(r).join("\n"), /לא נמצאו קבצי מקור שמורים/);
});
await t("extension: from the stored name when plain, else the mime type, else bin; a hostile name adds nothing", async () => {
  assert.equal(extFor(doc(1, "x", { fileName: "a.PDF" })), "pdf");
  assert.equal(extFor(doc(1, "x", { fileName: "noext", mime: "application/pdf" })), "pdf");
  assert.equal(extFor(doc(1, "x", { fileName: "noext", mime: null })), "bin");
  assert.equal(extFor(doc(1, "x", { fileName: "../../evil.pdf\u0000.exe", mime: null })), "exe");
});
await t("without a pull the README states the original is not included, and no generated sentence uses a dash as punctuation", async () => {
  assert.match(originalsReadme(null)[0], /הפירמה מוסרת אותו בנפרד/);
  const all = [originalsReadme(null), originalsReadme({ files: [], rows: [{ document: "d", file: null, size: 1, sha256: "x", verified: false, reason: "OPEN" }], requested: 1, without: 1, verified: 0, skipped: null, complete: false })].flat().join("\n");
  assert.ok(!/[—–]/.test(all) && !/ - /.test(all));
});
console.log(`matter-originals-check: ${n} passed`);
