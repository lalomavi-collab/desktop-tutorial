// Checks the rules of the one documents list (src/lib/cockpit/docList.ts): ledger and archive merged once, the notes, the ticks,
// and a search that never matches on a hidden client's name. Run with: npm run doc-list-check
import assert from "node:assert/strict";
import { readFileSync, writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import ts from "typescript";

const t = (name, fn) => { fn(); console.log(`[PASS] ${name}`); };
const dir = mkdtempSync(join(tmpdir(), "doclist-"));
for (const f of ["finance", "financeSend", "docList"]) {
  const src = readFileSync(new URL(`../src/lib/cockpit/${f}.ts`, import.meta.url), "utf8");
  writeFileSync(join(dir, `${f}.js`), ts.transpileModule(src, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 } }).outputText.replace(/from "\.\/(finance|financeSend)"/g, 'from "./$1.js"'));
}
const L = await import(pathToFileURL(join(dir, "docList.js")).href);

const cust = { id: "c1", name: "שם לקוח לדוגמה", tax_id: null, email: "a@example.com", phone: "0501234567", address: null, city: null, notes: null, archived: false, i4u_customer_id: 7001, is_casual: false, retainer_active: false, retainer_description: null, retainer_amount: null };
const doc = (o) => ({ id: "d1", customer_id: "c1", doc_type: "INVOICE_RECEIPT", status: "ISSUED", subject: "שכר טרחה", tax_included: false, vat_rate: 18, lines: [], subtotal: 100, vat_amount: 18, total: 118, issue_date: "2026-10-20", due_date: null, payment_method: null, payment_ref: null, related_doc_id: null, send_email: false, doc_number: 70150, i4u_doc_id: "X1", allocation_number: null, pdf_url: "https://example.com/d1.pdf", is_test: false, last_error: null, issued_at: null, internal_note: null, matter_ref: null, source_proforma_id: null, ...o });
const arch = (o) => ({ id: "a1", i4u_doc_id: "Z9", i4u_doc_type: 3, doc_number: 70140, issue_date: "2026-10-10", i4u_client_id: 7001, subject: "ייעוץ", currency: "ILS", subtotal: 1000, vat_amount: 180, total: 1180, allocation_number: "123456789", status_id: 1, paid: null, balance: null, i4u_status: "פתוחה", ...o });
const send = (o) => ({ id: "s1", document_id: null, archive_id: null, channel: "EMAIL", recipient: "a@example.com", subject: null, status: "SENT", error: null, created_at: "2026-10-21T08:00:00Z", delivered_at: null, opened_at: null, bounced_at: null, complained_at: null, ...o });

