// What the document screen needs to send an issued document: default texts, the WhatsApp hand off, and the send log rules.
// The e-mail itself is sent by the edge function lalum-fin-doc-send; scripts/doc-send-check.mjs pins these helpers.
import { DOC_TYPE } from "./finance";
import type { DocType, FinDocument } from "./finance";

/** One row of the send log. Exactly one of document_id and archive_id is set. The four times come from the mail provider (migration 0078). */
export interface DocSend {
  id: string; document_id: string | null; archive_id: string | null; channel: "EMAIL" | "WHATSAPP"; recipient: string; subject: string | null;
  status: "PENDING" | "SENT" | "FAILED"; error: string | null; created_at: string;
  delivered_at: string | null; opened_at: string | null; bounced_at: string | null; complained_at: string | null;
}
export const DOC_SEND_COLS = "id, document_id, archive_id, channel, recipient, subject, status, error, created_at, delivered_at, opened_at, bounced_at, complained_at";

/** What a message is about, for the texts: a ledger document or an archive document (whose type is the provider's number, unknown numbers give null). */
export interface SendSubject { doc_type: DocType | null; doc_number: number | null }
const label = (t: DocType | null): string => (t ? DOC_TYPE[t] : "מסמך");
/** "Attached" agrees with the name: חשבונית and קבלה are feminine. Same rule as attachedWord in supabase/functions/_shared/docSend.ts. */
const attached = (t: DocType | null): string => (t && t !== "PROFORMA" ? "מצורפת" : "מצורף");
/** The provider's DocumentType codes as a ledger document type. */
export const ARCHIVE_DOC_TYPE: Record<number, DocType> = { 1: "INVOICE", 2: "RECEIPT", 3: "INVOICE_RECEIPT", 4: "CREDIT", 5: "PROFORMA" };

export const defaultSubject = (d: SendSubject): string =>
  `${label(d.doc_type)}${d.doc_number ? ` מספר ${d.doc_number}` : ""} מ-LALUM`;

/** No customer name on purpose: names are hidden on screen by default and the greeting reads fine without one. */
export const defaultBody = (d: SendSubject): string =>
  `שלום,\n\n${attached(d.doc_type)} ${label(d.doc_type)}${d.doc_number ? ` מספר ${d.doc_number}` : ""}.\n\nלשאלות אפשר להשיב להודעה זו.\n\nבברכה,\nד״ר עו״ד אברהם ללום`;

/** Israeli mobile to E.164 digits without the plus sign (what wa.me expects), or null. Same rule as supabase/functions/_shared/dunning.ts. */
export function waNumber(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let d = raw.replace(/[^\d+]/g, "");
  if (d.startsWith("+")) d = d.slice(1);
  else if (d.startsWith("00")) d = d.slice(2);
  else if (d.startsWith("0")) d = "972" + d.slice(1);
  return /^9725\d{8}$/.test(d) ? d : null;
}

/** A click to chat link with the message prepared. Without a valid mobile the link opens WhatsApp's own contact picker. */
export function whatsappUrl(phone: string | null | undefined, text: string): string {
  const n = waNumber(phone);
  return `https://wa.me/${n ?? ""}?text=${encodeURIComponent(text)}`;
}

export const waText = (d: SendSubject, url: string): string =>
  `שלום, ${label(d.doc_type)}${d.doc_number ? ` מספר ${d.doc_number}` : ""} מ-LALUM:\n${url}`;

/** The largest PDF that can be attached by hand to an archive document. The function checks the same limit (MAX_UPLOAD_BYTES in _shared/docSend.ts). */
export const UPLOAD_MAX_BYTES = 4 * 1024 * 1024;

/** Why a chosen file cannot be attached, or null when it can. The function checks the real content again; this only spares a useless upload. */
export function pdfFileProblem(f: { name: string; type: string; size: number }): string | null {
  const isPdf = f.type === "application/pdf" || /\.pdf$/i.test(f.name);
  if (!isPdf) return "הקובץ חייב להיות PDF.";
  if (f.size <= 0) return "הקובץ ריק.";
  if (f.size > UPLOAD_MAX_BYTES) return `הקובץ גדול מדי (${(f.size / 1048576).toFixed(1)}MB). המקסימום הוא ${UPLOAD_MAX_BYTES / 1048576}MB.`;
  return null;
}

/** A document can be sent when it is issued and has a PDF link. */
export const canSend = (d: Pick<FinDocument, "status" | "pdf_url">): boolean => d.status === "ISSUED" && !!d.pdf_url;

