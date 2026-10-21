// Checks the firm wide handover package builder (src/lib/cockpit/firmExportCore.ts) against a fake database. Run with: npm run firm-export-check
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { buildPackage, parseManifest, parseOriginals, readmeText, zipName, exportErrorText, ExportError } from "../src/lib/cockpit/firmExportCore.ts";

const t = async (name, fn) => { await fn(); console.log(`[PASS] ${name}`); };
const sha = (s) => createHash("sha256").update(s, "utf8").digest("hex");
const digest = async (s) => sha(s);

// A fake database: tables of JSON text rows, a manifest computed the way migration 0066 computes it, and a page function like lalum_firm_export_page.
function fake(tables, over = {}) {
  const sorted = Object.fromEntries(Object.entries(tables).map(([k, rows]) => [k, [...rows].sort()]));
  const sections = Object.entries(sorted).sort(([a], [b]) => a.localeCompare(b)).map(([table, rows]) => ({ table, rows: rows.length, sha256: sha(rows.join("\n")), file: `${table}.jsonl` }));
  const manifest = {
    firm_status: "SUSPENDED", generated_at: "2026-10-20T10:00:00Z", sections, rows_total: sections.reduce((a, s) => a + s.rows, 0),
    excluded: { lalum_tax_connections: "references to credentials in the vault", lalum_conflict_parties: "blind index hashes" },
    unclassified: [], complete: true,
    audit_chain: { verified: true, first_broken_seq: null, head_seq: 12, head_hash: "ab".repeat(32) },
    originals: { count: 0, bytes: 0, without_sha256: 0 },
    ...over.manifest,
  };
  const calls = { manifest: 0, pages: [] };
  const ports = {
    manifest: async () => { calls.manifest += 1; return manifest; },
    page: async (table, offset, limit) => {
      calls.pages.push([table, offset, limit]);
      if (over.page) return over.page(table, offset, limit, sorted);
      const rows = sorted[table];
      return { table, offset, limit, total: rows.length, rows: rows.slice(offset, offset + limit) };
    },
    digest, now: () => new Date("2026-10-20T12:00:00Z"),
  };
  return { ports, calls, manifest };
}
const row = (i, extra = "") => JSON.stringify({ id: i, name: `שורה ${i}`, note: `a\nb ${extra}` });
const tables = { lalum_cockpit_matters: [row(1), row(2), row(3), row(4), row(5)], lalum_trust_ledger: [row(6)], lalum_deadlines: [] };

