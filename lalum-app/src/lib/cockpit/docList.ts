// One list of every document, the way the invoicing system shows it: the ledger's documents and the history archive's, newest first,
// each row carrying what its icons need (sent, opened, allocation, a note such as "credited" or "open"). Pure; scripts/doc-list-check.mjs pins it.
// A document issued here and later imported into the archive is listed once, as the ledger row: the same rule summarize() uses.
import { DOC_TYPE, I4U_TYPE, closedBy, splitName } from "./finance";
import type { ArchiveDoc, DocType, FinCustomer, FinDocument } from "./finance";
import { ARCHIVE_DOC_TYPE, canSend, sendSummary } from "./financeSend";
import type { DocSend, SendSummary } from "./financeSend";

export type NoteTone = "green" | "yellow" | "red";
export interface DocRow {
  /** "d:" + ledger id or "a:" + archive id, unique across both sources. */
  key: string; source: "ledger" | "archive"; id: string;
  docType: DocType | null; typeLabel: string; number: number | null; date: string; subject: string;
  subtotal: number; total: number; allocation: string | null;
  /** The customer card, when there is one. A casual customer of the archive has only a typed name. */
  customer: FinCustomer | undefined; casualName: string; casual: boolean;
  note: { text: string; tone: NoteTone; title?: string } | null;
  sent: SendSummary;
  /** The history system recorded that the customer opened its mail. Only known for archive documents. */
  openedByProvider: boolean;
  /** Can be viewed and sent: an issued ledger document with a link, or any archive document (its link is asked for on demand). */
  sendable: boolean; isTest: boolean; pdfUrl: string | null;
  doc?: FinDocument; arch?: ArchiveDoc;
}

const num = (v: unknown): number => Number(v ?? 0) || 0;

function ledgerNote(d: FinDocument, docs: FinDocument[]): DocRow["note"] {
  if (d.status === "DRAFT") return (d.last_error ?? "").startsWith("UNCERTAIN") ? { text: "תוצאה לא ודאית", tone: "red" } : { text: "טיוטה", tone: "yellow" };
  if (d.is_test) return { text: "בדיקה", tone: "yellow" };
  if (d.doc_type === "PROFORMA") {
    const by = closedBy(d, docs);
    return by ? { text: "סגור", tone: "green", title: `נסגר במסמך ${by.doc_number ?? ""}` } : { text: "פתוח", tone: "yellow" };
  }
  if (d.doc_type === "INVOICE" || d.doc_type === "INVOICE_RECEIPT") {
    const credited = docs.filter((c) => c.doc_type === "CREDIT" && c.status === "ISSUED" && !c.is_test && c.related_doc_id === d.id).reduce((s, c) => s + num(c.total), 0);
    if (credited > 0) return credited + 0.005 >= num(d.total) ? { text: "מזוכית", tone: "red" } : { text: "זיכוי חלקי", tone: "yellow" };
  }
  return null;
}

/** The archive's own status label. "פתוחה" is noise on a receipt or an invoice-receipt (they never close), so it is shown only where it
 *  means money is still due: a tax invoice not yet closed by a receipt, and a pro forma not yet closed by an invoice. */
export function archiveNote(a: Pick<ArchiveDoc, "i4u_doc_type" | "status_id" | "i4u_status">): DocRow["note"] {
  const label = (a.i4u_status ?? "").trim() || ({ 1: "פתוחה", 2: "סגורה", 3: "מזוכית" } as Record<number, string>)[a.status_id ?? 0] || "";
  if (label === "מזוכית") return { text: "מזוכית", tone: "red" };
  if (a.i4u_doc_type === 5) return label === "סגורה" ? { text: "סגור", tone: "green" } : label === "פתוחה" ? { text: "פתוח", tone: "yellow", title: "חשבון עסקה שטרם נסגר בחשבונית במערכת ההיסטוריה" } : null;
  if (a.i4u_doc_type === 1) return label === "סגורה" ? { text: "סגורה", tone: "green", title: "נסגרה בקבלה במערכת ההיסטוריה" } : label === "פתוחה" ? { text: "פתוחה", tone: "yellow", title: "טרם נסגרה בקבלה במערכת ההיסטוריה" } : null;
  return null;
}

/** A pro forma that is still open, from either source. The ledger rule is isOpenProforma; the archive's is its own status. */
export const isOpenProformaRow = (r: DocRow): boolean => r.docType === "PROFORMA" && !r.isTest && r.note?.text === "פתוח";

