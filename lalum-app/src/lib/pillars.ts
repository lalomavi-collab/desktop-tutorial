import type { IconName } from "./content";
import type { Lang } from "./hreflang";
import type { QA } from "./schema";

// Content for the two pillar landing pages, held as data rather than inline in
// the page components for two reasons: the SEO prerender can emit the real page
// into the static HTML without running the React tree at build time, and the
// copy can carry the same five languages the rest of the site does.
//
// The structure splits what is language independent (route, icons, the slugs of
// the linked articles) from the prose, so icons and slugs are declared once
// instead of five times.

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
  faqs: QA[];
  ctaH2: string;
  ctaBody: string;
  disclaimer: string;
  ui: PillarUi;
};

// Button and card labels. Identical for both pillar pages within a language,
// so they are declared once per language rather than twice.
export type PillarUi = { book: string; fullAdvisory: string; articleLabel: string; read: string };

const UI: Record<Lang, PillarUi> = {
  he: { book: `לתיאום פגישת אבחון`, fullAdvisory: `שירותי הייעוץ המלאים`, articleLabel: `מאמר`, read: `קריאה` },
  en: { book: `Book a diagnostic meeting`, fullAdvisory: `Full advisory services`, articleLabel: `Article`, read: `Read` },
  es: { book: `Reservar una reunión de diagnóstico`, fullAdvisory: `Servicios de asesoría completos`, articleLabel: `Artículo`, read: `Leer` },
  fr: { book: `Réserver une réunion de diagnostic`, fullAdvisory: `Services de conseil complets`, articleLabel: `Article`, read: `Lire` },
  ar: { book: `حجز لقاء تشخيصي`, fullAdvisory: `خدمات الاستشارة الكاملة`, articleLabel: `مقال`, read: `قراءة` },
};

type Copy = {
  title: string;
  desc: string;
  heroEyebrow: string;
  lede: string;
  labels: { covers: string; when: string; steps: string; related: string; faq: string };
  coversH2: string;
  cards: { title: string; body: string }[];
  whenH2: string;
  whenLede: string;
  when: string[];
  stepsH2: string;
  steps: { title: string; body: string }[];
  relatedH2: string;
  faqH2: string;
  faqs: QA[];
  ctaH2: string;
  ctaBody: string;
  disclaimer: string;
};

// Language independent: route, card icons, and the articles each pillar links
// to. The link titles stay in Hebrew in every language because the articles
// themselves are Hebrew; a translated label on untranslated content would tell
// the reader something false about what they are about to open.
const SHARED = {
  ai: {
    path: "ai-legal-advisory",
    url: "https://lalumapp.com/ai-legal-advisory",
    icons: ["scale", "brain", "shield", "gavel"] as IconName[],
    related: [
      { slug: "second-opinion-revolution", title: `מהפכת הדעה השנייה: למה חוות דעת בלתי תלויה היא צעד של אחריות` },
      { slug: "ai-liability-ruling", title: `מי אחראי על מה שה-AI אומר? בין מינכן, וושינגטון וירושלים` },
      { slug: "ai-ethics-legal-risks", title: `אתיקה, משפט וסיכונים משפטיים של בינה מלאכותית` },
      { slug: "decision-oriented-ai-law", title: `משפט מבוסס בינה מלאכותית מוכוון הכרעה בעידן של אי-ודאות` },
      { slug: "law-algorithm-era", title: `המשפט בעידן האלגוריתם` },
      { slug: "ai-turning-point-2026", title: `2026: שנת המפנה של הבינה המלאכותית במשפט ובנדל"ן` },
    ],
  },
  mediation: {
    path: "mediation-dispute-resolution",
    url: "https://lalumapp.com/mediation-dispute-resolution",
    icons: ["gavel", "scale", "settings", "shield"] as IconName[],
    related: [
      { slug: "מהו-גישור-מכוון-הכרעה-וכיצד-הוא-שונה-מגישור-מסורתי", title: `מהו גישור מכוון הכרעה וכיצד הוא שונה מגישור מסורתי?` },
      { slug: "האם-גישור-מכוון-הכרעה-חוסך-זמן-וכסף-לעומת-הליכים-משפטיים-מסורתיים", title: `האם גישור מכוון הכרעה חוסך זמן וכסף לעומת הליכים משפטיים?` },
      { slug: "סכסוך-שותפים-בין-עורכי-דין-למה-גישור-מכוון-הכרעה-הוא-המסלול-שנשכח-והנכון-הקדמה-סכסוכים-בין-שותפי", title: `סכסוך שותפים בין עורכי דין: למה גישור מכוון הכרעה הוא המסלול שנשכח` },
      { slug: "פתרון-סכסוך-בין-יזם-לקבלן-באמצעות-גישור-מכוון-הכרעה-בפרויקט-נדל-ן-תיאור-מקרה-מעשי", title: `פתרון סכסוך בין יזם לקבלן באמצעות גישור מכוון הכרעה: תיאור מקרה` },
      { slug: "כיצד-לבחור-מגשר-מוסמך-מטעם-בית-המשפט-להליכי-גישור-מכוון-הכרעה", title: `כיצד לבחור מגשר מוסמך מטעם בית המשפט להליכי גישור מכוון הכרעה?` },
      { slug: "האם-גישור-מכוון-הכרעה-מתאים-לכל-סוגי-הסכסוכים", title: `האם גישור מכוון הכרעה מתאים לכל סוגי הסכסוכים?` },
    ],
  },
  realEstate: {
    path: "real-estate-legal-advisory",
    url: "https://lalumapp.com/real-estate-legal-advisory",
    icons: ["scale", "gavel", "compass", "shield", "brain"] as IconName[],
    related: [
      { slug: "urban-renewal-mistakes-guide", title: `המדריך לטעויות נפוצות בהתחדשות עירונית` },
      { slug: "urban-renewal-risk", title: `ניהול סיכונים בפרויקטי התחדשות עירונית` },
      { slug: "tenant-urban-renewal-guide", title: `מדריך לדייר בהתחדשות עירונית` },
      { slug: "combination-deals-architecture", title: `ארכיטקטורת עסקאות קומבינציה` },
      { slug: "ai-realestate-risk-management", title: `ניהול סיכונים בנדל"ן מבוסס בינה מלאכותית` },
      { slug: "contract-review-before-signing", title: `בדיקת חוזה לפני חתימה` },
    ],
  },
} as const;

const STEP_NUMBERS = ["1", "2", "3"];

const he: { ai: Copy; realEstate: Copy } = {
  ai: {
    title: `ייעוץ משפטי וחוות דעת שנייה בתחום ה-AI לחברות וארגונים`,
    desc: `ייעוץ משפטי עצמאי וחוות דעת שנייה לחברות וארגונים בנושא בינה מלאכותית: ממשל AI, EU AI Act, אחריות אלגוריתמית, הגנת קניין רוחני וניהול סיכונים, מאת ד"ר אברהם ללום.`,
    heroEyebrow: `ייעוץ משפטי וחוות דעת שנייה בנושא AI`,
    lede: `חברות וארגונים מאמצים בינה מלאכותית מהר יותר משהמסגרת המשפטית מדביקה. אנחנו נותנים ייעוץ משפטי עצמאי וחוות דעת שנייה בלתי תלויה, שהופכים את הסיכון האלגוריתמי למערכת שאפשר לשלוט בה, לפני שרגולטור, דירקטוריון או תובע עושים זאת במקומכם.`,
    labels: { covers: `מה הייעוץ מכסה`, when: `חוות דעת שנייה`, steps: `איך זה עובד`, related: `להעמקה`, faq: `שאלות ותשובות` },
    coversH2: `שכבת ההגנה המשפטית סביב ה-AI שלכם`,
    cards: [
      { title: `התאמה ל-EU AI Act ורגולציה`, body: `מיפוי חשיפה מול המסגרות המחמירות, סיווג סיכון של מערכות, חובות שקיפות ותיעוד, ותרגום לרשימת ציות מעשית לפי שלב וסיכון.` },
      { title: `אחריות אלגוריתמית לדירקטוריון`, body: `מדד ציות ומטריצת חשיפה לנושאי משרה, שמתמחרים את האחריות המשפטית מוקדם, לפני שרגולטור או תובע עושים זאת.` },
      { title: `קניין רוחני והגנת מידע`, body: `שכבת הגנה על הטכנולוגיה, סביבות מודל מקומיות ומאובטחות, ומדיניות שימוש שמונעת זליגת מידע רגיש וזיהום קוד בזכויות צד שלישי.` },
      { title: `חוזים מול ספקי AI`, body: `בחינה מחדש של הסכמי ספקים, הקצאת סיכונים, סעיפי שיפוי ואחריות, כך שהחוזה מגן על הארגון ולא רק על הספק.` },
    ],
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
    stepsH2: `שלושה שלבים לחוות דעת בת-הגנה`,
    steps: [
      { title: `אבחון`, body: `ממפים את הארכיטקטורה הטכנולוגית, המבנה הארגוני והחשיפה הרגולטורית, ומזהים את נקודות התורפה המיידיות.` },
      { title: `חוות דעת בלתי תלויה`, body: `בוחנים מחדש את ההחלטה או המערכת בעין ביקורתית, ומצליבים משפט, כלכלה וארכיטקטורת AI.` },
      { title: `מפת דרכים לניהול סיכון`, body: `מוסרים מסמך בר-הגנה, ממוקד ומתועד, עם צעדים מעשיים להקטנת החשיפה ולעמידה ברגולציה.` },
    ],
    relatedH2: `מאמרים בנושא ייעוץ, חוות דעת ואחריות AI`,
    faqH2: `ייעוץ משפטי וחוות דעת שנייה בנושא AI`,
    faqs: [
      { q: `מה כוללת חוות דעת משפטית שנייה בנושא AI לחברות וארגונים?`, a: `חוות דעת שנייה עצמאית בוחנת מחדש את החשיפה המשפטית של הארגון בשימוש בבינה מלאכותית: התאמה ל-EU AI Act, אחריות אלגוריתמית, הגנת פרטיות וקניין רוחני, ומבנה החוזים מול ספקי AI. המטרה היא לזהות סיכונים לפני שהם מתממשים, ולתת להנהלה ולדירקטוריון בסיס מושכל להחלטה.` },
      { q: `מתי כדאי לפנות לייעוץ משפטי חיצוני לפני החלטת AI?`, a: `לפני הטמעת מערכת AI חדשה, לפני חתימה על חוזה עם ספק AI, לפני השקת מוצר מבוסס אלגוריתם, וכשיש אי-ודאות רגולטורית או חשיפה אישית של נושאי משרה. ייעוץ מוקדם זול ומהיר יותר מהתמודדות עם תביעה או קנס בדיעבד.` },
      { q: `למי מיועד הייעוץ, לחברות הייטק בלבד?`, a: `לא. השירות מיועד לחברות טכנולוגיה, לתאגידים מסורתיים שמטמיעים AI, לגופים ציבוריים ולרשויות, וכן לעורכי דין ומשרדים שמבקשים חוות דעת שנייה בלתי תלויה בסוגיה מורכבת. הליבה היא המפגש בין משפט, כלכלה ובינה מלאכותית.` },
      { q: `האם EU AI Act חל על חברה ישראלית?`, a: `הוא עשוי לחול גם בלי נוכחות פיזית באירופה, כאשר המערכת מוצעת בשוק האירופי או כאשר הפלט שלה משמש בתוך האיחוד. לכן הצעד הראשון הוא מיפוי: היכן המשתמשים והיכן נעשה שימוש בפלט.` },
      { q: `כמה זמן לוקח לקבל חוות דעת?`, a: `זה תלוי בהיקף ובמורכבות. אבחון ראשוני נעשה בפגישה קצרה, וחוות דעת ממוקדת מוכנה בדרך כלל בתוך ימים ספורים עד שבועות, לפי כמות המסמכים והמערכות שנבחנות.` },
      { q: `האם חוות הדעת מחליפה את עורך הדין של החברה?`, a: `לא. חוות דעת שנייה נועדה לעבוד לצד היועץ המשפטי הקיים, לא במקומו. היא מוסיפה שכבת בדיקה בלתי תלויה ומחזקת את עמדת שני הצדדים.` },
    ],
    ctaH2: `מוכנים לחוות דעת בלתי תלויה על ה-AI שלכם?`,
    ctaBody: `פגישת אבחון קצרה ממפה את החשיפה שלכם ומגדירה מפת דרכים ברורה לניהול הסיכון.`,
    disclaimer: `המידע בעמוד זה כללי ואינו מהווה ייעוץ משפטי או תחליף לחוות דעת פרטנית.`,
  },
  realEstate: {
    title: `נדל"ן והתחדשות עירונית בארץ ובחו"ל: ייעוץ וחוות דעת שנייה`,
    desc: `ייעוץ משפטי עצמאי וחוות דעת שנייה בעסקאות נדל"ן בארץ ובחו"ל ובהתחדשות עירונית (תמ"א 38 ופינוי-בינוי), בשילוב Legal AI לבדיקת נאותות וניהול סיכונים.`,
    heroEyebrow: `ייעוץ וחוות דעת שנייה בנדל"ן, בארץ ובחו"ל`,
    lede: `עסקה בארץ, נכס מעבר לים, או פרויקט התחדשות עירונית: אלה זירות שבהן טעות חוזית אחת עולה ביוקר, ומעבר לים גם הדין החל אינו הדין שאתם מכירים. אנחנו נותנים ייעוץ משפטי עצמאי וחוות דעת שנייה בלתי תלויה, בשילוב כלי Legal AI, שהופכים מאות עמודי מסמכים לתמונת סיכון ברורה, לפני שאתם מתחייבים.`,
    labels: { covers: `מה הייעוץ מכסה`, when: `חוות דעת שנייה`, steps: `איך זה עובד`, related: `להעמקה`, faq: `שאלות ותשובות` },
    coversH2: `שכבת ההגנה המשפטית סביב העסקה שלכם`,
    cards: [
      { title: `עסקאות נדל"ן וחוזים`, body: `ליווי וייצוג בעסקאות מכר, רכישה והשקעה: בדיקת זכויות, ניסוח והגנה חוזית, מיסוי וזיהוי סיכונים מוקדם, לפני שהם הופכים לחשיפה.` },
      { title: `התחדשות עירונית: תמ"א 38 ופינוי-בינוי`, body: `ליווי בעלי דירות ונציגויות בפרויקטים מורכבים: בחינת הסכמי יזם, בטוחות, לוחות זמנים ומנגנוני הכרעה, לאיזון מול היזם ולהסכם בר-הגנה.` },
      { title: `עסקאות ונכסים בחו"ל`, body: `ליווי ישראלי לרוכש ולמשקיע מעבר לים: מבנה העסקה והחזקה, מיסוי בשתי המדינות, בדיקת מה שהדין המקומי באמת מחייב, ועבודה מול עורך הדין המקומי במקום במקומו.` },
      { title: `בדיקת נאותות וניהול סיכונים`, body: `מיפוי חשיפות משפטיות, זכויות בנייה, הערות אזהרה, מיסוי ובטוחות, ובניית ארכיטקטורת עסקה חסינה שמחזיקה גם כשמשהו משתבש.` },
      { title: `ניתוח מבוסס Legal AI`, body: `כלים מבוססי בינה מלאכותית סורקים מאות מסמכים, נספחים והסכמים, מחלצים סתירות וסיכונים, ומאיצים את הבדיקה, תמיד בפיקוח ובאישור עורך דין.` },
    ],
    whenH2: `מתי כדאי חוות דעת משפטית שנייה בנדל"ן`,
    whenLede: `חוות דעת שנייה בלתי תלויה אינה מגינה על החלטה שכבר התקבלה, אלא בוחנת אותה מחדש. היא מחזקת גם את הלקוח וגם את היועץ המייצג, ומספקת בסיס מתועד ובר-הגנה.`,
    when: [
      `לפני חתימה על חוזה רכישה או מכר של נכס`,
      `לפני חתימה על הסכם יזם בפרויקט תמ"א 38 או פינוי-בינוי`,
      `כשקיבלתם הסכם או חוות דעת ורוצים בדיקה בלתי תלויה`,
      `כשמתגלע סכסוך בין בעלי דירות, נציגות או מול היזם`,
      `לפני רכישת נכס או השקעה מעבר לים`,
      `לפני עסקת קומבינציה או עסקה מורכבת מול יזם`,
      `כשנדרש בסיס מתועד ובר-הגנה להחלטה`,
    ],
    stepsH2: `שלושה שלבים לחוות דעת בת-הגנה`,
    steps: [
      { title: `אבחון`, body: `ממפים את הנכס או הפרויקט, את הזכויות, החוזה והחשיפה המשפטית, ומזהים את נקודות התורפה המיידיות.` },
      { title: `חוות דעת בלתי תלויה`, body: `בוחנים מחדש את העסקה בעין ביקורתית, בשילוב משפט, כלכלה וכלי Legal AI לניתוח מסמכים וסיכונים.` },
      { title: `מפת דרכים לניהול סיכון`, body: `מוסרים מסמך בר-הגנה, ממוקד ומתועד, עם צעדים מעשיים להקטנת החשיפה ולחיזוק העמדה המשפטית.` },
    ],
    relatedH2: `מאמרים בנושא נדל"ן בארץ ובחו"ל, התחדשות עירונית ו-Legal AI`,
    faqH2: `ייעוץ וחוות דעת שנייה בנדל"ן והתחדשות עירונית`,
    faqs: [
      { q: `מה כוללת חוות דעת משפטית שנייה בעסקת נדל"ן?`, a: `בדיקה בלתי תלויה של רישום הזכויות, העיקולים והערות האזהרה, ההתאמה בין המצב הרשום למצב בפועל, חבויות המס, זכויות הבנייה והבטוחות המבטיחות את התמורה. המטרה אינה רק לאתר בעיה, אלא לבנות ארכיטקטורת עסקה שמחזיקה גם כאשר משהו משתבש.` },
      { q: `מתי כדאי חוות דעת שנייה בפרויקט תמ"א 38 או פינוי-בינוי?`, a: `לפני חתימה על הסכם היזם, וכן כאשר מתגלעת מחלוקת בין בעלי הדירות, הנציגות והיזם. בפרויקטים אלה יש מאות בעלי זכויות וחוזים מורכבים, ובדיקה בלתי תלויה של נוסח ההסכם היא ההגנה המרכזית מול פערי הכוחות שמול היזם.` },
      { q: `מה בודקים בהסכם מול יזם בהתחדשות עירונית?`, a: `את איתנות היזם, הבטוחות האוטונומיות הניתנות לבעלי הדירות, לוחות הזמנים ומנגנוני הפיצוי על איחור, השוויון בתמורות בין בעלי הדירות, מנגנון ההכרעה במחלוקות, ותנאי הביטול ומחיקת הערות האזהרה.` },
      { q: `כיצד Legal AI משתלב בבדיקה?`, a: `כלים מבוססי בינה מלאכותית סורקים מאות עמודי מסמכים, נספחים והסכמים בזמן קצר, מחלצים סתירות, סעיפים חסרים וחשיפות, ומצליבים אותם מול המצב המשפטי והכלכלי. הניתוח האלגוריתמי הוא נקודת פתיחה בלבד, וכל ממצא נבדק ומאושר בידי עורך דין.` },
      { q: `אני קונה נכס בחו"ל, למה צריך גם עורך דין ישראלי?`, a: `עורך הדין המקומי מכיר את הדין שלו, ולא את מה שהעסקה עושה לכם בישראל: חובות הדיווח, המיסוי הכפול והאמנה שמסדירה אותו, מבנה ההחזקה שנכון לתושב ישראלי, וההשלכות בהמשך על מכירה או על הורשה. הוא גם אינו מייצג אתכם מול המוכר או היזם באותה מידה שמייצג עורך דין שהלקוח שלו הוא אתם בלבד. שני התפקידים משלימים, והישראלי הוא זה שרואה את התמונה משני צדי הגבול.` },
      { q: `האם חוות דעת שנייה מחליפה את עורך הדין המלווה?`, a: `לא. היא בוחנת את העסקה מבחוץ ומאתרת נקודות עיוורון, ובכך מחזקת גם את הלקוח וגם את היועץ המייצג. שני התפקידים משלימים זה את זה ואינם מתחרים.` },
      { q: `כמה זמן לוקחת הבדיקה?`, a: `זה תלוי בהיקף המסמכים ובמורכבות העסקה. בדיקה של עסקת נכס בודד מתבצעת בדרך כלל בתוך ימים, ופרויקט התחדשות עירונית מלא דורש זמן ארוך יותר, בהתאם לכמות ההסכמים והנספחים.` },
    ],
    ctaH2: `מוכנים לחוות דעת בלתי תלויה על העסקה שלכם?`,
    ctaBody: `פגישת אבחון קצרה ממפה את החשיפה שלכם ומגדירה מפת דרכים ברורה לניהול הסיכון בעסקה או בפרויקט.`,
    disclaimer: `המידע בעמוד זה כללי ואינו מהווה ייעוץ משפטי או תחליף לחוות דעת פרטנית.`,
  },
};

