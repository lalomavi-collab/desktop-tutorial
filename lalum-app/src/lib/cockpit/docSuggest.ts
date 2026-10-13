// Suggests a document type (a key of DOC_TYPE) from where a file sits inside a matter folder: the file name first, then
// its sub folders from the nearest outwards. It only suggests when a keyword matches; otherwise it returns null and the
// partner's single answer for the import applies. A suggestion is a convenience, never a decision: it is shown before the
// import and every document can be reclassified inside the matter.
// Two passes. Specific keywords are tried first, over the file name and then every folder from the nearest outwards, so an
// annex inside a folder of agreements is a contract document and a letter inside it is still a letter. The generic word
// "annex" decides only when nothing more specific matched anywhere in the path.
const RULES: Array<[string, RegExp]> = [
  ["OPINION", /חוות[\s_-]?דעת|חו"ד|שמאות|שמאי|opinion/i],
  ["COURT_FILING", /כתב[\s_-]?(תביעה|הגנה|טענות|בי[\s_-]?דין)|תצהיר|בקשה|החלטה|החלטות|פסק[\s_-]?דין|פס"ד|ערעור|בית[\s_-]?משפט|בימ"ש|תביעה|court/i],
  ["CONTRACT", /חוזה|חוזים|הסכם(?!ה)|הסכמים|מזכר[\s_-]?הבנות|ייפוי[\s_-]?כוח|contract|agreement|nda/i],
  ["AUTHORITY", /רשות|עירי|ועדה|מס[\s_-]?הכנסה|מיסוי|טאבו|נסח|רישום[\s_-]?מקרקעין|רמ"י|היתר|תב"ע/i],
  ["CORRESPONDENCE", /מכתב|התכתבות|דוא"ל|אימייל|מייל|הודעה|הודעות|וואטסאפ|email|e-mail|whatsapp/i],
  ["EVIDENCE", /ראיה|ראיות|תמונות|צילום|קבלה|חשבונית|אסמכת/i],
];
const WEAK: Array<[string, RegExp]> = [["EVIDENCE", /נספח|נספחים/]];

export function suggestDocType(path: string): string | null {
  const parts = path.split("/").filter(Boolean);
  if (!parts.length) return null;
  const file = parts[parts.length - 1].replace(/\.[^.]+$/, "");
  const order = [file, ...parts.slice(0, -1).reverse()];
  for (const rules of [RULES, WEAK]) for (const seg of order) for (const [type, re] of rules) if (re.test(seg)) return type;
  return null;
}

// First sub folder of a file inside the matter, or null for a file at the matter's top level.
export function subjectOf(path: string): string | null {
  const i = path.indexOf("/");
  return i > 0 ? path.slice(0, i) : null;
}
