// Checks the automatic invoice intake rules (src/lib/cockpit/expenseIntake.ts): which uploaded invoice is attached to which
// expense, which is booked as a new one and how it is classified, and which is left for a person. Run: npm run expense-intake-check
import assert from "node:assert/strict";
import { readFileSync, writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import ts from "typescript";

const t = (name, fn) => { fn(); console.log(`[PASS] ${name}`); };
const src = readFileSync(new URL("../src/lib/cockpit/expenseIntake.ts", import.meta.url), "utf8");
const f = join(mkdtempSync(join(tmpdir(), "intake-")), "expenseIntake.mjs");
writeFileSync(f, ts.transpileModule(src, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 } }).outputText);
const I = await import(pathToFileURL(f).href);

const TODAY = "2026-10-30";
const exp = (o) => ({ id: "e1", spent_on: "2026-10-26", supplier: "דיינמיקה", category: "COMMUNICATION", description: null, total: 5689, vat_amount: 867.81, vat_recoverable_pct: 100, supplier_doc_ref: "332461423", payment_method: null, tax_category: "FIXED_ASSET", income_tax_recognition_pct: 100, ...o });
const draft = (o) => ({ spent_on: "2026-10-26", supplier: "Dynamica", category: "COMMUNICATION", description: "iPhone", total: 5689, vat_amount: 867.81, supplier_doc_ref: "332461423", currency: "ILS", ...o });
const doc = (o) => ({ id: "d1", expense_id: "e1", sha256: "a".repeat(64), mime: "application/pdf", size_bytes: 10, uploaded_at: "2026-10-27T08:00:00Z", superseded_at: null, ...o });
const none = new Map();