const en: { ai: Copy; realEstate: Copy } = {
  ai: {
    title: `Independent AI legal advice and second opinions for companies and organizations`,
    desc: `Independent legal advice and second opinions for companies and organizations on artificial intelligence: AI governance, the EU AI Act, algorithmic liability, IP protection and risk management, by Dr. Avraham Lalum.`,
    heroEyebrow: `AI legal advice and second opinions`,
    lede: `Companies and organizations are adopting artificial intelligence faster than the legal framework can follow. We provide independent legal advice and an arm's length second opinion that turn algorithmic risk into a system you can control, before a regulator, a board or a claimant does it for you.`,
    labels: { covers: `What the advisory covers`, when: `Second opinion`, steps: `How it works`, related: `Further reading`, faq: `Questions and answers` },
    coversH2: `The legal protection layer around your AI`,
    cards: [
      { title: `EU AI Act and regulatory alignment`, body: `Mapping exposure against the strictest frameworks, risk classification of systems, transparency and documentation duties, translated into a practical compliance list by stage and risk.` },
      { title: `Algorithmic liability for the board`, body: `A compliance measure and an exposure matrix for officers, pricing legal liability early, before a regulator or a claimant prices it for you.` },
      { title: `Intellectual property and data protection`, body: `A protective layer around the technology, local and secured model environments, and a usage policy that prevents leakage of sensitive information and contamination of code with third party rights.` },
      { title: `Contracts with AI vendors`, body: `Re-examining vendor agreements, risk allocation, indemnity and liability clauses, so the contract protects the organization and not only the vendor.` },
    ],
    whenH2: `When an AI second opinion is worth it`,
    whenLede: `An independent second opinion does not defend a decision already taken, it re-examines it. It strengthens both the organization and the advising counsel, and provides a documented, defensible basis.`,
    when: [
      `Before deploying a new AI system in the organization`,
      `Before signing a contract with an artificial intelligence vendor`,
      `Before launching an algorithm based product or service`,
      `When there is regulatory uncertainty or personal exposure for officers`,
      `When an opinion has been received and you want an independent check`,
      `When a regulator, a board or a client requires a documented basis for a decision`,
    ],
    stepsH2: `Three steps to a defensible opinion`,
    steps: [
      { title: `Diagnosis`, body: `We map the technical architecture, the organizational structure and the regulatory exposure, and identify the immediate weak points.` },
      { title: `Independent opinion`, body: `We re-examine the decision or the system with a critical eye, cross-referencing law, economics and AI architecture.` },
      { title: `Risk management roadmap`, body: `We deliver a focused, documented and defensible paper, with practical steps to reduce exposure and meet regulatory duties.` },
    ],
    relatedH2: `Articles on advisory work, second opinions and AI liability`,
    faqH2: `AI legal advice and second opinions`,
    faqs: [
      { q: `What does an AI second opinion for companies and organizations cover?`, a: `An independent second opinion re-examines the organization's legal exposure from its use of artificial intelligence: EU AI Act alignment, algorithmic liability, privacy and intellectual property protection, and the structure of contracts with AI vendors. The aim is to identify risks before they materialize, and to give management and the board an informed basis for a decision.` },
      { q: `When should you seek outside legal advice before an AI decision?`, a: `Before deploying a new AI system, before signing with an AI vendor, before launching an algorithm based product, and whenever there is regulatory uncertainty or personal exposure for officers. Advice taken early is cheaper and faster than dealing with a claim or a fine after the fact.` },
      { q: `Is the advisory only for technology companies?`, a: `No. It serves technology companies, traditional corporations adopting AI, public bodies and authorities, and also lawyers and firms seeking an independent second opinion on a complex question. The core is the meeting point of law, economics and artificial intelligence.` },
      { q: `Does the EU AI Act apply to an Israeli company?`, a: `It may apply without any physical presence in Europe, where the system is placed on the European market or where its output is used within the Union. The first step is therefore mapping: where the users are, and where the output is used.` },
      { q: `How long does an opinion take?`, a: `It depends on scope and complexity. An initial diagnosis is done in a short meeting, and a focused opinion is usually ready within days to weeks, according to the volume of documents and systems examined.` },
      { q: `Does the opinion replace the company's own counsel?`, a: `No. A second opinion is designed to work alongside existing counsel, not instead of them. It adds an independent layer of review and strengthens both positions.` },
    ],
    ctaH2: `Ready for an independent opinion on your AI?`,
    ctaBody: `A short diagnostic meeting maps your exposure and sets a clear roadmap for managing the risk.`,
    disclaimer: `The information on this page is general and does not constitute legal advice or a substitute for a specific opinion.`,
  },
  realEstate: {
    title: `Real estate and urban renewal in Israel and abroad: advice and second opinions`,
    desc: `Independent legal advice and second opinions on real estate transactions in Israel and abroad and on urban renewal (TAMA 38 and evacuate and rebuild), combined with Legal AI for due diligence and risk management.`,
    heroEyebrow: `Real estate advice and second opinions, in Israel and abroad`,
    lede: `A transaction at home, a property overseas, or an urban renewal project: each is an arena where a single contractual mistake is expensive, and overseas the governing law is not the one you know. We provide independent legal advice and an arm's length second opinion, combined with Legal AI tools, that turn hundreds of pages of documents into a clear picture of risk, before you commit.`,
    labels: { covers: `What the advisory covers`, when: `Second opinion`, steps: `How it works`, related: `Further reading`, faq: `Questions and answers` },
    coversH2: `The legal protection layer around your transaction`,
    cards: [
      { title: `Real estate transactions and contracts`, body: `Guidance and representation in sale, purchase and investment transactions: title checks, drafting and contractual protection, taxation, and early identification of risks before they become exposure.` },
      { title: `Urban renewal: TAMA 38 and evacuate and rebuild`, body: `Guidance for apartment owners and owner committees in complex projects: reviewing developer agreements, guarantees, timetables and decision mechanisms, to balance the position against the developer and reach a defensible agreement.` },
      { title: `Transactions and property abroad`, body: `Israeli counsel beside the buyer and the investor overseas: the structure of the deal and of the holding, taxation in both countries, what the local law actually requires, and working with local counsel rather than in place of them.` },
      { title: `Due diligence and risk management`, body: `Mapping legal exposures, building rights, cautionary notes, taxation and guarantees, and building a resilient transaction architecture that holds even when something goes wrong.` },
      { title: `Legal AI based analysis`, body: `Artificial intelligence tools scan hundreds of documents, annexes and agreements, extract contradictions and risks, and accelerate the review, always under the supervision and approval of a lawyer.` },
    ],
    whenH2: `When a real estate second opinion is worth it`,
    whenLede: `An independent second opinion does not defend a decision already taken, it re-examines it. It strengthens both the client and the advising counsel, and provides a documented, defensible basis.`,
    when: [
      `Before signing a purchase or sale contract for a property`,
      `Before signing a developer agreement in a TAMA 38 or evacuate and rebuild project`,
      `When you have received an agreement or an opinion and want an independent check`,
      `When a dispute arises among apartment owners, the committee or with the developer`,
      `Before buying a property or investing overseas`,
      `Before a combination transaction or a complex deal with a developer`,
      `When a documented, defensible basis for a decision is required`,
    ],
    stepsH2: `Three steps to a defensible opinion`,
    steps: [
      { title: `Diagnosis`, body: `We map the property or the project, the rights, the contract and the legal exposure, and identify the immediate weak points.` },
      { title: `Independent opinion`, body: `We re-examine the transaction with a critical eye, combining law, economics and Legal AI tools for document and risk analysis.` },
      { title: `Risk management roadmap`, body: `We deliver a focused, documented and defensible paper, with practical steps to reduce exposure and strengthen the legal position.` },
    ],
    relatedH2: `Articles on real estate at home and abroad, urban renewal and Legal AI`,
    faqH2: `Real estate and urban renewal advice and second opinions`,
    faqs: [
      { q: `What does a real estate second opinion cover?`, a: `An independent review of the registration of rights, attachments and cautionary notes, the match between the registered position and the position on the ground, tax liabilities, building rights, and the guarantees securing the consideration. The aim is not only to find a problem, but to build a transaction architecture that holds even when something goes wrong.` },
      { q: `When is a second opinion worth it in a TAMA 38 or evacuate and rebuild project?`, a: `Before signing the developer agreement, and whenever a dispute arises among the apartment owners, the committee and the developer. These projects involve hundreds of rights holders and complex contracts, and an independent review of the agreement is the main protection against the imbalance of power with the developer.` },
      { q: `What is examined in a developer agreement in urban renewal?`, a: `The developer's financial strength, the autonomous guarantees given to the apartment owners, the timetables and the compensation mechanisms for delay, the equality of consideration among the owners, the dispute resolution mechanism, and the conditions for cancellation and deletion of cautionary notes.` },
      { q: `How does Legal AI fit into the review?`, a: `Artificial intelligence tools scan hundreds of pages of documents, annexes and agreements in a short time, extract contradictions, missing clauses and exposures, and cross-reference them against the legal and economic position. The algorithmic analysis is only a starting point, and every finding is checked and approved by a lawyer.` },
      { q: `I am buying a property abroad, why do I also need an Israeli lawyer?`, a: `Local counsel knows their own law, not what the transaction does to you in Israel: the reporting duties, double taxation and the treaty that governs it, the holding structure that suits an Israeli resident, and the later consequences on a sale or on inheritance. Nor do they represent you against the seller or developer the way a lawyer whose only client is you does. The two roles complement each other, and the Israeli one is what sees the picture on both sides of the border.` },
      { q: `Does a second opinion replace the lawyer handling the transaction?`, a: `No. It examines the transaction from the outside and finds blind spots, strengthening both the client and the advising counsel. The two roles complement each other rather than compete.` },
      { q: `How long does the review take?`, a: `It depends on the volume of documents and the complexity of the transaction. A single property transaction is usually reviewed within days, while a full urban renewal project takes longer, according to the number of agreements and annexes.` },
    ],
    ctaH2: `Ready for an independent opinion on your transaction?`,
    ctaBody: `A short diagnostic meeting maps your exposure and sets a clear roadmap for managing the risk in the transaction or the project.`,
    disclaimer: `The information on this page is general and does not constitute legal advice or a substitute for a specific opinion.`,
  },
};

