// Checks the firm wide handover package builder (src/lib/cockpit/firmExportCore.ts) against a fake database. Run with: npm run firm-export-check
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { buildPackage, parseManifest, readmeText, zipName, exportErrorText, ExportError } from "../src/lib/cockpit/firmExportCore.ts";

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
await t("PACKAGE.json holds no row data, only file names, counts and hashes", async () => {
  const b = await buildPackage(fake(tables).ports);
  const pkg = b.files.find((f) => f.path === "PACKAGE.json").content;
  assert.ok(!pkg.includes("שורה"), "no row content leaks into the index");
});
console.log("firm-export-check: all passed");
