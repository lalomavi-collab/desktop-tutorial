// Pure helpers for the collections reminder channel (lalum-fin-dunning-send). No Deno or network APIs here, so
// lalum-app/scripts/dunning-send-check.mjs can run them under node.

export type Tier = 1 | 2 | 3;
export const isTier = (n: unknown): n is Tier => n === 1 || n === 2 || n === 3;

/** Israeli mobile or landline to E.164 digits without the plus sign (what the WhatsApp Cloud API expects). Null when it is not one. */
export function normalizeIsraeliPhone(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let d = raw.replace(/[^\d+]/g, "");
  if (d.startsWith("+")) d = d.slice(1);
  else if (d.startsWith("00")) d = d.slice(2);
  else if (d.startsWith("0")) d = "972" + d.slice(1);
  if (!/^972[2-9]\d{7,8}$/.test(d)) return null;
  // 972 + 5x + 7 digits is a mobile (12 digits in all); 972 + area code + 7 digits is a landline, which cannot receive WhatsApp.
  return d.startsWith("9725") && d.length === 12 ? d : null;
}

export const isEmail = (s: string | null | undefined): s is string => !!s && s.length <= 254 && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(s);

export const SUBJECT: Record<Tier, string> = {
  1: "תזכורת לתשלום יתרה פתוחה",
  2: "תזכורת רשמית: יתרה פתוחה לתשלום",
  3: "התראה: יתרה פתוחה לתשלום מיידי",
};

const ESC: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
export const escapeHtml = (s: string): string => s.replace(/[&<>"']/g, (c) => ESC[c]);

/** The partner's text as RTL HTML. Every character is escaped: the body is typed by a person and goes to a third party. */
export function emailHtml(body: string): string {
  const paras = body.split(/\n{2,}/).map((p) => `<p style="margin:0 0 12px">${escapeHtml(p.trim()).replace(/\n/g, "<br>")}</p>`).join("");
  return `<div dir="rtl" lang="he" style="font-family:Arial,sans-serif;font-size:15px;line-height:1.6">${paras}</div>`;
}

/** Name of the approved WhatsApp template for a tier, or null when none is configured. Meta only delivers a business-initiated
 *  message outside the 24 hour window as an approved template, so free text is never sent. */
export function templateName(tier: Tier, env: (k: string) => string | undefined): string | null {
  const n = env(`WHATSAPP_DUNNING_TEMPLATE_${tier}`);
  return n && /^[a-z0-9_]{1,512}$/.test(n) ? n : null;
}

export interface TemplateValues { name: string; amount: number; days: number }
/** Template body parameters, in the order {{1}} name, {{2}} amount, {{3}} days past the payment date. Null when a value is not usable. */
export function templateParams(v: TemplateValues): string[] | null {
  const name = (v.name ?? "").replace(/[\r\n\t]+/g, " ").trim().slice(0, 60);
  if (!name || !Number.isFinite(v.amount) || v.amount <= 0 || v.amount > 10_000_000 || !Number.isInteger(v.days) || v.days < 0 || v.days > 5000) return null;
  return [name, v.amount.toLocaleString("he-IL", { style: "currency", currency: "ILS" }), String(v.days)];
}
