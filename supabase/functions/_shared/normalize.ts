// Hebrew-aware name normalization for Bar-registry matching.
// See docs/11-verification-bar-registry.md §5.
//
// Goal: turn two human-entered names into comparable token sets so that
// "עו״ד ישראל ישראלי" and "ישראלי, ישראל" match — while staying conservative
// (near-but-not-exact matches are routed to manual review, not auto-verified).

const HEB_FINALS: Record<string, string> = {
  "ם": "מ", "ן": "נ", "ץ": "צ", "ף": "פ", "ך": "כ",
};

// Honorific / title tokens to strip (Hebrew + English).
const HONORIFICS = new Set([
  "עוד", "עוהד", "עורך", "עורכת", "דין", // עו״ד / עוה״ד / עורך דין variants after punctuation removal
  "advocate", "adv", "attorney", "atty", "esq", "mr", "mrs", "ms", "dr",
]);

/** Normalize a single name into a stable, comparable form. */
export function normalizeName(input: string): string {
  if (!input) return "";
  let s = input.normalize("NFKC");

  // Remove niqqud (Hebrew points) and cantillation.
  s = s.replace(/[֑-ׇ]/g, "");

  // Remove geresh/gershayim, quotes, and punctuation → spaces.
  s = s.replace(/['"׳״`.,;:()\[\]{}/\\\-_]/g, " ");

  // Lowercase (affects Latin; harmless for Hebrew).
  s = s.toLowerCase();

  // Normalize Hebrew final letters.
  s = s.replace(/[םןץףך]/g, (c) => HEB_FINALS[c] ?? c);

  // Collapse whitespace and tokenize.
  const tokens = s.split(/\s+/).filter(Boolean).filter((t) => !HONORIFICS.has(t));

  // Order-independent: sort tokens so "a b" == "b a".
  tokens.sort();
  return tokens.join(" ").trim();
}

/** Exact normalized equality (used for auto-verify). */
export function namesMatchExact(a: string, b: string): boolean {
  const na = normalizeName(a);
  const nb = normalizeName(b);
  return na.length > 0 && na === nb;
}

/**
 * Token-set similarity in [0,1] (Jaccard over normalized tokens).
 * Used to decide whether a near-match should be surfaced to a reviewer.
 */
export function nameSimilarity(a: string, b: string): number {
  const ta = new Set(normalizeName(a).split(" ").filter(Boolean));
  const tb = new Set(normalizeName(b).split(" ").filter(Boolean));
  if (ta.size === 0 || tb.size === 0) return 0;
  let inter = 0;
  for (const t of ta) if (tb.has(t)) inter++;
  const union = ta.size + tb.size - inter;
  return union === 0 ? 0 : inter / union;
}
