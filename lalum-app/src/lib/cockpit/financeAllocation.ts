// Tax Authority allocation numbers ("Israel Invoices"). Invoice4U requests the number by itself through its
// direct connection to the Tax Authority, and we only store what it returns. This file flags the one failure
// that shows no error: an invoice above the ceiling that came back without a number, for example when the
// connection's authorization has lapsed (it needs renewing about once a quarter).
//
// The ceiling is on the amount before VAT and has dropped in steps. Verified against the Tax Authority's
// "Israel Invoices" Q&A on gov.il and Tax Authority VAT directive 01/2025. Re-check the table, and move
// ALLOCATION_VERIFIED_ON, whenever the Authority announces a change.
import type { FinCustomer, FinDocument } from "./finance.ts";

export const ALLOCATION_THRESHOLDS: { from: string; net: number }[] = [
  { from: "2024-01-01", net: 25000 },
  { from: "2025-01-01", net: 20000 },
  { from: "2026-01-01", net: 10000 },
  { from: "2026-06-01", net: 5000 },
];
export const ALLOCATION_VERIFIED_ON = "2026-10-12";

/** Ceiling (before VAT) in force on an ISO date, or null before the model started. */
export function allocationThreshold(isoDate: string): number | null {
  let net: number | null = null;
  for (const t of ALLOCATION_THRESHOLDS) if (isoDate >= t.from) net = t.net;
  return net;
}

export interface AllocationGap { doc: FinDocument; threshold: number; customerHasTaxId: boolean }

/**
 * Issued tax invoices and tax invoice-receipts above the ceiling that carry no allocation number. Credit
 * notes, receipts, pro formas and zero-VAT documents never need one. The number is only owed to a customer
 * who is a licensed dealer and asks for it, which the ledger cannot know, so `customerHasTaxId` separates
 * the likely cases from customers with no tax id on file.
 */
export function allocationGaps(docs: FinDocument[], customers: FinCustomer[]): AllocationGap[] {
  const byId = new Map(customers.map((c) => [c.id, c]));
  const out: AllocationGap[] = [];
  for (const d of docs) {
    if (d.status !== "ISSUED" || d.is_test || d.allocation_number) continue;
    if (d.doc_type !== "INVOICE" && d.doc_type !== "INVOICE_RECEIPT") continue;
    if (!(d.vat_amount > 0)) continue;
    const threshold = allocationThreshold(d.issue_date);
    if (threshold === null || !(d.subtotal > threshold)) continue;
    const c = byId.get(d.customer_id);
    out.push({ doc: d, threshold, customerHasTaxId: !!c?.tax_id && !c.is_casual });
  }
  return out.sort((a, b) => (a.doc.issue_date < b.doc.issue_date ? 1 : -1));
}
