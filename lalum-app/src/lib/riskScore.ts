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
export type Question = { id: string; question: string; choices: Choice[] };

// Three scored questions, 0 to 3 each, so the range is 0 to 9 for every track.
// Low points mean low exposure.
export const QUESTIONS: Question[] = [
  {
    id: "governance",
    question: `איך מנוהלת אצלכם החשיפה לבינה מלאכותית ולדליפת מידע?`,
    choices: [
      { text: `יש מדיניות כתובה, סביבה מאובטחת, ובדיקה תקופתית מתועדת`, points: 0 },
      { text: `יש מדיניות, אך היא לא נאכפת ולא נבדקת בפועל`, points: 2 },
      { text: `אין מדיניות, והעובדים משתמשים בכלים ציבוריים לפי שיקול דעתם`, points: 3 },
    ],
  },
  {
    id: "review",
    question: `איך נבדקים חוזים, מסמכים והחלטות מהותיות לפני חתימה?`,
    choices: [
      { text: `בדיקה אנושית מובנית, ובנוסף שכבת ביקורת בלתי תלויה`, points: 0 },
      { text: `בדיקה אנושית בלבד, ללא ביקורת חיצונית`, points: 2 },
      { text: `אוטומציה או בדיקה חלקית, בלי פיקוח מוגדר ובלי תיעוד`, points: 3 },
    ],
  },
  {
    id: "accountability",
    question: `אם יתגלה כשל, האם תוכלו להראות מי החליט, על סמך מה, ומתי?`,
    choices: [
      { text: `כן, יש תיעוד החלטות שניתן להציג לרגולטור, לדירקטוריון או לבית משפט`, points: 0 },
      { text: `חלקית, התיעוד מפוזר ותלוי באנשים מסוימים`, points: 2 },
      { text: `לא, אין תיעוד מסודר של שרשרת ההחלטות`, points: 3 },
    ],
  },
];

export const MAX_SCORE = QUESTIONS.length * 3;

export function bandFor(score: number): BandId {
  if (score <= 2) return "low";
  if (score <= 5) return "medium";
  return "high";
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
  return `בדקתי את מוכנות הארגון שלי מול תשעה וקטורי סיכון בתחום ${t.blurb}. התוצאה: ${r.title} (${score} מתוך ${MAX_SCORE} נקודות חשיפה). מבדק קצר, לא חוות דעת משפטית.`;
}
