// What the document screen needs to send an issued document: default texts, the WhatsApp hand off, and the send log rules.
// The e-mail itself is sent by the edge function lalum-fin-doc-send; scripts/doc-send-check.mjs pins these helpers.
import { DOC_TYPE } from "./finance";
import type { FinDocument } from "./finance";

export interface DocSend {
  id: string; document_id: string; channel: "EMAIL" | "WHATSAPP"; recipient: string; subject: string | null;
  status: "PENDING" | "SENT" | "FAILED"; error: string | null; created_at: string;
}

export const defaultSubject = (d: Pick<FinDocument, "doc_type" | "doc_number">): string =>
  `${DOC_TYPE[d.doc_type]}${d.doc_number ? ` מספר ${d.doc_number}` : ""} מ-LALUM`;

/** No customer name on purpose: names are hidden on screen by default and the greeting reads fine without one. */
export const defaultBody = (d: Pick<FinDocument, "doc_type" | "doc_number">): string =>
  `שלום,\n\nמצורף ${DOC_TYPE[d.doc_type]}${d.doc_number ? ` מספר ${d.doc_number}` : ""}.\n\nלשאלות אפשר להשיב להודעה זו.\n\nבברכה,\nד״ר עו״ד אברהם ללום`;

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

export const waText = (d: Pick<FinDocument, "doc_type" | "doc_number" | "pdf_url">): string =>
  `שלום, ${DOC_TYPE[d.doc_type]}${d.doc_number ? ` מספר ${d.doc_number}` : ""} מ-LALUM:\n${d.pdf_url ?? ""}`;

/** A document can be sent when it is issued and has a PDF link. */
export const canSend = (d: Pick<FinDocument, "status" | "pdf_url">): boolean => d.status === "ISSUED" && !!d.pdf_url;

export interface SendSummary { email?: string; whatsapp?: string }
/** The latest successful send per channel, newest first input or not. Dates are YYYY-MM-DD in Israel time. */
export function sendSummary(sends: DocSend[]): SendSummary {
  const out: SendSummary = {};
  for (const s of sends) {
    if (s.status !== "SENT") continue;
    const day = new Date(s.created_at).toLocaleDateString("en-CA", { timeZone: "Asia/Jerusalem" });
    const key = s.channel === "EMAIL" ? "email" : "whatsapp";
    if (!out[key] || day > (out[key] as string)) out[key] = day;
  }
  return out;
}
