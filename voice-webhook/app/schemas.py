"""Pydantic models for the webhook payload and the Claude extraction result."""
from __future__ import annotations

from enum import Enum
from typing import Optional

from pydantic import BaseModel, Field, field_validator


# ── Incoming webhook ──────────────────────────────────────────────────────
class CallEndedWebhook(BaseModel):
    """Payload posted by the Voice AI agent (LiveKit/Twilio) when a call ends."""

    call_sid: str = Field(..., min_length=1, description="Unique call identifier")
    caller_phone: str = Field(..., min_length=1, description="Caller's phone number")
    duration_seconds: int = Field(..., ge=0, description="Call length in seconds")
    transcript: str = Field(default="", description="Full call transcript")

    @field_validator("call_sid", "caller_phone")
    @classmethod
    def _strip(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("must not be blank")
        return v


# ── Claude extraction ─────────────────────────────────────────────────────
class ClientIntent(str, Enum):
    inquiry = "Inquiry"
    consultation = "Consultation"
    dispute = "Dispute"
    support = "Support"


class TaskPriority(str, Enum):
    high = "High"
    medium = "Medium"
    low = "Low"


class SuggestedTask(BaseModel):
    title: str = Field(..., min_length=1)
    priority: TaskPriority
    due_days_offset: int = Field(..., ge=0, le=365)


class CallExtraction(BaseModel):
    """Structured analysis returned by Claude for a transcript."""

    client_intent: ClientIntent
    summary: str = Field(..., description="Under 100 words")
    suggested_task: SuggestedTask
    is_billable: bool

    @field_validator("summary")
    @classmethod
    def _cap_summary_words(cls, v: str) -> str:
        # Hard guard: keep the summary short even if the model overruns.
        words = v.split()
        if len(words) > 100:
            v = " ".join(words[:100])
        return v.strip()


# ── API responses ─────────────────────────────────────────────────────────
class IngestResult(BaseModel):
    status: str
    call_sid: str
    processed: bool
    client_id: Optional[str] = None
    call_id: Optional[str] = None
    created_lead: Optional[bool] = None
    is_billable: Optional[bool] = None
    billed_hours: Optional[float] = None
    amount: Optional[float] = None
    detail: Optional[str] = None
