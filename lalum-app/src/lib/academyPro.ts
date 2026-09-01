// LALUM Academy Pro: the open enrollment line for individual professionals.
// Separate from the In-House organisational line in src/lib/courses.ts, which
// is left untouched. Same six session, 24 academic hour framework, delivered
// online, with a participation certificate rather than any form of accreditation.
// Hebrew content, RTL. Follows the project no-dash rule from CLAUDE.md.
// Integral hyphens inside terms stay.
import type { Course } from "./courses";

export const proFramework = {
  sessions: "6 מפגשים",
  hours: "24 שעות אקדמיות",
  perSession: "4 שעות אקדמיות (3 שעות שעון) בכל מפגש",
  group: "מקוון",
  place: "תעודת השתתפות",
};

// Conditions for the participation certificate. Never described as accreditation.
// Cohorts open according to demand, so the page states that instead of naming a
// date it cannot keep. An enquiry is how someone gets told when one opens.
export const proCohort =
  "מחזורים נפתחים לפי היקף הביקוש. השאירו פרטים ונעדכן אתכם לקראת פתיחת המחזור הקרוב.";

export const proCertificate =
  "תעודת השתתפות מוענקת בתום התוכנית למשתתפים שנכחו בחמישה מפגשים לפחות והגישו את פרויקט הגמר.";

