// LALUM Academy: the four flagship executive training programs.
// Hebrew content (Israeli legal market). Text follows the project no-dash rule:
// em/en dashes are replaced with commas or colons; only integral hyphens inside
// terms stay (e.g. פינוי-בינוי, In-House, Legal-AI, אזרחי-מסחרי).

export type CourseSession = { n: number; title: string };

export type Course = {
  id: string;
  category: string; // short Hebrew category label for the badge
  title: string;
  audience: string;
  tailoring: string;
  capstoneName: string;
  capstoneDesc: string;
  sessions: CourseSession[];
  icon: string; // id in the shared icon sprite (public/icons.svg)
  accent: string; // warm brand accent for the card
  image: string; // /courses/<id>.jpg, shown when present (graceful fallback otherwise)
};

// Shared framework, identical across every track.
export const courseFramework = {
  sessions: "6 מפגשים",
  hours: "24 שעות אקדמיות",
  perSession: "4 שעות אקדמיות (3 שעות שעון) בכל מפגש",
  group: "10 עד 20 משתתפים",
  place: "בבית העסק (In-House)",
  cadence: "יום ושעה קבועים בשבוע, בהתאמה לצורכי הארגון",
};

export const courses: Course[] = [
  {
    id: "lalum-academy-real-estate",
    category: "נדל\"ן והתחדשות עירונית",
    title: "LALUM Academy: AI בעסקאות נדל\"ן מורכב והתחדשות עירונית",
    audience: "מחלקות משפטיות, חברות יזמיות, משרדי עורכי דין ומנהלי פרויקטים בנדל\"ן.",
    tailoring: "התאמה לסוג הפרויקטים של החברה (תמ\"א 38, פינוי-בינוי, מכר מסחרי, עסקאות קומבינציה).",
    capstoneName: "Smart Real Estate Due-Diligence Engine",
    capstoneDesc: "סוכן AI פנימי הסורק טיוטות הסכמים, מזהה חשיפות מיסוי, בוחן הוגנות תמורות (יחסית מול אחידה לאור פסיקות עדכניות) ומפיק מפת סיכונים.",
    icon: "pin",
    accent: "#a8482a",
    image: "/courses/lalum-academy-real-estate.jpg",
    sessions: [
      { n: 1, title: "היסודות, ארכיטקטורת Legal-AI בעולמות המקרקעין והנדסת פרומפטים מתקדמת" },
      { n: 2, title: "ניתוח מסמכים מרובים (RAG), נספחים, תשריטים והחלטות ועדה בזמן אמת" },
      { n: 3, title: "מה מותר ומה אסור, הגנת פרטיות, מניעת זליגת מידע, והסכנות באחריות מקצועית (הזיות AI)" },
      { n: 4, title: "ניהול סיכונים בהתחדשות עירונית, ניתוח סרבנות וביקורת בטוחות" },
      { n: 5, title: "סדנת פיתוח מעשית, בנייה והגדרת ה-Due-Diligence Engine של החברה" },
      { n: 6, title: "הצגת פרויקטי הגמר, בדיקת עמידות (Stress-Test) והטמעת נוהל עבודה משרדי" },
    ],
  },
  {
    id: "lalum-academy-corporate",
    category: "ממשל תאגידי וחוזים",
    title: "LALUM Academy: חוזים מורכבים, ממשל תאגידי ואוטומציה",
    audience: "יועצים משפטיים פנימיים (In-House), מנהלי סיכונים, קציני ציות (Compliance) ומנהלי עסקאות.",
    tailoring: "התאמה לשטאנץ החוזי, למדיניות הציות ולסוג העסקאות של בית העסק.",
    capstoneName: "Automated Contract Negotiator & Risk Assessor",
    capstoneDesc: "מערכת מותאמת אישית המאבחנת שינויים בהסכמים, מזהה סתירות פנימיות ומציעה ניסוחי נגד אסטרטגיים.",
    icon: "gavel",
    accent: "#9a7328",
    image: "/courses/lalum-academy-corporate.jpg",
    sessions: [
      { n: 1, title: "System Prompts וארכיטקטורת מודלים לעבודה חוזית ותאגידית" },
      { n: 2, title: "אוטומציה של ניתוח אסימטריה בחוזים מסחריים והגבלות אחריות" },
      { n: 3, title: "מה מותר ומה אסור, חיסיון עו\"ד-לקוח מול AI (הלכת Heppner), תוצרי עבודה ודיני עבודה" },
      { n: 4, title: "ממשל תאגידי, בעיית הקופסה השחורה ואחריות תאגידים באלגוריתמים אוטונומיים" },
      { n: 5, title: "סדנת פיתוח מעשית, בניית סוכן ניהול המשא ומתן והסיכונים של הארגון" },
      { n: 6, title: "הצגת הפרויקטים, גיבוש תקנון ציות פנימי (Internal AI Policy) והטמעה" },
    ],
  },
  {
    id: "lalum-academy-litigation",
    category: "ליטיגציה ויישוב סכסוכים",
    title: "LALUM Academy: ליטיגציה, ראיות דיגיטליות, גישור ובוררות",
    audience: "ליטיגטורים, מנהלי מחלקות סכסוכים, בוררים, מגשרים ומנהלי סיכונים משפטיים.",
    tailoring: "התאמה לסוג הסכסוכים האופייני לחברה (אזרחי-מסחרי, נדל\"ן, תאגידי).",
    capstoneName: "Litigation & Dispute Strategy Suite",
    capstoneDesc: "כלי המנתח כתבי טענות של הצד שכנגד, מזהה פערים ראייתיים, ומכין חקירות נגדיות וסעיפי בוררות או גישור.",
    icon: "scale",
    accent: "#8a3f45",
    image: "/courses/lalum-academy-litigation.jpg",
    sessions: [
      { n: 1, title: "מחקר משפטי מתקדם והפיכת קלסרי ראיות למאגר ידע חכם" },
      { n: 2, title: "ראיות דיגיטליות, Deepfakes ואותנטיות ראייתית (פסילת ראיות כוזבות)" },
      { n: 3, title: "מה מותר ומה אסור, איסור האצלת הכרעות ל-AI (הלכת ARIHQ) וסנקציות בתי משפט" },
      { n: 4, title: "AI בגישור ובוררות, כללי AAA-ICDR ומודלים של ODR" },
      { n: 5, title: "סדנת פיתוח מעשית, בניית ה-Strategy Suite להליכים המשפטיים של הארגון" },
      { n: 6, title: "הצגת הפרויקטים, סימולציית ליטיגציה או בוררות והערכת סיכונים" },
    ],
  },
  {
    id: "lalum-academy-hitech",
    category: "הייטק והנדסה רגולטורית",
    title: "LALUM Academy: AI Legal & Regulatory Engineering for Hi-Tech",
    audience: "יועצים משפטיים בהייטק (GC), מנהלי מוצר (VP Product/CPO), סמנכ\"לי טכנולוגיה (CTO) ומנהלי R&D.",
    tailoring: "התאמה לארכיטקטורת המוצר של החברה, לשווקי היעד ולדרישות הרגולטוריות שלה.",
    capstoneName: "AI Product Governance Framework & Risk Engine",
    capstoneDesc: "סוכן AI המבצע סקירת מוצר, מזהה חשיפות IP ורגולציה (EU AI Act/FTC), ומפיק מפת ציות אוטומטית.",
    icon: "brain",
    accent: "#3f8f5f",
    image: "/courses/lalum-academy-hitech.jpg",
    sessions: [
      { n: 1, title: "ארכיטקטורת LLMs, זרימת דאטה במוצר (Data Pipelines) והיבטים משפטיים" },
      { n: 2, title: "קניין רוחני (IP), אימון מודלים, זכויות יוצרים ורישיונות קוד פתוח" },
      { n: 3, title: "מה מותר ומה אסור, ה-EU AI Act, איסור AI Washing (FTC) והפרדת דאטה" },
      { n: 4, title: "פרטיות (GDPR/CCPA/PPA), אבטחת מידע וסביבות עבודה מבודדות (Ollama/Local LLMs)" },
      { n: 5, title: "סדנת פיתוח מעשית, בניית מערכת ה-Governance and Compliance של המוצר" },
      { n: 6, title: "הצגת הפרויקטים, Stress-Test רגולטורי למוצרי החברה וגיבוש תו ציות פנימי" },
    ],
  },
];