const es: { ai: Copy; realEstate: Copy } = {
  ai: {
    title: `Asesoría jurídica independiente y segunda opinión en IA para empresas y organizaciones`,
    desc: `Asesoría jurídica independiente y segunda opinión para empresas y organizaciones en materia de inteligencia artificial: gobernanza de la IA, Reglamento Europeo de IA, responsabilidad algorítmica, protección de la propiedad intelectual y gestión de riesgos, por el Dr. Avraham Lalum.`,
    heroEyebrow: `Asesoría jurídica y segunda opinión en IA`,
    lede: `Las empresas y organizaciones adoptan la inteligencia artificial más rápido de lo que avanza el marco jurídico. Ofrecemos asesoría jurídica independiente y una segunda opinión imparcial que convierten el riesgo algorítmico en un sistema que usted puede controlar, antes de que lo haga un regulador, un consejo de administración o un demandante.`,
    labels: { covers: `Qué cubre la asesoría`, when: `Segunda opinión`, steps: `Cómo funciona`, related: `Para profundizar`, faq: `Preguntas y respuestas` },
    coversH2: `La capa de protección jurídica alrededor de su IA`,
    cards: [
      { title: `Adecuación al Reglamento Europeo de IA`, body: `Mapeo de la exposición frente a los marcos más estrictos, clasificación del riesgo de los sistemas, obligaciones de transparencia y documentación, traducidos a una lista de cumplimiento práctica por fase y riesgo.` },
      { title: `Responsabilidad algorítmica para el consejo`, body: `Un índice de cumplimiento y una matriz de exposición para los administradores, que ponen precio a la responsabilidad jurídica de forma temprana, antes de que lo haga un regulador o un demandante.` },
      { title: `Propiedad intelectual y protección de datos`, body: `Una capa de protección sobre la tecnología, entornos de modelo locales y seguros, y una política de uso que evita la fuga de información sensible y la contaminación del código con derechos de terceros.` },
      { title: `Contratos con proveedores de IA`, body: `Revisión de los acuerdos con proveedores, asignación de riesgos, cláusulas de indemnidad y responsabilidad, de modo que el contrato proteja a la organización y no solo al proveedor.` },
    ],
    whenH2: `Cuándo conviene una segunda opinión jurídica en IA`,
    whenLede: `Una segunda opinión independiente no defiende una decisión ya tomada, sino que la vuelve a examinar. Refuerza tanto a la organización como al asesor que la representa, y aporta una base documentada y defendible.`,
    when: [
      `Antes de implantar un nuevo sistema de IA en la organización`,
      `Antes de firmar un contrato con un proveedor de inteligencia artificial`,
      `Antes de lanzar un producto o servicio basado en algoritmos`,
      `Cuando existe incertidumbre regulatoria o exposición personal de los administradores`,
      `Cuando se ha recibido un dictamen y se desea una verificación independiente`,
      `Cuando un regulador, un consejo o un cliente exige una base documentada para la decisión`,
    ],
    stepsH2: `Tres pasos hacia un dictamen defendible`,
    steps: [
      { title: `Diagnóstico`, body: `Mapeamos la arquitectura tecnológica, la estructura organizativa y la exposición regulatoria, e identificamos los puntos débiles inmediatos.` },
      { title: `Dictamen independiente`, body: `Volvemos a examinar la decisión o el sistema con mirada crítica, cruzando derecho, economía y arquitectura de IA.` },
      { title: `Hoja de ruta de gestión del riesgo`, body: `Entregamos un documento enfocado, documentado y defendible, con pasos prácticos para reducir la exposición y cumplir con la normativa.` },
    ],
    relatedH2: `Artículos sobre asesoría, segunda opinión y responsabilidad en IA`,
    faqH2: `Asesoría jurídica y segunda opinión en IA`,
    faqs: [
      { q: `¿Qué incluye una segunda opinión jurídica sobre IA para empresas y organizaciones?`, a: `Una segunda opinión independiente vuelve a examinar la exposición jurídica de la organización derivada del uso de inteligencia artificial: adecuación al Reglamento Europeo de IA, responsabilidad algorítmica, protección de la privacidad y de la propiedad intelectual, y la estructura de los contratos con proveedores de IA. El objetivo es detectar riesgos antes de que se materialicen y dar a la dirección y al consejo una base informada para decidir.` },
      { q: `¿Cuándo conviene acudir a asesoría jurídica externa antes de una decisión sobre IA?`, a: `Antes de implantar un nuevo sistema de IA, antes de firmar con un proveedor, antes de lanzar un producto basado en algoritmos, y cuando existe incertidumbre regulatoria o exposición personal de los administradores. Asesorarse a tiempo resulta más barato y más rápido que afrontar una demanda o una sanción después.` },
      { q: `¿La asesoría es solo para empresas tecnológicas?`, a: `No. El servicio se dirige a empresas tecnológicas, a corporaciones tradicionales que adoptan IA, a organismos públicos y autoridades, y también a abogados y despachos que buscan una segunda opinión independiente sobre una cuestión compleja. El núcleo es el encuentro entre derecho, economía e inteligencia artificial.` },
      { q: `¿El Reglamento Europeo de IA se aplica a una empresa israelí?`, a: `Puede aplicarse incluso sin presencia física en Europa, cuando el sistema se ofrece en el mercado europeo o cuando su resultado se utiliza dentro de la Unión. Por eso el primer paso es el mapeo: dónde están los usuarios y dónde se usa el resultado.` },
      { q: `¿Cuánto tarda un dictamen?`, a: `Depende del alcance y de la complejidad. El diagnóstico inicial se realiza en una reunión breve, y un dictamen enfocado suele estar listo en un plazo de días a semanas, según el volumen de documentos y sistemas examinados.` },
      { q: `¿El dictamen sustituye al abogado de la empresa?`, a: `No. Una segunda opinión está pensada para trabajar junto al asesor jurídico existente, no en su lugar. Añade una capa de revisión independiente y refuerza ambas posiciones.` },
    ],
    ctaH2: `¿Listos para una opinión independiente sobre su IA?`,
    ctaBody: `Una reunión de diagnóstico breve mapea su exposición y define una hoja de ruta clara para gestionar el riesgo.`,
    disclaimer: `La información de esta página es general y no constituye asesoramiento jurídico ni sustituye a un dictamen específico.`,
  },
  realEstate: {
    title: `Inmobiliario y renovación urbana en Israel y en el extranjero`,
    desc: `Asesoría jurídica independiente y segunda opinión en operaciones inmobiliarias en Israel y en el extranjero y en renovación urbana (TAMA 38 y demolición y reconstrucción), con Legal AI para la debida diligencia y la gestión de riesgos.`,
    heroEyebrow: `Asesoría y segunda opinión inmobiliaria, en Israel y fuera`,
    lede: `Una operación en el país, un inmueble al otro lado del mar o un proyecto de renovación urbana: en cada uno un solo error contractual sale caro, y fuera del país la ley aplicable tampoco es la que usted conoce. Ofrecemos asesoría jurídica independiente y una segunda opinión imparcial, con herramientas de Legal AI, que convierten cientos de páginas de documentos en un panorama claro del riesgo, antes de que usted se comprometa.`,
    labels: { covers: `Qué cubre la asesoría`, when: `Segunda opinión`, steps: `Cómo funciona`, related: `Para profundizar`, faq: `Preguntas y respuestas` },
    coversH2: `La capa de protección jurídica alrededor de su operación`,
    cards: [
      { title: `Operaciones inmobiliarias y contratos`, body: `Acompañamiento y representación en operaciones de compraventa e inversión: comprobación de derechos, redacción y protección contractual, fiscalidad e identificación temprana de riesgos, antes de que se conviertan en exposición.` },
      { title: `Renovación urbana: TAMA 38 y demolición y reconstrucción`, body: `Acompañamiento a propietarios y comisiones de vecinos en proyectos complejos: revisión de los acuerdos con el promotor, garantías, plazos y mecanismos de resolución, para equilibrar la posición frente al promotor y alcanzar un acuerdo defendible.` },
      { title: `Operaciones e inmuebles en el extranjero`, body: `Acompañamiento israelí al comprador y al inversor fuera del país: la estructura de la operación y de la tenencia, la fiscalidad en ambos países, qué exige realmente la ley local, y el trabajo junto al abogado local y no en su lugar.` },
      { title: `Debida diligencia y gestión de riesgos`, body: `Mapeo de exposiciones jurídicas, derechos de edificación, anotaciones preventivas, fiscalidad y garantías, y construcción de una arquitectura de operación resistente que aguanta incluso cuando algo falla.` },
      { title: `Análisis basado en Legal AI`, body: `Las herramientas de inteligencia artificial revisan cientos de documentos, anexos y acuerdos, extraen contradicciones y riesgos y aceleran la revisión, siempre bajo la supervisión y aprobación de un abogado.` },
    ],
    whenH2: `Cuándo conviene una segunda opinión jurídica en inmobiliario`,
    whenLede: `Una segunda opinión independiente no defiende una decisión ya tomada, sino que la vuelve a examinar. Refuerza tanto al cliente como al asesor que lo representa, y aporta una base documentada y defendible.`,
    when: [
      `Antes de firmar un contrato de compra o venta de un inmueble`,
      `Antes de firmar un acuerdo con el promotor en un proyecto TAMA 38 o de demolición y reconstrucción`,
      `Cuando ha recibido un acuerdo o un dictamen y desea una verificación independiente`,
      `Cuando surge un conflicto entre propietarios, la comisión de vecinos o con el promotor`,
      `Antes de comprar un inmueble o invertir al otro lado del mar`,
      `Antes de una operación de permuta o de una operación compleja con un promotor`,
      `Cuando se requiere una base documentada y defendible para la decisión`,
    ],
    stepsH2: `Tres pasos hacia un dictamen defendible`,
    steps: [
      { title: `Diagnóstico`, body: `Mapeamos el inmueble o el proyecto, los derechos, el contrato y la exposición jurídica, e identificamos los puntos débiles inmediatos.` },
      { title: `Dictamen independiente`, body: `Volvemos a examinar la operación con mirada crítica, combinando derecho, economía y herramientas de Legal AI para el análisis de documentos y riesgos.` },
      { title: `Hoja de ruta de gestión del riesgo`, body: `Entregamos un documento enfocado, documentado y defendible, con pasos prácticos para reducir la exposición y reforzar la posición jurídica.` },
    ],
    relatedH2: `Artículos sobre inmobiliario dentro y fuera del país, renovación urbana y Legal AI`,
    faqH2: `Asesoría y segunda opinión en inmobiliario y renovación urbana`,
    faqs: [
      { q: `¿Qué incluye una segunda opinión jurídica en una operación inmobiliaria?`, a: `Una revisión independiente de la inscripción de los derechos, los embargos y las anotaciones preventivas, la correspondencia entre la situación registral y la situación real, las obligaciones fiscales, los derechos de edificación y las garantías que aseguran la contraprestación. El objetivo no es solo detectar un problema, sino construir una arquitectura de operación que aguante incluso cuando algo falla.` },
      { q: `¿Cuándo conviene una segunda opinión en un proyecto TAMA 38 o de demolición y reconstrucción?`, a: `Antes de firmar el acuerdo con el promotor, y cuando surge una discrepancia entre los propietarios, la comisión de vecinos y el promotor. En estos proyectos intervienen cientos de titulares de derechos y contratos complejos, y una revisión independiente del acuerdo es la principal protección frente al desequilibrio de fuerzas con el promotor.` },
      { q: `¿Qué se examina en un acuerdo con el promotor en renovación urbana?`, a: `La solvencia del promotor, las garantías autónomas otorgadas a los propietarios, los plazos y los mecanismos de compensación por retraso, la igualdad de contraprestación entre los propietarios, el mecanismo de resolución de controversias y las condiciones de cancelación y de levantamiento de las anotaciones preventivas.` },
      { q: `¿Cómo se integra Legal AI en la revisión?`, a: `Las herramientas de inteligencia artificial revisan cientos de páginas de documentos, anexos y acuerdos en poco tiempo, extraen contradicciones, cláusulas ausentes y exposiciones, y las contrastan con la situación jurídica y económica. El análisis algorítmico es solo un punto de partida, y cada hallazgo es verificado y aprobado por un abogado.` },
      { q: `Compro un inmueble en el extranjero, ¿por qué necesito además un abogado israelí?`, a: `El abogado local conoce su propia ley, no lo que la operación produce en Israel: los deberes de declaración, la doble imposición y el convenio que la regula, la estructura de tenencia adecuada para un residente israelí, y las consecuencias posteriores en una venta o en una sucesión. Tampoco le representa frente al vendedor o al promotor como lo hace un abogado cuyo único cliente es usted. Los dos papeles se complementan, y el israelí es el que ve el cuadro a ambos lados de la frontera.` },
      { q: `¿Una segunda opinión sustituye al abogado que lleva la operación?`, a: `No. Examina la operación desde fuera y detecta puntos ciegos, reforzando así tanto al cliente como al asesor que lo representa. Los dos papeles se complementan en lugar de competir.` },
      { q: `¿Cuánto dura la revisión?`, a: `Depende del volumen de documentos y de la complejidad de la operación. La revisión de una operación de un único inmueble suele realizarse en días, mientras que un proyecto completo de renovación urbana requiere más tiempo, según la cantidad de acuerdos y anexos.` },
    ],
    ctaH2: `¿Listos para una opinión independiente sobre su operación?`,
    ctaBody: `Una reunión de diagnóstico breve mapea su exposición y define una hoja de ruta clara para gestionar el riesgo en la operación o en el proyecto.`,
    disclaimer: `La información de esta página es general y no constituye asesoramiento jurídico ni sustituye a un dictamen específico.`,
  },
};

