// Own document engine: the live Shaam call, "Invoices v2 Approval" (invoices_approval product,
// sandbox), per docs/finance-engine-design.md. This is the SEALING -> ALLOCATED step: given a
// sealed-but-not-yet-allocated document, build the request the Tax Authority API expects and parse
// what it returns.
//
// Pure mapping only, no network, no Supabase: the live call itself needs an OAuth2 access token
// (provider "longtimetoken", authorization-code flow) that this module does not fetch. That flow
// needs a registered application the owner creates himself in the sandbox portal ("Get access"),
// and it is still unknown whether the resulting credential is a long-lived token to use directly
// (the provider's own name suggests this) or a client_id/client_secret pair to exchange per call;
// the Tax Authority's reply to the owner's email has not addressed this yet (finance-engine-design.md).
// So the edge function that actually calls gov.il, reads that credential from a secret, and moves a
// document from SEALING to ALLOCATED, is still a separate, later piece: it can import the functions
// here once the credential shape is known, instead of duplicating this mapping.
//
// Source for every field and code below: the live OpenAPI 3.0.1 definition read directly from the
// sandbox portal on 20 October 2026 (see docs/finance-engine-design.md). Two things that definition
// does not spell out and this file does not guess: the exact meaning distinguishing
// `amount_before_discount` from `payment_amount` when there is no discount (mapped the same, see
// buildInvoiceRequest below), and whether `client_id`/`client_secret` are also required alongside
// the bearer token. Re-check both once the sandbox "Try it" page can actually be exercised.

import { DOC_TYPE_CODE } from "./shaamExport.ts";
import { allocationShort } from "./financeAllocation.ts";
import type { DocType, FinCustomer, FinDocument } from "./finance.ts";
import type { ShaamBusiness } from "./shaamExport.ts";

/** The only `invoice_type` codes the live API accepts. The four this ledger ever produces come
 *  from DOC_TYPE_CODE (shaamExport.ts); the rest exist in the Tax Authority's own code table but
 *  have no document type in this ledger to map from. */
export const INVOICE_TYPE_CODES = [300, 305, 310, 320, 330, 332, 340, 345, 348] as const;
export type InvoiceTypeCode = (typeof INVOICE_TYPE_CODES)[number];

/** `action` values the definition documents, used only on a follow-up call for a delayed invoice
 *  (vat_number 777777723 in sandbox); a first submission omits it. */
export const INVOICE_ACTION_CODES = [0, 3, 4] as const;

export interface InvoiceItem {
  index: number;
  description: string;
  quantity: number;
  price_per_unit: number;
  discount: number;
  total_amount: number;
  vat_rate: number;
  vat_amount: number;
  catalog_id?: string;
  category?: string;
  measure_unit_description?: string;
}

/** Body of `POST /Invoices/v2/Approval`. Field names and the 13 required ones are exactly as the
 *  live definition names them, not translated or renamed, so a request built here can be sent
 *  (or compared to the definition) without a second mapping step. */
export interface InvoiceRequest {
  // Required (13).
  invoice_id: string;
  invoice_type: InvoiceTypeCode;
  vat_number: string;
  invoice_reference_number: string;
  customer_vat_number: string;
  invoice_date: string; // YYYY-MM-DD
  invoice_issuance_date: string; // YYYY-MM-DD
  accounting_software_number: number;
  amount_before_discount: number;
  discount: number;
  payment_amount: number;
  vat_amount: number;
  payment_amount_including_vat: number;
  // Optional.
  action?: (typeof INVOICE_ACTION_CODES)[number];
  union_vat_number?: string;
  authorized_company?: string;
  user_id?: string;
  user_name?: string;
  customer_name?: string;
  customer_country_code?: string;
  branch_id?: string;
  client_software_key?: string;
  invoice_note?: string;
  items?: InvoiceItem[];
}

/** Body of the response. `confirmation_number` is the allocation number (wrapped the same way
 *  Invoice4U wraps it: a timestamp prefix in front of the real 9-digit number, confirmed against
 *  the definition's own success example, "...199093572" ending the same way); allocationShort from
 *  financeAllocation.ts strips it, reused here rather than duplicated. */
export interface ShaamApprovalResponse {
  status?: string;
  message?: string;
  confirmation_number: string;
  approved: boolean;
}

/** Sandbox-only VAT numbers that exercise specific paths, documented on the live definition page.
 *  Never meaningful outside the sandbox; not shipped as a default for `vat_number`. */
export const SANDBOX_TEST_VAT_NUMBERS = {
  ALLOCATES: "777777715",
  DELAYED_INVOICE: "777777723",
  FOUND_NO_INSTRUCTION: "777777731",
  FOUND_INSTRUCTION_CHOSEN: "777777749",
} as const;

/** Same unsigned-amount rule as shaamExport.ts: a CREDIT document is stored with a negative total
 *  in the ledger, but every amount field here is a positive magnitude, since `invoice_type` (330)
 *  already tells the Tax Authority it is a credit. Rounded to 2 decimals, as a JSON number (the
 *  definition types these fields `number`, not the fixed-width strings the uniform-structure file
 *  uses). */
