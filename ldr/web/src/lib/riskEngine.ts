// Client-side Risk Score (mirrors services/ai-core) for instant feedback.
import type { EconomicExposure } from "./supabase";

const FACTOR_WEIGHTS: Record<string, number> = {
  regulatory_delay: 14, funding_gap: 18, title_defect: 16, minority_holdout: 15,
  permit_risk: 12, counterparty_insolvency: 20, valuation_dispute: 10,
  contractual_ambiguity: 9, tax_exposure: 8, timeline_risk: 7,
};

const EXPOSURE_MULTIPLIER: Record<EconomicExposure, number> = {
  under_1M: 0.8, "1M_to_5M": 0.9, "5M_to_10M": 1.0, "10M_to_15M": 1.1,
  "15M_to_50M": 1.2, "50M_to_100M": 1.35, over_100M: 1.5,
};

export interface RiskResult {
  score: number;
  confidence: number;
  recommendations: string[];
}

export function computeRisk(
  exposure: EconomicExposure,
  factors: string[],
  peerProbabilities: number[] = [],
): RiskResult {
  const base = factors.reduce((s, f) => s + (FACTOR_WEIGHTS[f] ?? 5), 0);
  let score = Math.min(100, Math.round(base * (EXPOSURE_MULTIPLIER[exposure] ?? 1) * 10) / 10);

  if (peerProbabilities.length) {
    const avgFailure = 1 - peerProbabilities.reduce((a, b) => a + b, 0) / peerProbabilities.length;
    score = Math.round((0.6 * score + 0.4 * avgFailure * 100) * 10) / 10;
  }
  const confidence = Math.min(1, 0.3 + 0.1 * peerProbabilities.length);

  const recommendations = [...factors]
    .sort((a, b) => (FACTOR_WEIGHTS[b] ?? 0) - (FACTOR_WEIGHTS[a] ?? 0))
    .slice(0, 3)
    .map((f) => `התמודדות מוקדמת עם "${f}" — תרומה שולית גבוהה לסיכון.`);

  return { score, confidence, recommendations };
}

export function riskBand(score: number): { label: string; cls: string } {
  if (score >= 70) return { label: "סיכון גבוה", cls: "risk-high" };
  if (score >= 40) return { label: "סיכון בינוני", cls: "risk-mid" };
  return { label: "סיכון נמוך", cls: "risk-low" };
}