const dayIL = (iso: string): string => new Date(iso).toLocaleDateString("en-CA", { timeZone: "Asia/Jerusalem" });
export interface SendSummary { email?: string; whatsapp?: string; opened?: string; bounced?: boolean }
/** The latest successful send per channel, newest first input or not, the latest known open, and whether a mail came back. Dates are YYYY-MM-DD in Israel time. */
export function sendSummary(sends: DocSend[]): SendSummary {
  const out: SendSummary = {};
  for (const s of sends) {
    if (s.status !== "SENT") continue;
    const day = dayIL(s.created_at);
    const key = s.channel === "EMAIL" ? "email" : "whatsapp";
    if (!out[key] || day > (out[key] as string)) out[key] = day;
    if (s.bounced_at) out.bounced = true;
    if (s.opened_at) { const o = dayIL(s.opened_at); if (!out.opened || o > out.opened) out.opened = o; }
  }
  return out;
}

export type DeliveryTone = "green" | "yellow" | "red";
/**
 * The state of one send, strongest known fact first. An open is only a tracking image loading, so it is shown when known and there is no
 * "not opened": a mail client that blocks images never reports one. A WhatsApp row only says the partner opened WhatsApp, never that it arrived.
 */
export function deliveryState(s: DocSend): { text: string; tone: DeliveryTone } {
  if (s.status === "FAILED") return { text: "נכשל", tone: "red" };
  if (s.status === "PENDING") return { text: "בשליחה", tone: "yellow" };
  if (s.channel === "WHATSAPP") return { text: "נפתח ב-WhatsApp", tone: "green" };
  if (s.bounced_at) return { text: "חזר, לא נמסר", tone: "red" };
  if (s.complained_at) return { text: "סומן כספאם", tone: "red" };
  if (s.opened_at) return { text: "נפתח", tone: "green" };
  if (s.delivered_at) return { text: "נמסר", tone: "green" };
  return { text: "נשלח", tone: "green" };
}

// ---- automatic delivery at issue time (lalum-fin-issue sends the document by itself; migration 0081) ----
export interface AutoOutcome { status: "sent" | "skipped" | "failed" | "unknown"; code?: string }
const AUTO_REASON: Record<string, string> = {
  no_email: 'אין בכרטיס כתובת דוא"ל', no_mobile: "אין בכרטיס נייד תקין", no_whatsapp_consent: "לא נרשמה הסכמה להודעות WhatsApp",
  template_not_configured: "תבנית ה-WhatsApp למסמכים לא הוגדרה בשרת", whatsapp_not_configured: "חיבור ה-WhatsApp לא הוגדר בשרת",
  mail_not_configured: 'שליחת הדוא"ל לא הוגדרה בשרת', no_pdf: "אין קישור תקין למסמך", test_document: "זהו מסמך בדיקה",
  already_sent: "כבר נשלח", send_failed: "הספק דחה את השליחה", fetch_failed: "לא התקבלה תשובה, בדקו ביומן השליחות", not_attempted: "לא נוסה",
};
const CHANNEL_NAME = { email: 'בדוא"ל', whatsapp: "ב-WhatsApp" } as const;
/**
 * One sentence for the screen about what the automatic delivery did. Green only when the e-mail went out; every channel that did not
 * is named with its reason, so a missing WhatsApp is never silent. A document that was issued stays issued whatever this says.
 */
export function deliveryText(d: Partial<Record<"email" | "whatsapp", AutoOutcome>> | undefined): { ok: boolean; text: string } {
  if (!d) return { ok: false, text: "לא התקבל דיווח על שליחת המסמך ללקוח. בדקו ביומן השליחות." };
  const sent = (["email", "whatsapp"] as const).filter((k) => d[k]?.status === "sent");
  const problems = (["email", "whatsapp"] as const).filter((k) => d[k] && d[k]!.status !== "sent" && !(d[k]!.status === "skipped" && d[k]!.code === "already_sent"))
    .map((k) => `${CHANNEL_NAME[k]}: ${AUTO_REASON[d[k]!.code ?? ""] ?? "השליחה נכשלה"}`);
  const head = sent.length ? `נשלח ללקוח ${sent.map((k) => CHANNEL_NAME[k]).join(" וגם ")}.` : "המסמך לא נשלח ללקוח.";
  return { ok: d.email?.status === "sent" || d.email?.code === "already_sent", text: problems.length ? `${head} לא נשלח ${problems.join("; ")}.` : head };
}
