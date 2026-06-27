// ============================================================================
// CLIENT-SIDE ZERO-KNOWLEDGE ANONYMIZER
// ----------------------------------------------------------------------------
// This module runs ONLY on the client device (browser / desktop). Its output —
// an `LdrCase` — is the single artifact permitted to cross into the cloud.
// Raw case text, names, asset details and exact sums must be destroyed here.
//
// The regex/heuristic passes below are a deliberately conservative skeleton.
// Production MUST replace `redactEntities` with a real on-device NER model
// (e.g. a WASM/ONNX Hebrew+English NER) so nothing is shipped to a server for
// the sake of de-identification.
// ============================================================================

import type { EconomicExposure, LdrCase, LegalDomain, RiskFactor } from "./schema.js";

export interface RawCaseInput {
  narrative: string;
  legal_domain: LegalDomain;
  /** Raw monetary figure in ILS. Bucketed locally; the raw value is discarded. */
  economic_value_ils?: number;
}

const ENTITY_PATTERNS: { label: string; re: RegExp }[] = [
  // Israeli ID (Teudat Zehut) — 9 digits
  { label: "[ID]", re: /\b\d{9}\b/g },
  // Phone numbers (IL formats)
  { label: "[PHONE]", re: /\b0\d{1,2}[-\s]?\d{7}\b/g },
  // Email
  { label: "[EMAIL]", re: /\b[\w.+-]+@[\w-]+\.[\w.-]+\b/g },
  // Gush/Helka real-estate parcel identifiers ("גוש 1234 חלקה 56")
  { label: "[PARCEL]", re: /\b(?:גוש|חלקה)\s*\d+/g },
  // Bank account-ish digit runs
  { label: "[ACCOUNT]", re: /\b\d{6,}\b/g },
  // Currency figures — stripped from the narrative (kept only as a bucket)
  { label: "[AMOUNT]", re: /(?:₪|ש"ח|NIS|ILS)\s?[\d,]+(?:\.\d+)?|[\d,]+(?:\.\d+)?\s?(?:₪|ש"ח|NIS|ILS)/g },
];

/**
 * Heuristic entity redaction. SKELETON ONLY.
 * TODO(production): swap for an on-device NER model that also catches person
 * and organization names, which simple regex cannot.
 */
export function redactEntities(text: string): string {
  let out = text;
  for (const { label, re } of ENTITY_PATTERNS) {
    out = out.replace(re, label);
  }
  return out;
}

/** Convert a raw ILS figure into a coarse bucket. The raw number is never returned. */
export function bucketExposure(valueIls?: number): EconomicExposure {
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

const RISK_KEYWORDS: { factor: RiskFactor; terms: string[] }[] = [
  { factor: "regulatory_delay", terms: ["רגולצי", "ועדה מקומית", "היתר", "regulatory", "permit delay"] },
  { factor: "funding_gap", terms: ["מימון", "פער מימון", "ליווי בנקאי", "funding", "financing gap"] },
  { factor: "title_defect", terms: ["זכויות", "רישום", "טאבו", "title", "lien"] },
  { factor: "minority_holdout", terms: ["דייר סרבן", "מיעוט", "holdout", "minority"] },
  { factor: "permit_risk", terms: ["היתר בנייה", "תב\"ע", "building permit"] },
  { factor: "tax_exposure", terms: ["מס שבח", "מע\"מ", "tax", "מיסוי"] },
];

/** Lightweight client-side hinting of risk factors from the (already-redacted) text. */
export function detectRiskFactors(redactedText: string): RiskFactor[] {
  const lower = redactedText.toLowerCase();
  const found = new Set<RiskFactor>();
  for (const { factor, terms } of RISK_KEYWORDS) {
    if (terms.some((t) => lower.includes(t.toLowerCase()))) found.add(factor);
  }
  return [...found];
}

function uuid(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  // Fallback for non-browser test envs.
  return "00000000-0000-4000-8000-" + Date.now().toString(16).padStart(12, "0");
}

/**
 * The single entry point: transform a raw case into the anonymized LdrCase.
 * Everything identifying is destroyed before the object is returned.
 */
export function anonymizeCase(input: RawCaseInput): LdrCase {
  const cleaned = redactEntities(input.narrative);
  return {
    case_id: uuid(),
    legal_domain: input.legal_domain,
    economic_exposure: bucketExposure(input.economic_value_ils),
    risk_factors: detectRiskFactors(cleaned),
    proposed_strategy: cleaned,
    created_at: new Date().toISOString(),
  };
}
