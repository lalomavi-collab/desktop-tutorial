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
  practice_areas: string[];
  experience_tier: ExperienceTier | null;
  jurisdiction: string | null;
  avatar_url: string | null;
  headline: string | null;
  license_type: LicenseType | null;
  license_no: string | null;
  license_doc: string | null;
  verification_status: VerificationStatus;
  is_admin: boolean;
}

// Illustrative attorney profiles ("להמחשה") shown alongside real ones.
export interface DemoAttorney {
  id: string;
  display_name: string;
  jurisdiction: string;
  practice_areas: string[];
  experience_tier: ExperienceTier;
  reputation: number;
  headline: string | null;
  is_demo: true;
}

export const VERIFICATION_LABELS: Record<VerificationStatus, string> = {
  unverified: "לא מאומת",
  pending: "ממתין לאימות",
  verified: "מאומת",
  rejected: "אימות נדחה",
};

export const LICENSE_LABELS: Record<LicenseType, string> = {
  lawyer: "עו״ד מורשה",
  intern: "מתמחה",
};

// Max practice areas a lawyer may select (kept in sync with the DB CHECK).
export const MAX_PRACTICE_AREAS = 3;

export type Currency = "EUR" | "USD" | "ILS" | "GBP";
export const CURRENCY_SYMBOL: Record<Currency, string> = { EUR: "€", USD: "$", ILS: "₪", GBP: "£" };

// A "Legal Gig" — a tactical solution an attorney offers in their jurisdiction.
export interface Gig {
  id: string;
  owner_id: string;
  jurisdiction: string;
  practice_area: string;
  title: string;
  scope: string;
  fee_min: number | null;
  fee_max: number | null;
  currency: Currency;
  status: "active" | "paused";
  created_at: string;
  owner?: {
    display_name: string | null;
    reputation: number;
    verification_status: VerificationStatus;
    experience_tier: ExperienceTier | null;
  } | null;
}

// Escrow milestone — a referral-fee tranche released on dual digital sign-off.
export interface Milestone {
  id: string;
  title: string;
  amount: number | null;
  done: boolean;      // provider marked the work delivered
  signed_a: boolean;  // requester (Attorney A) signed off
  signed_b: boolean;  // provider (Attorney B) signed off
  signed_at?: string | null;
}

export type ReferralStatus = "proposed" | "accepted" | "in_progress" | "completed" | "cancelled";

export const REFERRAL_STATUS_LABELS: Record<ReferralStatus, string> = {
  proposed: "הוצע",
  accepted: "התקבל",
  in_progress: "בביצוע",
  completed: "הושלם",
  cancelled: "בוטל",
};

export interface Referral {
  id: string;
  gig_id: string | null;
  requester_id: string;
  provider_id: string;
  jurisdiction: string;
  brief: string;
  fee: number | null;
  currency: Currency;
  status: ReferralStatus;
  milestones: Milestone[];
  created_at: string;
  updated_at: string;
  requester?: { display_name: string | null } | null;
  provider?: { display_name: string | null } | null;
}

// Feed post (professional activity stream).
export interface PostAuthor {
  display_name: string | null;
  reputation: number;
  verification_status: VerificationStatus;
  experience_tier: ExperienceTier | null;
  headline: string | null;
  avatar_url: string | null;
}
export interface Post {
  id: string;
  author_id: string;
  body: string;
  created_at: string;
  author?: PostAuthor | null;
  likes?: { count: number }[];
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
