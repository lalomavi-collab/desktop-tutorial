"""Action Execution Layer (DOM framework adaptation).

Turns structured tool calls from Claude into real downstream effects: calendar
scheduling, CRM lead capture, internal task creation. Every action posts to an
n8n webhook (or a direct API) and is logged to intent_logs via the session.

Actions run off the audio hot path: the agent confirms verbally while the effect
completes in the background, so a slow CRM never delays speech.
"""
from __future__ import annotations

import logging

import httpx

from app.actions.tools import TOOLS
from app.config import Settings, get_settings
from app.llm.claude_orchestrator import ToolCall
from app.models import ActionOutcome, IntentResult

log = logging.getLogger("voice_agent.actions")

_VALID_TOOLS = {t["name"] for t in TOOLS}


class ActionExecutor:
    def __init__(self, client: httpx.AsyncClient, settings: Settings | None = None) -> None:
        self._client = client
        self._s = settings or get_settings()

    async def execute(self, call: ToolCall) -> tuple[IntentResult, ActionOutcome]:
        """Dispatch one tool call and return the intent + outcome to log."""
        intent = IntentResult(
            intent=call.name,
            confidence=0.9,
            entities=call.input,
            action=call.name,
        )

        if call.name not in _VALID_TOOLS:
            return intent, ActionOutcome(action=call.name, status="skipped",
                                         result={"reason": "unknown_tool"})

        try:
            result = await self._dispatch(call)
            return intent, ActionOutcome(action=call.name, status="succeeded", result=result)
        except Exception as exc:  # noqa: BLE001 - never break the call on action failure
            log.warning("Action %s failed: %s", call.name, exc)
            return intent, ActionOutcome(action=call.name, status="failed",
                                         result={"error": str(exc)})

    async def _dispatch(self, call: ToolCall) -> dict:
        """Route to n8n. Swap for direct calendar/CRM SDK calls if preferred."""
        if not self._s.n8n_webhook_url:
            # No automation endpoint configured: record intent without side effect.
            return {"status": "queued", "note": "no webhook configured"}
        resp = await self._client.post(
            self._s.n8n_webhook_url,
            json={"action": call.name, "payload": call.input},
            timeout=8.0,
        )
        resp.raise_for_status()
        try:
            return resp.json()
        except ValueError:
            return {"status": "ok"}
