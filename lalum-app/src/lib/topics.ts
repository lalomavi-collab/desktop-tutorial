import { blogPosts } from "./blogPosts";
import { blocksToText } from "./articleBlocks";
import type { ArticleBlock } from "./content";
import type { Dict } from "./strings";

// Topic hubs for the writing.
//
// /insights was one flat list of 160 pieces. A reader looking for the mediation
// writing had to scroll past everything else, and a crawler saw a single page
// with 160 links and no signal about what any group of them was about. The
// subjects existed; they had no address.
//
// Each article belongs to exactly one topic, decided here rather than stored on
// the articles, because the corpus was imported over years and nothing on it
// carries a usable category. Assignment is by weighted keyword hits over the
// title, the standfirst and the opening of the body, with the topics tried in
// the order below so a piece about mediating an urban renewal dispute lands
// under mediation rather than under real estate: the dispute is what it is
// about, the project is only where it happens.
//
// Hebrew only, like the writing itself. These hubs claim no translated
// alternates, for the same reason the articles do not.

export type Topic = {
  slug: string;
  name: string;
  title: string;
  desc: string;
  lede: string;
  // The pillar page this subject sells into, linked from the hub so the
  // writing has somewhere to lead.
  pillar?: { path: string; label: string };
  keywords: string[];
};

export const TOPICS: Topic[] = [
  {
    slug: "mediation",
    name: `גישור ויישוב סכסוכים`,
    title: `גישור מכוון הכרעה ויישוב סכסוכים: מאמרים`,
    desc: `מאמרים על גישור מכוון הכרעה, גישור מסחרי, בוררות ויישוב סכסוכים עסקיים: איך מתנהל ההליך, מתי הוא עדיף על בית משפט, ומה הופך הסדר לבר-אכיפה.`,
    lede: `ההליך, הסמכות והגבולות. מתי גישור מכוון הכרעה מגיע להסדר שהליך משפטי לא היה מגיע אליו, ומה נדרש כדי שההסדר יחזיק אחר כך.`,
    pillar: { path: "mediation-dispute-resolution", label: `גישור מסחרי ויישוב סכסוכים עסקיים` },
    keywords: ["גישור", "מגשר", "בוררות", "בורר", "סכסוך", "סכסוכים", "מחלוקת", "הכרעה", "גישבור", "מדיאציה", "מגשרים", "יישוב סכסוכים"],
  },
  {
    slug: "urban-renewal",
    name: `נדל"ן והתחדשות עירונית`,
    title: `נדל"ן, תמ"א 38 ופינוי-בינוי: מאמרים`,
    desc: `מאמרים על עסקאות נדל"ן, התחדשות עירונית, תמ"א 38 ופינוי-בינוי: הסכמי יזם, בטוחות, זכויות בעלי דירות, בדיקת נאותות וניהול סיכונים בעסקה.`,
    lede: `מה נבדק לפני חתימה, מה מגן על בעל הזכויות כשהפרויקט משתבש, ואיפה עוברת השורה בין סיכון מסחרי לחשיפה משפטית.`,
    pillar: { path: "real-estate-legal-advisory", label: `ייעוץ וחוות דעת שנייה בנדל"ן` },
    keywords: ["נדל", "דירה", "דירות", "מקרקעין", "תמ\"א", "פינוי", "התחדשות", "דייר", "דיירים", "יזם", "קבלן", "בנייה", "שכירות", "משכנתא", "קומבינציה", "נציגות", "בעלי הזכויות"],
  },
  {
    slug: "ai-governance",
    name: `בינה מלאכותית וממשל סיכונים`,
    title: `ממשל בינה מלאכותית, EU AI Act וסיכון אלגוריתמי: מאמרים`,
    desc: `מאמרים על ממשל בינה מלאכותית, EU AI Act, אחריות אלגוריתמית, פרטיות ותיקון 13, וניהול סיכוני AI בארגון ובדירקטוריון.`,
    lede: `מה מוטל על הארגון שמפעיל מערכת אלגוריתמית, מי נושא באחריות כשהיא טועה, ואיך נראה תיעוד שמחזיק מול רגולטור.`,
    pillar: { path: "ai-legal-advisory", label: `ייעוץ וחוות דעת שנייה בנושא AI` },
    keywords: ["בינה מלאכותית", " ai", "ai ", "אלגורית", "eu ai act", "gpai", "llm", "מודל שפה", "אוטומטי", "פרטיות", "תיקון 13", "ממשל", "דירקטוריון", "רגולצי", "ציות", "סייבר", "נתונים"],
  },
  {
    slug: "cross-border",
    name: `עסקאות ונכסים בחו"ל`,
    title: `נדל"ן והשקעות בחו"ל למשקיע הישראלי: מאמרים`,
    desc: `מאמרים על רכישת נכסים והשקעות מעבר לים: מבנה העסקה, מיסוי, הדין הזר, ליווי משפטי ישראלי וסיכונים בעסקה חוצת גבולות.`,
    lede: `מה שונה כשהעסקה נכתבת בשפה אחת ומתבצעת תחת דין אחר, ואיפה משקיע ישראלי מגלה מאוחר מדי שהמבנה לא התאים.`,
    keywords: ["חו\"ל", "מעבר לים", "בינלאומ", "חוצה גבולות", "חוצי גבולות", "פורטוגל", "יוון", "קפריסין", "דובאי", "ארצות הברית", "אירופה", "משקיע הישראלי", "שווקים זרים", "דין זר"],
  },
  {
    slug: "contracts",
    name: `חוזים, חברות וקניין רוחני`,
    title: `חוזים, ליווי חברות וקניין רוחני: מאמרים`,
    desc: `מאמרים על חוזים מסחריים, ליווי סטארטאפים וחברות, הסכמי מייסדים וגיוס, קניין רוחני וסודות מסחריים, ובדיקת נאותות בעסקה.`,
    lede: `הסעיפים שנראים טכניים עד שמשהו משתבש, והמקום שבו נוסח החוזה קובע את התוצאה יותר מכל טענה שתבוא אחריו.`,
    keywords: ["חוזה", "חוזים", "הסכם", "הסכמי", "סעיף", "סטארטאפ", "מייסדים", "גיוס", "קניין רוחני", "פטנט", "סוד מסחרי", "זכויות יוצרים", "מיזוג", "רכישות", "נאותות", "שותפות", "חברה"],
  },
  {
    slug: "practice",
    name: `המקצוע המשפטי`,
    title: `שיקול דעת, חוות דעת שנייה והמקצוע המשפטי: מאמרים`,
    desc: `מאמרים על אופן העבודה של המשרד: חוות דעת שנייה בלתי תלויה, שיקול דעת משפטי, כלים דיגיטליים בעבודת עורך הדין, והמפגש בין משפט לכלכלה.`,
    lede: `לא על תחום דין מסוים, אלא על איך מתקבלת החלטה משפטית, מי בודק אותה, ומה הופך אותה לברת-הגנה.`,
    keywords: [],
  },
];

