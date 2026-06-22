// TypeScript mirror of schema/ldr_case.schema.json.
// Keep in sync with the canonical JSON Schema and the Pydantic models.

export type LegalDomain =
  | "Real_Estate_TAMA38"
  | "Real_Estate_Urban_Renewal"
  | "Real_Estate_Complex_Transaction"
  | "Commercial_Dispute"
  | "Litigation_General"
  | "Dispute_Oriented_Mediation";

export type EconomicExposure =
  | "under_1M"
  | "1M_to_5M"
  | "5M_to_10M"
  | "10M_to_15M"
  | "15M_to_50M"
  | "50M_to_100M"
  | "over_100M";

export type RiskFactor =
  | "regulatory_delay"
  | "funding_gap"
  | "title_defect"
  | "minority_holdout"
  | "permit_risk"
  | "counterparty_insolvency"
  | "valuation_dispute"
  | "contractual_ambiguity"
  | "tax_exposure"
  | "timeline_risk";

export interface PeerPrediction {
  peer_id_hash: string;
  success_probability: number;
  alternative_strategy?: string;
  flagged_blind_spots?: string[];
  submitted_at?: string;
}

export interface AiInsights {
  risk_score?: number;
  confidence?: number;
  mode?: "listener" | "suggester" | "autonomous";
  recommendations?: string[];
  model_version?: string;
}

/** The canonical anonymized case object — the ONLY thing allowed to cross the zero-knowledge boundary. */
export interface LdrCase {
  case_id: string;
  legal_domain: LegalDomain;
  economic_exposure: EconomicExposure;
  risk_factors: RiskFactor[];
  proposed_strategy: string;
  peer_predictions?: PeerPrediction[];
  ai_insights?: AiInsights;
  created_at?: string;
}
