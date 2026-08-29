import type { IconName } from "./content";

// Content for the two pillar landing pages, held as data rather than inline in
// the page components so the SEO prerender can emit the real page into the
// static HTML without running the React tree at build time. The pages render
// from exactly this, so the crawler copy and the visitor copy cannot drift.
//
// Note: this copy is Hebrew only, as it was when it lived in the components.
// The pages do not go through the `strings` dictionaries, so a visitor at
// ?lang=en still sees Hebrew here. Translating it is a separate decision.

export type PillarCard = { icon: IconName; title: string; body: string };
export type PillarStep = { n: string; title: string; body: string };
export type PillarLink = { slug: string; title: string };

export type PillarPage = {
  path: string;
  url: string;
  title: string;
  desc: string;
  heroEyebrow: string;
  lede: string;
  coversEyebrow: string;
  coversH2: string;
  cards: PillarCard[];
  whenEyebrow: string;
  whenH2: string;
  whenLede: string;
  when: string[];
  stepsEyebrow: string;
  stepsH2: string;
  steps: PillarStep[];
  relatedEyebrow: string;
  relatedH2: string;
  related: PillarLink[];
  faqEyebrow: string;
  faqH2: string;
  ctaH2: string;
  ctaBody: string;
  disclaimer: string;
};

const DISCLAIMER = "המידע בעמוד זה כללי ואינו מהווה ייעוץ משפטי או תחליף לחוות דעת פרטנית.";
const STEPS_EYEBROW = "איך זה עובד";
const STEPS_H2 = "שלושה שלבים לחוות דעת בת-הגנה";
const COVERS_EYEBROW = "מה הייעוץ מכסה";
const WHEN_EYEBROW = "חוות דעת שנייה";
const RELATED_EYEBROW = "להעמקה";
const FAQ_EYEBROW = "שאלות ותשובות";