const fr: { ai: Copy; realEstate: Copy } = {
  ai: {
    title: `Conseil juridique indépendant et deuxième avis en IA pour les entreprises et les organisations`,
    desc: `Conseil juridique indépendant et deuxième avis pour les entreprises et les organisations en matière d'intelligence artificielle : gouvernance de l'IA, règlement européen sur l'IA, responsabilité algorithmique, protection de la propriété intellectuelle et gestion des risques, par le Dr Avraham Lalum.`,
    heroEyebrow: `Conseil juridique et deuxième avis en IA`,
    lede: `Les entreprises et les organisations adoptent l'intelligence artificielle plus vite que le cadre juridique ne progresse. Nous apportons un conseil juridique indépendant et un deuxième avis impartial qui transforment le risque algorithmique en un système que vous pouvez maîtriser, avant qu'un régulateur, un conseil d'administration ou un demandeur ne le fasse à votre place.`,
    labels: { covers: `Ce que couvre le conseil`, when: `Deuxième avis`, steps: `Comment cela fonctionne`, related: `Pour approfondir`, faq: `Questions et réponses` },
    coversH2: `La couche de protection juridique autour de votre IA`,
    cards: [
      { title: `Conformité au règlement européen sur l'IA`, body: `Cartographie de l'exposition face aux cadres les plus stricts, classification du risque des systèmes, obligations de transparence et de documentation, traduites en une liste de conformité pratique par étape et par risque.` },
      { title: `Responsabilité algorithmique pour le conseil`, body: `Un indice de conformité et une matrice d'exposition pour les dirigeants, qui chiffrent la responsabilité juridique tôt, avant qu'un régulateur ou un demandeur ne le fasse.` },
      { title: `Propriété intellectuelle et protection des données`, body: `Une couche de protection sur la technologie, des environnements de modèle locaux et sécurisés, et une politique d'usage qui empêche la fuite d'informations sensibles et la contamination du code par des droits de tiers.` },
      { title: `Contrats avec les fournisseurs d'IA`, body: `Réexamen des accords fournisseurs, répartition des risques, clauses d'indemnisation et de responsabilité, afin que le contrat protège l'organisation et pas seulement le fournisseur.` },
    ],
    whenH2: `Quand un deuxième avis juridique en IA est utile`,
    whenLede: `Un deuxième avis indépendant ne défend pas une décision déjà prise, il la réexamine. Il renforce à la fois l'organisation et le conseil qui la représente, et fournit une base documentée et défendable.`,
    when: [
      `Avant de déployer un nouveau système d'IA dans l'organisation`,
      `Avant de signer un contrat avec un fournisseur d'intelligence artificielle`,
      `Avant de lancer un produit ou un service fondé sur un algorithme`,
      `En cas d'incertitude réglementaire ou d'exposition personnelle des dirigeants`,
      `Lorsqu'un avis a été reçu et que vous souhaitez une vérification indépendante`,
      `Lorsqu'un régulateur, un conseil ou un client exige une base documentée pour la décision`,
    ],
    stepsH2: `Trois étapes vers un avis défendable`,
    steps: [
      { title: `Diagnostic`, body: `Nous cartographions l'architecture technologique, la structure organisationnelle et l'exposition réglementaire, et identifions les points faibles immédiats.` },
      { title: `Avis indépendant`, body: `Nous réexaminons la décision ou le système d'un œil critique, en croisant droit, économie et architecture de l'IA.` },
      { title: `Feuille de route de gestion du risque`, body: `Nous remettons un document ciblé, documenté et défendable, avec des étapes concrètes pour réduire l'exposition et respecter la réglementation.` },
    ],
    relatedH2: `Articles sur le conseil, le deuxième avis et la responsabilité en IA`,
    faqH2: `Conseil juridique et deuxième avis en IA`,
    faqs: [
      { q: `Que comprend un deuxième avis juridique sur l'IA pour les entreprises et les organisations ?`, a: `Un deuxième avis indépendant réexamine l'exposition juridique de l'organisation liée à son usage de l'intelligence artificielle : conformité au règlement européen sur l'IA, responsabilité algorithmique, protection de la vie privée et de la propriété intellectuelle, et structure des contrats avec les fournisseurs d'IA. L'objectif est d'identifier les risques avant qu'ils ne se réalisent et de donner à la direction et au conseil une base éclairée pour décider.` },
      { q: `Quand faut-il consulter un conseil juridique externe avant une décision liée à l'IA ?`, a: `Avant de déployer un nouveau système d'IA, avant de signer avec un fournisseur, avant de lancer un produit fondé sur un algorithme, et en cas d'incertitude réglementaire ou d'exposition personnelle des dirigeants. Un conseil pris tôt coûte moins cher et va plus vite que la gestion d'une réclamation ou d'une amende après coup.` },
      { q: `Le conseil s'adresse-t-il uniquement aux entreprises technologiques ?`, a: `Non. Le service s'adresse aux entreprises technologiques, aux groupes traditionnels qui adoptent l'IA, aux organismes publics et aux autorités, ainsi qu'aux avocats et cabinets qui souhaitent un deuxième avis indépendant sur une question complexe. Le cœur du sujet est la rencontre entre le droit, l'économie et l'intelligence artificielle.` },
      { q: `Le règlement européen sur l'IA s'applique-t-il à une société israélienne ?`, a: `Il peut s'appliquer même sans présence physique en Europe, lorsque le système est mis sur le marché européen ou lorsque son résultat est utilisé au sein de l'Union. La première étape est donc la cartographie : où se trouvent les utilisateurs et où le résultat est utilisé.` },
      { q: `Combien de temps faut-il pour obtenir un avis ?`, a: `Cela dépend de l'ampleur et de la complexité. Le diagnostic initial se fait lors d'une courte réunion, et un avis ciblé est généralement prêt en quelques jours à quelques semaines, selon le volume de documents et de systèmes examinés.` },
      { q: `L'avis remplace-t-il l'avocat de l'entreprise ?`, a: `Non. Un deuxième avis est conçu pour travailler aux côtés du conseil juridique existant, et non à sa place. Il ajoute une couche de vérification indépendante et renforce les deux positions.` },
    ],
    ctaH2: `Prêts pour un avis indépendant sur votre IA ?`,
    ctaBody: `Une courte réunion de diagnostic cartographie votre exposition et définit une feuille de route claire pour gérer le risque.`,
    disclaimer: `Les informations de cette page sont générales et ne constituent ni un conseil juridique ni un substitut à un avis particulier.`,
  },
  realEstate: {
    title: `Immobilier et renouvellement urbain, en Israël et à l'étranger`,
    desc: `Conseil juridique indépendant et deuxième avis sur les transactions immobilières en Israël et à l'étranger et sur le renouvellement urbain (TAMA 38 et démolition reconstruction), avec le Legal AI pour la due diligence et la gestion des risques.`,
    heroEyebrow: `Conseil et deuxième avis en immobilier, ici et à l'étranger`,
    lede: `Une transaction au pays, un bien de l'autre côté de la mer, ou un projet de renouvellement urbain : dans chacun, une seule erreur contractuelle coûte cher, et à l'étranger la loi applicable n'est pas celle que vous connaissez. Nous apportons un conseil juridique indépendant et un deuxième avis impartial, avec des outils de Legal AI, qui transforment des centaines de pages de documents en une image claire du risque, avant que vous ne vous engagiez.`,
    labels: { covers: `Ce que couvre le conseil`, when: `Deuxième avis`, steps: `Comment cela fonctionne`, related: `Pour approfondir`, faq: `Questions et réponses` },
    coversH2: `La couche de protection juridique autour de votre transaction`,
    cards: [
      { title: `Transactions immobilières et contrats`, body: `Accompagnement et représentation dans les opérations de vente, d'achat et d'investissement : vérification des droits, rédaction et protection contractuelle, fiscalité et identification précoce des risques, avant qu'ils ne deviennent une exposition.` },
      { title: `Renouvellement urbain : TAMA 38 et démolition reconstruction`, body: `Accompagnement des copropriétaires et des comités dans des projets complexes : examen des accords avec le promoteur, garanties, calendriers et mécanismes de règlement, pour rééquilibrer la position face au promoteur et obtenir un accord défendable.` },
      { title: `Transactions et biens à l'étranger`, body: `Un accompagnement israélien aux côtés de l'acquéreur et de l'investisseur à l'étranger : la structure de l'opération et de la détention, la fiscalité dans les deux pays, ce que le droit local exige réellement, et le travail avec l'avocat local plutôt qu'à sa place.` },
      { title: `Due diligence et gestion des risques`, body: `Cartographie des expositions juridiques, des droits à construire, des mentions conservatoires, de la fiscalité et des garanties, et construction d'une architecture de transaction résistante qui tient même lorsque quelque chose dérape.` },
      { title: `Analyse fondée sur le Legal AI`, body: `Les outils d'intelligence artificielle parcourent des centaines de documents, annexes et accords, en extraient contradictions et risques et accélèrent l'examen, toujours sous la supervision et l'approbation d'un avocat.` },
    ],
    whenH2: `Quand un deuxième avis juridique en immobilier est utile`,
    whenLede: `Un deuxième avis indépendant ne défend pas une décision déjà prise, il la réexamine. Il renforce à la fois le client et le conseil qui le représente, et fournit une base documentée et défendable.`,
    when: [
      `Avant de signer un contrat d'achat ou de vente d'un bien`,
      `Avant de signer un accord avec le promoteur dans un projet TAMA 38 ou de démolition reconstruction`,
      `Lorsque vous avez reçu un accord ou un avis et souhaitez une vérification indépendante`,
      `Lorsqu'un litige survient entre copropriétaires, avec le comité ou avec le promoteur`,
      `Avant d'acheter un bien ou d'investir à l'étranger`,
      `Avant une opération de dation en paiement ou une opération complexe avec un promoteur`,
      `Lorsqu'une base documentée et défendable est requise pour la décision`,
    ],
    stepsH2: `Trois étapes vers un avis défendable`,
    steps: [
      { title: `Diagnostic`, body: `Nous cartographions le bien ou le projet, les droits, le contrat et l'exposition juridique, et identifions les points faibles immédiats.` },
      { title: `Avis indépendant`, body: `Nous réexaminons la transaction d'un œil critique, en combinant droit, économie et outils de Legal AI pour l'analyse des documents et des risques.` },
      { title: `Feuille de route de gestion du risque`, body: `Nous remettons un document ciblé, documenté et défendable, avec des étapes concrètes pour réduire l'exposition et renforcer la position juridique.` },
    ],
    relatedH2: `Articles sur l'immobilier ici et à l'étranger, le renouvellement urbain et le Legal AI`,
    faqH2: `Conseil et deuxième avis en immobilier et renouvellement urbain`,
    faqs: [
      { q: `Que comprend un deuxième avis juridique dans une transaction immobilière ?`, a: `Un examen indépendant de l'inscription des droits, des saisies et des mentions conservatoires, de la correspondance entre la situation inscrite et la situation réelle, des obligations fiscales, des droits à construire et des garanties qui sécurisent la contrepartie. L'objectif n'est pas seulement de trouver un problème, mais de construire une architecture de transaction qui tient même lorsque quelque chose dérape.` },
      { q: `Quand un deuxième avis est-il utile dans un projet TAMA 38 ou de démolition reconstruction ?`, a: `Avant de signer l'accord avec le promoteur, et lorsqu'un désaccord survient entre les copropriétaires, le comité et le promoteur. Ces projets impliquent des centaines de titulaires de droits et des contrats complexes, et un examen indépendant de l'accord est la protection principale face au déséquilibre des forces avec le promoteur.` },
      { q: `Qu'examine-t-on dans un accord avec le promoteur en renouvellement urbain ?`, a: `La solidité financière du promoteur, les garanties autonomes accordées aux copropriétaires, les calendriers et les mécanismes d'indemnisation en cas de retard, l'égalité des contreparties entre les copropriétaires, le mécanisme de règlement des différends, et les conditions de résiliation et de radiation des mentions conservatoires.` },
      { q: `Comment le Legal AI s'intègre-t-il à l'examen ?`, a: `Les outils d'intelligence artificielle parcourent des centaines de pages de documents, annexes et accords en peu de temps, en extraient contradictions, clauses manquantes et expositions, et les recoupent avec la situation juridique et économique. L'analyse algorithmique n'est qu'un point de départ, et chaque constat est vérifié et validé par un avocat.` },
      { q: `J'achète un bien à l'étranger, pourquoi aussi un avocat israélien ?`, a: `L'avocat local connaît son propre droit, non ce que l'opération produit pour vous en Israël : les obligations déclaratives, la double imposition et la convention qui la régit, la structure de détention adaptée à un résident israélien, et les conséquences ultérieures lors d'une vente ou d'une succession. Il ne vous représente pas non plus face au vendeur ou au promoteur comme le fait un avocat dont vous êtes le seul client. Les deux rôles sont complémentaires, et l'israélien est celui qui voit le tableau des deux côtés de la frontière.` },
      { q: `Un deuxième avis remplace-t-il l'avocat qui suit la transaction ?`, a: `Non. Il examine la transaction de l'extérieur et repère les angles morts, renforçant ainsi le client comme le conseil qui le représente. Les deux rôles se complètent au lieu de se concurrencer.` },
      { q: `Combien de temps dure l'examen ?`, a: `Cela dépend du volume de documents et de la complexité de la transaction. L'examen d'une opération portant sur un seul bien se fait généralement en quelques jours, tandis qu'un projet complet de renouvellement urbain demande plus de temps, selon le nombre d'accords et d'annexes.` },
    ],
    ctaH2: `Prêts pour un avis indépendant sur votre transaction ?`,
    ctaBody: `Une courte réunion de diagnostic cartographie votre exposition et définit une feuille de route claire pour gérer le risque de l'opération ou du projet.`,
    disclaimer: `Les informations de cette page sont générales et ne constituent ni un conseil juridique ni un substitut à un avis particulier.`,
  },
};