export function buildDocRows(docs: FinDocument[], archive: ArchiveDoc[], sends: DocSend[], customers: FinCustomer[]): DocRow[] {
  const byId = new Map(customers.map((c) => [c.id, c]));
  const byI4u = new Map(customers.filter((c) => c.i4u_customer_id).map((c) => [Number(c.i4u_customer_id), c]));
  const sendsOf = new Map<string, DocSend[]>();
  for (const s of sends) {
    const k = s.document_id ? `d:${s.document_id}` : s.archive_id ? `a:${s.archive_id}` : "";
    if (k) sendsOf.set(k, [...(sendsOf.get(k) ?? []), s]);
  }
  const inLedger = new Set(docs.filter((d) => d.status === "ISSUED" && d.i4u_doc_id).map((d) => String(d.i4u_doc_id)));
  const rows: DocRow[] = [];
  for (const d of docs) {
    const c = byId.get(d.customer_id);
    rows.push({
      key: `d:${d.id}`, source: "ledger", id: d.id, docType: d.doc_type, typeLabel: DOC_TYPE[d.doc_type], number: d.doc_number, date: d.issue_date,
      subject: d.subject ?? "", subtotal: num(d.subtotal), total: num(d.total), allocation: d.allocation_number,
      customer: c, casualName: "", casual: c?.is_casual === true, note: ledgerNote(d, docs), sent: sendSummary(sendsOf.get(`d:${d.id}`) ?? []),
      openedByProvider: false, sendable: canSend(d), isTest: d.is_test, pdfUrl: d.pdf_url, doc: d,
    });
  }
  for (const a of archive) {
    if (inLedger.has(String(a.i4u_doc_id))) continue;
    const c = a.i4u_client_id ? byI4u.get(Number(a.i4u_client_id)) : undefined;
    rows.push({
      key: `a:${a.id}`, source: "archive", id: a.id, docType: ARCHIVE_DOC_TYPE[a.i4u_doc_type] ?? null, typeLabel: I4U_TYPE[a.i4u_doc_type] ?? String(a.i4u_doc_type),
      number: a.doc_number, date: a.issue_date, subject: a.subject ?? "", subtotal: num(a.subtotal), total: num(a.total), allocation: a.allocation_number,
      customer: c, casualName: c ? "" : splitName(a.gname || a.cname || "").name, casual: !c || c.is_casual, note: archiveNote(a),
      sent: sendSummary(sendsOf.get(`a:${a.id}`) ?? []), openedByProvider: a.opened === true || a.opened === "true",
      sendable: true, isTest: false, pdfUrl: null, arch: a,
    });
  }
  return rows.sort((x, y) => (x.date === y.date ? (y.number ?? 0) - (x.number ?? 0) : x.date < y.date ? 1 : -1));
}

/** What the tick column shows: two ticks when the customer is known to have opened the mail (our tracking or the history system's),
 *  one when we sent it, nothing when neither is known. No tick is not "not sent": the history system's own sends are not in our log. */
export function sentMark(r: Pick<DocRow, "sent" | "openedByProvider">): { ticks: 0 | 1 | 2; title: string; bounced: boolean } {
  const bounced = r.sent.bounced === true;
  if (r.sent.opened) return { ticks: 2, title: `נשלח ונפתח אצל הלקוח (${r.sent.opened})`, bounced };
  if (r.openedByProvider) return { ticks: 2, title: "נפתח אצל הלקוח, לפי מערכת ההיסטוריה", bounced };
  const last = [r.sent.email && `בדוא"ל ${r.sent.email}`, r.sent.whatsapp && `ב-WhatsApp ${r.sent.whatsapp}`].filter(Boolean).join(", ");
  if (last) return { ticks: 1, title: `נשלח ${last}`, bounced };
  return { ticks: 0, title: "", bounced };
}

/** Search that never matches on a client's name or on the subject (which can name one) while names are hidden: then only the
 *  document number and the allocation number count. Revealed, the subject and the customer's shown label count too. */
export function rowMatches(r: DocRow, query: string, revealed: boolean, label: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  if (String(r.number ?? "").includes(q) || (r.allocation ?? "").toLowerCase().includes(q)) return true;
  return revealed && (r.subject.toLowerCase().includes(q) || label.toLowerCase().includes(q));
}

/** The type filter: "" all, "OPEN_PROFORMA" open pro formas of both sources, or one document type. */
export const typeMatches = (r: DocRow, filter: string): boolean => !filter || (filter === "OPEN_PROFORMA" ? isOpenProformaRow(r) : r.docType === filter);
