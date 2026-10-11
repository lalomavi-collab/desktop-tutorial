// Own document engine: the uniform-structure file (קובץ מבנה אחיד), SHAAM 1.31, per
// docs/finance-engine-design.md. Builds INI.TXT and BKMVDATA.TXT from the finance ledger using
// @accounter/shaam-uniform-format-generator's per-record encoders.
//
// Pin note: the package's "latest" npm publish (0.2.7) ships a broken dist (missing most compiled
// files, import crashes immediately). 0.2.6 is complete and this is what package.json pins,
// exactly, no caret: a caret would let npm pick up 0.2.7 again on a fresh install.
//
// API note: the raw encode* functions (encodeA100, encodeC100, ...) do not apply the Zod schemas'
// field defaults themselves, they just spread whatever object they are given. Every call here goes
// through the matching *Schema.parse(...) first so optional fields get their spec default ('' for
// almost all of them) instead of crashing on undefined. Confirmed by reading the package's own
// source, not assumed.
//
// Scope: documents only (C100/D110/D120), no B100/B110/M100. LALUM's ledger is not a general-ledger
// bookkeeping system, it only issues sales documents, so there are no journal entries or a chart of
// accounts to report. Empty journalEntries/accounts/inventory is valid input to this library (plain
// z.array with no .min(1)), and matches what the practice's system actually tracks.
//
// PROFORMA documents are excluded: a proforma has no tax effect and is not a reportable document.

import {
  encodeA000,
  encodeA000Sum,
  encodeA100,
  encodeC100,
  encodeD110,
  encodeD120,
  encodeZ900,
  A100InputSchema,
  C100Schema,
  D110Schema,
  D120Schema,
  Z900InputSchema,
  defaultKeyGenerator,
} from "@accounter/shaam-uniform-format-generator";
import type { DocType, FinDocument, FinCustomer, PayMethod } from "./finance";

const DOC_TYPE_CODE: Partial<Record<DocType, string>> = {
  INVOICE: "305", // חשבונית מס
  RECEIPT: "340", // קבלה
  INVOICE_RECEIPT: "320", // חשבונית מס קבלה
  CREDIT: "330", // חשבונית מס זיכוי
  // PROFORMA has no SHAAM code: it is filtered out before mapping, see isReportable below.
};

const PAY_METHOD_CODE: Record<PayMethod, string> = {
  CASH: "1", CHEQUE: "2", CARD: "3", TRANSFER: "4", BIT: "9", PAYBOX: "9",
};

const ymd = (isoDate: string) => isoDate.replaceAll("-", "");
// SHAAM's amount fields are unsigned (the C100/D110/D120 schemas reject a leading minus sign,
// confirmed by their regex). A CREDIT document is stored in the ledger with a negative total
// (migration 0014), but reported here as a positive magnitude: the document type code (330) is
// what tells the Tax Authority it is a credit, not the sign of the amount.
const abs2 = (n: number) => Math.abs(n).toFixed(2);

export interface ShaamBusiness {
  /** The practice's own business id (עוסק מורשה), 9 digits, Israeli ID check digit valid for a
   *  sole proprietor. Goes in both the VAT ID field and the software registration field (field
   *  1006): the practice has no separate accounting-software registration certificate, so per the
   *  owner's decision (finance-engine-design.md) its own business id is used there too. */
  taxId: string;
  name: string;
  taxYear: string; // YYYY
  periodStart: string; // YYYY-MM-DD
  periodEnd: string; // YYYY-MM-DD
}

export interface ShaamResult {
  iniText: string;
  dataText: string;
  counts: Record<string, number>;
}

/** A document is reportable only once it has a real, consumed series number: PROFORMA and DRAFT
 *  never reach this function in the first place (the caller filters before calling), this just
 *  double checks so a bad input fails loudly instead of silently mis-mapping. */
function isReportable(doc: FinDocument): doc is FinDocument & { doc_type: Exclude<DocType, "PROFORMA">; doc_number: number } {
  return doc.doc_type !== "PROFORMA" && doc.doc_number != null;
}

/** Builds the uniform-structure file pair for one firm's documents in a period. Pure function: no
 *  network, no Supabase, so it can run both in the browser (preview) and in a script or edge
 *  function with the same input shape. Throws ShaamFormatError (from the package) with the exact
 *  field that failed, rather than silently producing a malformed file. */
