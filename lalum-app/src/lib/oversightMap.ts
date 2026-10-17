// The "where the human enters" map: the points at which two frameworks name a
// human being, as written in the instruments themselves.
//
// Every quotation below was read in the instrument and found identical in a
// second official source (the record, with links and the check date, is
// docs/oversight-map/verified-claims.md). Nothing here is a paraphrase of a
// duty: the Hebrew line under each quotation says where the human appears and
// no more. Two scope limits are carried on the page, not hidden in a footnote:
// Article 14 applies to high-risk AI systems only, and the AI RMF is a
// voluntary framework, not a law.
//
// Adding a point means verifying it first. An unverified claim does not go in.

export type OversightSource = "ai-act" | "nist";

export interface OversightPoint {
  id: string;
  source: OversightSource;
  /** Where in the instrument. */
  ref: string;
  /** The words of the instrument, verbatim and in its own language. */
  quote: string;
  /** Where the human appears, in one plain line. Says no more than the quote. */
  human: string;
  /** Short label for the card. */
  title: string;
  url: string;
}

export const OVERSIGHT_SOURCES: Record<OversightSource, { label: string; status: string; scope: string }> = {
  "ai-act": {
    label: `AI Act`,
    status: `חיקוק מחייב`,
    scope: `סעיף 14 חל על מערכות בינה מלאכותית מסווגות high-risk בלבד, ולא על כל מערכת AI.`,
  },
  nist: {
    label: `NIST AI RMF`,
    status: `מסגרת וולונטרית`,
    scope: `ה-AI RMF אינו חיקוק. ארגון מאמץ אותו מרצונו, והוא אינו מחייב איש.`,
  },
};

export const OVERSIGHT_POINTS: OversightPoint[] = [
  {
    id: "design",
    source: "ai-act",
    ref: `Article 14(1)`,
    quote: `High-risk AI systems shall be designed and developed in such a way, including with appropriate human-machine interface tools, that they can be effectively overseen by natural persons during the period in which they are in use.`,
    human: `האדם נכנס כבר בתכנון: המערכת צריכה להיבנות כך שאדם יוכל לפקח עליה בזמן השימוש.`,
    title: `פיקוח כבר בתכנון`,
    url: `https://eur-lex.europa.eu/eli/reg/2024/1689/2026-07-27/eng`,
  },
  {
    id: "proportion",
    source: "ai-act",
    ref: `Article 14(3)`,
    quote: `The oversight measures shall be commensurate with the risks, level of autonomy and context of use of the high-risk AI system`,
    human: `עוצמת הפיקוח האנושי נקבעת לפי הסיכון, מידת האוטונומיה והקשר השימוש.`,
    title: `פיקוח לפי הסיכון`,
    url: `https://ai-act-service-desk.ec.europa.eu/en/ai-act/article-14`,
  },
  {
    id: "bias",
    source: "ai-act",
    ref: `Article 14(4)(b)`,
    quote: `to remain aware of the possible tendency of automatically relying or over-relying on the output produced by a high-risk AI system (automation bias)`,
    human: `מי שמפקח צריך להישאר מודע לנטייה להסתמך על פלט המכונה באופן אוטומטי או יתר על המידה.`,
    title: `הסתמכות יתר על המכונה`,
    url: `https://eur-lex.europa.eu/eli/reg/2024/1689/2026-07-27/eng`,
  },
  {
    id: "override",
    source: "ai-act",
    ref: `Article 14(4)(d)`,
    quote: `to decide, in any particular situation, not to use the high-risk AI system or to otherwise disregard, override or reverse the output of the high-risk AI system`,
    human: `האדם יכול להחליט שלא להשתמש במערכת, או להתעלם מהפלט שלה, לעקוף אותו או להפוך אותו.`,
    title: `הזכות לעקוף`,
    url: `https://ai-act-service-desk.ec.europa.eu/en/ai-act/article-14`,
  },
  {
    id: "stop",
    source: "ai-act",
    ref: `Article 14(4)(e)`,
    quote: `to intervene in the operation of the high-risk AI system or interrupt the system through a 'stop' button or a similar procedure that allows the system to come to a halt in a safe state.`,
    human: `האדם יכול להתערב בפעולת המערכת ולעצור אותה, באמצעות כפתור עצירה או הליך דומה.`,
    title: `כפתור עצירה`,
    url: `https://eur-lex.europa.eu/eli/reg/2024/1689/2026-07-27/eng`,
  },
  {
    id: "roles",
    source: "nist",
    ref: `GOVERN 3.2`,
    quote: `Policies and procedures are in place to define and differentiate roles and responsibilities for human-AI configurations and oversight of AI systems.`,
    human: `ארגון מגדיר מראש מי אחראי על מה כשאדם ומכונה עובדים יחד, ומי מפקח.`,
    title: `הגדרת תפקידים ואחריות`,
    url: `https://airc.nist.gov/airmf-resources/playbook/govern/`,
  },
];

export const OVERSIGHT_PAGE = {
  path: "ai-legal-advisory/human-oversight",
  url: "https://lalumapp.com/ai-legal-advisory/human-oversight/",
  title: `איפה האדם נכנס: פיקוח אנושי ב-AI Act וב-NIST`,
  desc: `שש נקודות שבהן סעיף 14 ב-AI Act ומסגרת ה-AI RMF של NIST מציבים אדם מול מכונה, בציטוט מדויק ובקישור למקור. מה מחייב ומה וולונטרי, ולמי זה חל.`,
  eyebrow: `AI ומשפט`,
  h1: `איפה האדם נכנס`,
  lede: `מכונה יכולה לסמן. השאלה היא איפה הדין והמסגרות המקובלות דורשים או מציעים שאדם יכריע. כאן שש נקודות כאלה, כל אחת בלשון המקור ועם קישור אליו, כדי שאפשר יהיה לבדוק אותן בעצמכם.`,
  filterAll: `הכול`,
  filterLabel: `סינון לפי מקור`,
  quoteLabel: `לשון המקור`,
  humanLabel: `איפה האדם`,
  sourceLabel: `למקור`,
  scopeLabel: `היקף`,
  pickLabel: `בחרו נקודה`,
  moreLabel: `קריאה נוספת`,
  moreHref: `/insights/effective-human-oversight-ai-systems`,
  moreTitle: `פיקוח אנושי אפקטיבי על מערכות AI: איך מיישמים בפועל`,
  checked: `הציטוטים נבדקו מול שני מקורות רשמיים בתאריך 17.10.2026. מה שלא נבדק בשני מקורות אינו מופיע כאן.`,
  disclaimer: `העמוד מספק מידע כללי ואינו ייעוץ משפטי. הוא מתאר מה כתוב בשני מסמכים, ולא אם ומה חל על ארגון מסוים, וזו שאלה שמחייבת בחינה פרטנית. כל הציטוטים באנגלית כלשונם במקור.`,
} as const;
