"""Typed domain models shared across the pipeline.

These mirror the PostgreSQL schema in supabase/migrations/0003_voice_agent.sql
and the JSON contracts exchanged with Claude function calling.
"""
from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import Any
from uuid import UUID

from pydantic import BaseModel, Field


# ── Enums (kept in lockstep with the SQL check constraints) ────────────────────
class CallStatus(str, Enum):
    RINGING = "ringing"
    IN_PROGRESS = "in_progress"
    ESCALATED = "escalated"
    COMPLETED = "completed"
    FAILED = "failed"
    ABANDONED = "abandoned"


class Role(str, Enum):
    CALLER = "caller"
    AGENT = "agent"
    SYSTEM = "system"


class RiskCategory(str, Enum):
    UNAUTHORIZED_ADVICE = "unauthorized_advice"
    BINDING_COMMITMENT = "binding_commitment"
    CONFIDENTIAL_EXPOSURE = "confidential_exposure"
    FINANCIAL_COMMITMENT = "financial_commitment"
    HALLUCINATION_RISK = "hallucination_risk"
    OUT_OF_SCOPE = "out_of_scope"
    OTHER = "other"


class RiskDecision(str, Enum):
    ALLOWED = "allowed"
    REDIRECTED = "redirected"
    BLOCKED = "blocked"
    ESCALATED = "escalated"


class Severity(str, Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


class EscalationReason(str, Enum):
    FRUSTRATION = "frustration"
    LOOP_DETECTED = "loop_detected"
    COMPLIANCE_TRIGGER = "compliance_trigger"
    CALLER_REQUEST = "caller_request"
    MAX_TURNS = "max_turns"
    SYSTEM_ERROR = "system_error"


# ── RAG ────────────────────────────────────────────────────────────────────────
class KnowledgeChunk(BaseModel):
    id: UUID
    source: str
    title: str | None = None
    content: str
    category: str
    similarity: float


# ── Governance ─────────────────────────────────────────────────────────────────
class RiskAssessment(BaseModel):
    """Result of the RECIR pre-flight check for one candidate agent utterance."""
    decision: RiskDecision
    compliance_score: float = Field(ge=0.0, le=1.0)
    category: RiskCategory | None = None
    severity: Severity = Severity.LOW
    detector: str = "rule"
    triggered_text: str | None = None
    replacement_text: str | None = None

    @property
    def is_safe(self) -> bool:
        return self.decision == RiskDecision.ALLOWED


# ── Intent / actions (DOM framework) ───────────────────────────────────────────
class IntentResult(BaseModel):
    intent: str
    confidence: float = Field(ge=0.0, le=1.0, default=0.0)
    entities: dict[str, Any] = Field(default_factory=dict)
    action: str | None = None


class ActionOutcome(BaseModel):
    action: str
    status: str  # pending | succeeded | failed | skipped
    result: dict[str, Any] = Field(default_factory=dict)


# ── Turn: the atomic unit persisted per exchange ──────────────────────────────
class Turn(BaseModel):
    call_id: UUID
    turn_index: int
    role: Role
    content: str
    is_final: bool = True
    stt_confidence: float | None = None
    latency_ms: int | None = None
    created_at: datetime | None = None
