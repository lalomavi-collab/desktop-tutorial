// Smoke test for the uniform-structure file (shaamExport.ts): builds INI.TXT and BKMVDATA.TXT for
// a handful of synthetic documents covering every reportable doc_type and payment method, then
// round-trips them through the SHAAM package's own parser and validator. A real filing still needs
// a human to run it through the Tax Authority's own file-checker before ever being used for real.
// Run with: npm run shaam-check
import assert from "node:assert/strict";
import { parseUniformFormatFiles } from "@accounter/shaam-uniform-format-generator";
import { buildShaamReport } from "../src/lib/cockpit/shaamExport.ts";

const t = (name, fn) => { fn(); console.log(`[PASS] ${name}`); };

const business = {
  taxId: "031471261", name: "LALUM משרד עורכי דין",
  taxYear: "2026", periodStart: "2026-01-01", periodEnd: "2026-12-31",
};

const customer = { id: "c1", name: 'לקוח לדוגמה בע"מ', tax_id: "515123456", email: null, phone: null, address: null, city: null, notes: null, archived: false, i4u_customer_id: null, is_casual: false };
const customersById = { c1: customer };

const doc = (o) => ({
  id: "d1", customer_id: "c1", doc_type: "INVOICE", status: "ISSUED", subject: "", tax_included: false, vat_rate: 18,
  lines: [{ name: "ייעוץ משפטי", qty: 1, price: 1000 }], subtotal: 1000, vat_amount: 180, total: 1180,
  issue_date: "2026-06-15", due_date: null, payment_method: null, payment_ref: null, related_doc_id: null,
  send_email: false, doc_number: 1, i4u_doc_id: null, allocation_number: null, pdf_url: null,
  is_test: false, last_error: null, issued_at: null, ...o,
});

t("one invoice, no payment yet: no D120", () => {
  const { dataText, counts } = buildShaamReport(business, [doc({ doc_number: 101 })], customersById);
  assert.deepEqual(counts, { A100: 1, C100: 1, D110: 1, Z900: 1 });
  assert.ok(dataText.includes("\r\n"), "lines are CRLF terminated per the spec");
});

t("receipt with a payment method: gets a D120", () => {
  const { counts } = buildShaamReport(
    business,
    [doc({ doc_number: 102, doc_type: "RECEIPT", payment_method: "TRANSFER" })],
    customersById,
  );
  assert.equal(counts.D120, 1);
});

t("proforma is excluded, never reaches the file", () => {
  const { counts } = buildShaamReport(
    business,
    [doc({ doc_number: 103, doc_type: "PROFORMA" }), doc({ doc_number: 104 })],
    customersById,
  );
  assert.equal(counts.C100, 1, "only the real invoice, not the proforma");
});

t("a credit document maps to 330 and a receipt tax invoice to 320", () => {
  const { dataText } = buildShaamReport(
    business,
    [
      doc({ doc_number: 105, doc_type: "CREDIT", total: -118, subtotal: -100, vat_amount: -18 }),
      doc({ doc_number: 106, doc_type: "INVOICE_RECEIPT", payment_method: "CASH" }),
    ],
    customersById,
  );
  const c100Lines = dataText.split("\r\n").filter((l) => l.startsWith("C100"));
  assert.equal(c100Lines[0].slice(22, 25), "330");
  assert.equal(c100Lines[1].slice(22, 25), "320");
});

t("round trip: the package's own parser and cross-validator accept the generated file", () => {
  const documents = [
    doc({ doc_number: 201, doc_type: "INVOICE" }),
    doc({ doc_number: 202, doc_type: "RECEIPT", payment_method: "CASH", lines: [{ name: "שכר טרחה", qty: 1, price: 500 }], subtotal: 500, vat_amount: 90, total: 590 }),
    doc({ doc_number: 203, doc_type: "INVOICE_RECEIPT", payment_method: "CARD" }),
  ];
  const { iniText, dataText } = buildShaamReport(business, documents, customersById);
  const parsed = parseUniformFormatFiles(iniText, dataText, {
    validationMode: "lenient", skipUnknownRecords: true, allowPartialData: true,
  });
  // The package's own cross-validator raises a "z900_total_records" warning here, off by one from
  // what this generator produces. Checked against both the official PDF (field 1155: total records
  // including the opening and closing of the file) and the package's own generate-report.ts
  // (totalRecords: records.length + 1, the same inclusive count used here): this generator's output
  // is correct, the mismatch is in the parser's own cross-check, not something to chase by changing
  // correct output. Tolerated here by name so a real new warning still fails the test.
  assert.deepEqual(parsed.summary.errors.map((e) => e.field), ["z900_total_records"]);
  assert.ok(parsed.summary.errors.every((e) => e.severity === "warning"), "only a warning, no errors");
});

console.log("shaam-check: all pass. This proves the file round trips through the library's own\n" +
  "validator, it does not prove the Tax Authority's own file-checker will accept it. Run a real\n" +
  "output through that before ever using this for an actual filing.");