const ar: { ai: Copy; realEstate: Copy } = {
  ai: {
    title: `استشارة قانونية مستقلة ورأي ثانٍ في الذكاء الاصطناعي للشركات والمؤسسات`,
    desc: `استشارة قانونية مستقلة ورأي ثانٍ للشركات والمؤسسات في مجال الذكاء الاصطناعي: حوكمة الذكاء الاصطناعي، قانون الذكاء الاصطناعي الأوروبي، المسؤولية الخوارزمية، حماية الملكية الفكرية وإدارة المخاطر، بقلم د. أبراهام لالوم.`,
    heroEyebrow: `استشارة قانونية ورأي ثانٍ في الذكاء الاصطناعي`,
    lede: `تتبنى الشركات والمؤسسات الذكاء الاصطناعي بوتيرة أسرع مما يواكبه الإطار القانوني. نقدم استشارة قانونية مستقلة ورأياً ثانياً محايداً يحولان المخاطر الخوارزمية إلى منظومة يمكنكم التحكم بها، قبل أن يقوم بذلك جهة تنظيمية أو مجلس إدارة أو مدّعٍ نيابة عنكم.`,
    labels: { covers: `ما تغطيه الاستشارة`, when: `رأي ثانٍ`, steps: `كيف تسير العملية`, related: `لمزيد من التعمق`, faq: `أسئلة وأجوبة` },
    coversH2: `طبقة الحماية القانونية حول الذكاء الاصطناعي لديكم`,
    cards: [
      { title: `الامتثال لقانون الذكاء الاصطناعي الأوروبي`, body: `رسم خريطة التعرض أمام الأطر الأكثر صرامة، تصنيف مخاطر الأنظمة، واجبات الشفافية والتوثيق، وترجمتها إلى قائمة امتثال عملية بحسب المرحلة والمخاطر.` },
      { title: `المسؤولية الخوارزمية لمجلس الإدارة`, body: `مؤشر امتثال ومصفوفة تعرض لأعضاء الإدارة، يسعّران المسؤولية القانونية مبكراً، قبل أن تفعل ذلك جهة تنظيمية أو مدّعٍ.` },
      { title: `الملكية الفكرية وحماية البيانات`, body: `طبقة حماية للتقنية، بيئات نماذج محلية ومؤمّنة، وسياسة استخدام تمنع تسرب المعلومات الحساسة وتلوث الشيفرة بحقوق أطراف ثالثة.` },
      { title: `العقود مع مزودي الذكاء الاصطناعي`, body: `إعادة فحص اتفاقيات المزودين، توزيع المخاطر، بنود التعويض والمسؤولية، بحيث يحمي العقد المؤسسة لا المزود وحده.` },
    ],
    whenH2: `متى يستحق الرأي القانوني الثاني في الذكاء الاصطناعي`,
    whenLede: `الرأي الثاني المستقل لا يدافع عن قرار سبق اتخاذه، بل يعيد فحصه. وهو يعزز المؤسسة والمستشار الممثل لها معاً، ويوفر أساساً موثقاً وقابلاً للدفاع عنه.`,
    when: [
      `قبل تطبيق نظام ذكاء اصطناعي جديد في المؤسسة`,
      `قبل توقيع عقد مع مزود خدمات ذكاء اصطناعي`,
      `قبل إطلاق منتج أو خدمة قائمة على خوارزمية`,
      `عند وجود عدم يقين تنظيمي أو تعرض شخصي لأعضاء الإدارة`,
      `عند تلقي رأي قانوني والرغبة في فحص مستقل`,
      `عندما تطلب جهة تنظيمية أو مجلس إدارة أو عميل أساساً موثقاً للقرار`,
    ],
    stepsH2: `ثلاث خطوات نحو رأي قابل للدفاع عنه`,
    steps: [
      { title: `التشخيص`, body: `نرسم خريطة البنية التقنية والهيكل التنظيمي والتعرض التنظيمي، ونحدد نقاط الضعف المباشرة.` },
      { title: `رأي مستقل`, body: `نعيد فحص القرار أو النظام بعين نقدية، مع تقاطع بين القانون والاقتصاد وبنية الذكاء الاصطناعي.` },
      { title: `خارطة طريق لإدارة المخاطر`, body: `نسلّم وثيقة مركزة وموثقة وقابلة للدفاع عنها، مع خطوات عملية لتقليل التعرض والامتثال للتنظيم.` },
    ],
    relatedH2: `مقالات في الاستشارة والرأي الثاني والمسؤولية عن الذكاء الاصطناعي`,
    faqH2: `استشارة قانونية ورأي ثانٍ في الذكاء الاصطناعي`,
    faqs: [
      { q: `ماذا يشمل الرأي القانوني الثاني في الذكاء الاصطناعي للشركات والمؤسسات؟`, a: `يعيد الرأي الثاني المستقل فحص التعرض القانوني للمؤسسة الناتج عن استخدامها للذكاء الاصطناعي: الامتثال لقانون الذكاء الاصطناعي الأوروبي، المسؤولية الخوارزمية، حماية الخصوصية والملكية الفكرية، وبنية العقود مع مزودي الذكاء الاصطناعي. الهدف هو رصد المخاطر قبل وقوعها، ومنح الإدارة ومجلس الإدارة أساساً واعياً لاتخاذ القرار.` },
      { q: `متى ينبغي طلب استشارة قانونية خارجية قبل قرار يتعلق بالذكاء الاصطناعي؟`, a: `قبل تطبيق نظام ذكاء اصطناعي جديد، وقبل التوقيع مع مزود، وقبل إطلاق منتج قائم على خوارزمية، وعند وجود عدم يقين تنظيمي أو تعرض شخصي لأعضاء الإدارة. الاستشارة المبكرة أقل كلفة وأسرع من مواجهة دعوى أو غرامة لاحقاً.` },
      { q: `هل الاستشارة مخصصة لشركات التقنية فقط؟`, a: `لا. الخدمة موجهة لشركات التقنية، وللشركات التقليدية التي تتبنى الذكاء الاصطناعي، وللجهات العامة والسلطات، وكذلك للمحامين والمكاتب التي تطلب رأياً ثانياً مستقلاً في مسألة معقدة. الجوهر هو الالتقاء بين القانون والاقتصاد والذكاء الاصطناعي.` },
      { q: `هل ينطبق قانون الذكاء الاصطناعي الأوروبي على شركة إسرائيلية؟`, a: `قد ينطبق حتى دون وجود مادي في أوروبا، عندما يُطرح النظام في السوق الأوروبية أو عندما تُستخدم مخرجاته داخل الاتحاد. لذلك فإن الخطوة الأولى هي رسم الخريطة: أين المستخدمون وأين تُستخدم المخرجات.` },
      { q: `كم يستغرق إعداد الرأي؟`, a: `يعتمد ذلك على النطاق ودرجة التعقيد. يجري التشخيص الأولي في لقاء قصير، ويكون الرأي المركز جاهزاً عادة خلال أيام إلى أسابيع، بحسب حجم المستندات والأنظمة التي تُفحص.` },
      { q: `هل يحل الرأي محل المستشار القانوني للشركة؟`, a: `لا. الرأي الثاني مصمم للعمل إلى جانب المستشار القانوني القائم، لا بديلاً عنه. فهو يضيف طبقة فحص مستقلة ويعزز الموقفين معاً.` },
    ],
    ctaH2: `هل أنتم مستعدون لرأي مستقل حول الذكاء الاصطناعي لديكم؟`,
    ctaBody: `لقاء تشخيصي قصير يرسم خريطة تعرضكم ويحدد خارطة طريق واضحة لإدارة المخاطر.`,
    disclaimer: `المعلومات في هذه الصفحة عامة ولا تشكل استشارة قانونية ولا بديلاً عن رأي قانوني خاص.`,
  },
  realEstate: {
    title: `العقارات والتجديد الحضري في إسرائيل وخارجها: استشارة ورأي ثانٍ`,
    desc: `استشارة قانونية مستقلة ورأي ثانٍ في الصفقات العقارية داخل البلاد وخارجها وفي التجديد الحضري (تاما 38 والهدم وإعادة البناء)، مع الذكاء الاصطناعي القانوني للعناية الواجبة وإدارة المخاطر.`,
    heroEyebrow: `استشارة ورأي ثانٍ في العقارات، داخل البلاد وخارجها`,
    lede: `صفقة في البلاد، أو عقار وراء البحر، أو مشروع تجديد حضري: في كل منها يكلّف خطأ تعاقدي واحد ثمناً باهظاً، وخارج البلاد لا يكون القانون الحاكم هو القانون الذي تعرفونه. نقدم استشارة قانونية مستقلة ورأياً ثانياً محايداً، مع أدوات الذكاء الاصطناعي القانوني، تحوّل مئات صفحات المستندات إلى صورة واضحة للمخاطر، قبل أن تلتزموا.`,
    labels: { covers: `ما تغطيه الاستشارة`, when: `رأي ثانٍ`, steps: `كيف تسير العملية`, related: `لمزيد من التعمق`, faq: `أسئلة وأجوبة` },
    coversH2: `طبقة الحماية القانونية حول صفقتكم`,
    cards: [
      { title: `الصفقات العقارية والعقود`, body: `مرافقة وتمثيل في صفقات البيع والشراء والاستثمار: فحص الحقوق، الصياغة والحماية التعاقدية، الضرائب، والكشف المبكر عن المخاطر قبل أن تتحول إلى تعرض.` },
      { title: `التجديد الحضري: تاما 38 والهدم وإعادة البناء`, body: `مرافقة أصحاب الشقق ولجان السكان في مشاريع معقدة: فحص اتفاقيات المطوّر، الضمانات، الجداول الزمنية وآليات الحسم، لتحقيق التوازن أمام المطوّر والوصول إلى اتفاق قابل للدفاع عنه.` },
      { title: `الصفقات والعقارات في الخارج`, body: `مرافقة إسرائيلية إلى جانب المشتري والمستثمر خارج البلاد: بنية الصفقة وبنية الحيازة، والضرائب في البلدين، وما يشترطه القانون المحلي فعلاً، والعمل مع المحامي المحلي لا بدلاً عنه.` },
      { title: `العناية الواجبة وإدارة المخاطر`, body: `رسم خريطة التعرضات القانونية، حقوق البناء، إشارات التحذير، الضرائب والضمانات، وبناء هندسة صفقة صامدة تثبت حتى عند حدوث خلل.` },
      { title: `تحليل قائم على الذكاء الاصطناعي القانوني`, body: `تمسح أدوات الذكاء الاصطناعي مئات المستندات والملاحق والاتفاقيات، وتستخرج التناقضات والمخاطر، وتسرّع الفحص، دائماً تحت إشراف محامٍ وبموافقته.` },
    ],
    whenH2: `متى يستحق الرأي القانوني الثاني في العقارات`,
    whenLede: `الرأي الثاني المستقل لا يدافع عن قرار سبق اتخاذه، بل يعيد فحصه. وهو يعزز العميل والمستشار الممثل له معاً، ويوفر أساساً موثقاً وقابلاً للدفاع عنه.`,
    when: [
      `قبل توقيع عقد شراء أو بيع لعقار`,
      `قبل توقيع اتفاقية مع المطوّر في مشروع تاما 38 أو الهدم وإعادة البناء`,
      `عند تلقي اتفاقية أو رأي قانوني والرغبة في فحص مستقل`,
      `عند نشوء نزاع بين أصحاب الشقق أو لجنة السكان أو مع المطوّر`,
      `قبل شراء عقار أو الاستثمار وراء البحر`,
      `قبل صفقة مقايضة أو صفقة معقّدة أمام مطوّر`,
      `عند الحاجة إلى أساس موثق وقابل للدفاع عنه لاتخاذ القرار`,
    ],
    stepsH2: `ثلاث خطوات نحو رأي قابل للدفاع عنه`,
    steps: [
      { title: `التشخيص`, body: `نرسم خريطة العقار أو المشروع والحقوق والعقد والتعرض القانوني، ونحدد نقاط الضعف المباشرة.` },
      { title: `رأي مستقل`, body: `نعيد فحص الصفقة بعين نقدية، بالجمع بين القانون والاقتصاد وأدوات الذكاء الاصطناعي القانوني لتحليل المستندات والمخاطر.` },
      { title: `خارطة طريق لإدارة المخاطر`, body: `نسلّم وثيقة مركزة وموثقة وقابلة للدفاع عنها، مع خطوات عملية لتقليل التعرض وتعزيز الموقف القانوني.` },
    ],
    relatedH2: `مقالات في العقارات داخل البلاد وخارجها والتجديد الحضري والذكاء الاصطناعي القانوني`,
    faqH2: `استشارة ورأي ثانٍ في العقارات والتجديد الحضري`,
    faqs: [
      { q: `ماذا يشمل الرأي القانوني الثاني في صفقة عقارية؟`, a: `فحص مستقل لتسجيل الحقوق والحجوزات وإشارات التحذير، ومدى التطابق بين الوضع المسجل والوضع الفعلي، والالتزامات الضريبية، وحقوق البناء، والضمانات التي تؤمّن المقابل. الهدف ليس رصد مشكلة فحسب، بل بناء هندسة صفقة تثبت حتى عند حدوث خلل.` },
      { q: `متى يستحق الرأي الثاني في مشروع تاما 38 أو الهدم وإعادة البناء؟`, a: `قبل توقيع اتفاقية المطوّر، وعند نشوء خلاف بين أصحاب الشقق ولجنة السكان والمطوّر. تضم هذه المشاريع مئات أصحاب الحقوق وعقوداً معقدة، والفحص المستقل لصيغة الاتفاقية هو الحماية الأساسية أمام اختلال موازين القوى مع المطوّر.` },
      { q: `ماذا يُفحص في اتفاقية المطوّر في التجديد الحضري؟`, a: `متانة المطوّر المالية، والضمانات المستقلة الممنوحة لأصحاب الشقق، والجداول الزمنية وآليات التعويض عن التأخير، والمساواة في المقابل بين أصحاب الشقق، وآلية حسم الخلافات، وشروط الإلغاء وشطب إشارات التحذير.` },
      { q: `كيف يندمج الذكاء الاصطناعي القانوني في الفحص؟`, a: `تمسح أدوات الذكاء الاصطناعي مئات صفحات المستندات والملاحق والاتفاقيات في وقت قصير، وتستخرج التناقضات والبنود الناقصة والتعرضات، وتقاطعها مع الوضع القانوني والاقتصادي. التحليل الخوارزمي نقطة انطلاق فقط، وكل نتيجة يفحصها ويعتمدها محامٍ.` },
      { q: `أشتري عقاراً في الخارج، فلماذا أحتاج محامياً إسرائيلياً أيضاً؟`, a: `المحامي المحلي يعرف قانونه هو، لا ما تُحدثه الصفقة لكم في إسرائيل: واجبات الإبلاغ، والازدواج الضريبي والاتفاقية التي تنظمه، وبنية الحيازة الملائمة لمقيم إسرائيلي، والتبعات اللاحقة عند البيع أو الميراث. كما أنه لا يمثلكم أمام البائع أو المطوّر بالقدر الذي يمثلكم به محامٍ أنتم عميله الوحيد. الدوران متكاملان، والإسرائيلي هو من يرى الصورة على جانبي الحدود.` },
      { q: `هل يحل الرأي الثاني محل المحامي المرافق للصفقة؟`, a: `لا. فهو يفحص الصفقة من الخارج ويكشف النقاط العمياء، وبذلك يعزز العميل والمستشار الممثل له معاً. الدوران متكاملان لا متنافسان.` },
      { q: `كم يستغرق الفحص؟`, a: `يعتمد ذلك على حجم المستندات ودرجة تعقيد الصفقة. يجري فحص صفقة عقار واحد عادة خلال أيام، بينما يتطلب مشروع تجديد حضري كامل وقتاً أطول، بحسب عدد الاتفاقيات والملاحق.` },
    ],
    ctaH2: `هل أنتم مستعدون لرأي مستقل حول صفقتكم؟`,
    ctaBody: `لقاء تشخيصي قصير يرسم خريطة تعرضكم ويحدد خارطة طريق واضحة لإدارة المخاطر في الصفقة أو المشروع.`,
    disclaimer: `المعلومات في هذه الصفحة عامة ولا تشكل استشارة قانونية ولا بديلاً عن رأي قانوني خاص.`,
  },
};