await t("the package holds one verified file per table, PACKAGE.json and README.txt", async () => {
  const { ports } = fake(tables);
  const b = await buildPackage(ports, { pageSize: 2 });
  assert.deepEqual(b.files.map((f) => f.path), ["data/lalum_cockpit_matters.jsonl", "data/lalum_deadlines.jsonl", "data/lalum_trust_ledger.jsonl", "PACKAGE.json", "README.txt"]);
  const pkg = JSON.parse(b.files.find((f) => f.path === "PACKAGE.json").content);
  for (const f of pkg.files) assert.equal(sha(b.files.find((x) => x.path === f.path).content), f.sha256, `${f.path} hashes to its recorded value`);
  assert.ok(pkg.files.every((f) => f.verified === true));
});
await t("pages are pulled in order and the file is the rows joined by a newline with none at the end", async () => {
  const { ports, calls } = fake(tables);
  const b = await buildPackage(ports, { pageSize: 2 });
  assert.deepEqual(calls.pages.filter((p) => p[0] === "lalum_cockpit_matters").map((p) => p[1]), [0, 2, 4], "three pages of two for five rows");
  const body = b.files.find((f) => f.path === "data/lalum_cockpit_matters.jsonl").content;
  assert.equal(body.split("\n").length, 5, "five rows, one per line: the row text holds an escaped newline, not a raw one");
  assert.ok(!body.endsWith("\n"));
});
await t("an empty table is an empty file with the hash of the empty string", async () => {
  const { ports } = fake(tables);
  const b = await buildPackage(ports);
  assert.equal(b.files.find((f) => f.path === "data/lalum_deadlines.jsonl").content, "");
});
await t("a page size above 500 is clamped to 500 and below 1 to 1", async () => {
  const a = fake(tables); await buildPackage(a.ports, { pageSize: 100000 });
  assert.ok(a.calls.pages.every((p) => p[2] === 500));
  const c = fake({ x: [row(1), row(2)] }); await buildPackage(c.ports, { pageSize: 0 });
  assert.ok(c.calls.pages.every((p) => p[2] === 1));
});
await t("a file that does not hash to the manifest stops the build and names the table", async () => {
  const { ports } = fake(tables, { page: (table, offset, limit, s) => ({ table, offset, limit, total: s[table].length, rows: s[table].slice(offset, offset + limit).map((r) => (table === "lalum_trust_ledger" ? r.replace("שורה", "שורא") : r)) }) });
  await assert.rejects(buildPackage(ports), (e) => e instanceof ExportError && e.code === "HASH_MISMATCH" && e.detail === "lalum_trust_ledger");
});
await t("rows that changed in count during the export stop the build", async () => {
  const more = fake(tables, { page: (table, offset, limit, s) => ({ table, offset, limit, total: s[table].length + 1, rows: s[table].slice(offset, offset + limit) }) });
  await assert.rejects(buildPackage(more.ports), (e) => e.code === "COUNT_CHANGED");
  const short = fake(tables, { page: (table, offset, limit) => ({ table, offset, limit, total: 5, rows: [] }) });
  await assert.rejects(buildPackage(short.ports), (e) => e.code === "COUNT_CHANGED");
});
await t("a database that never ends a page cannot loop the browser", async () => {
  let n = 0;
  const loop = fake({ x: [row(1), row(2), row(3)] }, { page: (table, offset, limit) => { n += 1; return { table, offset, limit, total: 3, rows: [row(1)] }; } });
  await assert.rejects(buildPackage(loop.ports, { pageSize: 1 }), (e) => e.code === "HASH_MISMATCH" || e.code === "COUNT_CHANGED");
  assert.ok(n <= 6, `bounded number of calls (${n})`);
});
await t("an incomplete manifest produces no package", async () => {
  const a = fake(tables, { manifest: { complete: false, unclassified: ["lalum_new_thing"] } });
  await assert.rejects(buildPackage(a.ports), (e) => e.code === "INCOMPLETE" && e.detail === "lalum_new_thing");
  assert.equal(a.calls.pages.length, 0, "no row is pulled when the package cannot be complete");
  const b = fake(tables, { manifest: { complete: true, unclassified: ["x"] } });
  await assert.rejects(buildPackage(b.ports), (e) => e.code === "INCOMPLETE", "complete true with a leftover is still refused");
});
await t("a manifest of the wrong shape is refused, as are table names that are not plain identifiers", async () => {
  assert.equal(parseManifest(null), null);
  assert.equal(parseManifest({}), null);
  const ok = fake(tables).manifest;
  assert.ok(parseManifest(ok));
  assert.equal(parseManifest({ ...ok, sections: [{ ...ok.sections[0], table: "x/../../etc" }] }), null, "no path tricks into the zip");
  assert.equal(parseManifest({ ...ok, sections: [{ ...ok.sections[0], sha256: "zz" }] }), null);
  assert.equal(parseManifest({ ...ok, originals: { count: "x" } }), null);
  await assert.rejects(buildPackage({ ...fake(tables).ports, manifest: async () => ({ nope: 1 }) }), (e) => e.code === "MANIFEST");
});
await t("the zip name has the date and a short id and no firm or client name", async () => {
  assert.equal(zipName("0a1b2c3d-4e5f-6789-aaaa-bbbbbbbbbbbb", new Date("2026-10-20T12:00:00Z")), "firm-export-0a1b2c3d-2026-10-20.zip");
  assert.equal(zipName("xyz", new Date("2026-10-20T12:00:00Z")), "firm-export-firm-2026-10-20.zip", "an id with no hex digits falls back safely");
  assert.ok(!/[^a-z0-9.-]/.test(zipName("../../x", new Date("2026-10-20T12:00:00Z"))), "no path characters whatever the id");
});
await t("a broken audit chain is carried into the README, not hidden and not a reason to refuse", async () => {
  const { ports } = fake(tables, { manifest: { audit_chain: { verified: false, first_broken_seq: 7, head_seq: 12, head_hash: "cd".repeat(32) } } });
  const b = await buildPackage(ports);
  assert.match(b.files.find((f) => f.path === "README.txt").content, /שבורה החל מרצף 7/);
  assert.equal(JSON.parse(b.files.find((f) => f.path === "PACKAGE.json").content).audit_chain.verified, false);
});
await t("originals are never claimed: with originals present the package is not complete for handover and says so", async () => {
  const { ports } = fake(tables, { manifest: { originals: { count: 250, bytes: 68245286, without_sha256: 0 } } });
  const b = await buildPackage(ports);
  assert.equal(b.handoverComplete, false);
  const pkg = JSON.parse(b.files.find((f) => f.path === "PACKAGE.json").content);
  assert.equal(pkg.handover_complete, false);
  assert.equal(pkg.originals.included, false);
  const readme = b.files.find((f) => f.path === "README.txt").content;
  assert.match(readme, /250 מסמכים מקוריים/);
  assert.match(readme, /אינה שלמה למסירה/);
  const none = await buildPackage(fake(tables).ports);
  assert.equal(none.handoverComplete, true, "a firm with no stored originals has nothing missing");
});
await t("the README lists what was left out with the reason, and the generated text uses no dash as punctuation", async () => {
  const b = await buildPackage(fake(tables).ports);
  const readme = b.files.find((f) => f.path === "README.txt").content;
  assert.match(readme, /lalum_tax_connections: references to credentials/);
  assert.match(readme, /\[CLIENT_NAME_1\]/);
  for (const text of [readme, readmeText(fake(tables).manifest && parseManifest(fake(tables).manifest), true, new Date()), ...["INCOMPLETE", "COUNT_CHANGED", "HASH_MISMATCH", "PAGE", "MANIFEST"].map((c) => exportErrorText(new ExportError(c, "x"))), exportErrorText(new Error("x"))]) {
    assert.ok(!/[—–]/.test(text), "no em or en dash");
    assert.ok(!/ - /.test(text), "no spaced hyphen");
  }
});