export const academyPro: Course[] = [
  {
    id: "lalum-academy-pro-law",
    category: "עורכי דין",
    title: "LALUM Academy Pro: AI לעורך הדין העצמאי ולמשרד הבוטיק",
    audience:
      "עורכי דין עצמאיים ומשרדי בוטיק שרוצים להטמיע כלי AI בעבודה היומיומית בלי לפגוע בחיסיון ובאחריות המקצועית.",
    tailoring:
      "התאמה לסוג התיקים, לתבניות ההסכמים ולנהלי העבודה של המשרד.",
    tailoringLabel: "התאמה מקצועית:",
    capstoneName: "Firm Contract Drafting & Review Engine",
    capstoneDesc:
      "מנוע ניסוח וסקירת חוזים שעובד על תבניות המשרד עצמו ומפיק טיוטה מסומנת עם נקודות לבדיקה אנושית.",
    icon: "gavel",
    accent: "#9a7328",
    image: "",
    track: "pro",
    frame: proFramework,
    ctaLabel: "לפרטים ולהרשמה",
    sessions: [
      { n: 1, title: "יסודות וגבולות גזרה: איך מודל שפה עובד ומה הוא לא, מפת הכלים, חיסיון עורך דין לקוח וסודיות מקצועית מול כלים ענניים, וכללי האתיקה של הלשכה" },
      { n: 2, title: "עבודה עם מסמכים משפטיים: השוואת גרסאות חוזה, חילוץ סעיפים והגדרות, איתור סתירות פנימיות, בניית כרונולוגיה מתוך תיק" },
      { n: 3, title: "הפקת התוצר המשפטי: טיוטת חוזה מתבניות המשרד, מכתב התראה, סיכום פגישת לקוח וטיוטת חוות דעת" },
      { n: 4, title: "בקרת איכות ואחריות מקצועית: הזיות ופסיקה מומצאת, אימות אסמכתאות, מה חובה לקרוא לפני חתימה, ותיעוד שיעמוד בביקורת" },
      { n: 5, title: "בניית הסוכן: RAG על ארכיון המשרד, סביבה סגורה מול ענן, מודל מקומי, ומה קורה למידע שנכנס למודל של ספק" },
      { n: 6, title: "רגולציה ופרויקט גמר: ה-EU AI Act ברמה הרלוונטית למשרד, תיקון 13 והגנת הפרטיות, שאלת היידוע של הלקוח על שימוש בכלים אוטומטיים, והצגת פרויקט הגמר" },
    ],
  },
  {
    id: "lalum-academy-pro-appraisal",
    category: "שמאי מקרקעין",
    title: "LALUM Academy Pro: AI לשמאי המקרקעין",
    audience:
      "שמאי מקרקעין עצמאיים ומשרדי שמאות שרוצים לקצר את שלב איסוף הנתונים והניתוח בלי לפגוע באחריות המקצועית על השומה.",
    tailoring:
      "התאמה לסוגי השומות, למקורות הנתונים ולנהלי העבודה של המשרד.",
    tailoringLabel: "התאמה מקצועית:",
    capstoneName: "Comparable Transactions Research Engine",
    capstoneDesc:
      "מנוע איסוף וניתוח עסקאות השוואה שמפיק טיוטת פרק נתונים עם מקור לכל שורה, לבדיקת השמאי.",
    icon: "pin",
    accent: "#a8482a",
    image: "",
    track: "pro",
    frame: proFramework,
    ctaLabel: "לפרטים ולהרשמה",
    sessions: [
      { n: 1, title: "יסודות וגבולות גזרה: איך מודל שפה עובד ומה הוא לא, מפת הכלים, סודיות מזמין השומה, וכללי האתיקה והתקינה המקצועית שהשומה חייבת לעמוד בהם" },
      { n: 2, title: "מסמכים ונתונים: נסח טאבו, תיק בניין, תוכניות והוראותיהן, היתרי בנייה וחוזי מכר, חילוץ מובנה וזיהוי סתירות בין מקורות" },
      { n: 3, title: "הפקת התוצר השמאי: איסוף וניתוח עסקאות השוואה, טיוטת פרק הנתונים והתיאור, ובדיקת סבירות מול טווחי שוק" },
      { n: 4, title: "בקרת איכות ואחריות: מקור לכל נתון, איתור עסקאות לא רלוונטיות, תיעוד שיטת ההשוואה, ומה חובה לאמת ידנית" },
      { n: 5, title: "בניית הסוכן: RAG על ארכיון השומות של המשרד, סביבה סגורה, ופרטיות בעלי נכסים" },
      { n: 6, title: "רגולציה ופרויקט גמר: שאלת האחריות המקצועית כאשר חלק מהעבודה נעשה בכלי אוטומטי, שקיפות מול מזמין השומה, והצגת פרויקט הגמר" },
    ],
  },
  {
    id: "lalum-academy-pro-accounting",
    category: "רואי חשבון ויועצי מס",
    title: "LALUM Academy Pro: AI לרואה החשבון וליועץ המס",
    audience:
      "רואי חשבון, יועצי מס ומנהלי חשבונות בכירים שרוצים לקצר סיווג, הצלבה ואיתור חריגים בלי לוותר על בקרה.",
    tailoring:
      "התאמה לסוגי הלקוחות, למבנה התיקים ולנהלי הבקרה של המשרד.",
    tailoringLabel: "התאמה מקצועית:",
    capstoneName: "Document Classification & Exception Engine",
    capstoneDesc:
      "מנוע סיווג והצלבת מסמכים שמסמן חריגים לבדיקה אנושית לפני סגירת דוח.",
    icon: "spark",
    accent: "#800020",
    image: "",
    track: "pro",
    frame: proFramework,
    ctaLabel: "לפרטים ולהרשמה",
    sessions: [
      { n: 1, title: "יסודות וגבולות גזרה: איך מודל שפה עובד ומה הוא לא, מפת הכלים, סודיות לקוח, עצמאות ואי תלות בביקורת, וכללי האתיקה של הלשכה" },
      { n: 2, title: "מסמכים ונתונים: חשבוניות, כרטסות, דוחות בנק, הסכמים ומסמכי רשות המסים, חילוץ, סיווג והצלבה בין מקורות" },
      { n: 3, title: "הפקת התוצר המקצועי: טיוטת נייר עבודה, סיכום ממצאים, טיוטת חוות דעת מס ומכתב ללקוח" },
      { n: 4, title: "בקרת איכות ואחריות: מה מודל שפה לא יודע לעשות עם מספרים, הוצאת החישוב אל מחוץ למודל, וסימון חריגים לבדיקה אנושית" },
      { n: 5, title: "בניית הסוכן: RAG על תיקי הלקוחות, סביבה סגורה, וסודיות מול תיקון 13" },
      { n: 6, title: "רגולציה ופרויקט גמר: אחריות מקצועית, שאלת היידוע של הלקוח על שימוש בכלים אוטומטיים, והצגת פרויקט הגמר" },
    ],
  },
];
