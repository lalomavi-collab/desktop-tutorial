import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL as string;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

if (!url || !key) {
  // eslint-disable-next-line no-console
  console.error("Missing VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY in .env");
}

export const supabase = createClient(url, key, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
});

export type LegalDomain =
  | "Real_Estate_TAMA38"
  | "Real_Estate_Urban_Renewal"
  | "Real_Estate_Complex_Transaction"
  | "Commercial_Dispute"
  | "Litigation_General"
  | "Dispute_Oriented_Mediation";

export type EconomicExposure =
  | "under_1M" | "1M_to_5M" | "5M_to_10M" | "10M_to_15M"
  | "15M_to_50M" | "50M_to_100M" | "over_100M";

export interface LdrCase {
  case_id: string;
  owner_id: string;
  firm_id: string | null;
  legal_domain: LegalDomain;
  economic_exposure: EconomicExposure;
  risk_factors: string[];
  proposed_strategy: string;
  ai_risk_score: number | null;
  ai_confidence: number | null;
  ai_mode: string | null;
  ai_recommendations: string[];
  visibility: "private" | "firm" | "community";
  created_at: string;
}

export interface Profile {
  id: string;
  display_name: string | null;
  firm_id: string | null;
  contribution_count: number;
  prediction_count: number;
  reputation: number;
}

export const DOMAIN_LABELS: Record<LegalDomain, string> = {
  Real_Estate_TAMA38: "תמ\"א 38",
  Real_Estate_Urban_Renewal: "התחדשות עירונית",
  Real_Estate_Complex_Transaction: "עסקת נדל\"ן מורכבת",
  Commercial_Dispute: "סכסוך מסחרי",
  Litigation_General: "ליטיגציה כללית",
  Dispute_Oriented_Mediation: "יישוב סכסוך מונחה-הכרעה",
};

export const EXPOSURE_LABELS: Record<EconomicExposure, string> = {
  under_1M: "עד 1M ₪",
  "1M_to_5M": "1–5M ₪",
  "5M_to_10M": "5–10M ₪",
  "10M_to_15M": "10–15M ₪",
  "15M_to_50M": "15–50M ₪",
  "50M_to_100M": "50–100M ₪",
  over_100M: "מעל 100M ₪",
};

export const RISK_FACTOR_LABELS: Record<string, string> = {
  regulatory_delay: "עיכוב רגולטורי",
  funding_gap: "פער מימון",
  title_defect: "פגם בזכויות",
  minority_holdout: "דייר סרבן / מיעוט",
  permit_risk: "סיכון היתרים",
  counterparty_insolvency: "חדלות פירעון צד נגדי",
  valuation_dispute: "מחלוקת שומה",
  contractual_ambiguity: "עמימות חוזית",
  tax_exposure: "חשיפת מס",
  timeline_risk: "סיכון לוחות זמנים",
};
