"""LDR Risk Engine.

Computes the Risk Score and operates in one of three evolution modes:

  * listener   — observes peer decisions, does NOT surface recommendations.
  * suggester  — proposes recommendations alongside the human peer room.
  * autonomous — produces standalone risk assessment + simulations.

The current mode is configurable (env LDR_AI_MODE) so the product can graduate
the AI as the crowdsourced dataset matures. The scoring below is a transparent,
explainable heuristic SKELETON — production replaces `_score` with the trained
model (federated-learning aggregate) while keeping this interface stable.
"""
from __future__ import annotations

import os

MODEL_VERSION = "skeleton-0.1.0"

# Weight per risk factor (0-100 contribution before normalization).
_FACTOR_WEIGHTS: dict[str, float] = {
    "regulatory_delay": 14,
    "funding_gap": 18,
    "title_defect": 16,
    "minority_holdout": 15,
    "permit_risk": 12,
    "counterparty_insolvency": 20,
    "valuation_dispute": 10,
    "contractual_ambiguity": 9,
    "tax_exposure": 8,
    "timeline_risk": 7,
}

# Higher economic exposure amplifies the score.
_EXPOSURE_MULTIPLIER: dict[str, float] = {
    "under_1M": 0.8,
    "1M_to_5M": 0.9,
    "5M_to_10M": 1.0,
    "10M_to_15M": 1.1,
    "15M_to_50M": 1.2,
    "50M_to_100M": 1.35,
    "over_100M": 1.5,
}


def current_mode() -> str:
    return os.environ.get("LDR_AI_MODE", "listener")


def _score(legal_domain: str, economic_exposure: str, risk_factors: list[str]) -> float:
    base = sum(_FACTOR_WEIGHTS.get(f, 5) for f in risk_factors)
    multiplier = _EXPOSURE_MULTIPLIER.get(economic_exposure, 1.0)
    return min(100.0, round(base * multiplier, 1))


def assess(
    legal_domain: str,
    economic_exposure: str,
    risk_factors: list[str],
    peer_success_probabilities: list[float] | None = None,
) -> dict:
    """Return ai_insights for an anonymized case, gated by the current mode."""
    mode = current_mode()
    score = _score(legal_domain, economic_exposure, risk_factors)

    # Blend in peer wisdom when available (crowdsourced -> AI learning).
    peers = peer_success_probabilities or []
    if peers:
        avg_failure = 1 - (sum(peers) / len(peers))
        score = round(0.6 * score + 0.4 * (avg_failure * 100), 1)
    confidence = min(1.0, 0.3 + 0.1 * len(peers))

    recommendations: list[str] = []
    if mode in ("suggester", "autonomous"):
        for f in sorted(risk_factors, key=lambda x: _FACTOR_WEIGHTS.get(x, 0), reverse=True)[:3]:
            recommendations.append(f"Mitigate '{f}' early — high marginal contribution to risk.")

    return {
        "risk_score": score,
        "confidence": confidence,
        "mode": mode,
        "recommendations": recommendations,
        "model_version": MODEL_VERSION,
    }
