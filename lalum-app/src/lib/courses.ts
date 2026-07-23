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
      { n: 1, title: "הכלים והטכנולוגיה, ארכיטקטורת Legal-AI בעולמות המקרקעין והנדסת פרומפטים מתקדמת" },
      { n: 2, title: "הכלים בפעולה: ניתוח מסמכים מרובים (RAG) ואוטומציה של נספחים, תשריטים והחלטות ועדה" },
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
      { n: 1, title: "הכלים והטכנולוגיה, System Prompts וארכיטקטורת מודלים לעבודה חוזית ותאגידית" },
      { n: 2, title: "הכלים בפעולה: אוטומציה של ניתוח אסימטריה בחוזים מסחריים והגבלות אחריות" },
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
      { n: 1, title: "הכלים והטכנולוגיה, מחקר משפטי מתקדם והפיכת קלסרי ראיות למאגר ידע חכם" },
      { n: 2, title: "הכלים בפעולה: אוטומציה של סקירת ראיות, ראיות דיגיטליות, Deepfakes ואותנטיות ראייתית" },
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
      { n: 1, title: "הכלים והטכנולוגיה, ארכיטקטורת LLMs, זרימת דאטה במוצר (Data Pipelines) והיבטים משפטיים" },
      { n: 2, title: "הכלים בפעולה: קניין רוחני (IP), אימון מודלים, זכויות יוצרים ורישיונות קוד פתוח" },
      { n: 3, title: "מה מותר ומה אסור, ה-EU AI Act, איסור AI Washing (FTC) והפרדת דאטה" },
      { n: 4, title: "פרטיות (GDPR/CCPA/PPA), אבטחת מידע וסביבות עבודה מבודדות (Ollama/Local LLMs)" },
      { n: 5, title: "סדנת פיתוח מעשית, בניית מערכת ה-Governance and Compliance של המוצר" },
      { n: 6, title: "הצגת הפרויקטים, Stress-Test רגולטורי למוצרי החברה וגיבוש תו ציות פנימי" },
    ],
  },
  {
    id: "lalum-academy-public-sector",
    category: "רשויות מקומיות וגופים ציבוריים",
    title: "LALUM Academy: AI לרשויות מקומיות ולמגזר הציבורי",
    audience: "מנהלי מחלקות ברשויות מקומיות, לשכות משפטיות ציבוריות, מבקרי פנים, ממוני חופש מידע וצוותי רגולציה.",
    tailoring: "התאמה לתחומי הרשות (רישוי, אכיפה, ועדות תכנון, מכרזים, שירות לתושב).",
    capstoneName: "Municipal Compliance & FOIA Engine",
    capstoneDesc: "סוכן AI הבוחן החלטות ומסמכי רשות, מזהה חשיפות מנהליות, מכין מענה לבקשות חופש מידע ומפיק מפת סיכוני ציות.",
    icon: "home",
    accent: "#3f6f8f",
    image: "/courses/lalum-academy-public-sector.jpg",
    sessions: [
      { n: 1, title: "הכלים והטכנולוגיה, ארכיטקטורת AI במגזר הציבורי והנדסת פרומפטים למסמכי רשות" },
      { n: 2, title: "הכלים בפעולה: ניתוח מסמכים מרובים (RAG) ואוטומציה של פרוטוקולים, החלטות ועדה ותיקי רישוי" },
      { n: 3, title: "מה מותר ומה אסור, מנהל תקין, חובת ההנמקה, הגנת פרטיות ואיסור האצלת שיקול דעת" },
      { n: 4, title: "אוטומציה של מכרזים, אכיפה מנהלית ומענה לחופש המידע בעידן ה-AI" },
      { n: 5, title: "סדנת פיתוח מעשית, בניית מנוע הציות והאוטומציה של הרשות" },
      { n: 6, title: "הצגת הפרויקטים, בדיקת עמידות (Stress-Test) והטמעת נוהל עבודה מחלקתי" },
    ],
  },
  {
    id: "lalum-academy-automotive",
    category: "תעשיית הרכב וניידות",
    title: "LALUM Academy: AI המשפטי לתעשיית הרכב והניידות",
    audience: "יועצים משפטיים ומנהלי רגולציה ביבואני ויצרני רכב, חברות ניידות, ביטוח רכב וניהול צי.",
    tailoring: "התאמה לשרשרת האספקה, לרגולציית הבטיחות ולסוג המוצר (רכב, רכב אוטונומי, פלטפורמות ניידות).",
    capstoneName: "Automotive Recall & Liability Radar",
    capstoneDesc: "סוכן AI המנטר תקלות ופניות, מזהה חשיפות אחריות מוצר וקריאות ריקול, ומפיק מפת סיכונים רגולטורית וחוזית.",
    icon: "settings",
    accent: "#5c6470",
    image: "/courses/lalum-academy-automotive.jpg",
    sessions: [
      { n: 1, title: "הכלים והטכנולוגיה, ארכיטקטורת AI בעולם הרכב והנדסת פרומפטים לחוזים ולרגולציה" },
      { n: 2, title: "הכלים בפעולה: אוטומציה של ניתוח הסכמי הפצה, אחריות ותקני בטיחות (RAG)" },
      { n: 3, title: "מה מותר ומה אסור, אחריות מוצר, פרטיות נתוני רכב ורגולציית רכב אוטונומי" },
      { n: 4, title: "ניהול סיכוני ריקול, שרשרת אספקה, וממשק מול רשויות הבטיחות" },
      { n: 5, title: "סדנת פיתוח מעשית, בניית מכ״ם האחריות והריקול של החברה" },
      { n: 6, title: "הצגת הפרויקטים, בדיקת עמידות (Stress-Test) והטמעת נוהל עבודה" },
    ],
  },
  {
    id: "lalum-academy-healthcare",
    category: "בריאות ומדעי החיים",
    title: "LALUM Academy: AI המשפטי לבריאות ולמדעי החיים",
    audience: "יועצים משפטיים בקופות חולים, בתי חולים, חברות מכשור רפואי, פארמה ובריאות דיגיטלית.",
    tailoring: "התאמה לסוג הפעילות (שירותי בריאות, מכשור רפואי, מחקר קליני, בריאות דיגיטלית).",
    capstoneName: "Clinical Data & Device Compliance Engine",
    capstoneDesc: "סוכן AI הבוחן מסמכי מוצר ומחקר, מזהה חשיפות בפרטיות מידע רפואי וברגולציית מכשור, ומפיק מפת ציות.",
    icon: "shield",
    accent: "#2f8f7f",
    image: "/courses/lalum-academy-healthcare.jpg",
    sessions: [
      { n: 1, title: "הכלים והטכנולוגיה, ארכיטקטורת AI ברפואה והנדסת פרומפטים למסמכים קליניים ומשפטיים" },
      { n: 2, title: "הכלים בפעולה: אוטומציה של הסכמות מדעת, פרוטוקולי מחקר ותיקי מכשור (RAG)" },
      { n: 3, title: "מה מותר ומה אסור, סודיות רפואית, פרטיות מידע בריאות (HIPAA/GDPR) ואיסור הכרעה קלינית אוטונומית" },
      { n: 4, title: "רגולציית מכשור רפואי (MDR/FDA), אחריות מקצועית וטל-רפואה" },
      { n: 5, title: "סדנת פיתוח מעשית, בניית מנוע הציות הקליני והמכשור של הארגון" },
      { n: 6, title: "הצגת הפרויקטים, בדיקת עמידות (Stress-Test) והטמעת נוהל עבודה" },
    ],
  },
  {
    id: "lalum-academy-finance",
    category: "פיננסים וביטוח",
    title: "LALUM Academy: AI המשפטי לפיננסים ולביטוח",
    audience: "יועצים משפטיים וקציני ציות בבנקים, חברות ביטוח, בתי השקעות, פינטק וגופים מוסדיים.",
    tailoring: "התאמה לתחום (אשראי, ביטוח, שוק ההון, פינטק) ולמסגרת הרגולטורית של הגוף.",
    capstoneName: "Regulatory & AML Decision Auditor",
    capstoneDesc: "סוכן AI הבוחן החלטות אשראי וחיתום, מזהה הטיה וחשיפות ציות (איסור הלבנה, הגינות), ומפיק מפת סיכונים.",
    icon: "file",
    accent: "#9a7328",
    image: "/courses/lalum-academy-finance.jpg",
    sessions: [
      { n: 1, title: "הכלים והטכנולוגיה, ארכיטקטורת AI בפיננסים והנדסת פרומפטים לחוזים ולרגולציה" },
      { n: 2, title: "הכלים בפעולה: אוטומציה של ניתוח מדיניות, הסכמים והוראות רגולטור (RAG)" },
      { n: 3, title: "מה מותר ומה אסור, הוגנות אלגוריתמית, איסור הלבנת הון (AML/KYC) ופרטיות פיננסית" },
      { n: 4, title: "החלטות אשראי וחיתום אוטומטיות, בעיית הקופסה השחורה ואחריות מוסדית" },
      { n: 5, title: "סדנת פיתוח מעשית, בניית מבקר ההחלטות והציות של הארגון" },
      { n: 6, title: "הצגת הפרויקטים, בדיקת עמידות (Stress-Test) והטמעת נוהל עבודה" },
    ],
  },
  {
    id: "lalum-academy-energy",
    category: "אנרגיה, תשתיות ותעשייה",
    title: "LALUM Academy: AI המשפטי לאנרגיה, תשתיות ותעשייה",
    audience: "יועצים משפטיים ומנהלי רגולציה בחברות אנרגיה, תשתיות, בנייה ותעשייה יצרנית.",
    tailoring: "התאמה לתחום (אנרגיה מתחדשת, תשתיות לאומיות, ייצור) ולמסגרת הרישוי והבטיחות.",
    capstoneName: "Infrastructure Permits & Safety Risk Engine",
    capstoneDesc: "סוכן AI הבוחן מכרזים, היתרים ותקני בטיחות, מזהה חשיפות רגולטוריות וחוזיות, ומפיק מפת סיכונים לפרויקט.",
    icon: "spark",
    accent: "#b5722a",
    image: "/courses/lalum-academy-energy.jpg",
    sessions: [
      { n: 1, title: "הכלים והטכנולוגיה, ארכיטקטורת AI בתשתיות והנדסת פרומפטים לחוזים ולרישוי" },
      { n: 2, title: "הכלים בפעולה: אוטומציה של ניתוח מכרזים, היתרים ותקני בטיחות (RAG)" },
      { n: 3, title: "מה מותר ומה אסור, רגולציית סביבה ובטיחות, פרטיות ואיסור האצלת הכרעות" },
      { n: 4, title: "ניהול סיכונים בפרויקטים גדולים, שותפויות ציבורי-פרטי (PPP) ושרשרת אספקה" },
      { n: 5, title: "סדנת פיתוח מעשית, בניית מנוע ההיתרים והבטיחות של הארגון" },
      { n: 6, title: "הצגת הפרויקטים, בדיקת עמידות (Stress-Test) והטמעת נוהל עבודה" },
    ],
  },
  {
    id: "lalum-academy-cyber",
    category: "סייבר והגנת מידע",
    title: "LALUM Academy: AI המשפטי לסייבר והגנת מידע",
    audience: "יועצים משפטיים, מנהלי אבטחת מידע (CISO), ממוני הגנת פרטיות (DPO) וצוותי ציות וניהול סיכונים.",
    tailoring: "התאמה לסביבת האיומים של הארגון, למסגרת הרגולטורית ולסוג הנתונים (רגיש, רפואי, פיננסי).",
    capstoneName: "Cyber Incident & Data Breach Response Engine",
    capstoneDesc: "סוכן AI המנתח אירועי אבטחה ופרטיות, מזהה חובות דיווח וחשיפות משפטיות, ומפיק תוכנית תגובה וניהול משבר.",
    icon: "shield",
    accent: "#5a4f9a",
    image: "/courses/lalum-academy-cyber.jpg",
    sessions: [
      { n: 1, title: "הכלים והטכנולוגיה, ארכיטקטורת AI לסייבר והנדסת פרומפטים לניתוח איומים ומסמכים משפטיים" },
      { n: 2, title: "הכלים בפעולה: אוטומציה של ניתוח לוגים, מדיניות אבטחה והסכמי עיבוד נתונים (RAG)" },
      { n: 3, title: "מה מותר ומה אסור, הגנת פרטיות (חוק הגנת הפרטיות תיקון 13, GDPR), חיסיון ומניעת זליגת מידע רגיש למודלים" },
      { n: 4, title: "תגובה לאירועי סייבר, חובות דיווח (רשות הגנת הפרטיות), אחריות ספקים ושרשרת אספקה" },
      { n: 5, title: "סדנת פיתוח מעשית, בניית מנוע תגובת האירועים והדיווח של הארגון" },
      { n: 6, title: "הצגת הפרויקטים, סימולציית אירוע סייבר (Stress-Test) והטמעת נוהל תגובה" },
    ],
  },
];
