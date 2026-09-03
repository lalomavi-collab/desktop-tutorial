// The case law database behind /rulings.
//
// The rule this module exists to enforce: nothing here is written from memory.
// Every record is drawn from something the firm has already published, and
// carries the article it came from, the deciding court, the date, and any
// public source. A record without a citation, a court and a date does not
// belong in the corpus, and the types below make that a compile error rather
// than a review comment.
//
// The corpus is deliberately narrow. It covers what the practice has written
// about, which today is artificial intelligence in legal work and the duties
// that come with it. For everything else the page does not guess: it hands the
// visitor a ready query for the official databases. An empty area is shown as
// empty, because a case law search that invents an answer is worse than one
// that says it has none.

import data from "../data/rulings.json";
import { norm, scoreAgainst } from "./hebrewSearch";

export type AreaId = "ai" | "profession" | "real-estate" | "urban-renewal";

export type RulingSource = { label: string; href: string };

export type Ruling = {
  id: string;
  /** The docket number as it is cited, e.g. "בג״ץ 38379-12-24". */
  citation: string;
  /** The parties, where the published source names them. */
  caption?: string;
  court: string;
  bench?: string;
  /** ISO date, used for sorting. Day precision is not always known. */
  date: string;
  /** The date as it is written in Hebrew, e.g. "23.2.2025" or "יולי 2025". */
  dateLabel: string;
  jurisdiction: "IL" | "US" | "CA" | "EU";
  areas: AreaId[];
  tags: string[];
  facts?: string;
  issue?: string;
  holding: string;
  implications?: string;
  quote?: string;
  sources: RulingSource[];
  /** Slug of the LALUM article this record was written from. */
  article?: string;
};

export const rulings: Ruling[] = (data.rulings as Ruling[]).slice();

// The four subjects the search is organised by. The two the practice leads
// with are first, even though the corpus does not cover them yet: the visitor
// who came looking for a refusing tenant should see that subject named, and get
// a working query for it, rather than a search box that silently returns
// nothing.
export type Area = {
  id: AreaId;
  label: string;
  blurb: string;
  /** Ready made queries for the official databases, in the terms they index. */
  terms: string[];
};

export const AREAS: Area[] = [
  {
    id: "real-estate",
    label: "נדל״ן ומקרקעין",
    blurb: "עסקאות, מיסוי מקרקעין, רישום וליקויי בנייה.",
    terms: [
      "שווי מכירה מול תמורה חוזית מס שבח",
      "עסקאות נוגדות במקרקעין תקנת השוק",
      "הערת אזהרה תום לב",
      "היטל השבחה ועדת ערר",
      "ליקויי בנייה איחור במסירה",
    ],
  },
  {
    id: "urban-renewal",
    label: "התחדשות עירונית",
    blurb: "תמ״א 38, פינוי-בינוי, רוב נדרש וסרבנות.",
    terms: [
      "דייר סרבן פינוי בינוי סירוב בלתי סביר",
      "תביעת נזיקין לפי חוק פינוי ובינוי (פיצויים)",
      "רוב מיוחס בעלי דירות התחדשות עירונית",
      "הגנת קשישים פינוי בינוי",
      "המפקח על רישום מקרקעין חיזוק בתים משותפים",
    ],
  },
  {
    id: "ai",
    label: "בינה מלאכותית ומשפט",
    blurb: "הזיות ואסמכתאות, אחריות ספק, שקיפות אלגוריתמית.",
    terms: [
      "אסמכתאות בדויות בינה מלאכותית כתב טענות",
      "אחריות ספק מודל שפה נזק",
      "זכויות יוצרים בינה מלאכותית יצירה",
      "שקיפות אלגוריתמית החלטה מנהלית",
    ],
  },
  {
    id: "profession",
    label: "מקצוע עריכת הדין",
    blurb: "ייחוד המקצוע, שכר טרחה, אתיקה וחובת אימות.",
    terms: [
      "ייחוד המקצוע סעיף 20 לחוק לשכת עורכי הדין",
      "שכר ראוי בהיעדר הסכם שכר טרחה",
      "אתיקה שימוש בכלי בינה מלאכותית עורך דין",
    ],
  },
];

// How a record is titled. A foreign citation already carries the case name
// ("Walters v. OpenAI, 23-A-04860-2"), so appending the caption to it printed
// the name twice. An Israeli docket number does not, so there the caption is
// what tells the reader which case this is.
export function rulingTitle(r: Ruling): string {
  if (!r.caption) return r.citation;
  return r.citation.includes(r.caption) ? r.citation : `${r.citation} ${r.caption}`;
}

export const areaLabel = (id: AreaId): string => AREAS.find((a) => a.id === id)?.label ?? id;

