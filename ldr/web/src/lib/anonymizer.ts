// CLIENT-SIDE ZERO-KNOWLEDGE ANONYMIZER (browser).
// Mirrors ldr/client-anonymizer. Raw narrative + exact sums are destroyed here,
// before anything is sent to Supabase.
import type { EconomicExposure } from "./supabase";

const ENTITY_PATTERNS: { label: string; re: RegExp }[] = [
  { label: "[ת.ז]", re: /\b\d{9}\b/g },
  { label: "[טלפון]", re: /\b0\d{1,2}[-\s]?\d{7}\b/g },
  { label: "[אימייל]", re: /\b[\w.+-]+@[\w-]+\.[\w.-]+\b/g },
  { label: "[גוש/חלקה]", re: /\b(?:גוש|חלקה)\s*\d+/g },
  { label: "[חשבון]", re: /\b\d{6,}\b/g },
  { label: "[סכום]", re: /(?:₪|ש"ח|NIS|ILS)\s?[\d,]+(?:\.\d+)?|[\d,]+(?:\.\d+)?\s?(?:₪|ש"ח|NIS|ILS)/g },
];

export function redactEntities(text: string): string {
  let out = text;
  for (const { label, re } of ENTITY_PATTERNS) out = out.replace(re, label);
  return out;
}

export function bucketExposure(valueIls: number | undefined): EconomicExposure {
  if (valueIls === undefined || Number.isNaN(valueIls)) return "under_1M";
  const M = 1_000_000;
  if (valueIls < 1 * M) return "under_1M";
  if (valueIls < 5 * M) return "1M_to_5M";
  if (valueIls < 10 * M) return "5M_to_10M";
  if (valueIls < 15 * M) return "10M_to_15M";
  if (valueIls < 50 * M) return "15M_to_50M";
  if (valueIls < 100 * M) return "50M_to_100M";
  return "over_100M";
}

const RISK_KEYWORDS: { factor: string; terms: string[] }[] = [
  { factor: "regulatory_delay", terms: ["רגולצי", "ועדה מקומית", "regulatory"] },
  { factor: "funding_gap", terms: ["מימון", "ליווי בנקאי", "funding"] },
  { factor: "title_defect", terms: ["זכויות", "טאבו", "רישום", "title"] },
  { factor: "minority_holdout", terms: ["דייר סרבן", "סרבן", "מיעוט", "holdout"] },
  { factor: "permit_risk", terms: ["היתר", "תב\"ע", "permit"] },
  { factor: "tax_exposure", terms: ["מס שבח", "מע\"מ", "מיסוי", "tax"] },
  { factor: "timeline_risk", terms: ["לוח זמנים", "עיכוב", "delay"] },
];

export function detectRiskFactors(redacted: string): string[] {
  const lower = redacted.toLowerCase();
  const found = new Set<string>();
  for (const { factor, terms } of RISK_KEYWORDS) {
    if (terms.some((t) => lower.includes(t.toLowerCase()))) found.add(factor);
  }
  return [...found];
}

/** Returns labels of any raw identifiers still present — UI safety net. */
export function residualPii(text: string): string[] {
  const hits: string[] = [];
  for (const { label, re } of ENTITY_PATTERNS) {
    re.lastIndex = 0;
    if (re.test(text)) hits.push(label);
  }
  return hits;
}