// ---- originals (the batch signed files of lalum-export-originals) ----
const bytesOf = (s) => new Uint8Array(Buffer.from(s, "utf8"));
const D = (n) => `${String(n).padStart(8, "0")}-0000-4000-8000-000000000000`;
function withOriginals(docs, over = {}) {
  const manifest = { originals: { count: docs.length, bytes: docs.reduce((a, d) => a + d.body.length, 0), without_sha256: 0 }, ...over.manifest };
  const f = fake(tables, { manifest });
  const store = Object.fromEntries(docs.map((d) => [`https://signed/${d.id}`, d.body]));
  const fetches = [];
  f.ports.originals = {
    list: async () => over.list ? over.list() : ({ ok: true, items: docs.map((d) => ({ document: D(d.id), matter: D(90 + d.id), sha256: "sha" in d ? d.sha : sha(d.body), size: d.size ?? Buffer.byteLength(d.body), mime: d.mime ?? "application/pdf", file_name: d.name ?? `שם לקוח ${d.id}.pdf`, url: d.nourl ? null : `https://signed/${d.id}` })) }),
    fetchBytes: async (url) => { fetches.push(url); if (over.fetch) return over.fetch(url, store, fetches); return bytesOf(store[url]); },
    digestBytes: async (b) => createHash("sha256").update(b).digest("hex"),
  };
  return { ...f, fetches };
}
const pkgOf = (b) => JSON.parse(b.files.find((x) => x.path === "PACKAGE.json").content);