export function countByArea(id: AreaId): number {
  return rulings.filter((r) => r.areas.includes(id)).length;
}

// The courts present in the corpus, for the filter. Derived rather than listed,
// so a new record never needs a second edit somewhere else.
export function courtsInCorpus(): string[] {
  return [...new Set(rulings.map((r) => r.court))].sort((a, b) => a.localeCompare(b, "he"));
}

// Legal vocabulary, so a visitor who types the word they use finds the record
// written in the word the court used. Terminology only: these are synonyms in
// Israeli legal usage, not claims about what any ruling held.
const LEGAL_SYNONYMS: string[][] = [
  ["הזיה", "הזיות", "hallucination", "hallucinations", "אסמכתא בדויה", "אסמכתאות בדויות", "ציטוט מומצא", "פסק דין בדוי"],
  ["בינה", "מלאכותית", "ai", "בינה מלאכותית", "מודל שפה", "llm", "chatgpt", "אלגוריתם", "אלגוריתמי"],
  ["סרבן", "סרבנות", "דייר סרבן", "סירוב בלתי סביר", "רוב מיוחס"],
  ["פינוי", "בינוי", "פינוי-בינוי", "התחדשות", "עירונית", "תמא", "תמא 38", "מתחם"],
  ["נדלן", "מקרקעין", "דירה", "נכס", "עסקה", "רכישה", "מכר"],
  ["מיסוי", "שבח", "רכישה", "השבחה", "מס", "ועדת ערר", "שומה"],
  ["שכר", "טרחה", "שכר ראוי", "שכט"],
  ["אתיקה", "משמעת", "משמעתי", "לשכת עורכי הדין", "ייחוד המקצוע", "סעיף 20"],
  ["סנקציה", "סנקציות", "הוצאות אישיות", "קנס", "נזיפה"],
  ["עליון", "בגץ", "בית המשפט העליון", "supreme"],
  ["שלום", "מחוזי", "ערכאה ראשונה"],
];

export type Sort = "relevance" | "newest" | "oldest";

export type Query = { q: string; area: AreaId | "all"; court: string | "all"; sort: Sort };

export const EMPTY_QUERY: Query = { q: "", area: "all", court: "all", sort: "relevance" };

// One record's searchable text. The citation is in the title field so a docket
// number outranks a passing mention of the same digits in a body.
function fieldsOf(r: Ruling) {
  return {
    title: rulingTitle(r),
    body: [r.facts, r.issue, r.holding, r.implications, r.quote].filter(Boolean).join(" "),
    keys: `${r.court} ${r.bench ?? ""} ${r.tags.join(" ")} ${r.dateLabel} ${r.areas.map(areaLabel).join(" ")}`,
  };
}

export function searchRulings(query: Query): Ruling[] {
  const filtered = rulings.filter(
    (r) => (query.area === "all" || r.areas.includes(query.area)) && (query.court === "all" || r.court === query.court),
  );
  const byDate = (a: Ruling, b: Ruling) =>
    query.sort === "oldest" ? a.date.localeCompare(b.date) : b.date.localeCompare(a.date);

  if (!norm(query.q)) return filtered.sort(byDate);

  const scored = filtered
    .map((r) => ({ r, score: scoreAgainst(query.q, fieldsOf(r), LEGAL_SYNONYMS) }))
    .filter((x) => x.score > 0);
  if (query.sort !== "relevance") return scored.map((x) => x.r).sort(byDate);
  return scored.sort((a, b) => b.score - a.score || b.r.date.localeCompare(a.r.date)).map((x) => x.r);
}

// The public databases, for everything the corpus does not hold.
//
// Their own search forms take a session and a form post rather than a query in
// the URL, so a link that claims to carry the visitor's words into them would
// quietly drop them. A site scoped search does carry the words, and lands on
// real documents in that database, so that is what the query links use, with
// the database's own search form offered beside it.
export const DATABASES: { label: string; site: string; form: string }[] = [
  { label: "הרשות השופטת", site: "supreme.court.gov.il", form: "https://supreme.court.gov.il/Pages/fullsearch.aspx" },
  { label: "נבו", site: "nevo.co.il", form: "https://www.nevo.co.il/psikasearch.aspx" },
  { label: "פסקדין", site: "psakdin.co.il", form: "https://www.psakdin.co.il/Court" },
];

export function siteSearchUrl(site: string, q: string): string {
  return `https://www.google.com/search?q=${encodeURIComponent(`site:${site} ${q}`)}`;
}

export function webSearchUrl(q: string): string {
  return `https://www.google.com/search?q=${encodeURIComponent(`${q} פסק דין`)}`;
}