t("a document issued here and imported into the archive is listed once, as the ledger row", () => {
  const rows = L.buildDocRows([doc({})], [arch({ id: "a2", i4u_doc_id: "X1", doc_number: 70150 }), arch({})], [], [cust]);
  assert.equal(rows.length, 2);
  assert.deepEqual(rows.map((r) => r.key), ["d:d1", "a:a1"], "newest first, the duplicate archive row dropped");
  assert.equal(rows[0].source, "ledger");
});
t("a draft is not de-duplicated against the archive and cannot be sent", () => {
  const rows = L.buildDocRows([doc({ status: "DRAFT", doc_number: null, pdf_url: null })], [arch({ i4u_doc_id: "X1" })], [], [cust]);
  assert.equal(rows.length, 2);
  const d = rows.find((r) => r.source === "ledger");
  assert.equal(d.sendable, false);
  assert.equal(d.note.text, "טיוטה");
});
t("archive rows find their customer card by the provider's client number, else are casual with the printed name", () => {
  const rows = L.buildDocRows([], [arch({}), arch({ id: "a3", i4u_client_id: null, cname: "לקוח מזדמן בשם" })], [], [cust]);
  const a1 = rows.find((r) => r.id === "a1"), a3 = rows.find((r) => r.id === "a3");
  assert.equal(a1.customer?.id, "c1"); assert.equal(a1.casual, false);
  assert.equal(a3.customer, undefined); assert.equal(a3.casual, true); assert.equal(a3.casualName, "לקוח מזדמן בשם");
  assert.equal(a1.docType, "INVOICE_RECEIPT"); assert.equal(a1.sendable, true);
});
t("archive notes: credited, open and closed pro formas and tax invoices, nothing for an invoice-receipt that is merely 'open'", () => {
  assert.equal(L.archiveNote({ i4u_doc_type: 3, status_id: 3, i4u_status: "מזוכית" }).text, "מזוכית");
  assert.equal(L.archiveNote({ i4u_doc_type: 3, status_id: 1, i4u_status: "פתוחה" }), null);
  assert.equal(L.archiveNote({ i4u_doc_type: 2, status_id: 1, i4u_status: "פתוחה" }), null);
  assert.equal(L.archiveNote({ i4u_doc_type: 5, status_id: 1, i4u_status: "פתוחה" }).text, "פתוח");
  assert.equal(L.archiveNote({ i4u_doc_type: 5, status_id: 2, i4u_status: "סגורה" }).text, "סגור");
  assert.equal(L.archiveNote({ i4u_doc_type: 5, status_id: 2, i4u_status: null }).text, "סגור", "status number when the label is missing");
  assert.equal(L.archiveNote({ i4u_doc_type: 1, status_id: 1, i4u_status: "פתוחה" }).text, "פתוחה");
  assert.equal(L.archiveNote({ i4u_doc_type: 1, status_id: 2, i4u_status: "סגורה" }).text, "סגורה");
});
t("ledger notes: an open and a closed pro forma, a fully and a partly credited invoice, a test document", () => {
  const p = doc({ id: "p1", doc_type: "PROFORMA", i4u_doc_id: "P1" });
  assert.equal(L.buildDocRows([p], [], [], [cust])[0].note.text, "פתוח");
  const closer = doc({ id: "i2", i4u_doc_id: "I2", source_proforma_id: "p1" });
  assert.equal(L.buildDocRows([p, closer], [], [], [cust]).find((r) => r.id === "p1").note.text, "סגור");
  const inv = doc({ id: "i1", doc_type: "INVOICE", total: 118 });
  const full = doc({ id: "c9", doc_type: "CREDIT", related_doc_id: "i1", total: 118, i4u_doc_id: "C9" });
  const part = doc({ id: "c8", doc_type: "CREDIT", related_doc_id: "i1", total: 18, i4u_doc_id: "C8" });
  assert.equal(L.buildDocRows([inv, full], [], [], [cust]).find((r) => r.id === "i1").note.text, "מזוכית");
  assert.equal(L.buildDocRows([inv, part], [], [], [cust]).find((r) => r.id === "i1").note.text, "זיכוי חלקי");
  assert.equal(L.buildDocRows([doc({ is_test: true })], [], [], [cust])[0].note.text, "בדיקה");
});
t("open pro formas from both sources pass the filter, closed ones and other types do not", () => {
  const rows = L.buildDocRows([doc({ id: "p1", doc_type: "PROFORMA", i4u_doc_id: "P1" })], [arch({ id: "a5", i4u_doc_type: 5, status_id: 1 }), arch({ id: "a6", i4u_doc_type: 5, status_id: 2, i4u_status: "סגורה" }), arch({})], [], [cust]);
  assert.deepEqual(rows.filter((r) => L.typeMatches(r, "OPEN_PROFORMA")).map((r) => r.id).sort(), ["a5", "p1"]);
  assert.equal(rows.filter((r) => L.typeMatches(r, "PROFORMA")).length, 3);
  assert.equal(rows.filter((r) => L.typeMatches(r, "")).length, 4);
});
t("ticks: two when opened (our tracking or the history system's), one when sent, none when unknown; a bounce is flagged", () => {
  const rows = L.buildDocRows([doc({})], [arch({ opened: true }), arch({ id: "a7", opened: null })], [send({ document_id: "d1", opened_at: "2026-10-21T09:00:00Z" }), send({ id: "s2", archive_id: "a7", bounced_at: "2026-10-21T09:00:00Z" })], [cust]);
  const by = Object.fromEntries(rows.map((r) => [r.id, L.sentMark(r)]));
  assert.equal(by.d1.ticks, 2);
  assert.equal(by.a1.ticks, 2); assert.match(by.a1.title, /מערכת ההיסטוריה/);
  assert.equal(by.a7.ticks, 1); assert.equal(by.a7.bounced, true);
  assert.equal(L.sentMark({ sent: {}, openedByProvider: false }).ticks, 0);
  assert.equal(L.buildDocRows([], [arch({ opened: "true" })], [], [cust])[0].openedByProvider, true, "the raw value may arrive as text");
});
t("search: number and allocation always; subject and name only while names are revealed", () => {
  const [r] = L.buildDocRows([], [arch({})], [], [cust]);
  assert.equal(L.rowMatches(r, "70140", false, "לקוח 7001"), true);
  assert.equal(L.rowMatches(r, "456789", false, "לקוח 7001"), true);
  assert.equal(L.rowMatches(r, "ייעוץ", false, "לקוח 7001"), false, "the subject can name a client");
  assert.equal(L.rowMatches(r, "לדוגמה", false, "לקוח 7001"), false);
  assert.equal(L.rowMatches(r, "ייעוץ", true, "שם לקוח לדוגמה"), true);
  assert.equal(L.rowMatches(r, "לדוגמה", true, "שם לקוח לדוגמה"), true);
  assert.equal(L.rowMatches(r, "  ", false, ""), true);
});
console.log("doc-list-check: ok");
