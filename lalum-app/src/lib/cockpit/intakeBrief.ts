// The intake brief (owner, 31.10.2026, after a look at Lizzy and Nomos; learnt from them, not copied): right after a document
// enters a matter, three short screens say what the system understood, ask the few questions that decide what to analyse,
// and suggest the next steps by topic. Everything here is a pure function of the masked text and the playbook findings
// already stored with the document: nothing leaves the browser and nothing is written. Self-contained on purpose, so that
// scripts/intake-brief-check.mjs can transpile this one file and test the shipped code.

export interface BriefFinding { ruleId: string; ruleName: string; severity: string; fallbackClause?: string | null }
export interface BriefInput {
  /** The document text as stored, after PII masking. */
  text: string;
  practiceArea: string;
  docOrigin?: string | null;
  conflictStatus?: string | null;
  findings?: BriefFinding[];
}
export interface BriefMap { kind: string | null; words: number; parties: number; dates: string[]; deadlines: string[]; amounts: string[]; red: string[]; yellow: number; fallbacks: number }
export interface Option { id: string; label: string }
export interface Question { id: string; ask: string; why: string; context?: string; options: Option[] }
/** Question id to the id of the option picked. Closed answers only: free text would sit outside the PII shield. */
export type Answers = Record<string, string>;
export type Panel = "findings" | "template" | "kyc" | "conflict";
export type Action = { kind: "go"; to: string } | { kind: "panel"; panel: Panel } | { kind: "copy" };
export type Topic = "deadlines" | "drafting" | "checks" | "client";
export interface Step { id: string; topic: Topic; title: string; when: string; action: Action }

export const TOPICS: Array<[Topic, string]> = [["deadlines", "מועדים וסיכונים"], ["drafting", "ניסוח"], ["checks", "בדיקות ואימות"], ["client", "לקוח ותקשורת"]];
export const MAX_QUESTIONS = 6;
export const MAX_PER_TOPIC = 3;
const UNKNOWN: Option = { id: "unknown", label: "לא ידוע עדיין" };