export const aiPillar: PillarPage = {
  path: "ai-legal-advisory",
  url: "https://lalumapp.com/ai-legal-advisory",
  title: `ייעוץ משפטי וחוות דעת שנייה בתחום ה-AI לחברות וארגונים`,
  desc: `ייעוץ משפטי עצמאי וחוות דעת שנייה לחברות וארגונים בנושא בינה מלאכותית: ממשל AI, EU AI Act, אחריות אלגוריתמית, הגנת קניין רוחני וניהול סיכונים, מאת ד"ר אברהם ללום.`,
  heroEyebrow: `ייעוץ משפטי וחוות דעת שנייה בנושא AI`,
  lede: `חברות וארגונים מאמצים בינה מלאכותית מהר יותר משהמסגרת המשפטית מדביקה. אנחנו נותנים ייעוץ משפטי עצמאי וחוות דעת שנייה בלתי תלויה, שהופכים את הסיכון האלגוריתמי למערכת שאפשר לשלוט בה, לפני שרגולטור, דירקטוריון או תובע עושים זאת במקומכם.`,
  coversEyebrow: COVERS_EYEBROW,
  coversH2: `שכבת ההגנה המשפטית סביב ה-AI שלכם`,
  cards: [
    { icon: "scale", title: `התאמה ל-EU AI Act ורגולציה`, body: `מיפוי חשיפה מול המסגרות המחמירות, סיווג סיכון של מערכות, חובות שקיפות ותיעוד, ותרגום לרשימת ציות מעשית לפי שלב וסיכון.` },
    { icon: "brain", title: `אחריות אלגוריתמית לדירקטוריון`, body: `מדד ציות ומטריצת חשיפה לנושאי משרה, שמתמחרים את האחריות המשפטית מוקדם, לפני שרגולטור או תובע עושים זאת.` },
    { icon: "shield", title: `קניין רוחני והגנת מידע`, body: `שכבת הגנה על הטכנולוגיה, סביבות מודל מקומיות ומאובטחות, ומדיניות שימוש שמונעת זליגת מידע רגיש וזיהום קוד בזכויות צד שלישי.` },
    { icon: "gavel", title: `חוזים מול ספקי AI`, body: `בחינה מחדש של הסכמי ספקים, הקצאת סיכונים, סעיפי שיפוי ואחריות, כך שהחוזה מגן על הארגון ולא רק על הספק.` },
  ],
  whenEyebrow: WHEN_EYEBROW,
  whenH2: `מתי כדאי חוות דעת משפטית שנייה בנושא AI`,
  whenLede: `חוות דעת שנייה בלתי תלויה אינה מגינה על החלטה שכבר התקבלה, אלא בוחנת אותה מחדש. היא מחזקת גם את הארגון וגם את היועץ המייצג, ומספקת בסיס מתועד ובר-הגנה.`,
  when: [
    `לפני הטמעת מערכת AI חדשה בארגון`,
    `לפני חתימה על חוזה עם ספק בינה מלאכותית`,
    `לפני השקת מוצר או שירות מבוסס אלגוריתם`,
    `כשיש אי-ודאות רגולטורית או חשיפה אישית של נושאי משרה`,
    `כשהתקבלה חוות דעת ורוצים בדיקה בלתי תלויה`,
    `כשרגולטור, דירקטוריון או לקוח דורשים בסיס מתועד להחלטה`,
  ],
  stepsEyebrow: STEPS_EYEBROW,
  stepsH2: STEPS_H2,
  steps: [
    { n: "1", title: `אבחון`, body: `ממפים את הארכיטקטורה הטכנולוגית, המבנה הארגוני והחשיפה הרגולטורית, ומזהים את נקודות התורפה המיידיות.` },
    { n: "2", title: `חוות דעת בלתי תלויה`, body: `בוחנים מחדש את ההחלטה או המערכת בעין ביקורתית, ומצליבים משפט, כלכלה וארכיטקטורת AI.` },
    { n: "3", title: `מפת דרכים לניהול סיכון`, body: `מוסרים מסמך בר-הגנה, ממוקד ומתועד, עם צעדים מעשיים להקטנת החשיפה ולעמידה ברגולציה.` },
  ],
  relatedEyebrow: RELATED_EYEBROW,
  relatedH2: `מאמרים בנושא ייעוץ, חוות דעת ואחריות AI`,
  related: [
    { slug: "second-opinion-revolution", title: `מהפכת הדעה השנייה: למה חוות דעת בלתי תלויה היא צעד של אחריות` },
    { slug: "ai-liability-ruling", title: `מי אחראי על מה שה-AI אומר? בין מינכן, וושינגטון וירושלים` },
    { slug: "ai-ethics-legal-risks", title: `אתיקה, משפט וסיכונים משפטיים של בינה מלאכותית` },
    { slug: "decision-oriented-ai-law", title: `משפט מבוסס בינה מלאכותית מוכוון הכרעה בעידן של אי-ודאות` },
    { slug: "law-algorithm-era", title: `המשפט בעידן האלגוריתם` },
    { slug: "ai-turning-point-2026", title: `2026: שנת המפנה של הבינה המלאכותית במשפט ובנדל"ן` },
  ],
  faqEyebrow: FAQ_EYEBROW,
  faqH2: `ייעוץ משפטי וחוות דעת שנייה בנושא AI`,
  ctaH2: `מוכנים לחוות דעת בלתי תלויה על ה-AI שלכם?`,
  ctaBody: `פגישת אבחון קצרה ממפה את החשיפה שלכם ומגדירה מפת דרכים ברורה לניהול הסיכון.`,
  disclaimer: DISCLAIMER,
};