const amt = (n: number): number => Math.round(Math.abs(n) * 100) / 100;

/**
 * Builds the request body for one sealed document. The caller decides eligibility (allocation
 * threshold, customer has a VAT id, etc., see financeAllocation.ts); this only maps a document that
 * is already going out. `doc.doc_number` must be set, i.e. the document has been through
 * lalum_fin_seal_document (status SEALING or later): that number is the invoice_reference_number
 * the Tax Authority requires.
 *
 * No `items[]` by default: none of the optional per-line fields (catalog id, category, unit of
 * measure) exist in this ledger's Line type, and the required totals already carry the real amounts
 * without them. Pass `includeItems: true` to attach a best-effort line breakdown instead.
 */
export function buildInvoiceRequest(
  doc: FinDocument,
  customer: Pick<FinCustomer, "tax_id" | "name">,
  business: Pick<ShaamBusiness, "taxId" | "softwareRegNumber">,
  opts: { includeItems?: boolean } = {},
): InvoiceRequest {
  const code = DOC_TYPE_CODE[doc.doc_type];
  if (!code) throw new Error(`UNALLOCATABLE_DOC_TYPE:${doc.doc_type}`);
  if (doc.doc_number == null) throw new Error("DOCUMENT_NOT_SEALED");

  const req: InvoiceRequest = {
    invoice_id: doc.id,
    invoice_type: Number(code) as InvoiceTypeCode,
    vat_number: business.taxId,
    invoice_reference_number: String(doc.doc_number),
    customer_vat_number: customer.tax_id ?? "",
    invoice_date: doc.issue_date,
    invoice_issuance_date: doc.issue_date,
    accounting_software_number: Number(business.softwareRegNumber || business.taxId),
    amount_before_discount: amt(doc.subtotal),
    discount: 0,
    payment_amount: amt(doc.subtotal),
    vat_amount: amt(doc.vat_amount),
    payment_amount_including_vat: amt(doc.total),
    customer_name: customer.name,
  };

  if (opts.includeItems) {
    req.items = doc.lines.map((line, i) => ({
      index: i + 1,
      description: line.name,
      quantity: line.qty,
      price_per_unit: amt(line.price),
      discount: 0,
      total_amount: amt(line.qty * line.price),
      vat_rate: doc.vat_rate,
      vat_amount: amt((line.qty * line.price * doc.vat_rate) / 100),
    }));
  }

  return req;
}

/** Reasons a request would be rejected before ever sending it: the 13 required fields, the two
 *  length limits the definition states (invoice_id <= 50 chars, invoice_reference_number <= 20
 *  chars), and invoice_type being one of the allowed codes. Does not replicate the Tax Authority's
 *  own business-rule checks (date too old, duplicate invoice_id, etc.), only what is knowable
 *  client-side from the shape of the request. */
export function invoiceRequestProblems(req: InvoiceRequest): string[] {
  const out: string[] = [];
  const req13: Array<keyof InvoiceRequest> = [
    "invoice_id", "invoice_type", "vat_number", "invoice_reference_number", "customer_vat_number",
    "invoice_date", "invoice_issuance_date", "accounting_software_number", "amount_before_discount",
    "discount", "payment_amount", "vat_amount", "payment_amount_including_vat",
  ];
  for (const f of req13) if (req[f] === undefined || req[f] === null || req[f] === "") out.push(`שדה חובה חסר: ${f}`);
  if (req.invoice_id && req.invoice_id.length > 50) out.push("invoice_id ארוך מ-50 תווים");
  if (req.invoice_reference_number && req.invoice_reference_number.length > 20) out.push("invoice_reference_number ארוך מ-20 תווים");
  if (req.invoice_type != null && !(INVOICE_TYPE_CODES as readonly number[]).includes(req.invoice_type)) out.push(`invoice_type לא מהרשימה המותרת: ${req.invoice_type}`);
  return out;
}

/** Parses the response body. Returns the raw `confirmation_number` and the short (last 9 digit)
 *  form actually printed on the invoice and known to the Tax Authority (allocationShort), same as
 *  the Invoice4U path already does. `approved: false` or a non-2xx HTTP status both mean no
 *  allocation happened; the caller decides what that means for the document (retry, VOID, etc.). */
export function parseApprovalResponse(body: ShaamApprovalResponse): {
  approved: boolean; confirmationNumber: string; allocationNumber: string; status?: string; message?: string;
} {
  return {
    approved: !!body.approved,
    confirmationNumber: body.confirmation_number,
    allocationNumber: allocationShort(body.confirmation_number),
    status: body.status,
    message: body.message,
  };
}

/** True for a DocType the live allocation call can ever be used for: the same four this ledger
 *  already reports through the uniform-structure file (DOC_TYPE_CODE), nothing else. */
export const isAllocatable = (t: DocType): boolean => t in DOC_TYPE_CODE;