// What the document is, read from its own words. The opening lines decide first (a claim that cites a judgment is still a claim).
const KINDS: Array<[RegExp, string]> = [
  [/כתב\s+תביעה/, "כתב תביעה"],
  [/כתב\s+הגנה/, "כתב הגנה"],
  [/מכתב\s+התראה|התראה\s+לפני\s+נקיטת/, "מכתב התראה"],
  [/פסק\s+דין/, "פסק דין"],
  [/פינוי[\s-]*בינוי/, "הסכם פינוי בינוי"],
  [/תמ["״]א\s*38/, 'הסכם תמ"א 38'],
  [/(?:הסכם|חוזה)\s+(?:מכר|למכירת)/, "הסכם מכר"],
  [/(?:הסכם|חוזה)\s+(?:שכירות|שכירת)/, "הסכם שכירות"],
  [/(?:הסכם|חוזה)\s+(?:העסקה|עבודה)/, "הסכם עבודה"],
  [/סודיות|\bNDA\b/, "הסכם סודיות"],
  [/מזכר\s+הבנות/, "מזכר הבנות"],
  [/י{1,2}פוי\s+כו?ח/, "ייפוי כוח"],
  [/צוואה/, "צוואה"],
  [/חוות\s+דעת/, "חוות דעת"],
  [/החלטה/, "החלטה"],
  [/הסכם|חוזה/, "הסכם"],
];

export function kindOf(text: string): string | null {
  for (const scope of [text.slice(0, 600), text]) for (const [re, label] of KINDS) if (re.test(scope)) return label;
  return null;
}

const uniq = (xs: string[], max: number): string[] => [...new Set(xs.map((x) => x.replace(/\s+/g, " ").trim()))].slice(0, max);
const MONTHS = "ינואר|פברואר|מרץ|מרס|אפריל|מאי|יוני|יולי|אוגוסט|ספטמבר|אוקטובר|נובמבר|דצמבר";

/** Calendar dates in the text, in order of appearance. Dotted dates need a four digit year, so clause numbers (5.1.10) are not read as dates. */
export function datesIn(text: string): string[] {
  const found: Array<[number, string]> = [];
  const ok = (d: number, m: number) => d >= 1 && d <= 31 && m >= 1 && m <= 12;
  for (const x of text.matchAll(/(?<!\d)(\d{1,2})([./])(\d{1,2})\2(\d{4}|\d{2})(?!\.?\d)/g)) {
    const [, d, sep, m, y] = x;
    if (sep === "." && y.length === 2) continue;
    if (ok(+d, +m)) found.push([x.index ?? 0, `${+d}.${+m}.${y.length === 2 ? `20${y}` : y}`]);
  }
  for (const x of text.matchAll(/(?<!\d)(\d{4})-(\d{2})-(\d{2})(?!\d)/g)) if (ok(+x[3], +x[2])) found.push([x.index ?? 0, `${+x[3]}.${+x[2]}.${x[1]}`]);
  for (const x of text.matchAll(new RegExp(`(?<!\\d)(\\d{1,2})\\s+[בל]?(${MONTHS})\\s*,?\\s*(\\d{4})`, "g"))) found.push([x.index ?? 0, `${+x[1]} ב${x[2]} ${x[3]}`]);
  return uniq(found.sort((a, b) => a[0] - b[0]).map((f) => f[1]), 4);
}

const COUNT = "\\d{1,3}|שבעה|שבע|עשרה|עשר|ארבעה עשר|חמישה עשר|עשרים ואחד|עשרים|שלושים|ארבעים וחמישה|ארבעים|שישים|תשעים";
const UNIT = "ימי עסקים|ימים|יום|שבועות|שבוע|חודשים|חודש|שנים|שנה";
/** Periods the text sets for acting ("תוך 30 ימים"), and a mention of limitation, which is a deadline even without a number. */
export function deadlinesIn(text: string): string[] {
  const out = [...text.matchAll(new RegExp(`(?:בתוך|תוך|לא יאוחר מ(?:תום)?|עד תום)\\s+(?:${COUNT})\\s+(?:${UNIT})`, "g"))].map((x) => x[0]);
  if (/התיישנות/.test(text)) out.push("אזכור של התיישנות");
  if (/מועד\s+אחרון/.test(text)) out.push("אזכור של מועד אחרון");
  return uniq(out, 3);
}

const NUM = "\\d{1,3}(?:,\\d{3})+(?:\\.\\d+)?|\\d+(?:\\.\\d+)?";
const CUR = 'ש["״]ח|ש\\.ח\\.?|שקלים(?:\\s+חדשים)?|NIS|ILS|דולר(?:ים)?|USD|יורו|EUR|₪|\\$|€';
/** Sums of money, symbol before or currency after, with "מיליון" or "אלף" between. */
export function amountsIn(text: string): string[] {
  const re = new RegExp(`(?:[₪$€]\\s?(?:${NUM})(?:\\s?(?:מיליון|אלף))?)|(?:(?<![\\d,.])(?:${NUM})\\s?(?:(?:מיליון|אלף)\\s?)?(?:${CUR}))`, "g");
  return uniq([...text.matchAll(re)].map((x) => x[0]), 3);
}

export function readMap(input: BriefInput): BriefMap {
  const f = input.findings ?? [];
  const red = f.filter((x) => x.severity === "RED");
  return {
    kind: kindOf(input.text),
    words: input.text.split(/\s+/).filter(Boolean).length,
    parties: new Set(input.text.match(/\[CLIENT_NAME_\d+\]/g) ?? []).size,
    dates: datesIn(input.text),
    deadlines: deadlinesIn(input.text),
    amounts: amountsIn(input.text),
    red: red.map((x) => x.ruleName),
    yellow: f.filter((x) => x.severity === "YELLOW").length,
    fallbacks: f.filter((x) => x.severity !== "GREEN" && x.fallbackClause).length,
  };
}

const opts = (pairs: Array<[string, string]>, unknown = true): Option[] => [...pairs.map(([id, label]) => ({ id, label })), ...(unknown && !pairs.some(([id]) => id === "unknown") ? [UNKNOWN] : [])];

const SIDES: Record<string, Array<[string, string]>> = {
  REAL_ESTATE: [["buyer", "קונה"], ["seller", "מוכר"], ["developer", "יזם"], ["owners", "בעלי דירות"], ["tenant", "שוכר"], ["landlord", "משכיר"]],
  COMMERCIAL_MA: [["buyer", "רוכש"], ["seller", "מוכר"], ["investor", "משקיע"], ["company", "החברה"]],
  LABOR_LAW: [["employee", "עובד"], ["employer", "מעסיק"]],
  AI_GOVERNANCE: [["vendor", "ספק המערכת"], ["deployer", "הארגון שמטמיע"], ["users", "המשתמשים"]],
  LITIGATION: [["plaintiff", "תובע"], ["defendant", "נתבע"], ["third", "צד שלישי"]],
};

// One question per area about the material that is usually missing at intake.
const AREA_Q: Record<string, Question> = {
  REAL_ESTATE: { id: "tabu", ask: "יש נסח טאבו עדכני לנכס?", why: "בלי נסח אי אפשר לבדוק בעלות, משכנתאות והערות אזהרה.", options: opts([["have", "כן, יצורף לתיק"], ["need", "צריך להוציא"], ["na", "לא רלוונטי"]]) },
  LITIGATION: { id: "court", ask: "נקבעו כבר מועדים בבית המשפט?", why: "מועד שיפוטי גובר על כל תכנון אחר בתיק.", options: opts([["hearing", "יש דיון קבוע"], ["filing", "יש מועד להגשה"], ["none", "עוד לא נקבעו"]]) },
  LABOR_LAW: { id: "employed", ask: "העובד עדיין מועסק?", why: "זה קובע אם מדובר בשימוע, בגמר חשבון או בתביעה.", options: opts([["yes", "כן"], ["dismissal", "בתהליך פיטורים"], ["ended", "ההעסקה הסתיימה"]]) },
  COMMERCIAL_MA: { id: "dd", ask: "נעשתה בדיקת נאותות?", why: "ההצהרות והשיפויים בהסכם נבנים על מה שנבדק.", options: opts([["done", "כן, הושלמה"], ["partial", "חלקית"], ["none", "עוד לא"], ["na", "לא רלוונטי"]]) },
  AI_GOVERNANCE: { id: "ai_stage", ask: "באיזה שלב נמצאת מערכת ה-AI?", why: "החובות שונות לפני ההפעלה ואחריה.", options: opts([["plan", "תכנון"], ["pilot", "פיילוט"], ["live", "בשימוש מלא"]]) },
};

/** The questions worth asking for this document, most decisive first, at most MAX_QUESTIONS. */
export function questionsFor(input: BriefInput, map: BriefMap): Question[] {
  const qs: Question[] = [
    { id: "goal", ask: "מה הלקוח רוצה להשיג?", why: "המטרה קובעת מה מנתחים: סיכון, מינוף או לוחות זמנים.", options: opts([["deal", "לסגור עסקה"], ["defend", "להתגונן מדרישה או תביעה"], ["claim", "לדרוש או לתבוע"], ["opinion", "לקבל חוות דעת"], ["settle", "להגיע להסדר"]]) },
    { id: "side", ask: "את מי אנחנו מייצגים?", why: "אותו סעיף טוב לצד אחד ורע לצד השני.", options: opts(SIDES[input.practiceArea] ?? [["initiator", "הצד היוזם"], ["responder", "הצד המגיב"]]) },
    { id: "stage", ask: "איפה הדברים עומדים היום?", why: "לפני חתימה מתקנים נוסח, אחרי חתימה מנהלים סיכון.", options: opts([["draft", "טיוטה ראשונה"], ["negotiation", "משא ומתן"], ["signed", "כבר נחתם"], ["dispute", "יש מחלוקת"], ["court", "בהליך משפטי"]]) },
  ];
  const seen = [...map.deadlines, ...map.dates];
  qs.push({ id: "deadline", ask: "יש מועד שחייבים לעמוד בו?", why: "מועד שמוחמץ הוא הסיכון היקר ביותר בתיק.", context: seen.length ? `מצאנו בטקסט: ${seen.slice(0, 3).join(", ")}` : undefined, options: opts([["week", "כן, השבוע"], ["month", "כן, החודש"], ["later", "כן, בהמשך"], ["none", "אין מועד דחוף"]]) });
  if (map.red.length) qs.push({ id: "red", ask: `הסעיף "${map.red[0]}" סומן בסיכון גבוה. הלקוח כבר חתום עליו?`, why: "אם עוד לא נחתם מציעים נוסח חלופי, ואם נחתם בונים הגנה.", options: opts([["unsigned", "עוד לא נחתם"], ["signed", "כבר נחתם"], ["na", "לא רלוונטי ללקוח"]]) });
  if (input.docOrigin === "ADVERSE") qs.push({ id: "ask", ask: "המסמך הגיע מהצד שכנגד. מה מבקשים מאיתנו?", why: "כך יודעים אם לנסח, להשיב או רק לנתח.", options: opts([["comments", "הערות לנוסח"], ["reply", "מכתב תגובה"], ["opinion", "חוות דעת ללקוח"], ["file", "רק לתייק"]]) });
  if (map.amounts.length) qs.push({ id: "amount", ask: `הסכום ${map.amounts[0]} הוא הסכום המרכזי בתיק?`, why: "הסכום משפיע על החשיפה ועל היקף הטיפול.", options: opts([["yes", "כן"], ["other", "יש סכום אחר"], ["none", "אין סכום במחלוקת"]]) });
  const area = AREA_Q[input.practiceArea];
  if (area) qs.push(area);
  // Without a date in the text the deadline question still matters, but less than what the document itself raised.
  if (!seen.length) qs.push(...qs.splice(qs.findIndex((q) => q.id === "deadline"), 1));
  return qs.slice(0, MAX_QUESTIONS);
}

/** Suggested next steps, grouped by topic, at most MAX_PER_TOPIC in each. Every step opens a screen or panel that already exists. */
export function stepsFor(input: BriefInput, map: BriefMap, a: Answers, matterId: string): Step[] {
  const s: Step[] = [];
  const add = (topic: Topic, id: string, title: string, when: string, action: Action) => { if (!s.some((x) => x.id === id) && s.filter((x) => x.topic === topic).length < MAX_PER_TOPIC) s.push({ id, topic, title, when, action }); };
  const m360: Action = { kind: "go", to: `/workspace/matter-360?matter=${matterId}` };
  const risky = map.red.length + map.yellow;
  if (risky) add("deadlines", "findings", `מעבר על ${risky} ממצאים`, "השתמשו כדי לעבור על מה שסומן בסיכון, ממצא אחר ממצא.", { kind: "panel", panel: "findings" });
  if (a.deadline === "week" || a.court === "hearing" || a.court === "filing") add("deadlines", "deadline", "רישום המועד בתיק 360 עכשיו", "יש מועד קרוב: רושמים אותו כדי שיופיע ביומן ובתזכורות.", m360);
  else if (a.deadline === "month" || a.deadline === "later" || map.dates.length || map.deadlines.length) add("deadlines", "deadline", "רישום מועד בתיק 360", "השתמשו כשיש מועד שאסור לפספס.", m360);
  if (a.employed === "dismissal") add("deadlines", "hearing", "משימה: זימון לשימוע", "פיטורים בלי שימוע כדין חושפים את המעסיק.", { kind: "go", to: "/workspace/tasks" });

  if (map.fallbacks && a.red !== "signed" && a.stage !== "signed") add("drafting", "fallback", "הוספת סעיף חלופי", "השתמשו כשהמסמך עוד לא נחתם ויש לממצא נוסח חלופי מוכן.", { kind: "panel", panel: "findings" });
  if (a.ask === "reply") add("drafting", "reply", "מכתב תגובה מתבנית", "השתמשו כדי לנסח תגובה לצד שכנגד מנתוני התיק.", { kind: "panel", panel: "template" });
  else if (a.goal === "claim") add("drafting", "demand", "מכתב התראה מתבנית", "השתמשו לפני נקיטת הליכים, כדי לפתוח בדרישה מסודרת.", { kind: "panel", panel: "template" });
  else add("drafting", "template", "יצירת מסמך מתבנית", "השתמשו כשצריך הסכם, נספח או מכתב שנבנה מנתוני התיק.", { kind: "panel", panel: "template" });

  if (input.conflictStatus && input.conflictStatus !== "CLEAN") add("checks", "conflict", "השלמת בדיקת ניגוד עניינים", "התיק סומן לבדיקה. משלימים אותה לפני עבודה מהותית.", { kind: "panel", panel: "conflict" });
  add("checks", "kyc", "הכרת הלקוח (KYC)", "השתמשו בפתיחת תיק ללקוח חדש, לפני קבלת כספים.", { kind: "panel", panel: "kyc" });
  if (a.tabu === "need") add("checks", "tabu", "משימה: להוציא נסח טאבו", "נסח עדכני נדרש לבדיקת בעלות, שעבודים והערות אזהרה.", { kind: "go", to: "/workspace/tasks" });
  if (a.dd === "partial" || a.dd === "none") add("checks", "dd", "משימה: להשלים בדיקת נאותות", "ההצהרות בהסכם צריכות לשקף את מה שנבדק בפועל.", { kind: "go", to: "/workspace/tasks" });

  const open = ["goal", "side"].some((k) => !a[k] || a[k] === "unknown") || a.stage === "dispute";
  if (open) add("client", "meet", "פגישה עם הלקוח", "נשארו שאלות שרק הלקוח יכול לענות עליהן.", { kind: "go", to: "/workspace/scheduling" });
  add("client", "task", "משימה לצוות", "השתמשו כדי לחלק את העבודה בתיק עם אחראי ומועד.", { kind: "go", to: "/workspace/tasks" });
  add("client", "copy", "העתקת סיכום הקליטה", "השתמשו כדי להדביק את התמונה במייל או בהערה לתיק.", { kind: "copy" });
  return s;
}

/** A plain text summary of the brief and the answers given, for the clipboard. Labels come from the caller, which owns the display names. */
export function briefText(labels: { area: string; type: string | null; file: string }, map: BriefMap, qs: Question[], a: Answers): string {
  const line = (k: string, v: string | null | undefined) => (v ? `${k}: ${v}` : null);
  const head = [
    "תדריך קליטה",
    line("מסמך", labels.file),
    line("סוג", [labels.type, map.kind].filter(Boolean).join(", ")),
    line("תחום", labels.area),
    line("מועדים שנמצאו", [...map.deadlines, ...map.dates].join(", ")),
    line("סכומים שנמצאו", map.amounts.join(", ")),
    `ממצאים: ${map.red.length} בסיכון גבוה, ${map.yellow} לזהירות`,
  ];
  const answered = qs.filter((q) => a[q.id]).map((q) => `• ${q.ask} ${q.options.find((o) => o.id === a[q.id])?.label ?? ""}`);
  return [...head.filter(Boolean), "", answered.length ? "תשובות:" : "עוד לא נענו שאלות.", ...answered].join("\n");
}