// The mediation pillar's copy, in its own table rather than folded into the
// per-language objects above, so adding a third pillar did not mean editing
// five hand-maintained blocks.
//
// Why this page exists: mediation and dispute resolution is the largest body of
// writing on the site, 55 articles, and it was the only one of the three
// practices with no page to land on. The articles were reachable from a flat
// index and the sitemap, which gets them crawled but gives the subject no
// address of its own.
//
// What it targets: the term the practice is named for, גישור מכוון הכרעה, is
// uncontested and close to unsearched. The demand sits in גישור מסחרי, גישור
// עסקי and יישוב סכסוכים, held by small firms with a dedicated landing page
// each. So the page leads with the commercial language a party in a dispute
// actually types, and explains the method inside it.
const mediationCopy: Record<Lang, Copy> = {
  he: {
    title: `גישור מסחרי ויישוב סכסוכים עסקיים מכוון הכרעה`,
    desc: `גישור מסחרי ויישוב סכסוכים עסקיים בשיטת גישור מכוון הכרעה (DOM): סכסוכי שותפים, ספקים, נדל"ן והתחדשות עירונית, עם הערכה משפטית מנומקת והסכם מתועד ובר-הגנה.`,
    heroEyebrow: `גישור מכוון הכרעה (DOM)`,
    lede: `סכסוך עסקי עוצר את העסק הרבה לפני שהוא מגיע לפסק דין. גישור מכוון הכרעה מוסיף לגישור המסורתי את מה שחסר בו: הערכה משפטית מנומקת מצד מי שמכיר את הדין ואת המספרים, כך שהצדדים מגיעים להסכמה מתוך תמונה ברורה, ולא מתוך תשישות או פערי כוחות.`,
    labels: { covers: `מה ההליך מכסה`, when: `מתי לגשת לגישור`, steps: `איך זה עובד`, related: `להעמקה`, faq: `שאלות ותשובות` },
    coversH2: `סוגי הסכסוכים שאנחנו מגשרים`,
    cards: [
      { title: `סכסוכי שותפים ובעלי מניות`, body: `פרידה בין שותפים, מבוי סתום בהצבעה, טענות לקיפוח מיעוט ומחלוקות על שווי ועל מנגנוני יציאה. ההליך מפריד בין השאלה המשפטית לבין הכעס שנצבר סביבה.` },
      { title: `סכסוכים מסחריים בין חברות`, body: `הפרות חוזה, מחלוקות ספק ולקוח, עמלות ותמורות, וסיום התקשרות. כשהיחסים המסחריים עדיין שווים משהו, פסק דין הוא הדרך היקרה ביותר לסיים אותם.` },
      { title: `סכסוכי נדל"ן והתחדשות עירונית`, body: `בעלי דירות מול נציגות, נציגות מול יזם, יזם מול קבלן, ומחלוקות על תמורות, לוחות זמנים ובטוחות. אלה סכסוכים עם מאות בעלי זכויות, שבהם עיכוב עולה יותר מהמחלוקת עצמה.` },
      { title: `סכסוכי טכנולוגיה, קניין רוחני ו-AI`, body: `בעלות על קוד ועל מודלים, שימוש בנתונים, כשל של מערכת אלגוריתמית, ומחלוקות מול ספקי בינה מלאכותית. סכסוכים שדורשים מגשר שקורא גם את הארכיטקטורה וגם את החוזה.` },
    ],
    whenH2: `מתי גישור מכוון הכרעה עדיף על הליך משפטי`,
    whenLede: `גישור מכוון הכרעה אינו ויתור על הזכויות ואינו פשרה בכל מחיר. הוא מסלול שבו הצדדים שומרים על השליטה בתוצאה, ומקבלים לאורך הדרך הערכה משפטית מנומקת של מה שהיה קורה בבית המשפט.`,
    when: [
      `כשהסכסוך מקפיא עסקה, פרויקט או תזרים`,
      `כשהצדדים צריכים להמשיך לעבוד יחד גם אחרי ההכרעה`,
      `כשחשיפת המחלוקת בפומבי תפגע במוניטין או בסוד מסחרי`,
      `כשגישור מסורתי מיצה את עצמו ולא הגיע להכרעה`,
      `כשהפער בין הצדדים הוא בהערכת הסיכון המשפטי, לא בעובדות`,
      `כשעלות ההתדיינות גדולה מהסכום השנוי במחלוקת`,
    ],
    stepsH2: `שלושה שלבים מסכסוך להסכם`,
    steps: [
      { title: `אבחון ומיפוי`, body: `שומעים כל צד בנפרד, ממפים את העובדות, את המסמכים ואת החשיפה המשפטית והכלכלית של כל עמדה, ומגדירים מה באמת שנוי במחלוקת.` },
      { title: `ישיבות והערכה מנומקת`, body: `מנהלים את ישיבות הגישור, ובנקודה הנכונה מציגים הערכה משפטית מנומקת של הסיכויים והסיכונים, שמחליפה ניחוש בתמונה שאפשר להחליט לפיה.` },
      { title: `הסכם מתועד ובר-אכיפה`, body: `מנסחים הסדר שמחזיק: מנגנוני ביצוע, לוחות זמנים, בטוחות וסעד למקרה של הפרה, בנוסח שאפשר לאשר כפסק דין.` },
    ],
    relatedH2: `מאמרים בנושא גישור, בוררות ויישוב סכסוכים`,
    faqH2: `גישור מסחרי וגישור מכוון הכרעה`,
    faqs: [
      { q: `מה זה גישור מכוון הכרעה, ובמה הוא שונה מגישור רגיל?`, a: `בגישור מסורתי המגשר נמנע מהבעת עמדה, ותפקידו לקרב בין הצדדים בלבד. בגישור מכוון הכרעה המגשר, שהוא עורך דין ובורר, מציג בשלב המתאים הערכה משפטית מנומקת של הסיכויים והסיכונים של כל צד. ההערכה אינה מחייבת, אבל היא מחליפה ניחוש בתמונה ברורה, ולכן הליכים שנתקעו בגישור רגיל מגיעים כאן להסכמה.` },
      { q: `האם ההכרעה של המגשר מחייבת את הצדדים?`, a: `לא מעצמה. ההערכה שהמגשר מציג היא חוות דעת, לא פסק דין, והצדדים חופשיים לדחות אותה. מה שמחייב הוא ההסכם שהם חותמים עליו בסוף. אם הצדדים מבקשים תוצאה מחייבת מראש, אפשר לעצב את ההליך כבוררות מואצת, וזו החלטה שמתקבלת בתחילת הדרך ונרשמת בהסכם.` },
      { q: `כמה זמן לוקח הליך גישור מסחרי, וכמה הוא עולה?`, a: `רוב הסכסוכים המסחריים נסגרים בשתיים עד ארבע ישיבות, לאורך שבועות ולא שנים. העלות היא חלק קטן מעלות ההתדיינות באותו סכסוך, והיא ידועה מראש. לשם השוואה, תביעה מסחרית בבית משפט נמדדת בשנים ובכתבי טענות, והיא גם מקפיאה את היחסים המסחריים לאורך כל התקופה.` },
      { q: `מה קורה אם הגישור לא מצליח, האם אפשר עדיין לפנות לבית המשפט?`, a: `כן. הפנייה לגישור אינה מוותרת על שום זכות משפטית. ההליך חסוי, ומה שנאמר בו אינו קביל בהליך משפטי מאוחר, כך שצד שנכנס לגישור אינו חושף את קלפיו. גם גישור שלא הסתיים בהסכם מצמצם בדרך כלל את המחלוקת ומקצר את ההליך שבא אחריו.` },
      { q: `אילו סכסוכים אינם מתאימים לגישור?`, a: `סכסוך שבו צד אחד זקוק לסעד דחוף מבית משפט, למשל צו מניעה למניעת נזק מיידי, סכסוך שבו יש חשד לפלילים, וסכסוך שבו צד אחד אינו מעוניין בפתרון אלא בעיכוב. בכל אלה ההליך המשפטי הוא הכלי הנכון, ולעיתים אפשר לחזור לגישור אחרי שהסעד הדחוף ניתן.` },
      { q: `האם ההליך חסוי, ומי רואה את המסמכים?`, a: `ההליך חסוי במלואו. הישיבות אינן פומביות, המסמכים אינם מוגשים לתיק בית משפט, ומה שנמסר למגשר בשיחה נפרדת עם צד אחד אינו מועבר לצד השני בלי רשות. זו אחת הסיבות המרכזיות שחברות בוחרות בגישור כשהמחלוקת נוגעת לסוד מסחרי, לתמחור או למוניטין.` },
    ],
    ctaH2: `יש סכסוך שעוצר לכם את העסק?`,
    ctaBody: `פגישת אבחון קצרה בודקת אם הסכסוך מתאים לגישור מכוון הכרעה, ומה המסלול המהיר ביותר לסיים אותו.`,
    disclaimer: `המידע בעמוד זה כללי ואינו מהווה ייעוץ משפטי או תחליף לחוות דעת פרטנית.`,
  },
  en: {
    title: `Commercial mediation and business dispute resolution`,
    desc: `Decision-oriented mediation (DOM) for commercial disputes: partners and shareholders, suppliers and customers, real estate and urban renewal, with a reasoned legal assessment and a documented, enforceable settlement.`,
    heroEyebrow: `Decision-oriented mediation (DOM)`,
    lede: `A commercial dispute stops the business long before it reaches a judgment. Decision-oriented mediation adds to conventional mediation the one thing it lacks: a reasoned legal assessment from someone who reads both the law and the numbers, so the parties settle from a clear picture rather than from exhaustion or an imbalance of power.`,
    labels: { covers: `What the process covers`, when: `When to mediate`, steps: `How it works`, related: `Further reading`, faq: `Questions and answers` },
    coversH2: `The disputes we mediate`,
    cards: [
      { title: `Partner and shareholder disputes`, body: `Separating partners, deadlocked votes, minority oppression claims, and disagreements over valuation and exit mechanics. The process separates the legal question from the anger that has built up around it.` },
      { title: `Commercial disputes between companies`, body: `Breach of contract, supplier and customer disputes, commissions and consideration, and terminating a relationship. While the commercial relationship is still worth something, a judgment is the most expensive way to end it.` },
      { title: `Real estate and urban renewal disputes`, body: `Owners against their committee, a committee against the developer, a developer against the contractor, and disputes over consideration, timetables and security. These involve hundreds of rights-holders, where delay costs more than the dispute.` },
      { title: `Technology, IP and AI disputes`, body: `Ownership of code and models, use of data, failure of an algorithmic system, and disputes with AI vendors. These need a mediator who reads the architecture as well as the contract.` },
    ],
    whenH2: `When mediation beats litigation`,
    whenLede: `Decision-oriented mediation is not a waiver of rights, and not compromise at any price. It is a route where the parties keep control of the outcome while receiving a reasoned legal assessment of what a court would have done.`,
    when: [
      `When the dispute has frozen a deal, a project or cash flow`,
      `When the parties must keep working together afterwards`,
      `When airing the dispute in public would cost reputation or a trade secret`,
      `When conventional mediation has run its course without a decision`,
      `When the parties differ on legal risk rather than on the facts`,
      `When litigating costs more than the amount in dispute`,
    ],
    stepsH2: `Three stages from dispute to agreement`,
    steps: [
      { title: `Diagnosis and mapping`, body: `Each side is heard separately. The facts, the documents and the legal and commercial exposure of each position are mapped, and what is genuinely in dispute is defined.` },
      { title: `Sessions and a reasoned assessment`, body: `The sessions are run, and at the right moment a reasoned legal assessment of each side's prospects and risks is put on the table, replacing guesswork with a picture that can be decided on.` },
      { title: `A documented, enforceable agreement`, body: `A settlement built to hold: performance mechanics, timetables, security and a remedy for breach, drafted so it can be entered as a judgment.` },
    ],
    relatedH2: `Writing on mediation, arbitration and dispute resolution`,
    faqH2: `Commercial and decision-oriented mediation`,
    faqs: [
      { q: `What is decision-oriented mediation, and how does it differ from ordinary mediation?`, a: `In conventional mediation the mediator withholds any view and works only to bring the parties closer. In decision-oriented mediation the mediator, a lawyer and arbitrator, presents at the right stage a reasoned legal assessment of each side's prospects and risks. The assessment does not bind anyone, but it replaces guesswork with a clear picture, which is why matters that stalled in ordinary mediation settle here.` },
      { q: `Is the mediator's assessment binding on the parties?`, a: `Not by itself. What the mediator presents is an opinion, not a judgment, and either party is free to reject it. What binds is the agreement they sign at the end. Parties who want a binding outcome from the start can have the process structured as expedited arbitration, a choice made at the outset and recorded in the agreement.` },
      { q: `How long does commercial mediation take, and what does it cost?`, a: `Most commercial disputes close in two to four sessions, over weeks rather than years. The cost is a fraction of litigating the same dispute, and it is known in advance. A commercial claim in court, by contrast, is measured in years and pleadings, and it freezes the commercial relationship throughout.` },
      { q: `If mediation fails, can we still go to court?`, a: `Yes. Going to mediation waives no legal right. The process is confidential, and what is said in it is inadmissible in later proceedings, so a party entering mediation is not showing its hand. Even mediation that ends without agreement usually narrows the dispute and shortens what follows.` },
      { q: `Which disputes are not suited to mediation?`, a: `A dispute where one side needs urgent relief from a court, an injunction against immediate harm for instance; a dispute with a suspicion of criminal conduct; and a dispute where one side wants delay rather than resolution. In all of these litigation is the right instrument, and mediation is sometimes possible once the urgent relief is granted.` },
      { q: `Is the process confidential, and who sees the documents?`, a: `It is fully confidential. Sessions are not public, documents are not filed with a court, and what one party tells the mediator in a private session is not passed to the other without permission. This is a main reason companies choose mediation where the dispute touches a trade secret, pricing or reputation.` },
    ],
    ctaH2: `Is a dispute holding your business up?`,
    ctaBody: `A short diagnostic meeting establishes whether the dispute suits decision-oriented mediation, and what the fastest route to ending it is.`,
    disclaimer: `The information on this page is general and is not legal advice or a substitute for an opinion on your own matter.`,
  },
  es: {
    title: `Mediación comercial y resolución de conflictos empresariales`,
    desc: `Mediación orientada a la decisión (DOM) para conflictos comerciales: socios y accionistas, proveedores y clientes, inmobiliario y renovación urbana, con una evaluación jurídica razonada y un acuerdo documentado y ejecutable.`,
    heroEyebrow: `Mediación orientada a la decisión (DOM)`,
    lede: `Un conflicto empresarial detiene el negocio mucho antes de llegar a sentencia. La mediación orientada a la decisión añade a la mediación tradicional lo único que le falta: una evaluación jurídica razonada de quien lee tanto el derecho como los números, de modo que las partes acuerdan a partir de un panorama claro y no del agotamiento o de un desequilibrio de fuerzas.`,
    labels: { covers: `Qué cubre el proceso`, when: `Cuándo mediar`, steps: `Cómo funciona`, related: `Para profundizar`, faq: `Preguntas y respuestas` },
    coversH2: `Los conflictos que mediamos`,
    cards: [
      { title: `Conflictos entre socios y accionistas`, body: `Separación de socios, bloqueo en las votaciones, alegaciones de opresión de la minoría y desacuerdos sobre valoración y mecanismos de salida. El proceso separa la cuestión jurídica del enfado acumulado a su alrededor.` },
      { title: `Conflictos mercantiles entre empresas`, body: `Incumplimiento de contrato, disputas entre proveedor y cliente, comisiones y contraprestaciones, y terminación de la relación. Mientras la relación comercial todavía vale algo, una sentencia es la forma más cara de acabar con ella.` },
      { title: `Conflictos inmobiliarios y de renovación urbana`, body: `Propietarios frente a su comisión, la comisión frente al promotor, el promotor frente a la constructora, y desacuerdos sobre contraprestaciones, plazos y garantías. Son conflictos con cientos de titulares de derechos, donde la demora cuesta más que la propia disputa.` },
      { title: `Conflictos de tecnología, propiedad intelectual e IA`, body: `Titularidad del código y de los modelos, uso de datos, fallo de un sistema algorítmico y disputas con proveedores de IA. Exigen un mediador que lea la arquitectura además del contrato.` },
    ],
    whenH2: `Cuándo la mediación supera al litigio`,
    whenLede: `La mediación orientada a la decisión no es una renuncia de derechos ni una transacción a cualquier precio. Es una vía en la que las partes conservan el control del resultado y reciben una evaluación jurídica razonada de lo que habría hecho un tribunal.`,
    when: [
      `Cuando el conflicto ha congelado una operación, un proyecto o la tesorería`,
      `Cuando las partes deben seguir trabajando juntas después`,
      `Cuando ventilar el conflicto en público costaría reputación o un secreto comercial`,
      `Cuando la mediación tradicional se ha agotado sin llegar a una decisión`,
      `Cuando las partes discrepan sobre el riesgo jurídico y no sobre los hechos`,
      `Cuando litigar cuesta más que la cantidad en disputa`,
    ],
    stepsH2: `Tres etapas del conflicto al acuerdo`,
    steps: [
      { title: `Diagnóstico y mapeo`, body: `Se escucha a cada parte por separado. Se mapean los hechos, los documentos y la exposición jurídica y económica de cada posición, y se define qué está realmente en disputa.` },
      { title: `Sesiones y evaluación razonada`, body: `Se dirigen las sesiones y, en el momento adecuado, se pone sobre la mesa una evaluación jurídica razonada de las posibilidades y los riesgos de cada parte, que sustituye la conjetura por un panorama sobre el que se puede decidir.` },
      { title: `Acuerdo documentado y ejecutable`, body: `Un acuerdo construido para durar: mecanismos de cumplimiento, plazos, garantías y remedio en caso de incumplimiento, redactado para poder homologarse como sentencia.` },
    ],
    relatedH2: `Artículos sobre mediación, arbitraje y resolución de conflictos`,
    faqH2: `Mediación comercial y orientada a la decisión`,
    faqs: [
      { q: `¿Qué es la mediación orientada a la decisión y en qué se diferencia de la mediación habitual?`, a: `En la mediación tradicional el mediador se abstiene de opinar y solo acerca a las partes. En la mediación orientada a la decisión el mediador, abogado y árbitro, presenta en la fase adecuada una evaluación jurídica razonada de las posibilidades y los riesgos de cada parte. La evaluación no vincula a nadie, pero sustituye la conjetura por un panorama claro, y por eso se resuelven aquí asuntos que se habían estancado en la mediación habitual.` },
      { q: `¿La evaluación del mediador vincula a las partes?`, a: `No por sí misma. Lo que el mediador presenta es un dictamen, no una sentencia, y cualquiera de las partes puede rechazarlo. Lo que vincula es el acuerdo que firman al final. Quien desee un resultado vinculante desde el principio puede estructurar el proceso como arbitraje acelerado, una elección que se toma al inicio y se recoge en el acuerdo.` },
      { q: `¿Cuánto dura la mediación comercial y cuánto cuesta?`, a: `La mayoría de los conflictos mercantiles se cierran en dos a cuatro sesiones, en semanas y no en años. El coste es una fracción del de litigar el mismo conflicto y se conoce de antemano. Una demanda mercantil ante los tribunales, en cambio, se mide en años y escritos, y congela la relación comercial durante todo ese tiempo.` },
      { q: `Si la mediación fracasa, ¿podemos acudir igualmente a los tribunales?`, a: `Sí. Acudir a la mediación no renuncia a ningún derecho. El proceso es confidencial y lo dicho en él no es admisible en un procedimiento posterior, de modo que quien entra en mediación no descubre sus cartas. Incluso una mediación que termina sin acuerdo suele reducir la disputa y acortar lo que viene después.` },
      { q: `¿Qué conflictos no son aptos para mediación?`, a: `Aquel en el que una parte necesita tutela urgente de un tribunal, por ejemplo una medida cautelar frente a un daño inmediato; aquel en el que hay sospecha de conducta delictiva; y aquel en el que una parte busca demora en lugar de solución. En todos ellos el litigio es el instrumento correcto, y a veces cabe volver a la mediación una vez concedida la tutela urgente.` },
      { q: `¿El proceso es confidencial y quién ve los documentos?`, a: `Es plenamente confidencial. Las sesiones no son públicas, los documentos no se presentan ante un tribunal, y lo que una parte cuenta al mediador en sesión privada no se traslada a la otra sin permiso. Es una razón principal por la que las empresas eligen la mediación cuando el conflicto afecta a un secreto comercial, a los precios o a la reputación.` },
    ],
    ctaH2: `¿Un conflicto está frenando su negocio?`,
    ctaBody: `Una breve reunión de diagnóstico determina si el conflicto es apto para la mediación orientada a la decisión y cuál es la vía más rápida para cerrarlo.`,
    disclaimer: `La información de esta página es general y no constituye asesoramiento jurídico ni sustituye un dictamen sobre su caso concreto.`,
  },
  fr: {
    title: `Médiation commerciale et règlement des litiges d'affaires`,
    desc: `Médiation orientée vers la décision (DOM) pour les litiges commerciaux : associés et actionnaires, fournisseurs et clients, immobilier et renouvellement urbain, avec une évaluation juridique motivée et un accord documenté et exécutoire.`,
    heroEyebrow: `Médiation orientée vers la décision (DOM)`,
    lede: `Un litige commercial arrête l'entreprise bien avant d'arriver au jugement. La médiation orientée vers la décision ajoute à la médiation classique ce qui lui manque : une évaluation juridique motivée, par quelqu'un qui lit à la fois le droit et les chiffres, pour que les parties s'accordent sur une image claire plutôt que par épuisement ou par déséquilibre des forces.`,
    labels: { covers: `Ce que couvre le processus`, when: `Quand médier`, steps: `Comment cela fonctionne`, related: `Pour approfondir`, faq: `Questions et réponses` },
    coversH2: `Les litiges que nous médions`,
    cards: [
      { title: `Litiges entre associés et actionnaires`, body: `Séparation d'associés, blocage des votes, allégations d'abus de minorité, désaccords sur la valorisation et les mécanismes de sortie. Le processus sépare la question juridique de la colère accumulée autour d'elle.` },
      { title: `Litiges commerciaux entre sociétés`, body: `Inexécution contractuelle, différends fournisseur et client, commissions et contreparties, fin de relation. Tant que la relation commerciale vaut encore quelque chose, un jugement est la manière la plus coûteuse d'y mettre fin.` },
      { title: `Litiges immobiliers et de renouvellement urbain`, body: `Copropriétaires contre leur comité, comité contre promoteur, promoteur contre entreprise générale, et désaccords sur les contreparties, les délais et les garanties. Des litiges à des centaines d'ayants droit, où le retard coûte plus cher que le différend.` },
      { title: `Litiges technologiques, propriété intellectuelle et IA`, body: `Propriété du code et des modèles, usage des données, défaillance d'un système algorithmique, différends avec des fournisseurs d'IA. Ils exigent un médiateur qui lit l'architecture autant que le contrat.` },
    ],
    whenH2: `Quand la médiation vaut mieux qu'un procès`,
    whenLede: `La médiation orientée vers la décision n'est ni une renonciation à ses droits, ni une transaction à tout prix. C'est une voie où les parties gardent la maîtrise du résultat tout en recevant une évaluation juridique motivée de ce qu'aurait fait un tribunal.`,
    when: [
      `Quand le litige gèle une opération, un projet ou la trésorerie`,
      `Quand les parties devront continuer à travailler ensemble ensuite`,
      `Quand exposer le litige en public coûterait une réputation ou un secret d'affaires`,
      `Quand la médiation classique s'est épuisée sans aboutir à une décision`,
      `Quand les parties divergent sur le risque juridique et non sur les faits`,
      `Quand le coût du procès dépasse le montant en jeu`,
    ],
    stepsH2: `Trois étapes du litige à l'accord`,
    steps: [
      { title: `Diagnostic et cartographie`, body: `Chaque partie est entendue séparément. Les faits, les pièces et l'exposition juridique et économique de chaque position sont cartographiés, et ce qui est réellement en litige est défini.` },
      { title: `Séances et évaluation motivée`, body: `Les séances sont conduites et, au bon moment, une évaluation juridique motivée des chances et des risques de chacun est posée sur la table, remplaçant la conjecture par une image sur laquelle on peut décider.` },
      { title: `Accord documenté et exécutoire`, body: `Un accord fait pour tenir : mécanismes d'exécution, délais, garanties et remède en cas d'inexécution, rédigé pour pouvoir être homologué comme jugement.` },
    ],
    relatedH2: `Articles sur la médiation, l'arbitrage et le règlement des litiges`,
    faqH2: `Médiation commerciale et orientée vers la décision`,
    faqs: [
      { q: `Qu'est-ce que la médiation orientée vers la décision et en quoi diffère-t-elle de la médiation ordinaire ?`, a: `Dans la médiation classique, le médiateur s'abstient de toute opinion et se borne à rapprocher les parties. Dans la médiation orientée vers la décision, le médiateur, avocat et arbitre, présente au bon stade une évaluation juridique motivée des chances et des risques de chaque partie. Cette évaluation ne lie personne, mais elle remplace la conjecture par une image claire, et c'est pourquoi des dossiers enlisés en médiation ordinaire se règlent ici.` },
      { q: `L'évaluation du médiateur lie-t-elle les parties ?`, a: `Pas en elle-même. Ce que le médiateur présente est un avis, non un jugement, et chaque partie reste libre de l'écarter. Ce qui lie, c'est l'accord signé à la fin. Les parties qui veulent d'emblée un résultat contraignant peuvent faire structurer le processus en arbitrage accéléré, un choix arrêté dès le départ et consigné dans la convention.` },
      { q: `Combien de temps dure une médiation commerciale et combien coûte-t-elle ?`, a: `La plupart des litiges commerciaux se règlent en deux à quatre séances, en semaines et non en années. Le coût représente une fraction de celui d'un procès sur le même litige, et il est connu à l'avance. Une action commerciale devant les tribunaux, elle, se mesure en années et en écritures, et elle gèle la relation commerciale pendant toute cette durée.` },
      { q: `Si la médiation échoue, pouvons-nous encore saisir le tribunal ?`, a: `Oui. Recourir à la médiation ne fait renoncer à aucun droit. Le processus est confidentiel et ce qui s'y dit n'est pas recevable dans une procédure ultérieure, de sorte qu'une partie qui entre en médiation ne dévoile pas son jeu. Même une médiation qui s'achève sans accord réduit en général le litige et raccourcit ce qui suit.` },
      { q: `Quels litiges ne se prêtent pas à la médiation ?`, a: `Celui où une partie a besoin d'une mesure urgente du tribunal, une injonction contre un dommage immédiat par exemple ; celui où pèse un soupçon d'infraction pénale ; et celui où une partie cherche le retard plutôt que la solution. Dans tous ces cas, le procès est l'instrument juste, et il est parfois possible de revenir à la médiation une fois la mesure urgente obtenue.` },
      { q: `Le processus est-il confidentiel et qui voit les pièces ?`, a: `Il est entièrement confidentiel. Les séances ne sont pas publiques, les pièces ne sont pas versées à un dossier judiciaire, et ce qu'une partie confie au médiateur en séance séparée n'est pas transmis à l'autre sans autorisation. C'est une raison majeure pour laquelle les entreprises choisissent la médiation lorsque le litige touche à un secret d'affaires, à des prix ou à la réputation.` },
    ],
    ctaH2: `Un litige bloque votre activité ?`,
    ctaBody: `Une courte réunion de diagnostic détermine si le litige se prête à la médiation orientée vers la décision, et quelle est la voie la plus rapide pour y mettre fin.`,
    disclaimer: `Les informations de cette page sont générales et ne constituent ni un conseil juridique ni un substitut à un avis sur votre dossier.`,
  },
  ar: {
    title: `الوساطة التجارية وحل النزاعات بين الشركات`,
    desc: `وساطة موجّهة نحو الحسم (DOM) للنزاعات التجارية: الشركاء والمساهمون، المورّدون والعملاء، العقارات والتجديد الحضري، مع تقييم قانوني مُعلّل واتفاق موثّق وقابل للتنفيذ.`,
    heroEyebrow: `وساطة موجّهة نحو الحسم (DOM)`,
    lede: `النزاع التجاري يوقف العمل قبل وقت طويل من صدور الحكم. الوساطة الموجّهة نحو الحسم تضيف إلى الوساطة التقليدية ما ينقصها: تقييم قانوني مُعلّل ممن يقرأ القانون والأرقام معاً، فيصل الطرفان إلى اتفاق من صورة واضحة، لا من الإنهاك أو من اختلال موازين القوى.`,
    labels: { covers: `ما الذي تغطيه العملية`, when: `متى نلجأ إلى الوساطة`, steps: `كيف تعمل`, related: `للتعمّق`, faq: `أسئلة وأجوبة` },
    coversH2: `النزاعات التي نتوسّط فيها`,
    cards: [
      { title: `نزاعات الشركاء والمساهمين`, body: `انفصال الشركاء، وتعطّل التصويت، ودعاوى إجحاف الأقلية، والخلاف على التقييم وآليات الخروج. تفصل العملية المسألة القانونية عن الغضب المتراكم حولها.` },
      { title: `نزاعات تجارية بين الشركات`, body: `الإخلال بالعقد، وخلافات المورّد والعميل، والعمولات والمقابل، وإنهاء التعاقد. وما دامت العلاقة التجارية تساوي شيئاً، فالحكم القضائي أغلى وسيلة لإنهائها.` },
      { title: `نزاعات العقارات والتجديد الحضري`, body: `أصحاب الشقق أمام لجنتهم، واللجنة أمام المطوّر، والمطوّر أمام المقاول، والخلاف على المقابل والجداول الزمنية والضمانات. نزاعات بمئات أصحاب الحقوق، يكلّف فيها التأخير أكثر من الخلاف نفسه.` },
      { title: `نزاعات التكنولوجيا والملكية الفكرية والذكاء الاصطناعي`, body: `ملكية الشيفرة والنماذج، واستخدام البيانات، وإخفاق نظام خوارزمي، والخلافات مع مورّدي الذكاء الاصطناعي. تحتاج إلى وسيط يقرأ البنية التقنية كما يقرأ العقد.` },
    ],
    whenH2: `متى تتفوّق الوساطة على التقاضي`,
    whenLede: `الوساطة الموجّهة نحو الحسم ليست تنازلاً عن الحقوق ولا تسوية بأي ثمن. هي مسار يحتفظ فيه الطرفان بالسيطرة على النتيجة، ويتلقّيان تقييماً قانونياً مُعلّلاً لما كانت المحكمة ستقضي به.`,
    when: [
      `حين يجمّد النزاع صفقة أو مشروعاً أو التدفق النقدي`,
      `حين يتعيّن على الطرفين مواصلة العمل معاً بعد ذلك`,
      `حين يكلّف كشف النزاع علناً سمعةً أو سرّاً تجارياً`,
      `حين تستنفد الوساطة التقليدية نفسها دون الوصول إلى حسم`,
      `حين يكون الخلاف على تقدير المخاطر القانونية لا على الوقائع`,
      `حين تفوق كلفة التقاضي المبلغ محل النزاع`,
    ],
    stepsH2: `ثلاث مراحل من النزاع إلى الاتفاق`,
    steps: [
      { title: `التشخيص ورسم الخريطة`, body: `يُسمع كل طرف على حدة، وتُرسم خريطة الوقائع والمستندات والتعرّض القانوني والاقتصادي لكل موقف، ويُحدَّد ما هو محل النزاع فعلاً.` },
      { title: `الجلسات والتقييم المُعلّل`, body: `تُدار جلسات الوساطة، وفي اللحظة المناسبة يُطرح تقييم قانوني مُعلّل لفرص كل طرف ومخاطره، فيحلّ محل التخمين صورةٌ يمكن أن يُبنى عليها القرار.` },
      { title: `اتفاق موثّق وقابل للتنفيذ`, body: `تسوية مبنية لتصمد: آليات تنفيذ وجداول زمنية وضمانات وجزاء عند الإخلال، بصياغة تتيح المصادقة عليها كحكم قضائي.` },
    ],
    relatedH2: `مقالات في الوساطة والتحكيم وحل النزاعات`,
    faqH2: `الوساطة التجارية والوساطة الموجّهة نحو الحسم`,
    faqs: [
      { q: `ما الوساطة الموجّهة نحو الحسم، وبم تختلف عن الوساطة العادية؟`, a: `في الوساطة التقليدية يمتنع الوسيط عن إبداء أي موقف، ودوره التقريب بين الطرفين فحسب. أما في الوساطة الموجّهة نحو الحسم فيقدّم الوسيط، وهو محامٍ ومحكّم، في المرحلة المناسبة تقييماً قانونياً مُعلّلاً لفرص كل طرف ومخاطره. التقييم غير ملزم، لكنه يستبدل بالتخمين صورةً واضحة، ولذلك تُحسم هنا ملفات تعثّرت في الوساطة العادية.` },
      { q: `هل تقييم الوسيط ملزم للطرفين؟`, a: `ليس بذاته. ما يقدّمه الوسيط رأي لا حكم، ولكل طرف أن يرفضه. الملزم هو الاتفاق الذي يوقّعانه في النهاية. ومن أراد نتيجة ملزمة منذ البداية أمكنه تصميم العملية بوصفها تحكيماً معجّلاً، وهو خيار يُتّخذ في المستهل ويُثبت في الاتفاق.` },
      { q: `كم تستغرق الوساطة التجارية وكم تكلّف؟`, a: `تُغلق معظم النزاعات التجارية في جلستين إلى أربع، خلال أسابيع لا سنوات. والكلفة جزء يسير من كلفة التقاضي في النزاع نفسه، وهي معروفة سلفاً. أما الدعوى التجارية أمام المحاكم فتُقاس بالسنوات واللوائح، وتجمّد العلاقة التجارية طوال تلك المدة.` },
      { q: `إذا أخفقت الوساطة، هل يمكننا اللجوء إلى المحكمة؟`, a: `نعم. اللجوء إلى الوساطة لا يسقط أي حق قانوني. والعملية سرّية، وما يُقال فيها غير مقبول في إجراء لاحق، فلا يكشف الطرف الداخل إليها أوراقه. وحتى الوساطة التي تنتهي دون اتفاق تضيّق النزاع عادةً وتختصر ما يليه.` },
      { q: `أي النزاعات لا تصلح للوساطة؟`, a: `النزاع الذي يحتاج فيه أحد الطرفين إلى إنصاف عاجل من المحكمة، كأمر منع لتفادي ضرر فوري؛ والنزاع الذي تُشتبه فيه مخالفة جنائية؛ والنزاع الذي يسعى فيه أحد الطرفين إلى التأخير لا إلى الحل. في هذه جميعاً يكون التقاضي هو الأداة الصحيحة، وقد يمكن العودة إلى الوساطة بعد صدور الإنصاف العاجل.` },
      { q: `هل العملية سرّية، ومن يطّلع على المستندات؟`, a: `سرّية بالكامل. الجلسات ليست علنية، والمستندات لا تُقدَّم إلى ملف قضائي، وما يُفضي به طرف إلى الوسيط في جلسة منفردة لا يُنقل إلى الطرف الآخر دون إذن. وهذا من أهم أسباب اختيار الشركات للوساطة حين يمسّ النزاع سرّاً تجارياً أو تسعيراً أو سمعة.` },
    ],
    ctaH2: `هل يعطّل نزاعٌ نشاطكم؟`,
    ctaBody: `لقاء تشخيصي قصير يحدّد ما إذا كان النزاع صالحاً للوساطة الموجّهة نحو الحسم، وما أسرع طريق لإنهائه.`,
    disclaimer: `المعلومات في هذه الصفحة عامة ولا تشكل استشارة قانونية ولا بديلاً عن رأي قانوني خاص.`,
  },
};

