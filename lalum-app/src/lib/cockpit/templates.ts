// Template merge for the case cockpit. A template body carries placeholders; the form fills them in
// the browser and the merged text goes through the ordinary upload route, so the PII shield, the
// conflict check and the playbook run on it exactly as on any uploaded document. The merged text
// with real names exists only in this browser session (see originals.ts).
//
// Template language
//   {{field}}                      a value typed by the user
//   {{#if field}} ... {{/if}}      shown when the field is yes
//   {{#if field=value}} ... {{else}} ... {{/if}}      also field!=value; blocks may nest
//   {{@party:m|f|mp|fp}}           a word that agrees with the party's gender and number: masculine
//                                  singular, feminine singular, masculine plural, feminine plural.
//                                  The last form may be omitted and falls back to the masculine plural.
//   The party is the prefix of its fields: client has client_gender (m or f) and client_number (s or p).
//
// A condition field left unset blocks generation: silently taking the else branch would put the
// wrong clause into a legal document. A gender or number left unset stays a visible bracket.

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
export const PARTY_LABEL: Record<string, string> = { client: "הלקוח", counterparty: "הצד שכנגד" };

/** Fields the PII shield has no detector for. They never reach the server: the document keeps a
 *  visible blank and the attorney fills the value into the exported file. */
export const UNMASKED_FIELDS = new Set(["client_address"]);

export class TemplateError extends Error {}

type Node =
  | { t: "text"; v: string }
  | { t: "field"; key: string }
  | { t: "agree"; party: string; forms: string[] }
  | { t: "if"; key: string; op: "truthy" | "eq" | "ne"; val: string; yes: Node[]; no: Node[] };

const TAG = /\{\{\s*([^{}]+?)\s*\}\}/g;
const FIELD_KEY = /^[a-z][a-z0-9_]*$/;
const YES = "yes";

export function parse(body: string): Node[] {
  const root: Node[] = [];
  const stack: Array<{ node: Extract<Node, { t: "if" }>; inElse: boolean }> = [];
  const into = (): Node[] => (stack.length ? (stack[stack.length - 1].inElse ? stack[stack.length - 1].node.no : stack[stack.length - 1].node.yes) : root);
  let last = 0;
  for (const m of body.matchAll(TAG)) {
    if (m.index > last) into().push({ t: "text", v: body.slice(last, m.index) });
    last = m.index + m[0].length;
    const tag = m[1];
    if (tag.startsWith("#if ")) {
      const c = /^([a-z][a-z0-9_]*)\s*(?:(!?=)\s*(.+))?$/.exec(tag.slice(4).trim());
      if (!c) throw new TemplateError(`תנאי לא תקין: ${tag}`);
      const node: Extract<Node, { t: "if" }> = { t: "if", key: c[1], op: !c[2] ? "truthy" : c[2] === "=" ? "eq" : "ne", val: (c[3] ?? "").trim(), yes: [], no: [] };
      into().push(node);
      stack.push({ node, inElse: false });
    } else if (tag === "else") {
      const top = stack[stack.length - 1];
      if (!top || top.inElse) throw new TemplateError("else ללא תנאי פתוח");
      top.inElse = true;
    } else if (tag === "/if") {
      if (!stack.pop()) throw new TemplateError("סגירת תנאי ללא פתיחה");
    } else if (tag.startsWith("@")) {
      const a = /^@([a-z][a-z0-9_]*)\s*:\s*(.+)$/.exec(tag);
      const forms = a ? a[2].split("|").map((x) => x.trim()) : [];
      if (!a || forms.length < 3 || forms.length > 4 || forms.some((f) => !f)) throw new TemplateError(`הטיה לא תקינה: ${tag}`);
      into().push({ t: "agree", party: a[1], forms });
    } else if (FIELD_KEY.test(tag)) {
      into().push({ t: "field", key: tag });
    } else {
      throw new TemplateError(`שדה לא תקין: ${tag}`);
    }
  }
  if (last < body.length) into().push({ t: "text", v: body.slice(last) });
  if (stack.length) throw new TemplateError("תנאי שלא נסגר");
  return root;
}

const holds = (n: Extract<Node, { t: "if" }>, values: Record<string, string>): boolean => {
  const v = (values[n.key] ?? "").trim();
  return n.op === "truthy" ? v === YES : n.op === "eq" ? v === n.val : v !== "" && v !== n.val;
};

export type FieldSpec =
  | { key: string; kind: "text" }
  | { key: string; kind: "bool" }
  | { key: string; kind: "choice"; options: string[] }
  | { key: string; kind: "gender" | "number" };

