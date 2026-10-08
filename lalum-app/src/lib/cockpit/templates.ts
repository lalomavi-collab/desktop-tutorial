// Template merge for the case cockpit. A template body carries {{field}} placeholders; the form
// fills them in the browser and the merged text goes through the ordinary upload route, so the PII
// shield, the conflict check and the playbook run on it exactly as on any uploaded document.
// The merged text with real names exists only in this browser session (see originals.ts).

export interface DocTemplate { id: string; name: string; practice_area: string; body: string; version: number }

export const FIELD_LABEL: Record<string, string> = {
  date: "תאריך",
  client_name: "שם הלקוח",
  client_id: "ת.ז. / ח.פ. של הלקוח",
  client_phone: "טלפון הלקוח",
  client_email: 'דוא"ל הלקוח',
  client_address: "כתובת הלקוח",
  counterparty_name: "שם הצד שכנגד",
  counterparty_id: "ת.ז. / ח.פ. של הצד שכנגד",
  matter_title: "נושא התיק",
  fee: "שכר הטרחה",
  price: "התמורה",
  deposit: "מקדמה",
  signing_date: "מועד חתימה",
  gush: "גוש",
  helka: "חלקה",
  floor: "קומה",
  track: "מסלול",
  source_of_funds: "מקור הכספים",
};

/** Fields the PII shield has no detector for. They never reach the server: the document keeps a
 *  visible blank and the attorney fills the value into the exported file. */
export const UNMASKED_FIELDS = new Set(["client_address"]);

const PLACEHOLDER = /\{\{\s*([a-z][a-z0-9_]*)\s*\}\}/g;

/** Field keys in the order they first appear in the body. */
export function extractFields(body: string): string[] {
  const seen: string[] = [];
  for (const m of body.matchAll(PLACEHOLDER)) if (!seen.includes(m[1])) seen.push(m[1]);
  return seen;
}

export const todayHe = (d = new Date()): string =>
  `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}.${d.getFullYear()}`;

export const blankFor = (key: string): string => `[${FIELD_LABEL[key] ?? key}: להשלמה בקובץ המיוצא]`;

/** Fills every placeholder. A field left empty becomes a visible bracketed blank, never silent text. */
export function mergeTemplate(body: string, values: Record<string, string>): string {
  return body.replace(PLACEHOLDER, (_m, key: string) => {
    const v = (values[key] ?? "").trim();
    return v && !UNMASKED_FIELDS.has(key) ? v : blankFor(key);
  });
}

export interface PartyInput { role: "CLIENT" | "ADVERSE"; name?: string; idNumber?: string }

/** Declared parties for the shield and the conflict engine, taken from the field prefixes. */
export function partiesFrom(values: Record<string, string>): PartyInput[] {
  const pick = (role: PartyInput["role"], n: string, i: string): PartyInput | null => {
    const name = (values[n] ?? "").trim();
    const idNumber = (values[i] ?? "").trim();
    return name || idNumber ? { role, name: name || undefined, idNumber: idNumber || undefined } : null;
  };
  return [pick("CLIENT", "client_name", "client_id"), pick("ADVERSE", "counterparty_name", "counterparty_id")].filter((p): p is PartyInput => p !== null);
}

export const missingFields = (body: string, values: Record<string, string>): string[] =>
  extractFields(body).filter((k) => !UNMASKED_FIELDS.has(k) && !(values[k] ?? "").trim());
