// Pure rules for showing client names on screen (see migration 0044). Kept free of React so scripts/client-names-check.mjs tests the shipped code.
export interface Named { matter_code?: string | null; title?: string | null }

/** Hidden: the matter code. Revealed: the title (falling back to the code when there is none). Never throws, never returns an empty label. */
export function displayName(revealed: boolean, m: Named | null | undefined): string {
  const code = m?.matter_code?.trim() || "";
  const title = m?.title?.trim() || "";
  if (revealed) return title || code || "תיק";
  return code || "תיק";
}

/** Text that identifies a client (a billing customer name, a free typed client): the text while revealed, a neutral word while hidden. */
export const maskedText = (revealed: boolean, text: string | null | undefined, placeholder = "מוסתר"): string => (revealed ? (text ?? "") : text ? placeholder : "");

/** Search may only match what the user can see: the code while hidden, the title (and code) once revealed. */
export function matchesQuery(revealed: boolean, m: Named, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  if ((m.matter_code ?? "").toLowerCase().includes(q)) return true;
  return revealed && (m.title ?? "").toLowerCase().includes(q);
}

/** Names go back into hiding after this much time without interaction. */
export const REVEAL_IDLE_MS = 5 * 60 * 1000;
export const idleExpired = (lastActivity: number, now: number, ttl: number = REVEAL_IDLE_MS): boolean => now - lastActivity >= ttl;

/** A customer card as the bookkeeping screens hold it: the name is what identifies a person, the id and the invoicing number do not. */
export interface CustomerLike { id: string; name?: string | null; i4u_customer_id?: number | string | null }

/** Hidden: a neutral label that still tells customers apart in a list (the invoicing number, else the last four characters of the id). Revealed: the name. */
export function customerLabel(revealed: boolean, c: CustomerLike | null | undefined): string {
  const name = c?.name?.trim() || "";
  if (revealed) return name || "לקוח";
  if (!c) return "לקוח";
  const no = c.i4u_customer_id != null && String(c.i4u_customer_id).trim() ? String(c.i4u_customer_id).trim() : "";
  const id = c.id || "";
  // Only a real id contributes its own characters; any other key (a casual customer is keyed by the typed name) is hashed, so the label never spells part of a name.
  const tail = no || (UUID.test(id) ? id.replace(/-/g, "").slice(-4).toUpperCase() : hashTail(id));
  return tail ? `לקוח ${tail}` : "לקוח";
}
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** Four characters from a hash of the text: stable, tells two names apart, reveals none of the letters. */
export function hashTail(text: string): string {
  if (!text) return "";
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 16777619); }
  return (h >>> 0).toString(36).toUpperCase().padStart(4, "0").slice(-4);
}
/** A free typed customer name (a casual customer, an archived document): the text while revealed, a hashed label while hidden. */
export const casualLabel = (revealed: boolean, text: string | null | undefined): string => (revealed ? (text?.trim() || "לקוח מזדמן") : text?.trim() ? `לקוח ${hashTail(text.trim())}` : "לקוח מזדמן");

/** Why names are being shown. The code is what the audit log keeps; the note is optional free text, required for OTHER, and must not carry a name. */
export const REVEAL_REASONS = [
  { code: "INVOICE", label: "הפקת חשבונית או מסמך" },
  { code: "COLLECTION", label: "גבייה ותזכורת" },
  { code: "RECONCILIATION", label: "התאמת בנק או הנהלת חשבונות" },
  { code: "CLIENT_CONTACT", label: "בירור או שיחה עם הלקוח" },
  { code: "MATTER_WORK", label: "עבודה על תיק" },
  { code: "OTHER", label: "אחר (חובה לפרט)" },
] as const;
export type RevealReasonCode = (typeof REVEAL_REASONS)[number]["code"];
export const REASON_NOTE_MIN = 5;
export const REASON_NOTE_MAX = 200;

/** The message to show when the reason is not acceptable, or null when it is. Mirrors lalum_reveal_client_names. */
export function reasonError(code: string | null | undefined, note: string | null | undefined): string | null {
  if (!REVEAL_REASONS.some((r) => r.code === code)) return "בחרו סיבה להצגת השמות.";
  const n = (note ?? "").trim();
  if (n.length > REASON_NOTE_MAX) return `ההערה ארוכה מדי (עד ${REASON_NOTE_MAX} תווים).`;
  if (code === "OTHER" && n.length < REASON_NOTE_MIN) return "בסיבה \"אחר\" יש לפרט (לפחות חמישה תווים).";
  return null;
}

/** The reason as a phrase for a chip or a log row: without the "(חובה לפרט)" hint the picker shows. */
export const reasonLabel = (code: string | null | undefined): string => (REVEAL_REASONS.find((r) => r.code === code)?.label ?? "").replace(/ \(חובה לפרט\)$/, "");
