// Smoke test for shaamClient.ts: the live Invoices v2 Approval request/response mapping. Pure
// mapping only, no network call, so this only proves the shape is right, not that the Tax Authority
// accepts it; that needs a real sandbox call once the owner has a registered application.
// Run with: npm run shaam-client-check
import assert from "node:assert/strict";
import {
  buildInvoiceRequest, invoiceRequestProblems, parseApprovalResponse, isAllocatable,
  SANDBOX_TEST_VAT_NUMBERS, INVOICE_TYPE_CODES,
} from "../src/lib/cockpit/shaamClient.ts";

const t = (name, fn) => { fn(); console.log(`[PASS] ${name}`); };

const business = { taxId: "031471261", softwareRegNumber: null };
const customer = { tax_id: "515123456", name: 'לקוח לדוגמה בע"מ' };

const doc = (o) => ({
  id: "d1-uuid", customer_id: "c1", doc_type: "INVOICE", status: "SEALING", subject: "", tax_included: false, vat_rate: 18,
  lines: [{ name: "ייעוץ משפטי", qty: 1, price: 1000 }], subtotal: 1000, vat_amount: 180, total: 1180,
  issue_date: "2026-06-15", due_date: null, payment_method: null, payment_ref: null, related_doc_id: null,
  send_email: false, doc_number: 107, i4u_doc_id: null, allocation_number: null, pdf_url: null,
  is_test: false, last_error: null, issued_at: null, internal_note: null, matter_ref: null, source_proforma_id: null, ...o,
});

t("invoice maps to type 305, uses doc_number as the reference number", () => {
  const req = buildInvoiceRequest(doc(), customer, business);
  assert.equal(req.invoice_type, 305);
  assert.equal(req.invoice_reference_number, "107");
  assert.equal(req.vat_number, "031471261");
  assert.equal(req.accounting_software_number, 31471261, "no softwareRegNumber: falls back to the business id, as an int");
  assert.deepEqual(invoiceRequestProblems(req), [], "all 13 required fields present");
});

t("every ledger doc_type the ledger can issue maps to an allowed invoice_type code", () => {
  for (const [t, expected] of [["INVOICE", 305], ["RECEIPT", 340], ["INVOICE_RECEIPT", 320], ["CREDIT", 330]]) {
    assert.ok(isAllocatable(t));
    const req = buildInvoiceRequest(doc({ doc_type: t }), customer, business);
    assert.equal(req.invoice_type, expected);
    assert.ok(INVOICE_TYPE_CODES.includes(req.invoice_type));
  }
  assert.equal(isAllocatable("PROFORMA"), false, "a proforma has no SHAAM code, same as the uniform-structure file");
});

t("a credit document's amounts are unsigned, same rule as the uniform-structure file", () => {
  const req = buildInvoiceRequest(doc({ doc_type: "CREDIT", total: -118, subtotal: -100, vat_amount: -18 }), customer, business);
  assert.equal(req.amount_before_discount, 100);
  assert.equal(req.vat_amount, 18);
  assert.equal(req.payment_amount_including_vat, 118);
});

t("a document not yet sealed (no doc_number) refuses to build a request", () => {
  assert.throws(() => buildInvoiceRequest(doc({ doc_number: null }), customer, business), /DOCUMENT_NOT_SEALED/);
});

t("includeItems maps the one ledger line to an InvoiceItem", () => {
  const req = buildInvoiceRequest(doc(), customer, business, { includeItems: true });
  assert.equal(req.items.length, 1);
  assert.equal(req.items[0].total_amount, 1000);
  assert.equal(req.items[0].vat_amount, 180);
});

t("missing required fields are each reported once", () => {
  const req = buildInvoiceRequest(doc(), customer, business);
  const broken = { ...req, customer_vat_number: "", invoice_type: 999 };
  const problems = invoiceRequestProblems(broken);
  assert.ok(problems.some((p) => p.includes("customer_vat_number")));
  assert.ok(problems.some((p) => p.includes("invoice_type")));
});

t("parses the definition's own success example: confirmation_number carries a 9-digit allocation number", () => {
  const out = parseApprovalResponse({ confirmation_number: "20240718181618323199093572", approved: true });
  assert.equal(out.approved, true);
  assert.equal(out.allocationNumber, "199093572");
  assert.equal(out.confirmationNumber, "20240718181618323199093572");
});

t("parses the definition's own error example: code 434, not approved, confirmation_number \"0\"", () => {
  const out = parseApprovalResponse({ status: "434", message: "Invoice date is too old for approval", confirmation_number: "0", approved: false });
  assert.equal(out.approved, false);
  assert.equal(out.allocationNumber, "0", "too short to be a wrapped number, so returned as-is");
  assert.equal(out.message, "Invoice date is too old for approval");
});

t("sandbox test VAT numbers are the four the definition documents, for reference only", () => {
  assert.deepEqual(Object.values(SANDBOX_TEST_VAT_NUMBERS), ["777777715", "777777723", "777777731", "777777749"]);
});

console.log("shaam-client-check: all pass. This proves the request/response mapping only; it does not\n" +
  "prove the Tax Authority's sandbox accepts a real call. That needs a registered application and a\n" +
  "live test, not yet done (finance-engine-design.md).");
