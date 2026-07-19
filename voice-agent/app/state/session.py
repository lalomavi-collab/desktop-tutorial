"""Per-call session state and durable logging.

CallSession is the in-memory hot state for one live call (conversation history,
rolling counters used by the escalation matrix). It also fans writes out to
PostgreSQL so the audit trail survives the process.

Writes to the database are fire-and-forget (scheduled on the event loop) so a
slow insert never stalls the audio path. Losing a log line is preferable to
adding jitter to speech.
"""
from __future__ import annotations

import asyncio
import logging
from uuid import UUID

from app.config import get_settings
from app.models import (
    ActionOutcome,
    CallStatus,
    EscalationReason,
    IntentResult,
    RiskAssessment,
    RiskDecision,
    Role,
)
from app.state import db

log = logging.getLogger("voice_agent.session")


class CallSession:
    """Mutable state for a single call. Not shared across calls."""

    def __init__(self, call_id: UUID, provider_call_sid: str | None) -> None:
        self.call_id = call_id
        self.provider_call_sid = provider_call_sid
        self.turn_index = 0
        self.status = CallStatus.IN_PROGRESS

        # Conversation history in Claude message format.
        self.history: list[dict[str, str]] = []

        # Rolling signals consumed by governance/escalation.
        self.frustration_events = 0
        self.compliance_scores: list[float] = []
        self.recent_agent_replies: list[str] = []
        self.recent_intents: list[str] = []
        self.escalated = False

        self._settings = get_settings()

    # ── History helpers ────────────────────────────────────────────────────────
    def next_turn(self) -> int:
        self.turn_index += 1
        return self.turn_index

    def add_caller_message(self, text: str) -> None:
        self.history.append({"role": "user", "content": text})

    def add_agent_message(self, text: str) -> None:
        self.history.append({"role": "assistant", "content": text})
        self.recent_agent_replies.append(text)
        self.recent_agent_replies = self.recent_agent_replies[-5:]

    # ── Durable logging (non-blocking) ─────────────────────────────────────────
    def log_transcript(
        self,
        role: Role,
        content: str,
        *,
        turn_index: int | None = None,
        is_final: bool = True,
        stt_confidence: float | None = None,
        latency_ms: int | None = None,
    ) -> None:
        idx = turn_index if turn_index is not None else self.turn_index
        self._spawn(
            db.execute(
                """
                insert into public.transcripts
                  (call_id, turn_index, role, content, is_final, stt_confidence, latency_ms)
                values ($1,$2,$3,$4,$5,$6,$7)
                on conflict (call_id, turn_index, role) do update
                  set content = excluded.content, is_final = excluded.is_final
                """,
                self.call_id, idx, role.value, content, is_final,
                stt_confidence, latency_ms,
            )
        )

    def log_intent(self, intent: IntentResult, outcome: ActionOutcome | None) -> None:
        self.recent_intents.append(intent.intent)
        self.recent_intents = self.recent_intents[-5:]
        self._spawn(
            db.execute(
                """
                insert into public.intent_logs
                  (call_id, turn_index, intent, confidence, entities,
                   action, action_status, action_result)
                values ($1,$2,$3,$4,$5,$6,$7,$8)
                """,
                self.call_id, self.turn_index, intent.intent, intent.confidence,
                intent.entities, intent.action,
                outcome.status if outcome else "none",
                outcome.result if outcome else None,
            )
        )

    def log_compliance(self, risk: RiskAssessment) -> None:
        self.compliance_scores.append(risk.compliance_score)
        # Only record interceptions, not every allowed turn, to keep the audit
        # table focused on actual risk events.
        if risk.decision == RiskDecision.ALLOWED:
            return
        self._spawn(
            db.execute(
                """
                insert into public.compliance_violations
                  (call_id, turn_index, category, severity, compliance_score,
                   decision, triggered_text, replacement_text, detector)
                values ($1,$2,$3,$4,$5,$6,$7,$8,$9)
                """,
                self.call_id, self.turn_index,
                risk.category.value if risk.category else "other",
                risk.severity.value, risk.compliance_score, risk.decision.value,
                risk.triggered_text, risk.replacement_text, risk.detector,
            )
        )

    async def mark_escalated(self, reason: EscalationReason) -> None:
        self.escalated = True
        self.status = CallStatus.ESCALATED
        await db.execute(
            "update public.calls set status=$2, escalated=true, escalation_reason=$3 where id=$1",
            self.call_id, CallStatus.ESCALATED.value, reason.value,
        )

    async def finalize(self, status: CallStatus) -> None:
        self.status = status
        avg = (
            sum(self.compliance_scores) / len(self.compliance_scores)
            if self.compliance_scores
            else None
        )
        await db.execute(
            """
            update public.calls
               set status=$2, turn_count=$3, avg_compliance=$4, ended_at=now()
             where id=$1
            """,
            self.call_id, status.value, self.turn_index, avg,
        )

    # ── internals ──────────────────────────────────────────────────────────────
    @staticmethod
    def _spawn(coro) -> None:
        task = asyncio.create_task(coro)
        task.add_done_callback(_report_task_error)


def _report_task_error(task: asyncio.Task) -> None:
    if task.cancelled():
        return
    exc = task.exception()
    if exc is not None:
        log.warning("Background persistence task failed: %s", exc)


async def create_call(
    provider: str,
    provider_call_sid: str | None,
    from_number: str | None,
    to_number: str | None,
) -> CallSession:
    """Insert the calls row and return a fresh session."""
    row = await db.fetchrow(
        """
        insert into public.calls
          (provider, provider_call_sid, from_number, to_number, status, answered_at)
        values ($1,$2,$3,$4,'in_progress', now())
        returning id
        """,
        provider, provider_call_sid, from_number, to_number,
    )
    return CallSession(call_id=row["id"], provider_call_sid=provider_call_sid)