t("a corrected invoice keeps its number, lands on the row it corrects, replaces the attached copy and clears the request", () => {
  const d = I.decideIntake(draft({}), [], [exp({ description: "iPhone. לבקש חשבונית מתוקנת על שם העסק" })], new Map([["e1", [doc({ id: "old", uploaded_at: "2026-10-01T00:00:00Z", superseded_at: "2026-10-02T00:00:00Z" }), doc({})]]]), TODAY);
  assert.deepEqual(d, { kind: "attach", expenseId: "e1", supersedes: "d1", corrected: true, by: "ref" });
  assert.equal(I.decideIntake(draft({}), [], [exp({ description: "x. התקבלה חשבונית מתוקנת 1.11.2026" })], none, TODAY).corrected, false, "asked once, cleared once");
});
t("the number matches across spelling and separators; a long number needs no supplier match, a short one does", () => {
  assert.equal(I.normRef(" 0033-2461423 "), "332461423");
  assert.equal(I.normRef("AB-12"), "ab-12");
  assert.equal(I.normRef("12"), null);
  assert.equal(I.decideIntake(draft({ supplier_doc_ref: "33-2461423" }), [], [exp({})], none, TODAY).kind, "attach");
  assert.equal(I.decideIntake(draft({ supplier: "חברה אחרת", supplier_doc_ref: "1943" }), [], [exp({ supplier: "סלקום", supplier_doc_ref: "1943", total: 5689 })], none, TODAY).kind, "create", "a short number of another supplier is not this invoice");
});
t("same number, other amount: a corrected invoice that changes the sum is left for a person", () => {
  const d = I.decideIntake(draft({ total: 5600, vat_amount: 854.24 }), [], [exp({})], none, TODAY);
  assert.equal(d.kind, "review"); assert.equal(d.reason, "amount_changed"); assert.deepEqual(d.candidates, ["e1"]);
});
t("without a number: the same amount from the same supplier within a week is that expense's document", () => {
  const rows = [exp({ id: "c1", supplier: "סלקום ישראל", supplier_doc_ref: null, total: 595.44, vat_amount: 69.58, spent_on: "2026-10-14" })];
  const d = I.decideIntake(draft({ supplier: "סלקום", supplier_doc_ref: null, total: 595.44, vat_amount: 90.83, spent_on: "2026-10-12" }), [], rows, none, TODAY);
  assert.deepEqual(d, { kind: "attach", expenseId: "c1", supersedes: null, corrected: false, by: "amount" });
  assert.equal(I.decideIntake(draft({ supplier: "סלקום", supplier_doc_ref: null, total: 595.44, vat_amount: 90.83, spent_on: "2026-09-01" }), [], rows, none, TODAY).kind, "create", "six weeks apart is another bill");
});
t("two rows fit: left for a person, with both offered first", () => {
  const rows = [exp({ id: "a" }), exp({ id: "b" })];
  const d = I.decideIntake(draft({}), [], rows, none, TODAY);
  assert.equal(d.reason, "ambiguous"); assert.deepEqual(d.candidates, ["a", "b"]);
  assert.deepEqual(I.pickList(draft({}), d.candidates, [exp({ id: "z", total: 10 }), ...rows]).map((e) => e.id), ["a", "b", "z"]);
});
t("nothing fits: a new expense, fully business by default, or classified like the same supplier's last settled row", () => {
  const d = I.decideIntake(draft({ supplier: "Microsoft Israel", supplier_doc_ref: "E0700AB12", total: 55.81, vat_amount: 8.51, spent_on: "2026-10-19", category: "SOFTWARE" }), [], [exp({})], none, TODAY);
  assert.equal(d.kind, "create"); assert.equal(d.learnedFrom, null);
  assert.equal(d.row.tax_category, "OPERATIONAL_100"); assert.equal(d.row.income_tax_recognition_pct, 100); assert.equal(d.row.vat_recoverable_pct, 100);
  assert.equal(d.row.category, "SOFTWARE"); assert.match(d.row.description, /עסקי 100%/);
  const home = [exp({ id: "h1", supplier: "חברת החשמל לישראל", spent_on: "2026-08-01", supplier_doc_ref: null, tax_category: "HOME_OFFICE", income_tax_recognition_pct: 25, vat_recoverable_pct: 25, category: "OFFICE" }),
    exp({ id: "h0", supplier: "חברת החשמל", spent_on: "2026-06-01", supplier_doc_ref: null, tax_category: "OPERATIONAL_100", income_tax_recognition_pct: 100 }),
    exp({ id: "m", supplier: "חברת החשמל", spent_on: "2026-09-01", supplier_doc_ref: null, tax_category: "MIXED_CUSTOM", income_tax_recognition_pct: null })];
  const h = I.decideIntake(draft({ supplier: "חברת החשמל", supplier_doc_ref: "880011", total: 472, vat_amount: 72, spent_on: "2026-10-20" }), [], home, none, TODAY);
  assert.equal(h.kind, "create"); assert.equal(h.learnedFrom, "h1", "the latest settled row, not an unsettled mixed one");
  assert.equal(h.row.income_tax_recognition_pct, 25); assert.equal(h.row.vat_recoverable_pct, 25); assert.equal(h.row.tax_category, "HOME_OFFICE");
});
t("a new expense is booked only when everything was read clearly and adds up", () => {
  const rows = [exp({})];
  const r = (o, unsure = []) => I.decideIntake(draft({ supplier_doc_ref: "990001", ...o }), unsure, rows, none, TODAY);
  assert.equal(r({ total: null }).reason, "unreadable");
  assert.equal(r({}, ["total"]).reason, "unsure");
  assert.equal(r({}, ["description"]).kind, "create", "an unsure description does not block");
  assert.equal(r({ supplier: null }).reason, "unsure");
  assert.equal(r({ currency: "USD" }).reason, "foreign");
  assert.equal(r({ vat_amount: null }).reason, "no_vat");
  assert.equal(r({ total: 516.22, vat_amount: 52.5 }).reason, "vat_mismatch", "a bill with exempt lines needs splitting");
  assert.equal(r({ total: 102.1, vat_amount: 0 }).kind, "create", "an exempt document");
  assert.equal(r({ spent_on: "2026-11-05" }).reason, "date_out_of_range");
  assert.equal(r({ spent_on: "2025-01-01" }).reason, "date_out_of_range");
});
t("VAT follows the rate of the document's date", () => {
  assert.equal(I.vatConsistent(117, 17, "2024-12-31"), true);
  assert.equal(I.vatConsistent(118, 18, "2025-01-01"), true);
  assert.equal(I.vatConsistent(118, 17.15, "2026-03-01"), false);
});
t("supplier names: containment or a shared word, legal suffixes ignored", () => {
  assert.equal(I.sameSupplier("סלקום ישראל בע\"מ", "סלקום"), true);
  assert.equal(I.sameSupplier("Microsoft Ireland Operations Ltd", "MICROSOFT"), true);
  assert.equal(I.sameSupplier("בזק בע\"מ", "פלאפון בע\"מ"), false);
  assert.equal(I.sameSupplier("", "x"), false);
});
t("the corrected note carries the day", () => assert.equal(I.correctedNote("2026-11-01"), ". התקבלה חשבונית מתוקנת 01.11.2026"));
console.log("expense-intake-check: ok");
