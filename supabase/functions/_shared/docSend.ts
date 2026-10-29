// Pure helpers for sending an issued finance document (lalum-fin-doc-send). No Deno or network APIs here, so
// lalum-app/scripts/doc-send-check.mjs can run them under node.
import { escapeHtml, isEmail, normalizeIsraeliPhone } from "./dunning.ts";

export const DOC_LABEL: Record<string, string> = {
  PROFORMA: "חשבון עסקה", INVOICE: "חשבונית מס", RECEIPT: "קבלה", INVOICE_RECEIPT: "חשבונית מס קבלה", CREDIT: "חשבונית זיכוי",
};
/** The provider's DocumentType codes (the history archive keeps the number), as a ledger document type. */
export const ARCHIVE_TYPE: Record<number, string> = { 1: "INVOICE", 2: "RECEIPT", 3: "INVOICE_RECEIPT", 4: "CREDIT", 5: "PROFORMA" };
export const MAX_RECIPIENTS = 6;
export const MAX_ATTACHMENT_BYTES = 8 * 1024 * 1024;
/** The largest PDF a partner may attach by hand to an archive document. Kept well under the request size the function host accepts. */
export const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;

/**
 * Whether a base64 string is a PDF a partner attached by hand: only base64 characters, a decoded size within the limit, and the PDF magic
 * bytes at the start. The content itself is not inspected further: it goes to the customer as an attachment and is never opened here.
 */
export function validPdfBase64(b64: unknown, maxBytes = MAX_UPLOAD_BYTES): b64 is string {
  if (typeof b64 !== "string" || b64.length < 8 || b64.length > Math.ceil((maxBytes * 4) / 3) + 4) return false;
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(b64) || b64.length % 4 !== 0) return false;
  const padding = b64.endsWith("==") ? 2 : b64.endsWith("=") ? 1 : 0;
  if ((b64.length / 4) * 3 - padding > maxBytes) return false;
  try { return atob(b64.slice(0, 8)).startsWith("%PDF"); } catch { return false; }
}

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
/** Every attachment this code sends is a PDF. Said explicitly: left to the provider it went out as application/octet-stream (29.10). */
export const pdfAttachment = (filename: string, content: string) => ({ filename, content, content_type: "application/pdf" as const });

// ---- automatic delivery at issue time ----

/**
 * Name of the approved WhatsApp template that carries an issued document (WHATSAPP_DOCUMENT_TEMPLATE), or null when none is configured.
 * Meta delivers a business initiated message outside the 24 hour window only as an approved template, so free text is never sent.
 */
export function documentTemplateName(env: (k: string) => string | undefined): string | null {
  const n = env("WHATSAPP_DOCUMENT_TEMPLATE");
  return n && /^[a-z0-9_]{1,512}$/.test(n) ? n : null;
}

