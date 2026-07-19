"""Algorithmic Risk Management Layer (RECIR framework adaptation).

Every candidate agent utterance passes through assess() before it is spoken:

  1. Risk Detection   : fast rule pass flags high-risk triggers.
  2. Compliance Filter: on a hit, the utterance is redirected to a safe fallback
                        or the call is escalated, never spoken as generated.
  3. Session tracking : the caller logs the score + decision to PostgreSQL.

The rule pass is deterministic and sub-millisecond so it stays on the hot path.
An optional LLM judge (hybrid mode) resolves borderline cases without adding
latency to the common, obviously-safe case.
"""
from __future__ import annotations

import re

from app.config import Settings, get_settings
from app.models import RiskAssessment, RiskCategory, RiskDecision, Severity

# ── Rule patterns: (compiled regex, category, severity, score) ────────────────
# Scores are the compliance score to assign when the pattern fires: lower means
# less compliant. Tuned so any critical trigger lands below compliance_min_score.
_RULES: list[tuple[re.Pattern[str], RiskCategory, Severity, float]] = [
    (re.compile(r"\b(i (guarantee|promise|assure you))\b", re.I),
     RiskCategory.BINDING_COMMITMENT, Severity.HIGH, 0.20),
    (re.compile(r"\b(you (will|are going to) win|guaranteed (outcome|result|approval))\b", re.I),
     RiskCategory.BINDING_COMMITMENT, Severity.CRITICAL, 0.10),
    (re.compile(r"\b(legal advice|you should sue|you must sign|i advise you to)\b", re.I),
     RiskCategory.UNAUTHORIZED_ADVICE, Severity.HIGH, 0.25),
    (re.compile(r"\b(refund of|pay you|wire (you|the)|transfer \$?\d|we will pay)\b", re.I),
     RiskCategory.FINANCIAL_COMMITMENT, Severity.CRITICAL, 0.15),
    (re.compile(r"\b(binding|legally binding|contractually obligated)\b", re.I),
     RiskCategory.BINDING_COMMITMENT, Severity.HIGH, 0.30),
    (re.compile(r"\b(ssn|social security|password|credit card number|other clients?)\b", re.I),
     RiskCategory.CONFIDENTIAL_EXPOSURE, Severity.CRITICAL, 0.10),
]

# When the model itself signals it is unsure, treat as hallucination risk.
_UNCERTAIN = re.compile(
    r"\b(i think|i'?m not sure|probably|i (assume|guess)|maybe it'?s)\b", re.I
)

SAFE_FALLBACK = (
    "I want to make sure you get an accurate answer on that, "
    "so I'd like to connect you with a member of our team who can help directly."
)


class RiskEngine:
    """Deterministic-first risk assessor with an optional LLM judge."""

    def __init__(self, judge=None, settings: Settings | None = None) -> None:
        # judge: an object exposing `async judge(text) -> tuple[bool, float]`.
        self._judge = judge
        self._s = settings or get_settings()

    async def assess(self, text: str) -> RiskAssessment:
        """Return the pre-flight decision for a single candidate utterance."""
        stripped = text.strip()
        if not stripped:
            return RiskAssessment(decision=RiskDecision.ALLOWED, compliance_score=1.0)

        # 1. Rule pass (deterministic, hot-path safe).
        worst: RiskAssessment | None = None
        for pattern, category, severity, score in _RULES:
            if pattern.search(stripped):
                candidate = RiskAssessment(
                    decision=self._decision_for(severity, score),
                    compliance_score=score,
                    category=category,
                    severity=severity,
                    detector="rule",
                    triggered_text=stripped,
                    replacement_text=SAFE_FALLBACK,
                )
                if worst is None or candidate.compliance_score < worst.compliance_score:
                    worst = candidate
        if worst is not None:
            return worst

        # 2. Hallucination hedge: self-declared uncertainty is not spoken as fact.
        if _UNCERTAIN.search(stripped):
            return RiskAssessment(
                decision=RiskDecision.REDIRECTED,
                compliance_score=0.55,
                category=RiskCategory.HALLUCINATION_RISK,
                severity=Severity.MEDIUM,
                detector="rule",
                triggered_text=stripped,
                replacement_text=(
                    "Let me get you a precise answer on that rather than guess. "
                    "One moment while I pull that up."
                ),
            )

        # 3. Optional LLM judge for borderline content (hybrid detector).
        if self._judge is not None:
            risky, score = await self._judge.judge(stripped)
            if risky and score < self._s.compliance_min_score:
                return RiskAssessment(
                    decision=RiskDecision.REDIRECTED,
                    compliance_score=score,
                    category=RiskCategory.OUT_OF_SCOPE,
                    severity=Severity.MEDIUM,
                    detector="hybrid",
                    triggered_text=stripped,
                    replacement_text=SAFE_FALLBACK,
                )

        return RiskAssessment(decision=RiskDecision.ALLOWED, compliance_score=0.98)

    def _decision_for(self, severity: Severity, score: float) -> RiskDecision:
        if severity == Severity.CRITICAL:
            return RiskDecision.ESCALATED
        if score < self._s.compliance_min_score:
            return RiskDecision.REDIRECTED
        return RiskDecision.ALLOWED