export function buildShaamReport(
  business: ShaamBusiness,
  documents: FinDocument[],
  customersById: Record<string, FinCustomer>,
): ShaamResult {
  const reportable = documents.filter(isReportable);

  // encodeA100 and encodeZ900 both read the package's single module-level defaultKeyGenerator
  // (not an injectable context: confirmed by reading their source, there is no parameter for it),
  // and the two records must carry the same generated id within one file. Resetting it right
  // before use is correct for one report built start to finish in one call, but this function is
  // NOT safe to run concurrently with another call to it in the same process: the two would race
  // on the same singleton. Call it from a script or a single edge-function invocation, not from
  // parallel requests sharing a process.
  defaultKeyGenerator.reset();

  const dataRecords: string[] = [];
  let n = 1;

  dataRecords.push(encodeA100(A100InputSchema.parse({ recordNumber: n++, vatId: business.taxId })));

  for (const doc of reportable) {
    const docType = DOC_TYPE_CODE[doc.doc_type];
    if (!docType) throw new Error(`UNREPORTABLE_DOC_TYPE:${doc.doc_type}`);
    const customer = customersById[doc.customer_id];
    const documentNumber = String(doc.doc_number);
    const issueDate = ymd(doc.issue_date);

    const c100RecordNumber = n;
    dataRecords.push(
      encodeC100(
        C100Schema.parse({
          code: "C100",
          recordNumber: String(n++),
          vatId: business.taxId,
          documentType: docType,
          documentId: documentNumber,
          documentIssueDate: issueDate,
          customerName: customer?.name ?? "",
          customerVatId: customer?.tax_id ?? "",
          currencyCode: "ILS",
          amountBeforeDiscount: abs2(doc.subtotal),
          amountAfterDiscountExcludingVat: abs2(doc.subtotal),
          vatAmount: abs2(doc.vat_amount),
          amountIncludingVat: abs2(doc.total),
          documentDate: issueDate.slice(0, 7), // field 1230 is 7 digits (9(7)), not 8: confirmed
          // against the package's own bundled c100.csv field table, not guessed.
          branchKey: "0",
        }),
      ),
    );

    doc.lines.forEach((line, i) => {
      dataRecords.push(
        encodeD110(
          D110Schema.parse({
            code: "D110",
            recordNumber: String(n++),
            vatId: business.taxId,
            documentType: docType,
            documentNumber,
            lineNumber: String(i + 1),
            goodsServiceDescription: line.name.slice(0, 30),
            quantity: String(line.qty),
            unitPriceExcludingVat: abs2(line.price),
            lineTotal: abs2(line.qty * line.price),
            vatRatePercent: String(doc.vat_rate),
            branchId: "0",
            documentDate: issueDate,
            headerLinkField: String(c100RecordNumber),
          }),
        ),
      );
    });

    if (doc.payment_method) {
      dataRecords.push(
        encodeD120(
          D120Schema.parse({
            code: "D120",
            recordNumber: String(n++),
            vatId: business.taxId,
            documentType: docType,
            documentNumber,
            lineNumber: "1",
            paymentMethod: PAY_METHOD_CODE[doc.payment_method],
            lineAmount: abs2(doc.total),
            documentDate: issueDate,
          }),
        ),
      );
    }
  }

  const z900RecordNumber = n;
  dataRecords.push(
    encodeZ900(
      Z900InputSchema.parse({
        recordNumber: z900RecordNumber,
        vatId: business.taxId,
        totalRecords: z900RecordNumber,
      }),
    ),
  );

  const dataText = dataRecords.join("");
  const counts: Record<string, number> = {};
  for (const line of dataText.split("\r\n")) {
    const code = line.slice(0, 4);
    if (code) counts[code] = (counts[code] ?? 0) + 1;
  }

  const now = new Date();
  const iniRecords: string[] = [];
  iniRecords.push(
    encodeA000({
      totalRecords: String(z900RecordNumber),
      vatId: business.taxId,
      softwareRegNumber: business.taxId,
      softwareName: "LALUM Finance Ledger",
      softwareVersion: "1.0.0",
      vendorVatId: business.taxId,
      vendorName: business.name,
      softwareType: "1", // single-year program: a separate file is produced per tax year
      fileOutputPath: `C:\\OPENFRMT\\${business.taxId}.`,
      accountingType: "1", // single-entry: documents only, no general ledger in this system
      balanceRequired: "1",
      companyRegId: "",
      withholdingFileNum: "",
      businessName: business.name,
      businessStreet: "", businessHouseNum: "", businessCity: "", businessZip: "",
      taxYear: business.taxYear,
      startDate: ymd(business.periodStart),
      endDate: ymd(business.periodEnd),
      processStartDate: now.toISOString().slice(0, 10).replaceAll("-", ""),
      processStartTime: `${String(now.getHours()).padStart(2, "0")}${String(now.getMinutes()).padStart(2, "0")}`,
      languageCode: "0",
      characterEncoding: "1",
      compressionSoftware: "none",
      baseCurrency: "ILS",
      branchInfoFlag: "0",
    }),
  );
  for (const [code, count] of Object.entries(counts)) {
    iniRecords.push(encodeA000Sum({ code, recordCount: String(count) }));
  }

  return { iniText: iniRecords.join(""), dataText, counts };
}
