// Pure helpers for sending an issued finance document (lalum-fin-doc-send). No Deno or network APIs here, so
// lalum-app/scripts/doc-send-check.mjs can run them under node.
import { escapeHtml, isEmail } from "./dunning.ts";

export const DOC_LABEL: Record<string, string> = {
  PROFORMA: "חשבון עסקה", INVOICE: "חשבונית מס", RECEIPT: "קבלה", INVOICE_RECEIPT: "חשבונית מס קבלה", CREDIT: "חשבונית זיכוי",
};
/** The provider's DocumentType codes (the history archive keeps the number), as a ledger document type. */
export const ARCHIVE_TYPE: Record<number, string> = { 1: "INVOICE", 2: "RECEIPT", 3: "INVOICE_RECEIPT", 4: "CREDIT", 5: "PROFORMA" };
export const MAX_RECIPIENTS = 6;
export const MAX_ATTACHMENT_BYTES = 8 * 1024 * 1024;

export interface RecipientInput { customerEmail: string | null; includeCustomer: boolean; extra: unknown; copyToMe: boolean; ownEmail: string | null; testOnly: boolean }
export interface Recipients { to: string[]; bcc: string[] }

/** Splits a typed list on commas, semicolons, spaces and line breaks. */
export const splitAddresses = (raw: unknown): string[] =>
  (Array.isArray(raw) ? raw.map(String) : String(raw ?? "").split(/[\s,;]+/)).map((s) => s.trim()).filter(Boolean);

/**
 * Who gets the mail. The customer's address comes from the customer record, never from the request. Extra addresses are typed by the
 * partner and are each checked. The partner's own copy goes as bcc so the customer does not see it. A TEST document (made in the
 * provider's trial environment) can only go to the partner's own address. Returns an error code instead of a list when something is off.
 */
export function resolveRecipients(i: RecipientInput): Recipients | { error: "no_recipient" | "bad_address" | "too_many" | "no_email" | "no_own_email" } {
  const extra = splitAddresses(i.extra).map((a) => a.toLowerCase());
  if (extra.some((a) => !isEmail(a))) return { error: "bad_address" };
  if (i.testOnly) {
    if (!isEmail(i.ownEmail)) return { error: "no_own_email" };
    return { to: [i.ownEmail.toLowerCase()], bcc: [] };
  }
  const to: string[] = [];
  if (i.includeCustomer) {
    if (!isEmail(i.customerEmail)) return { error: "no_email" };
    to.push(i.customerEmail.toLowerCase());
  }
  for (const a of extra) if (!to.includes(a)) to.push(a);
  const own = i.copyToMe ? (isEmail(i.ownEmail) ? i.ownEmail.toLowerCase() : null) : null;
  if (i.copyToMe && !own) return { error: "no_own_email" };
  if (!to.length) {
    if (!own) return { error: "no_recipient" };
    return { to: [own], bcc: [] };
  }
  const bcc = own && !to.includes(own) ? [own] : [];
  if (to.length + bcc.length > MAX_RECIPIENTS) return { error: "too_many" };
  return { to, bcc };
}

export const defaultSubject = (type: string, docNumber: number | null): string => `${DOC_LABEL[type] ?? "מסמך"}${docNumber ? ` מספר ${docNumber}` : ""} מ-LALUM`;

/** One line subject: no line breaks (mail header injection), trimmed, capped. */
export const cleanSubject = (s: unknown, fallback: string): string => {
  const t = String(s ?? "").replace(/[\r\n\t]+/g, " ").trim().slice(0, 150);
  return t || fallback;
};

/** The partner's text, then the document link. The text is escaped: it is typed by a person and goes to a third party. */
export function docEmailHtml(body: string, pdfUrl: string | null, attached: boolean): string {
  const paras = body.split(/\n{2,}/).filter((p) => p.trim()).map((p) => `<p style="margin:0 0 12px">${escapeHtml(p.trim()).replace(/\n/g, "<br>")}</p>`).join("");
  const link = pdfUrl && /^https:\/\//i.test(pdfUrl)
    ? `<p style="margin:0 0 12px"><a href="${escapeHtml(pdfUrl)}">${attached ? "קישור למסמך" : "צפייה במסמך"}</a></p>` : "";
  return `<div dir="rtl" lang="he" style="font-family:Arial,sans-serif;font-size:15px;line-height:1.6">${paras}${link}</div>`;
}

const FILE_STEM: Record<string, string> = { PROFORMA: "proforma", INVOICE: "tax-invoice", RECEIPT: "receipt", INVOICE_RECEIPT: "tax-invoice-receipt", CREDIT: "credit" };
/** ASCII only, so every mail client shows the attachment name correctly. */
export const safeFilename = (type: string, docNumber: number | null): string => `${FILE_STEM[type] ?? "document"}-${docNumber ?? "draft"}.pdf`;
