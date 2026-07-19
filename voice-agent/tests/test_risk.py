"""RECIR risk engine: deterministic rule pass behaviour."""
from __future__ import annotations

import pytest

from app.governance.risk import RiskEngine
from app.models import RiskCategory, RiskDecision


@pytest.mark.asyncio
async def test_safe_utterance_is_allowed():
    risk = await RiskEngine().assess("Our office is open weekdays from nine to five.")
    assert risk.decision == RiskDecision.ALLOWED
    assert risk.compliance_score > 0.9


@pytest.mark.asyncio
async def test_guaranteed_outcome_is_escalated():
    risk = await RiskEngine().assess("You are going to win this case, guaranteed.")
    assert risk.decision == RiskDecision.ESCALATED
    assert risk.category == RiskCategory.BINDING_COMMITMENT
    assert risk.replacement_text  # a safe fallback is always provided


@pytest.mark.asyncio
async def test_financial_commitment_is_intercepted():
    risk = await RiskEngine().assess("We will pay you 5000 as a refund today.")
    assert risk.decision in (RiskDecision.REDIRECTED, RiskDecision.ESCALATED)
    assert risk.category == RiskCategory.FINANCIAL_COMMITMENT
    assert risk.compliance_score < 0.6


@pytest.mark.asyncio
async def test_uncertainty_is_redirected_not_spoken_as_fact():
    risk = await RiskEngine().assess("I think the deadline is probably next Tuesday.")
    assert risk.decision == RiskDecision.REDIRECTED
    assert risk.category == RiskCategory.HALLUCINATION_RISK


@pytest.mark.asyncio
async def test_confidential_exposure_is_critical():
    risk = await RiskEngine().assess("Another client, John, gave us his social security number.")
    assert risk.decision == RiskDecision.ESCALATED
    assert risk.category == RiskCategory.CONFIDENTIAL_EXPOSURE