export const topicBySlug = new Map(TOPICS.map((t) => [t.slug, t]));

export type TopicArticle = { slug: string; title: string };

// The text an article is classified on. Its opening only, for the same reason
// the related-article scoring uses the opening: a piece states its subject
// early, and the rest adds length that matches everything.
function classifyText(title: string, dek: string, body: string): string {
  return `${title} ${title} ${dek} ${body.slice(0, 1200)}`.toLowerCase();
}

function topicFor(text: string): Topic {
  let best = TOPICS[TOPICS.length - 1];
  let bestScore = 0;
  for (const t of TOPICS) {
    let score = 0;
    for (const k of t.keywords) {
      // Count occurrences, not presence: an article that says גישור nine times
      // is about mediation, one that mentions it once in passing is not.
      let from = 0;
      for (;;) {
        const at = text.indexOf(k, from);
        if (at < 0) break;
        score++;
        from = at + k.length;
      }
    }
    // Strictly greater, so the first topic in TOPICS order wins a tie. That
    // order is the deliberate one described at the top of this file.
    if (score > bestScore) { best = t; bestScore = score; }
  }
  return bestScore > 0 ? best : TOPICS[TOPICS.length - 1];
}

const grouped = new WeakMap<object, Map<string, TopicArticle[]>>();

// Every article, grouped by topic, in corpus order. Memoised per dictionary so
// the build can ask once per hub and the app once per render.
export function articlesByTopic(dict: Dict): Map<string, TopicArticle[]> {
  let g = grouped.get(dict);
  if (g) return g;
  g = new Map(TOPICS.map((t) => [t.slug, [] as TopicArticle[]]));
  const all = [
    ...dict.data.articles.map((a) => ({ slug: a.slug, title: a.title, dek: a.dek, body: blocksToText(a.blocks as ArticleBlock[]) })),
    ...blogPosts.map((p) => ({ slug: p.slug, title: p.title, dek: p.excerpt, body: p.body })),
  ];
  for (const a of all) {
    const t = topicFor(classifyText(a.title, a.dek, a.body));
    g.get(t.slug)!.push({ slug: a.slug, title: a.title });
  }
  grouped.set(dict, g);
  return g;
}

export function topicPath(slug: string): string {
  return `/insights/topics/${slug}`;
}
