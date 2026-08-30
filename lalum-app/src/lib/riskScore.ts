// Scoring model for the Tech-Legal readiness self-assessment.
//
// Two deliberate departures from the draft this replaces:
//
// 1. Industry selects the TRACK, it does not score. The draft gave real estate
//    25 of 85 possible points for being real estate, so a well governed real
//    estate firm answering the two best answers still landed at 35 and was told
//    its exposure was "medium". It could never reach "low" however well run it
//    was. Being in an industry is not a risk practice. Only practices score.
//
// 2. It measures readiness from a described scenario, and says so. It does not
//    audit a contract, and nothing is uploaded. A public result that implies a
//    completed legal audit is a claim a licensed practice should not make, and
//    inviting people to paste real contracts into a web page is worse.

export type TrackId = "tech" | "legal" | "realestate";
export type BandId = "low" | "medium" | "high";

export type Track = { id: TrackId; label: string; blurb: string };

export const TRACKS: Track[] = [
  { id: "tech", label: `חברת טכנולוגיה שמפתחת או משלבת מערכות AI`, blurb: `פיתוח והטמעה של בינה מלאכותית` },
  { id: "legal", label: `משרד עורכי דין או שירותים מקצועיים שמטמיע כלי AI`, blurb: `עבודה משפטית בסיוע בינה מלאכותית` },
  { id: "realestate", label: `חברת נדל"ן, יזמות או התחדשות עירונית`, blurb: `עסקאות נדל"ן והתחדשות עירונית` },
];

export type Choice = { text: string; points: number };
// `track` marks a question as belonging to one path only. A question without
// it is asked of everyone.
export type Question = { id: string; area: string; track?: TrackId; question: string; choices: Choice[] };

