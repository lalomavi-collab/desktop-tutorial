// Convert a human display date to an ISO 8601 date for structured data.
//
// Article dates are authored as display strings in two shapes: Hebrew month
// plus year ("אוגוסט 2025") and English abbreviated month plus year
// ("Jul 2026"). schema.org datePublished must be ISO 8601, so a Hebrew or
// abbreviated string there is invalid and Google drops it. We only know the
// month and year, so we emit the first of that month (YYYY-MM-01), which is a
// valid date Google accepts. When the string cannot be parsed we return
// undefined, and the caller omits datePublished rather than emit something
// invalid.

const MONTHS: Record<string, number> = {
  // Hebrew
  "ינואר": 1, "פברואר": 2, "מרץ": 3, "אפריל": 4, "מאי": 5, "יוני": 6,
  "יולי": 7, "אוגוסט": 8, "ספטמבר": 9, "אוקטובר": 10, "נובמבר": 11, "דצמבר": 12,
  // English, full and abbreviated (lowercased at lookup)
  "january": 1, "february": 2, "march": 3, "april": 4, "may": 5, "june": 6,
  "july": 7, "august": 8, "september": 9, "october": 10, "november": 11, "december": 12,
  "jan": 1, "feb": 2, "mar": 3, "apr": 4, "jun": 6, "jul": 7, "aug": 8,
  "sep": 9, "sept": 9, "oct": 10, "nov": 11, "dec": 12,
};

export function toIsoDate(display: string | undefined): string | undefined {
  if (!display) return undefined;
  const yearMatch = display.match(/\b(20\d{2})\b/);
  if (!yearMatch) return undefined;
  const year = yearMatch[1];
  // The month token is any run of Hebrew or Latin letters in the string.
  const tokens = display.match(/[A-Za-z֐-׿]+/g) || [];
  for (const tok of tokens) {
    const month = MONTHS[tok] ?? MONTHS[tok.toLowerCase()];
    if (month) return `${year}-${String(month).padStart(2, "0")}-01`;
  }
  return undefined;
}
