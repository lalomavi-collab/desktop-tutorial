// Central per-page / per-category FAQ mapping. Each route resolves to the Q&A
// that is actually rendered on that page, so the FAQPage JSON-LD always matches
// the visible content (a Google requirement) and questions stay scoped to the
// page instead of one generic sitewide block.
//
// Content is not duplicated here: it is read from the existing bilingual sources
// (strings.ts via the passed Dict, and the curated faqCategories), so editing a
// question in one place keeps both the visible accordion and the schema in sync.

import type { Dict } from "./strings";
import { faqCategories } from "./faq";
import type { QA } from "./schema";

// The general homepage FAQ (rendered in the Home FAQ section).
function homeFaqs(t: Dict): QA[] {
  return t.data.faqs.map((f) => ({ q: f.q, a: f.a }));
}

// The practice-area FAQ (rendered by <PracticeFaq/> on Home and Advisory).
function practiceFaqs(t: Dict): QA[] {
  return t.practice.faq.cats.flatMap((c) => c.items.map((it) => ({ q: it.q, a: it.a })));
}

// The full Q&A page content (rendered on /faq), grouped by category. Each answer
// is stored as paragraphs, joined into one answer string for the schema.
function faqPageFaqs(): QA[] {
  return faqCategories.flatMap((c) => c.items.map((it) => ({ q: it.q, a: it.a.join(" ") })));
}

// Exact-path FAQ sets. A page emits ONE FAQPage built from its entry here.
// Home combines both visible FAQ blocks (general + practice) into a single page
// FAQPage rather than emitting two competing blocks.
// Pillar page: independent legal advice and a second opinion on AI for
// organizations. Content lives here so the visible page and the FAQPage schema
// stay in sync from one source.
function aiLegalAdvisoryFaqs(): QA[] {
  return [
    { q: `מה כוללת חוות דעת משפטית שנייה בנושא AI לחברות וארגונים?`, a: `חוות דעת שנייה עצמאית בוחנת מחדש את החשיפה המשפטית של הארגון בשימוש בבינה מלאכותית: התאמה ל-EU AI Act, אחריות אלגוריתמית, הגנת פרטיות וקניין רוחני, ומבנה החוזים מול ספקי AI. המטרה היא לזהות סיכונים לפני שהם מתממשים, ולתת להנהלה ולדירקטוריון בסיס מושכל להחלטה.` },
    { q: `מתי כדאי לפנות לייעוץ משפטי חיצוני לפני החלטת AI?`, a: `לפני הטמעת מערכת AI חדשה, לפני חתימה על חוזה עם ספק AI, לפני השקת מוצר מבוסס אלגוריתם, וכשיש אי-ודאות רגולטורית או חשיפה אישית של נושאי משרה. ייעוץ מוקדם זול ומהיר יותר מהתמודדות עם תביעה או קנס בדיעבד.` },
    { q: `למי מיועד הייעוץ, לחברות הייטק בלבד?`, a: `לא. השירות מיועד לחברות טכנולוגיה, לתאגידים מסורתיים שמטמיעים AI, לגופים ציבוריים ולרשויות, וכן לעורכי דין ומשרדים שמבקשים חוות דעת שנייה בלתי תלויה בסוגיה מורכבת. הליבה היא המפגש בין משפט, כלכלה ובינה מלאכותית.` },
    { q: `במה חוות דעת שנייה שונה מהייעוץ המשפטי הרגיל של הארגון?`, a: `חוות דעת שנייה היא בלתי תלויה: היא אינה מגינה על החלטה שכבר התקבלה, אלא בוחנת אותה מחדש בעין ביקורתית. היא מחזקת גם את הלקוח וגם את היועץ המייצג, ומספקת שכבת הגנה נוספת מול רגולטור, דירקטוריון או תובע.` },
    { q: `האם הייעוץ מכסה את ה-EU AI Act ורגולציה גלובלית?`, a: `כן. אנחנו ממפים את חשיפת הארגון מול המסגרות המחמירות ביותר, כולל ה-EU AI Act, חובות שקיפות ותיעוד, סיווג סיכון של מערכות, ודיני פרטיות מתקדמים, ומתרגמים אותן למטריצת ציות מעשית לפי שלב וסיכון.` },
    { q: `איך מתחילים?`, a: `בפגישת אבחון ראשונית ממפים את הארכיטקטורה הטכנולוגית, המבנה הארגוני והחשיפה הרגולטורית, ומגדירים מפת דרכים לחוות דעת ולניהול הסיכון. אפשר לתאם דרך עמוד הפגישה.` },
  ];
}

function exactSets(t: Dict): Record<string, QA[]> {
  return {
    "/": [...homeFaqs(t), ...practiceFaqs(t)],
    "/advisory": practiceFaqs(t),
    "/faq": faqPageFaqs(),
    "/ai-legal-advisory": aiLegalAdvisoryFaqs(),
  };
}

// Path-prefix FAQ sets, for whole sections that should share a category-specific
// set without per-page wiring. Longest matching prefix wins. Add future hubs
// here, e.g. "/insights": insightsFaqs(t). Empty by default so untouched
// sections emit no FAQPage instead of a generic one.
function prefixSets(_t: Dict): Record<string, QA[]> {
  return {};
}

// Resolve the Q&A visible on `path`. Returns [] when the page has no associated
// FAQ, so buildFaqPage() then skips the block entirely.
export function faqsForPath(t: Dict, path: string): QA[] {
  const clean = path.replace(/\/+$/, "") || "/";
  const exact = exactSets(t);
  if (clean in exact) return exact[clean];

  const prefixes = prefixSets(t);
  const match = Object.keys(prefixes)
    .filter((p) => clean === p || clean.startsWith(p + "/"))
    .sort((a, b) => b.length - a.length)[0];
  return match ? prefixes[match] : [];
}
