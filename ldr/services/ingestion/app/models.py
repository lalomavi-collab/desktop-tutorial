"""Pydantic models mirroring schema/ldr_case.schema.json.

These define the ONLY shape the ingestion service accepts. The service never
sees raw case text — only the already-anonymized LdrCase produced client-side.
"""
from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field


class LegalDomain(str, Enum):
    real_estate_tama38 = "Real_Estate_TAMA38"
    real_estate_urban_renewal = "Real_Estate_Urban_Renewal"
    real_estate_complex_transaction = "Real_Estate_Complex_Transaction"
    commercial_dispute = "Commercial_Dispute"
    litigation_general = "Litigation_General"
    dispute_oriented_mediation = "Dispute_Oriented_Mediation"


class EconomicExposure(str, Enum):
    under_1m = "under_1M"
    e1m_to_5m = "1M_to_5M"
    e5m_to_10m = "5M_to_10M"
    e10m_to_15m = "10M_to_15M"
    e15m_to_50m = "15M_to_50M"
    e50m_to_100m = "50M_to_100M"
    over_100m = "over_100M"


class RiskFactor(str, Enum):
    regulatory_delay = "regulatory_delay"
    funding_gap = "funding_gap"
    title_defect = "title_defect"
    minority_holdout = "minority_holdout"
    permit_risk = "permit_risk"
    counterparty_insolvency = "counterparty_insolvency"
    valuation_dispute = "valuation_dispute"
    contractual_ambiguity = "contractual_ambiguity"
    tax_exposure = "tax_exposure"
    timeline_risk = "timeline_risk"


class PeerPrediction(BaseModel):
    peer_id_hash: str
    success_probability: float = Field(ge=0, le=1)
    alternative_strategy: Optional[str] = Field(default=None, max_length=4000)
    flagged_blind_spots: list[str] = Field(default_factory=list)
    submitted_at: Optional[datetime] = None


class AiInsights(BaseModel):
    model_config = ConfigDict(protected_namespaces=())

    risk_score: Optional[float] = Field(default=None, ge=0, le=100)
    confidence: Optional[float] = Field(default=None, ge=0, le=1)
    mode: Optional[str] = None
    recommendations: list[str] = Field(default_factory=list)
    model_version: Optional[str] = None


class LdrCase(BaseModel):
    case_id: str
    legal_domain: LegalDomain
    economic_exposure: EconomicExposure
    risk_factors: list[RiskFactor] = Field(default_factory=list)
    proposed_strategy: str = Field(max_length=8000)
    peer_predictions: list[PeerPrediction] = Field(default_factory=list)
    ai_insights: Optional[AiInsights] = None
    created_at: Optional[datetime] = None


class RiskVector(BaseModel):
    """Categorical fingerprint used to compare cases and route to peer-room / ai-core."""

    case_id: str
    legal_domain: LegalDomain
    economic_exposure: EconomicExposure
    risk_factors: list[RiskFactor]
    factor_count: int