await t("originals are fetched, verified against the recorded hash and size, and named by document id", async () => {
  const { ports } = withOriginals([{ id: 1, body: "pdf one" }, { id: 2, body: "docx two", mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", name: "contract.docx" }]);
  const b = await buildPackage(ports);
  assert.equal(b.handoverComplete, true);
  assert.deepEqual(b.files.filter((f) => f.path.startsWith("originals/")).map((f) => f.path), [`originals/${D(1)}.pdf`, `originals/${D(2)}.docx`, "originals/index.jsonl"]);
  const f1 = b.files.find((f) => f.path === `originals/${D(1)}.pdf`);
  assert.ok(f1.binary && f1.content instanceof Uint8Array); assert.equal(Buffer.from(f1.content).toString("utf8"), "pdf one");
  const pkg = pkgOf(b);
  assert.equal(pkg.handover_complete, true); assert.equal(pkg.originals.included, true); assert.equal(pkg.originals.files_in_zip, 2); assert.equal(pkg.originals.verified, 2); assert.deepEqual(pkg.originals.failed, []);
  assert.match(b.files.find((f) => f.path === "README.txt").content, /כל המקוריים כלולים ואומתו/);
});
await t("no archive path carries an original file name, which can identify a client; the index does", async () => {
  const { ports } = withOriginals([{ id: 1, body: "x" }]);
  const b = await buildPackage(ports);
  assert.ok(b.files.every((f) => !f.path.includes("שם לקוח")), "no client name in any path");
  const idx = b.files.find((f) => f.path === "originals/index.jsonl").content;
  const row = JSON.parse(idx.split("\n")[0]);
  assert.equal(row.original_name, "שם לקוח 1.pdf"); assert.equal(row.verified, true); assert.equal(row.file, `originals/${D(1)}.pdf`);
});
await t("a hostile file name cannot change the archive path", async () => {
  const { ports } = withOriginals([{ id: 1, body: "x", name: "../../evil.pdf\u0000.exe", mime: "application/pdf" }, { id: 2, body: "y", name: "a.b/c", mime: null }]);
  const b = await buildPackage(ports);
  assert.ok(b.files.filter((f) => f.binary).every((f) => /^originals\/[0-9a-f-]{36}\.[a-z0-9]{1,8}$/.test(f.path)), b.files.map((f) => f.path).join(","));
  const bad = withOriginals([{ id: 3, body: "z" }], { list: () => ({ ok: true, items: [{ document: "../x", matter: "m", sha256: sha("z"), size: 1, mime: null, file_name: null, url: "https://signed/3" }] }) });
  const r = await buildPackage(bad.ports); assert.deepEqual(pkgOf(r).originals.failed, [{ document: "../x", reason: "BAD_ID" }]); assert.equal(r.handoverComplete, false);
});
await t("a wrong hash, a wrong size or no recorded hash keeps the file, flags it and makes the handover incomplete", async () => {
  const { ports } = withOriginals([{ id: 1, body: "ok" }, { id: 2, body: "tampered", sha: sha("original") }, { id: 3, body: "short", size: 99 }, { id: 4, body: "nohash", sha: null }]);
  const b = await buildPackage(ports);
  assert.equal(b.handoverComplete, false);
  const pkg = pkgOf(b);
  assert.deepEqual(pkg.originals.failed.map((f) => f.reason).sort(), ["NO_HASH", "SHA256", "SIZE"]);
  assert.equal(pkg.originals.verified, 1); assert.equal(pkg.originals.files_in_zip, 4);
  const readme = b.files.find((f) => f.path === "README.txt").content;
  assert.match(readme, /3 מסמכים לא כלולים או לא אומתו/); assert.match(readme, /אינה שלמה למסירה/);
  assert.ok(!/[—–]/.test(readme) && !/ - /.test(readme));
});
await t("a fetch that fails once is retried; one that fails twice is recorded and the export goes on", async () => {
  let n = 0;
  const { ports, fetches } = withOriginals([{ id: 1, body: "flaky" }, { id: 2, body: "gone" }], { fetch: async (url, store) => { if (url.endsWith("/1")) { n += 1; if (n === 1) throw new Error("net"); return bytesOf(store[url]); } throw new Error("down"); } });
  const b = await buildPackage(ports);
  assert.equal(pkgOf(b).originals.verified, 1); assert.deepEqual(pkgOf(b).originals.failed, [{ document: D(2), reason: "FETCH" }]);
  assert.equal(fetches.filter((u) => u.endsWith("/2")).length, 2, "two attempts, no more"); assert.equal(b.handoverComplete, false);
  assert.equal(b.files.find((f) => f.path === "originals/index.jsonl").content.split("\n").length, 2, "both are in the index");
});
await t("a missing link is recorded, a failed or malformed list is not fatal, and the tables still come out", async () => {
  const a = withOriginals([{ id: 1, body: "x", nourl: true }]); const ra = await buildPackage(a.ports);
  assert.deepEqual(pkgOf(ra).originals.failed, [{ document: D(1), reason: "NO_URL" }]);
  for (const list of [() => { throw new Error("401"); }, () => null, () => ({ ok: false }), () => ({ ok: true, items: "x" })]) {
    const c = withOriginals([{ id: 1, body: "x" }], { list }); const rc = await buildPackage(c.ports);
    assert.equal(rc.handoverComplete, false); assert.equal(pkgOf(rc).originals.list_error, "LIST"); assert.ok(rc.files.some((f) => f.path === "data/lalum_cockpit_matters.jsonl"), "the verified tables are still delivered");
    assert.match(rc.files.find((f) => f.path === "README.txt").content, /קבלת רשימת המקוריים נכשלה/);
  }
});
await t("a list that disagrees with the manifest count makes the package incomplete even if every file verifies", async () => {
  const { ports } = withOriginals([{ id: 1, body: "a" }, { id: 2, body: "b" }], { manifest: { originals: { count: 3, bytes: 2, without_sha256: 0 } } });
  const b = await buildPackage(ports);
  assert.equal(b.handoverComplete, false); assert.match(b.files.find((f) => f.path === "README.txt").content, /שונה ממספרם בכרטיס/);
});
await t("originals are fetched at most four at a time", async () => {
  let live = 0, peak = 0;
  const docs = Array.from({ length: 12 }, (_, i) => ({ id: i + 1, body: `b${i}` }));
  const { ports } = withOriginals(docs, { fetch: async (url, store) => { live += 1; peak = Math.max(peak, live); await new Promise((r) => setTimeout(r, 5)); live -= 1; return bytesOf(store[url]); } });
  const b = await buildPackage(ports); assert.equal(b.handoverComplete, true); assert.ok(peak <= 4 && peak > 1, `peak ${peak}`);
});
await t("without the originals port nothing is fetched and the package states it, as before", async () => {
  const f = fake(tables, { manifest: { originals: { count: 5, bytes: 10, without_sha256: 0 } } });
  const b = await buildPackage(f.ports); assert.equal(b.handoverComplete, false); assert.equal(pkgOf(b).originals.included, false); assert.equal(pkgOf(b).originals.files_in_zip, 0);
  assert.equal(b.originals, null);
});
await t("a firm with no stored originals never calls the originals port", async () => {
  let called = 0; const f = fake(tables); f.ports.originals = { list: async () => { called += 1; return null; }, fetchBytes: async () => new Uint8Array(), digestBytes: async () => "" };
  const b = await buildPackage(f.ports); assert.equal(called, 0); assert.equal(b.handoverComplete, true);
});
await t("parseOriginals refuses the wrong shape", async () => {
  assert.equal(parseOriginals(null), null); assert.equal(parseOriginals({ ok: false }), null); assert.equal(parseOriginals({ ok: true, items: [{ nope: 1 }] }), null);
  assert.deepEqual(parseOriginals({ ok: true, items: [] }), []);
});
await t("PACKAGE.json holds no row data, only file names, counts and hashes", async () => {
  const b = await buildPackage(fake(tables).ports);
  const pkg = b.files.find((f) => f.path === "PACKAGE.json").content;
  assert.ok(!pkg.includes("שורה"), "no row content leaks into the index");
});
console.log("firm-export-check: all passed");