// Six questions everyone answers, then two that belong to the track. Each is
// scored 0 to 3, so every path runs on the same 0 to 24 scale and the results
// stay comparable.
//
// Every question asks about practice, not intent. "Do you have a policy" is
// answered yes by almost everyone; "is it enforced and reviewed" is not.
export const QUESTIONS: Question[] = [
  {
    id: "governance",
    area: `ממשל ומדיניות`,
    question: `איך מנוהלת אצלכם החשיפה לבינה מלאכותית ולדליפת מידע?`,
    choices: [
      { text: `יש מדיניות כתובה, סביבה מאובטחת, ובדיקה תקופתית מתועדת`, points: 0 },
      { text: `יש מדיניות, אך היא לא נאכפת ולא נבדקת בפועל`, points: 2 },
      { text: `אין מדיניות, והעובדים משתמשים בכלים ציבוריים לפי שיקול דעתם`, points: 3 },
    ],
  },
  {
    id: "review",
    area: `בקרה לפני חתימה`,
    question: `איך נבדקים חוזים, מסמכים והחלטות מהותיות לפני חתימה?`,
    choices: [
      { text: `בדיקה אנושית מובנית, ובנוסף שכבת ביקורת בלתי תלויה`, points: 0 },
      { text: `בדיקה אנושית בלבד, ללא ביקורת חיצונית`, points: 2 },
      { text: `אוטומציה או בדיקה חלקית, בלי פיקוח מוגדר ובלי תיעוד`, points: 3 },
    ],
  },
  {
    id: "accountability",
    area: `תיעוד החלטות`,
    question: `אם יתגלה כשל, האם תוכלו להראות מי החליט, על סמך מה, ומתי?`,
    choices: [
      { text: `כן, יש תיעוד החלטות שניתן להציג לרגולטור, לדירקטוריון או לבית משפט`, points: 0 },
      { text: `חלקית, התיעוד מפוזר ותלוי באנשים מסוימים`, points: 2 },
      { text: `לא, אין תיעוד מסודר של שרשרת ההחלטות`, points: 3 },
    ],
  },
  {
    id: "data",
    area: `מידע וסודיות`,
    question: `מה קורה למידע שאתם מזינים לכלים חיצוניים?`,
    choices: [
      { text: `סביבה ייעודית או הסכם שמונע אימון על המידע שלנו, עם מדיניות שמירה מוגדרת`, points: 0 },
      { text: `יש הסכם מול הספק, אבל לא בדקנו מה נשמר ולכמה זמן`, points: 2 },
      { text: `משתמשים בכלים ציבוריים, ולא ידוע מה נעשה עם המידע`, points: 3 },
    ],
  },
  {
    id: "vendors",
    area: `אחריות מול ספקים`,
    question: `מי נושא באחריות כשהכלי או הספק טועה?`,
    choices: [
      { text: `החוזה מול הספק מגדיר אחריות, שיפוי וזכות ביקורת`, points: 0 },
      { text: `יש חוזה סטנדרטי של הספק, שלא נבדק מול הסיכון שלנו`, points: 2 },
      { text: `אין התייחסות חוזית לאחריות על תוצרי המערכת`, points: 3 },
    ],
  },
  {
    id: "people",
    area: `הרשאות והכשרה`,
    question: `מי בארגון רשאי להשתמש בכלים האלה, ומי הוכשר לכך?`,
    choices: [
      { text: `ההרשאות מוגדרות לפי תפקיד, והייתה הכשרה מתועדת`, points: 0 },
      { text: `אין הגבלה מסודרת, אבל דובר על זה בעל פה`, points: 2 },
      { text: `כל אחד משתמש במה שהוא מוצא, בלי הרשאה ובלי הכשרה`, points: 3 },
    ],
  },

  // Technology
  {
    id: "classification",
    area: `סיווג רגולטורי`,
    track: "tech",
    question: `האם סיווגתם את המערכות שלכם מול דרגות הסיכון של ה-EU AI Act?`,
    choices: [
      { text: `כן, לכל מערכת יש סיווג מתועד, וגם מיפוי של חובות GPAI`, points: 0 },
      { text: `התחלנו, אבל הסיווג אינו מלא ואינו מתועד`, points: 2 },
      { text: `לא ביצענו סיווג`, points: 3 },
    ],
  },
  {
    id: "trainingData",
    area: `זכויות בנתונים`,
    track: "tech",
    question: `מה מקור הנתונים שעליהם אתם מאמנים או שאתם מזינים, ואילו זכויות יש בהם?`,
    choices: [
      { text: `לכל מערך נתונים יש מקור מתועד, עם בדיקת זכויות ורישוי`, points: 0 },
      { text: `רוב המקורות ידועים, בלי בדיקת זכויות מסודרת`, points: 2 },
      { text: `לא מיפינו מקורות וזכויות`, points: 3 },
    ],
  },

  // Professional services
  {
    id: "privilege",
    area: `חיסיון לקוח`,
    track: "legal",
    question: `איך נשמר חיסיון עורך דין לקוח כשמשתמשים בכלי AI?`,
    choices: [
      { text: `סביבה סגורה או ספק בהסכם ייעודי, ואיסור מפורש על כלים ציבוריים`, points: 0 },
      { text: `יש הנחיה לא להעלות מידע מזהה, בלי אכיפה טכנית`, points: 2 },
      { text: `אין הבחנה, ומעלים חומרי לקוח לכלים ציבוריים`, points: 3 },
    ],
  },
  {
    id: "verification",
    area: `אימות הפלט`,
    track: "legal",
    question: `איך נבדקת נכונות הפלט לפני שהוא יוצא ללקוח או לבית משפט?`,
    choices: [
      { text: `כל אסמכתא וציטוט נבדקים מול המקור, ויש תיעוד של הבדיקה`, points: 0 },
      { text: `עורך הדין קורא ומתקן, בלי בדיקה שיטתית של האסמכתאות`, points: 2 },
      { text: `הפלט משמש כמעט כפי שהוא`, points: 3 },
    ],
  },

  // Real estate and urban renewal
  {
    id: "guarantees",
    area: `בטוחות ומנגנוני איחור`,
    track: "realestate",
    question: `איך נבדקות הבטוחות ומנגנוני האיחור בהסכם מול היזם?`,
    choices: [
      { text: `בדיקה ייעודית של בטוחות, ערבויות ופיצוי מוסכם, לפני חתימה`, points: 0 },
      { text: `נבדק בקריאה כללית של ההסכם`, points: 2 },
      { text: `הסתמכנו על הנוסח שהיזם הביא`, points: 3 },
    ],
  },
  {
    id: "representation",
    area: `ייצוג עצמאי`,
    track: "realestate",
    question: `מי מייצג את בעלי הזכויות, ומי משלם לעורך הדין?`,
    choices: [
      { text: `ייצוג עצמאי שנבחר על ידי בעלי הזכויות, בלי תלות ביזם`, points: 0 },
      { text: `עורך דין שהיזם הציע, עם בדיקה חלקית מטעמנו`, points: 2 },
      { text: `עורך הדין מטעם היזם מטפל בכולם`, points: 3 },
    ],
  },
];

