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

export type ExperienceTier = "junior" | "mid" | "senior";

export type VerificationStatus = "unverified" | "pending" | "verified" | "rejected";
export type LicenseType = "lawyer" | "intern";

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
  verification_status: VerificationStatus;
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

// ── Lawyer categorization ──────────────────────────────────────────────
// Experience tiers (by years of practice).
export const EXPERIENCE_TIERS: { key: ExperienceTier; label: string; hint: string }[] = [
  { key: "junior", label: "ג׳וניור", hint: "0–5 שנות ותק" },
  { key: "mid", label: "מנוסה", hint: "5–15 שנות ותק" },
  { key: "senior", label: "בכיר", hint: "15+ שנות ותק" },
];

export const EXPERIENCE_LABELS: Record<ExperienceTier, string> = {
  junior: "ג׳וניור (0–5)",
  mid: "מנוסה (5–15)",
  senior: "בכיר (15+)",
};

// Comprehensive list of legal practice areas (categories) a lawyer can select.
export interface PracticeArea {
  key: string;
  label: string;
  icon: string;
}

export const PRACTICE_AREAS: PracticeArea[] = [
  { key: "real_estate", label: "נדל\"ן ומקרקעין", icon: "🏗️" },
  { key: "urban_renewal", label: "התחדשות עירונית (תמ\"א 38 / פינוי-בינוי)", icon: "🏙️" },
  { key: "planning_building", label: "תכנון ובנייה", icon: "📐" },
  { key: "commercial", label: "מסחרי-עסקי וחוזים", icon: "🤝" },
  { key: "corporate_vc", label: "חברות, הון-סיכון וגיוסים (Hi-Tech)", icon: "🚀" },
  { key: "litigation", label: "ליטיגציה אזרחית-מסחרית", icon: "⚖️" },
  { key: "labor", label: "דיני עבודה", icon: "👷" },
  { key: "ip", label: "קניין רוחני, סימני מסחר ופטנטים", icon: "💡" },
  { key: "privacy_cyber", label: "הגנת הפרטיות וסייבר", icon: "🔒" },
  { key: "tax", label: "מיסים ומיסוי מקרקעין", icon: "🧾" },
  { key: "banking_finance", label: "בנקאות, מימון ושוק ההון", icon: "🏦" },
  { key: "family_inheritance", label: "דיני משפחה וירושה", icon: "👪" },
  { key: "criminal", label: "פלילי וצווארון לבן", icon: "🛡️" },
  { key: "admin_constitutional", label: "מנהלי וחוקתי / עתירות (בג\"ץ)", icon: "🏛️" },
  { key: "regulation", label: "רגולציה ורישוי", icon: "📋" },
  { key: "energy_infra", label: "אנרגיה ותשתיות", icon: "⚡" },
  { key: "environment", label: "סביבה ותכנון", icon: "🌱" },
  { key: "insurance_tort", label: "ביטוח ונזיקין", icon: "🩺" },
  { key: "insolvency", label: "חדלות פירעון והוצאה לפועל", icon: "📉" },
  { key: "adr", label: "בוררות וגישור (ADR / DOM)", icon: "🕊️" },
  { key: "class_actions", label: "צרכנות ותובענות ייצוגיות", icon: "📢" },
  { key: "health_pharma", label: "בריאות ופארמה", icon: "💊" },
  { key: "intl_trade", label: "סחר בינלאומי, ימי ותעופה", icon: "🌍" },
  { key: "franchising", label: "הפצה, זכיינות וייצוג מסחרי", icon: "🏷️" },
];

export const PRACTICE_AREA_LABELS: Record<string, string> =
  Object.fromEntries(PRACTICE_AREAS.map((a) => [a.key, a.label]));

// Jurisdiction nodes on the Global Legal Grid (for cross-border discovery & referrals).
export interface Jurisdiction { key: string; label: string; flag: string; }

export const JURISDICTIONS: Jurisdiction[] = [
  { key: "IL", label: "ישראל", flag: "🇮🇱" },
  { key: "US", label: "ארה\"ב", flag: "🇺🇸" },
  { key: "UK", label: "בריטניה", flag: "🇬🇧" },
  { key: "DE", label: "גרמניה", flag: "🇩🇪" },
  { key: "FR", label: "צרפת", flag: "🇫🇷" },
  { key: "ES", label: "ספרד", flag: "🇪🇸" },
  { key: "IT", label: "איטליה", flag: "🇮🇹" },
  { key: "NL", label: "הולנד", flag: "🇳🇱" },
  { key: "CH", label: "שווייץ", flag: "🇨🇭" },
  { key: "PT", label: "פורטוגל", flag: "🇵🇹" },
  { key: "IE", label: "אירלנד", flag: "🇮🇪" },
  { key: "LU", label: "לוקסמבורג", flag: "🇱🇺" },
  { key: "CY", label: "קפריסין", flag: "🇨🇾" },
  { key: "GR", label: "יוון", flag: "🇬🇷" },
  { key: "PL", label: "פולין", flag: "🇵🇱" },
  { key: "AE", label: "איחוד האמירויות", flag: "🇦🇪" },
  { key: "SG", label: "סינגפור", flag: "🇸🇬" },
  { key: "HK", label: "הונג קונג", flag: "🇭🇰" },
  { key: "CA", label: "קנדה", flag: "🇨🇦" },
  { key: "AU", label: "אוסטרליה", flag: "🇦🇺" },
];

export const JURISDICTION_LABELS: Record<string, string> =
  Object.fromEntries(JURISDICTIONS.map((j) => [j.key, `${j.flag} ${j.label}`]));
