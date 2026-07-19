"""Error Handling & Escalation Matrix.

Decides, per turn, whether the call should leave the AI and reach a human. The
matrix reads rolling signals off the CallSession:

  * frustration : caller sentiment/keywords crossing a threshold
  * loop        : the agent repeating itself, or the caller repeating an intent
  * compliance  : a critical RECIR trigger on the last utterance
  * caller ask  : an explicit "speak to a human" request
  * runaway     : the call exceeding the max-turn budget

When escalation is warranted the transfer executor hands the call to the human
operator (Twilio REST redirect to a <Dial>, or a LiveKit SIP transfer).
"""
from __future__ import annotations

import difflib
import logging
import re

from app.config import Settings, get_settings
from app.models import EscalationReason, RiskAssessment, RiskDecision
from app.state.session import CallSession

log = logging.getLogger("voice_agent.escalation")

_FRUSTRATION = re.compile(
    r"\b(this is ridiculous|useless|stupid|frustrat\w*|angry|terrible|"
    r"speak to (a human|someone|a person|a manager|an agent)|"
    r"real person|not helping|for the (third|fourth|fifth) time|are you a (bot|robot))\b",
    re.I,
)
_HUMAN_REQUEST = re.compile(
    r"\b(human|agent|representative|operator|manager|real person|transfer me)\b", re.I
)


class EscalationDecision:
    __slots__ = ("escalate", "reason")

    def __init__(self, escalate: bool, reason: EscalationReason | None = None) -> None:
        self.escalate = escalate
        self.reason = reason


class EscalationMatrix:
    def __init__(self, settings: Settings | None = None) -> None:
        self._s = settings or get_settings()

    def evaluate(
        self,
        session: CallSession,
        caller_text: str,
        last_risk: RiskAssessment | None,
    ) -> EscalationDecision:
        """Update rolling signals from this turn and decide on escalation."""
        # 1. Explicit human request wins immediately.
        if _HUMAN_REQUEST.search(caller_text) and _FRUSTRATION.search(caller_text):
            return EscalationDecision(True, EscalationReason.CALLER_REQUEST)

        # 2. Critical compliance trigger routes straight to a human.
        if last_risk is not None and last_risk.decision == RiskDecision.ESCALATED:
            return EscalationDecision(True, EscalationReason.COMPLIANCE_TRIGGER)

        # 3. Frustration accumulation.
        if _FRUSTRATION.search(caller_text):
            session.frustration_events += 1
        if session.frustration_events >= self._s.max_frustration_events:
            return EscalationDecision(True, EscalationReason.FRUSTRATION)

        # 4. Loop detection: agent repeating itself or caller stuck on one intent.
        if self._agent_looping(session) or self._intent_looping(session):
            return EscalationDecision(True, EscalationReason.LOOP_DETECTED)

        # 5. Runaway call length.
        if session.turn_index >= self._s.max_turns:
            return EscalationDecision(True, EscalationReason.MAX_TURNS)

        return EscalationDecision(False)

    def _agent_looping(self, session: CallSession) -> bool:
        replies = session.recent_agent_replies
        if len(replies) < self._s.max_repeat_loops:
            return False
        window = replies[-self._s.max_repeat_loops:]
        # Near-identical consecutive replies indicate a stuck agent.
        for a, b in zip(window, window[1:]):
            if difflib.SequenceMatcher(None, a, b).ratio() < 0.9:
                return False
        return True

    def _intent_looping(self, session: CallSession) -> bool:
        intents = session.recent_intents
        if len(intents) < self._s.max_repeat_loops:
            return False
        window = intents[-self._s.max_repeat_loops:]
        return len(set(window)) == 1 and window[0] not in ("", "unknown")
