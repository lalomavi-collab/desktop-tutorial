"""Escalation matrix: frustration, loops, and explicit human requests."""
from __future__ import annotations

from uuid import uuid4

from app.governance.escalation import EscalationMatrix
from app.models import EscalationReason, RiskAssessment, RiskDecision
from app.state.session import CallSession


def _session() -> CallSession:
    return CallSession(call_id=uuid4(), provider_call_sid="CA123")


def test_explicit_human_request_escalates_immediately():
    matrix = EscalationMatrix()
    decision = matrix.evaluate(_session(), "This is useless, get me a real person.", None)
    assert decision.escalate
    assert decision.reason == EscalationReason.CALLER_REQUEST


def test_frustration_accumulates_before_escalating():
    matrix = EscalationMatrix()
    s = _session()
    first = matrix.evaluate(s, "This is frustrating.", None)
    assert not first.escalate  # one strike is not enough
    second = matrix.evaluate(s, "This is terrible.", None)
    assert second.escalate
    assert second.reason == EscalationReason.FRUSTRATION


def test_critical_compliance_trigger_escalates():
    matrix = EscalationMatrix()
    risk = RiskAssessment(decision=RiskDecision.ESCALATED, compliance_score=0.1)
    decision = matrix.evaluate(_session(), "ok", risk)
    assert decision.escalate
    assert decision.reason == EscalationReason.COMPLIANCE_TRIGGER


def test_agent_repeating_itself_is_a_loop():
    matrix = EscalationMatrix()
    s = _session()
    for _ in range(3):
        s.recent_agent_replies.append("I can help you schedule a consultation.")
    decision = matrix.evaluate(s, "ok", None)
    assert decision.escalate
    assert decision.reason == EscalationReason.LOOP_DETECTED


def test_intent_loop_escalates():
    matrix = EscalationMatrix()
    s = _session()
    s.recent_intents = ["schedule_appointment"] * 3
    decision = matrix.evaluate(s, "ok", None)
    assert decision.escalate
    assert decision.reason == EscalationReason.LOOP_DETECTED