export const realEstatePillar: PillarPage = {
  path: "real-estate-legal-advisory",
  url: "https://lalumapp.com/real-estate-legal-advisory",
  title: `ייעוץ משפטי וחוות דעת שנייה בנדל"ן והתחדשות עירונית`,
  desc: `ייעוץ משפטי עצמאי וחוות דעת שנייה בעסקאות נדל"ן ובהתחדשות עירונית (תמ"א 38 ופינוי-בינוי), בשילוב Legal AI לבדיקת נאותות וניהול סיכונים, מאת ד"ר אברהם ללום.`,
  heroEyebrow: `ייעוץ וחוות דעת שנייה בנדל"ן והתחדשות עירונית`,
  lede: `עסקאות נדל"ן ופרויקטים של התחדשות עירונית הם זירה שבה טעות חוזית אחת עולה ביוקר. אנחנו נותנים ייעוץ משפטי עצמאי וחוות דעת שנייה בלתי תלויה, בשילוב כלי Legal AI, שהופכים מאות עמודי מסמכים לתמונת סיכון ברורה, לפני שאתם מתחייבים.`,
  coversEyebrow: COVERS_EYEBROW,
  coversH2: `שכבת ההגנה המשפטית סביב העסקה שלכם`,
  cards: [
    { icon: "scale", title: `עסקאות נדל"ן וחוזים`, body: `ליווי וייצוג בעסקאות מכר, רכישה והשקעה: בדיקת זכויות, ניסוח והגנה חוזית, מיסוי וזיהוי סיכונים מוקדם, לפני שהם הופכים לחשיפה.` },
    { icon: "gavel", title: `התחדשות עירונית: תמ"א 38 ופינוי-בינוי`, body: `ליווי בעלי דירות ונציגויות בפרויקטים מורכבים: בחינת הסכמי יזם, בטוחות, לוחות זמנים ומנגנוני הכרעה, לאיזון מול היזם ולהסכם בר-הגנה.` },
    { icon: "shield", title: `בדיקת נאותות וניהול סיכונים`, body: `מיפוי חשיפות משפטיות, זכויות בנייה, הערות אזהרה, מיסוי ובטוחות, ובניית ארכיטקטורת עסקה חסינה שמחזיקה גם כשמשהו משתבש.` },
    { icon: "brain", title: `ניתוח מבוסס Legal AI`, body: `כלים מבוססי בינה מלאכותית סורקים מאות מסמכים, נספחים והסכמים, מחלצים סתירות וסיכונים, ומאיצים את הבדיקה, תמיד בפיקוח ובאישור עורך דין.` },
  ],
  whenEyebrow: WHEN_EYEBROW,
  whenH2: `מתי כדאי חוות דעת משפטית שנייה בנדל"ן`,
  whenLede: `חוות דעת שנייה בלתי תלויה אינה מגינה על החלטה שכבר התקבלה, אלא בוחנת אותה מחדש. היא מחזקת גם את הלקוח וגם את היועץ המייצג, ומספקת בסיס מתועד ובר-הגנה.`,
  when: [
    `לפני חתימה על חוזה רכישה או מכר של נכס`,
    `לפני חתימה על הסכם יזם בפרויקט תמ"א 38 או פינוי-בינוי`,
    `כשקיבלתם הסכם או חוות דעת ורוצים בדיקה בלתי תלויה`,
    `כשמתגלע סכסוך בין בעלי דירות, נציגות או מול היזם`,
    `לפני עסקת קומבינציה או עסקה חוצת גבולות`,
    `כשנדרש בסיס מתועד ובר-הגנה להחלטה`,
  ],
  stepsEyebrow: STEPS_EYEBROW,
  stepsH2: STEPS_H2,
  steps: [
    { n: "1", title: `אבחון`, body: `ממפים את הנכס או הפרויקט, את הזכויות, החוזה והחשיפה המשפטית, ומזהים את נקודות התורפה המיידיות.` },
    { n: "2", title: `חוות דעת בלתי תלויה`, body: `בוחנים מחדש את העסקה בעין ביקורתית, בשילוב משפט, כלכלה וכלי Legal AI לניתוח מסמכים וסיכונים.` },
    { n: "3", title: `מפת דרכים לניהול סיכון`, body: `מוסרים מסמך בר-הגנה, ממוקד ומתועד, עם צעדים מעשיים להקטנת החשיפה ולחיזוק העמדה המשפטית.` },
  ],
  relatedEyebrow: RELATED_EYEBROW,
  relatedH2: `מאמרים בנושא נדל"ן, התחדשות עירונית ו-Legal AI`,
  related: [
    { slug: "urban-renewal-mistakes-guide", title: `המדריך לטעויות נפוצות בהתחדשות עירונית` },
    { slug: "urban-renewal-risk", title: `ניהול סיכונים בפרויקטי התחדשות עירונית` },
    { slug: "tenant-urban-renewal-guide", title: `מדריך לדייר בהתחדשות עירונית` },
    { slug: "combination-deals-architecture", title: `ארכיטקטורת עסקאות קומבינציה` },
    { slug: "ai-realestate-risk-management", title: `ניהול סיכונים בנדל"ן מבוסס בינה מלאכותית` },
    { slug: "contract-review-before-signing", title: `בדיקת חוזה לפני חתימה` },
  ],
  faqEyebrow: FAQ_EYEBROW,
  faqH2: `ייעוץ וחוות דעת שנייה בנדל"ן והתחדשות עירונית`,
  ctaH2: `מוכנים לחוות דעת בלתי תלויה על העסקה שלכם?`,
  ctaBody: `פגישת אבחון קצרה ממפה את החשיפה שלכם ומגדירה מפת דרכים ברורה לניהול הסיכון בעסקה או בפרויקט.`,
  disclaimer: DISCLAIMER,
};

export const pillarPages: PillarPage[] = [aiPillar, realEstatePillar];
