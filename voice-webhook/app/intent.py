"""Claude-powered intent and task extraction.

Uses the Anthropic Messages API with a forced tool call so Claude returns a
strict JSON object that we validate against :class:`CallExtraction`. Forcing a
tool schema is far more reliable than parsing free-form text and lets us treat
any deviation as a failure that routes into the retry path.
"""
from __future__ import annotations

import logging

from anthropic import AsyncAnthropic

from .config import Settings
from .schemas import CallExtraction

logger = logging.getLogger(__name__)


class ExtractionError(RuntimeError):
    """Raised when Claude cannot be reached or returns an unusable result."""


# JSON schema handed to Claude as a tool. Mirrors CallExtraction exactly.
EXTRACTION_TOOL = {
    "name": "record_call_analysis",
    "description": (
        "Record the structured analysis of a completed client phone call for a "
        "law firm CRM."
    ),
    "input_schema": {
        "type": "object",
        "properties": {
            "client_intent": {
                "type": "string",
                "enum": ["Inquiry", "Consultation", "Dispute", "Support"],
                "description": "The primary reason the client called.",
            },
            "summary": {
                "type": "string",
                "description": "Concise summary of the call, under 100 words.",
            },
            "suggested_task": {
                "type": "object",
                "properties": {
                    "title": {
                        "type": "string",
                        "description": "Short, actionable follow-up task title.",
                    },
                    "priority": {
                        "type": "string",
                        "enum": ["High", "Medium", "Low"],
                    },
                    "due_days_offset": {
                        "type": "integer",
                        "minimum": 0,
                        "maximum": 365,
                        "description": "Days from today the task is due.",
                    },
                },
                "required": ["title", "priority", "due_days_offset"],
            },
            "is_billable": {
                "type": "boolean",
                "description": (
                    "True only if professional or legal advice was actually "
                    "discussed or given during the call."
                ),
            },
        },
        "required": ["client_intent", "summary", "suggested_task", "is_billable"],
    },
}

SYSTEM_PROMPT = (
    "You are a legal-intake analyst for a boutique law firm. You read the "
    "transcript of a completed client phone call and record a structured "
    "analysis by calling the record_call_analysis tool. Judge is_billable "
    "strictly: mark it true only when substantive professional or legal advice "
    "was actually discussed, not for scheduling, small talk, or general "
    "information. Keep the summary under 100 words."
)


class IntentExtractor:
    """Thin wrapper around the Anthropic client, easy to swap in tests."""

    def __init__(self, settings: Settings, client: AsyncAnthropic | None = None):
        self._settings = settings
        self._client = client or AsyncAnthropic(
            api_key=settings.anthropic_api_key,
            timeout=settings.anthropic_timeout_seconds,
        )

    async def extract(self, transcript: str) -> CallExtraction:
        """Analyse a transcript and return a validated :class:`CallExtraction`.

        Raises :class:`ExtractionError` on transport failure, a missing tool
        call, or a payload that fails validation.
        """
        content = (transcript or "").strip()
        if not content:
            raise ExtractionError("empty transcript")

        try:
            message = await self._client.messages.create(
                model=self._settings.anthropic_model,
                max_tokens=self._settings.anthropic_max_tokens,
                system=SYSTEM_PROMPT,
                tools=[EXTRACTION_TOOL],
                tool_choice={"type": "tool", "name": "record_call_analysis"},
                messages=[
                    {
                        "role": "user",
                        "content": (
                            "Analyse this completed call transcript:\n\n"
                            f"{content}"
                        ),
                    }
                ],
            )
        except Exception as exc:  # noqa: BLE001 (surface any SDK/transport error)
            logger.warning("Claude request failed: %s", exc)
            raise ExtractionError(f"Claude request failed: {exc}") from exc

        tool_input = _first_tool_input(message)
        if tool_input is None:
            raise ExtractionError("Claude returned no tool call")

        try:
            return CallExtraction.model_validate(tool_input)
        except Exception as exc:  # noqa: BLE001 (validation failure)
            logger.warning("Claude output failed validation: %s", exc)
            raise ExtractionError(f"invalid extraction payload: {exc}") from exc


def _first_tool_input(message) -> dict | None:
    """Pull the input dict from the first tool_use block of a Messages reply."""
    for block in getattr(message, "content", []) or []:
        if getattr(block, "type", None) == "tool_use":
            return getattr(block, "input", None)
    return None