/** Options a condition field can take: every value it is compared with anywhere in the body. */
function optionsOf(nodes: Node[], out = new Map<string, Set<string>>(), bare = new Set<string>()): { opts: Map<string, Set<string>>; bare: Set<string> } {
  for (const n of nodes) {
    if (n.t !== "if") continue;
    if (n.op === "truthy") bare.add(n.key);
    else (out.get(n.key) ?? out.set(n.key, new Set()).get(n.key)!).add(n.val);
    optionsOf(n.yes, out, bare);
    optionsOf(n.no, out, bare);
  }
  return { opts: out, bare };
}

/** The fields that matter for the current answers: conditions first, then only what the active
 *  branches use, in order of first appearance. */
export function activeFields(body: string, values: Record<string, string>): FieldSpec[] {
  const tree = parse(body);
  const { opts, bare } = optionsOf(tree);
  const specs = new Map<string, FieldSpec>();
  const add = (s: FieldSpec) => { if (!specs.has(s.key)) specs.set(s.key, s); };
  const spec = (key: string): FieldSpec => bare.has(key) ? { key, kind: "bool" } : opts.has(key) ? { key, kind: "choice", options: [...opts.get(key)!] } : { key, kind: "text" };
  const walk = (nodes: Node[]) => {
    for (const n of nodes) {
      if (n.t === "field") add(spec(n.key));
      else if (n.t === "agree") { add({ key: `${n.party}_gender`, kind: "gender" }); add({ key: `${n.party}_number`, kind: "number" }); }
      else if (n.t === "if") { add(spec(n.key)); walk(holds(n, values) ? n.yes : n.no); }
    }
  };
  walk(tree);
  return [...specs.values()];
}

const pick = (forms: string[], gender: string, number: string): string => {
  const plural = number === "p";
  return plural ? (gender === "f" && forms[3] ? forms[3] : forms[2]) : gender === "f" ? forms[1] : forms[0];
};

export const todayHe = (d = new Date()): string =>
  `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}.${d.getFullYear()}`;

export const blankFor = (key: string): string => `[${FIELD_LABEL[key] ?? key}: להשלמה בקובץ המיוצא]`;

/** Fills the template. A field left empty becomes a visible bracketed blank, never silent text. */
export function mergeTemplate(body: string, values: Record<string, string>): string {
  const render = (nodes: Node[]): string => nodes.map((n) => {
    if (n.t === "text") return n.v;
    if (n.t === "field") { const v = (values[n.key] ?? "").trim(); return v && !UNMASKED_FIELDS.has(n.key) ? v : blankFor(n.key); }
    if (n.t === "agree") {
      const g = values[`${n.party}_gender`], num = values[`${n.party}_number`];
      return g && num ? pick(n.forms, g, num) : `[${PARTY_LABEL[n.party] ?? n.party}: בחרו מין ומספר]`;
    }
    return render(holds(n, values) ? n.yes : n.no);
  }).join("");
  return render(parse(body));
}

/** Answers that must be given before generating: conditions, genders and numbers. */
export const blockingFields = (body: string, values: Record<string, string>): FieldSpec[] =>
  activeFields(body, values).filter((s) => s.kind !== "text" && !(values[s.key] ?? "").trim());

/** Text fields left empty: allowed, they show as a bracketed blank. */
export const blankFields = (body: string, values: Record<string, string>): string[] =>
  activeFields(body, values).filter((s) => s.kind === "text" && !UNMASKED_FIELDS.has(s.key) && !(values[s.key] ?? "").trim()).map((s) => s.key);

export interface PartyInput { role: "CLIENT" | "ADVERSE"; name?: string; idNumber?: string }

/** Declared parties for the shield and the conflict engine, taken from the field prefixes. */
export function partiesFrom(values: Record<string, string>): PartyInput[] {
  const pickParty = (role: PartyInput["role"], n: string, i: string): PartyInput | null => {
    const name = (values[n] ?? "").trim();
    const idNumber = (values[i] ?? "").trim();
    return name || idNumber ? { role, name: name || undefined, idNumber: idNumber || undefined } : null;
  };
  return [pickParty("CLIENT", "client_name", "client_id"), pickParty("ADVERSE", "counterparty_name", "counterparty_id")].filter((p): p is PartyInput => p !== null);
}

export const GENDER_LABEL: Record<string, string> = { m: "זכר (או קבוצה מעורבת)", f: "נקבה" };
export const NUMBER_LABEL: Record<string, string> = { s: "יחיד", p: "רבים" };
export const YES_LABEL = YES;
