// Tolerant Hebrew text matching, shared by the site search and the case law
// search.
//
// Hebrew makes naive matching fail in ways Latin text does not: the same word
// ends with a final letter form, quotation marks inside abbreviations are
// written with three different characters (״ ׳ and the ASCII "), and a case
// number is written as 38379-12-24 in one place and 38379/12/24 in another.
// Normalising all of that once, in one place, is what lets a visitor type
// "דייר סרבן" or "בגץ 38379" and still land on the right record.

// Fold a string into a clean, space separated token stream: lowercase, no
// niqqud, no punctuation, and final letters folded to their base form.
export function norm(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[֑-ׇ]/g, "") // Hebrew niqqud and cantillation
    .replace(/[̀-ͯ]/g, "") // Latin combining marks
    .replace(/[ךםןףץ]/g, (c) => ({ "ך": "כ", "ם": "מ", "ן": "נ", "ף": "פ", "ץ": "צ" }[c] as string))
    .replace(/["'`׳״.,;:!?()[\]{}<>/\\|_+=~@#$%^&*־–—-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function tokens(s: string): string[] {
  const n = norm(s);
  return n ? n.split(" ") : [];
}

// Expand a query token through a synonym table: every term in a group that the
// token matches becomes a candidate. Prefix matching in both directions keeps
// Hebrew inflection ("סרבנות" for "סרבן") working without a stemmer.
export function expandWith(groups: string[][], list: string[]): string[] {
  const out = new Set(list);
  for (const tok of list) {
    for (const group of groups) {
      const hit = group.some((g) => {
        const n = norm(g);
        return n === tok || n.startsWith(tok) || tok.startsWith(n);
      });
      if (hit) for (const g of group) out.add(norm(g));
    }
  }
  return [...out].filter(Boolean);
}

// Score one record against a query. Every token of the query must be found
// (AND), with synonyms allowed to satisfy a token, and a hit in the title
// counts for more than a hit in the body. Returns 0 when the record is out.
export function scoreAgainst(
  query: string,
  fields: { title: string; body: string; keys: string }, groups: string[][],
): number {
  const raw = norm(query);
  if (!raw) return 0;
  const title = norm(fields.title);
  const body = norm(fields.body);
  const keys = norm(fields.keys);
  const hay = `${title} ${body} ${keys}`;
  let score = 0;
  for (const base of raw.split(" ")) {
    const variants = expandWith(groups, [base]);
    if (!variants.some((v) => hay.includes(v))) return 0;
    if (title.includes(base)) score += title.startsWith(base) ? 12 : 8;
    else if (keys.includes(base)) score += 4;
    else if (body.includes(base)) score += 3;
    else score += 1; // matched only through a synonym
  }
  return score;
}