const COPY: Record<Lang, { ai: Copy; realEstate: Copy; mediation: Copy }> = {
  he: { ...he, mediation: mediationCopy.he },
  en: { ...en, mediation: mediationCopy.en },
  es: { ...es, mediation: mediationCopy.es },
  fr: { ...fr, mediation: mediationCopy.fr },
  ar: { ...ar, mediation: mediationCopy.ar },
};

function build(lang: Lang, c: Copy, shared: { path: string; url: string; icons: readonly IconName[]; related: readonly PillarLink[] }): PillarPage {
  return {
    path: shared.path,
    url: shared.url,
    title: c.title,
    desc: c.desc,
    heroEyebrow: c.heroEyebrow,
    lede: c.lede,
    coversEyebrow: c.labels.covers,
    coversH2: c.coversH2,
    cards: c.cards.map((card, i) => ({ icon: shared.icons[i], title: card.title, body: card.body })),
    whenEyebrow: c.labels.when,
    whenH2: c.whenH2,
    whenLede: c.whenLede,
    when: c.when,
    stepsEyebrow: c.labels.steps,
    stepsH2: c.stepsH2,
    steps: c.steps.map((s, i) => ({ n: STEP_NUMBERS[i], title: s.title, body: s.body })),
    relatedEyebrow: c.labels.related,
    relatedH2: c.relatedH2,
    related: [...shared.related],
    faqEyebrow: c.labels.faq,
    faqH2: c.faqH2,
    faqs: c.faqs,
    ctaH2: c.ctaH2,
    ctaBody: c.ctaBody,
    disclaimer: c.disclaimer,
    ui: UI[lang],
  };
}

export function aiPillarFor(lang: Lang): PillarPage {
  return build(lang, COPY[lang].ai, SHARED.ai);
}

export function realEstatePillarFor(lang: Lang): PillarPage {
  return build(lang, COPY[lang].realEstate, SHARED.realEstate);
}

export function mediationPillarFor(lang: Lang): PillarPage {
  return build(lang, COPY[lang].mediation, SHARED.mediation);
}

export function pillarPagesFor(lang: Lang): PillarPage[] {
  return [aiPillarFor(lang), realEstatePillarFor(lang), mediationPillarFor(lang)];
}
