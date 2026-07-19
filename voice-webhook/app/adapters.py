"""Adapters that translate turnkey voice-platform webhooks (Vapi, Retell) into
our internal :class:`CallEndedWebhook`.

Each platform posts its own shape on call completion. We read the fields we
need defensively (platforms tweak payloads across versions and config), and
return ``None`` for events we should ignore (mid-call status updates, etc.) so
the endpoint can 200 them without processing.
"""
from __future__ import annotations

from typing import Any, Optional

from .schemas import CallEndedWebhook


def _to_int(value: Any) -> int:
    try:
        return max(0, int(round(float(value))))
    except (TypeError, ValueError):
        return 0


def _duration_from_ms_timestamps(start: Any, end: Any) -> Optional[float]:
    try:
        return (float(end) - float(start)) / 1000.0
    except (TypeError, ValueError):
        return None


def parse_vapi(payload: dict) -> Optional[CallEndedWebhook]:
    """Map a Vapi server message to our webhook, or None to ignore it.

    Acts only on ``end-of-call-report``, the single terminal event that carries
    the transcript. Reads:
      call_sid       <- message.call.id
      caller_phone   <- message.customer.number (or message.call.customer.number)
      transcript     <- message.artifact.transcript
      duration       <- message.durationSeconds (or startedAt/endedAt)
    """
    message = payload.get("message") or {}
    if message.get("type") != "end-of-call-report":
        return None

    call = message.get("call") or {}
    customer = message.get("customer") or call.get("customer") or {}
    caller = customer.get("number") or "unknown"
    call_sid = call.get("id") or message.get("id") or "unknown"

    artifact = message.get("artifact") or {}
    transcript = artifact.get("transcript") or message.get("transcript") or ""

    duration = message.get("durationSeconds")
    if duration is None:
        duration = _duration_from_ms_timestamps(
            message.get("startedAt"), message.get("endedAt")
        )

    return CallEndedWebhook(
        call_sid=str(call_sid),
        caller_phone=str(caller),
        duration_seconds=_to_int(duration),
        transcript=str(transcript),
    )


def parse_retell(payload: dict) -> Optional[CallEndedWebhook]:
    """Map a Retell webhook to our webhook, or None to ignore it.

    Acts only on ``call_ended`` (carries the transcript). ``call_analyzed`` is
    ignored to avoid analysing the same call twice. Reads:
      call_sid     <- call.call_id
      caller_phone <- call.from_number
      transcript   <- call.transcript
      duration     <- call.duration_ms (or start_timestamp/end_timestamp in ms)
    """
    if payload.get("event") != "call_ended":
        return None

    call = payload.get("call") or {}
    call_sid = call.get("call_id") or "unknown"
    caller = call.get("from_number") or "unknown"
    transcript = call.get("transcript") or ""

    duration = None
    if call.get("duration_ms") is not None:
        duration = float(call["duration_ms"]) / 1000.0
    else:
        duration = _duration_from_ms_timestamps(
            call.get("start_timestamp"), call.get("end_timestamp")
        )

    return CallEndedWebhook(
        call_sid=str(call_sid),
        caller_phone=str(caller),
        duration_seconds=_to_int(duration),
        transcript=str(transcript),
    )