/** Template body parameters, in the order {{1}} document type, {{2}} document number, {{3}} link. Null when the link is not an https link. */
export function documentTemplateParams(type: string, docNumber: number | null, url: string | null): string[] | null {
  if (!url || !/^https:\/\//i.test(url) || /\s/.test(url) || url.length > 1000) return null;
  return [DOC_LABEL[type] ?? "מסמך", docNumber ? String(docNumber) : "חדש", url];
}

export type AutoChannel = "EMAIL" | "WHATSAPP";
export interface AutoPlanInput { email: string | null; phone: string | null; consent: boolean; templateConfigured: boolean; pdfUrl: string | null; isTest: boolean }
export interface AutoPlan { send: AutoChannel[]; skipped: Array<{ channel: AutoChannel; reason: string }> }

/**
 * Which channels an issued document goes out on by itself. E-mail always, to the customer's address on the record. WhatsApp only to a valid
 * Israeli mobile whose owner has a recorded consent, with an approved template configured and a link to send. A TEST document (trial
 * environment) is never sent to a customer by WhatsApp. Every skipped channel carries the reason, so the screen can say why.
 */
export function autoSendPlan(i: AutoPlanInput): AutoPlan {
  const send: AutoChannel[] = [], skipped: AutoPlan["skipped"] = [];
  if (isEmail(i.email) || i.isTest) send.push("EMAIL"); else skipped.push({ channel: "EMAIL", reason: "no_email" });
  if (i.isTest) skipped.push({ channel: "WHATSAPP", reason: "test_document" });
  else if (!normalizeIsraeliPhone(i.phone)) skipped.push({ channel: "WHATSAPP", reason: "no_mobile" });
  else if (!i.consent) skipped.push({ channel: "WHATSAPP", reason: "no_whatsapp_consent" });
  else if (!i.templateConfigured) skipped.push({ channel: "WHATSAPP", reason: "template_not_configured" });
  else if (!i.pdfUrl) skipped.push({ channel: "WHATSAPP", reason: "no_pdf" });
  else send.push("WHATSAPP");
  return { send, skipped };
}

/** "Attached" agrees with the document's name: חשבונית and קבלה are feminine, חשבון עסקה and a plain מסמך are masculine. */
export const attachedWord = (type: string | null): string => (type && type !== "PROFORMA" && DOC_LABEL[type] ? "מצורפת" : "מצורף");

/** The default text of an automatic mail: names the document, never the customer (names are hidden on screen by default). */
export function autoBody(type: string, docNumber: number | null): string {
  const label = DOC_LABEL[type] ?? "מסמך";
  return `שלום,\n\n${attachedWord(type)} ${label}${docNumber ? ` מספר ${docNumber}` : ""}.\n\nלשאלות אפשר להשיב להודעה זו.\n\nבברכה,\nד״ר עו״ד אברהם ללום`;
}

// ---- delivery test: no document, no ledger, no Invoice4U ----

/** A one page PDF ("LALUM: document delivery test"), so a test mail proves the attachment path too. 637 bytes, not a tax document. */
export const SAMPLE_PDF_BASE64 = "JVBERi0xLjQKMSAwIG9iago8PCAvVHlwZSAvQ2F0YWxvZyAvUGFnZXMgMiAwIFIgPj4KZW5kb2JqCjIgMCBvYmoKPDwgL1R5cGUgL1BhZ2VzIC9LaWRzIFszIDAgUl0gL0NvdW50IDEgPj4KZW5kb2JqCjMgMCBvYmoKPDwgL1R5cGUgL1BhZ2UgL1BhcmVudCAyIDAgUiAvTWVkaWFCb3ggWzAgMCAzMDAgMTQ0XSAvQ29udGVudHMgNCAwIFIgL1Jlc291cmNlcyA8PCAvRm9udCA8PCAvRjEgNSAwIFIgPj4gPj4gPj4KZW5kb2JqCjQgMCBvYmoKPDwgL0xlbmd0aCA5MyA+PgpzdHJlYW0KQlQgL0YxIDE0IFRmIDIwIDgwIFRkIChMQUxVTTogZG9jdW1lbnQgZGVsaXZlcnkgdGVzdCkgVGogMCAtMjIgVGQgKE5vdCBhIHRheCBkb2N1bWVudC4pIFRqIEVUCmVuZHN0cmVhbQplbmRvYmoKNSAwIG9iago8PCAvVHlwZSAvRm9udCAvU3VidHlwZSAvVHlwZTEgL0Jhc2VGb250IC9IZWx2ZXRpY2EgPj4KZW5kb2JqCnhyZWYKMCA2CjAwMDAwMDAwMDAgNjU1MzUgZiAKMDAwMDAwMDAwOSAwMDAwMCBuIAowMDAwMDAwMDU4IDAwMDAwIG4gCjAwMDAwMDAxMTUgMDAwMDAgbiAKMDAwMDAwMDI0MSAwMDAwMCBuIAowMDAwMDAwMzg0IDAwMDAwIG4gCnRyYWlsZXIKPDwgL1NpemUgNiAvUm9vdCAxIDAgUiA+PgpzdGFydHhyZWYKNDU0CiUlRU9GCg==";

/** Template body parameters for the WhatsApp test: the same three variables a real document fills, with a harmless sample. */
export const testTemplateParams = (): string[] => ["בדיקת מערכת", "0", "https://lalumapp.com/"];

/** The text of the test mail. It says plainly that nothing was issued or recorded. */
export const testEmailBody = (): string =>
  "שלום,\n\nזוהי הודעת בדיקה של שליחת המסמכים האוטומטית ב-LALUM. לא הופק מסמך ולא נרשם דבר במערכת.\n\nאם הגיעה אליך הודעה זו עם קובץ PDF מצורף, שליחת הדוא\"ל פועלת.";

// ---- simulation of issuing: a draft rendered and mailed to the partner, nothing issued ----

export interface SimLine { name: unknown; qty: unknown; price: unknown }
export interface SimDraft { docType: string; issueDate: string | null; lines: SimLine[]; subtotal: unknown; vat: unknown; total: unknown }
const money2 = (n: unknown): string => (Number.isFinite(Number(n)) ? Number(n).toFixed(2) : "0.00");

/**
 * What a partner receives when simulating the issue of a draft: the document as this system renders it, plainly marked as not a tax
 * document. No customer name and no internal note are included (names are hidden on screen by default, and the note is never sent).
 * Every typed value is escaped. At most 60 lines, as in the ledger.
 */
export function simulationEmail(d: SimDraft): { subject: string; html: string } {
  const label = DOC_LABEL[d.docType] ?? "מסמך";
  const rows = d.lines.slice(0, 60).map((l) =>
    `<tr><td style="padding:4px 8px;border-bottom:1px solid #ddd">${escapeHtml(String(l.name ?? "").slice(0, 200))}</td><td style="padding:4px 8px;border-bottom:1px solid #ddd" dir="ltr">${escapeHtml(String(Number(l.qty) || 0))}</td><td style="padding:4px 8px;border-bottom:1px solid #ddd" dir="ltr">${money2(l.price)}</td></tr>`).join("");
  const date = d.issueDate && /^\d{4}-\d{2}-\d{2}$/.test(d.issueDate) ? d.issueDate : "";
  const html = `<div dir="rtl" lang="he" style="font-family:Arial,sans-serif;font-size:15px;line-height:1.6">`
    + `<p style="margin:0 0 12px;padding:8px 12px;background:#fff3cd"><b>סימולציה בלבד.</b> זו אינה חשבונית מס, לא הופק מסמך, לא הוקצה מספר ולא נשלח דבר ללקוח.</p>`
    + `<p style="margin:0 0 12px">${escapeHtml(label)}${date ? `, תאריך <span dir="ltr">${escapeHtml(date)}</span>` : ""}</p>`
    + `<table style="border-collapse:collapse;width:100%"><tr><th style="text-align:right;padding:4px 8px">תיאור</th><th style="text-align:right;padding:4px 8px">כמות</th><th style="text-align:right;padding:4px 8px">מחיר</th></tr>${rows}</table>`
    + `<p style="margin:12px 0 0">לפני מע"מ: <span dir="ltr">${money2(d.subtotal)}</span><br>מע"מ: <span dir="ltr">${money2(d.vat)}</span><br><b>סה"כ: <span dir="ltr">${money2(d.total)}</span></b></p>`
    + `<p style="margin:12px 0 0;color:#666">מצורף קובץ PDF לדוגמה (לא המסמך עצמו), כדי לבדוק גם את נתיב הצרופה.</p></div>`;
  return { subject: `[סימולציה] ${label} מ-LALUM, לא הופק`, html };
}