// The eight questions a given track answers, in order: the shared six, then
// the two that belong to it.
export function questionsFor(track: TrackId): Question[] {
  return [...QUESTIONS.filter((q) => !q.track), ...QUESTIONS.filter((q) => q.track === track)];
}

export const QUESTIONS_PER_TRACK = 8;

export const MAX_SCORE = QUESTIONS_PER_TRACK * 3;

export function bandFor(score: number): BandId {
  // Thirds of the 0 to 24 scale, so a band means the same thing on every track.
  if (score <= 6) return "low";
  if (score <= 14) return "medium";
  return "high";
}

// The area a visitor scored worst on. The total says how exposed they are; this
// says where, which is the part worth a conversation. Ties resolve to the first
// question asked, so the shared governance questions come before the
// track-specific ones.
export function topGap(track: TrackId, answers: number[]): string | null {
  const qs = questionsFor(track);
  let best = -1;
  let at = -1;
  answers.forEach((points, i) => {
    if (points > best) { best = points; at = i; }
  });
  return best > 0 && qs[at] ? qs[at].area : null;
}

export type Band = { id: BandId; title: string; tone: "ok" | "warn" | "risk"; body: string; next: string };

// Result copy per track and band. Each is specific to the track, because
// "exposure" means a different thing to a developer, a firm and a builder.
const RESULTS: Record<TrackId, Record<BandId, Band>> = {
  tech: {
    low: { id: "low", tone: "ok", title: `מוכנות גבוהה`, body: `הפרקטיקות שתיארתם מצביעות על ממשל מסודר סביב פיתוח והטמעה של בינה מלאכותית. הפער העיקרי שנותר הוא קצב הרגולציה: EU AI Act ממשיך להתפתח, וממשל שאינו מנוטר מתיישן.`, next: `בדיקה תקופתית קצרה תשמור על הפער סגור.` },
    medium: { id: "medium", tone: "warn", title: `מוכנות חלקית`, body: `יש אצלכם בסיס, אבל חסרה שכבת אכיפה או תיעוד. בפיתוח מבוסס AI הפער הזה מתבטא בדרך כלל בשלושה מקומות: סיווג סיכון של המערכת, זכויות בנתוני האימון, והקצאת האחריות בחוזה מול הספק.`, next: `מיפוי ממוקד יזהה אילו משלושת הפערים רלוונטי אליכם.` },
    high: { id: "high", tone: "risk", title: `מוכנות נמוכה`, body: `לפי מה שתיארתם אין כרגע בקרה מתועדת על השימוש בבינה מלאכותית. בחברת טכנולוגיה זו חשיפה כפולה: מול רגולטור שבודק ציות, ומול לקוח או משקיע שבודק נאותות.`, next: `כדאי להתחיל במיפוי חשיפה לפני ההתקשרות הבאה.` },
  },
  legal: {
    low: { id: "low", tone: "ok", title: `מוכנות גבוהה`, body: `הפרקטיקות שתיארתם עומדות בעקרון אדם בתוך הלולאה, שהוא הבסיס להגנתיות של עבודה משפטית בסיוע בינה מלאכותית. התיעוד הוא מה שהופך את זה לבר-הגנה בדיעבד.`, next: `בדיקה תקופתית תוודא שהנוהל נשמר גם בלחץ.` },
    medium: { id: "medium", tone: "warn", title: `מוכנות חלקית`, body: `הפער הנפוץ במשרדים הוא Shadow IT: שימוש בכלים חינמיים ללא מדיניות, שעלול לפגוע בחיסיון עורך דין לקוח. גם כשהעבודה עצמה איכותית, היעדר תיעוד מקשה להוכיח זאת.`, next: `רשימת בדיקה לספק ומדיניות שימוש סוגרות את רוב הפער.` },
    high: { id: "high", tone: "risk", title: `מוכנות נמוכה`, body: `שימוש חופשי בכלים ציבוריים ללא מדיניות חושף מידע של לקוחות ומעמיד את החיסיון בסיכון. בעבודה משפטית זו אינה חשיפה תיאורטית אלא סיכון אתי ומקצועי ישיר.`, next: `מדיניות שימוש וסביבה מאובטחת הן הצעד הראשון.` },
  },
  realestate: {
    low: { id: "low", tone: "ok", title: `מוכנות גבוהה`, body: `תיארתם בדיקה מסודרת עם שכבת ביקורת בלתי תלויה, שהיא בדיוק מה שמונע את הכשלים היקרים בעסקאות ובפרויקטי התחדשות עירונית.`, next: `בעסקה הבאה, בדיקה חיצונית לפני חתימה תשמור על אותו סטנדרט.` },
    medium: { id: "medium", tone: "warn", title: `מוכנות חלקית`, body: `בדיקה אנושית בלבד, בלי עין חיצונית, מפספסת בדרך כלל את אותן נקודות עיוורון: בטוחות, מנגנוני איחור, ושוויון תמורות בין בעלי הדירות. אלה סעיפים שמתגלים מאוחר ועולים ביוקר.`, next: `חוות דעת שנייה לפני חתימה ממפה את הפערים בזמן.` },
    high: { id: "high", tone: "risk", title: `מוכנות נמוכה`, body: `בעסקאות נדל"ן ובהתחדשות עירונית, היעדר בדיקה מובנית ותיעוד החלטות הוא הסיכון היקר ביותר. טעות חוזית אחת בהסכם יזם משפיעה על שנים קדימה ועל מאות בעלי זכויות.`, next: `בדיקה בלתי תלויה של נוסח ההסכם היא הצעד הדחוף.` },
  },
};

export function resultFor(track: TrackId, band: BandId): Band {
  return RESULTS[track][band];
}

export const BANDS: BandId[] = ["low", "medium", "high"];

// The shareable result page for a track and band. Each is prerendered with its
// own metadata and its own preview image, because LinkedIn reads Open Graph
// tags from the raw HTML of the shared URL and never runs the page's
// JavaScript. A share pointing at the site root, with the text passed as a
// query parameter, shows the generic site card: LinkedIn dropped the `summary`
// parameter years ago.
export function resultPath(track: TrackId, band: BandId): string {
  return `/risk/${track}/${band}`;
}

export function shareText(track: TrackId, band: BandId, score: number): string {
  const t = TRACKS.find((x) => x.id === track)!;
  const r = resultFor(track, band);
  return `בדקתי את מוכנות הארגון שלי מול ${MAX_SCORE} נקודות חשיפה בתחום ${t.blurb}. התוצאה: ${r.title} (${score} מתוך ${MAX_SCORE}). מבדק קצר של שמונה שאלות, לא חוות דעת משפטית.`;
}
