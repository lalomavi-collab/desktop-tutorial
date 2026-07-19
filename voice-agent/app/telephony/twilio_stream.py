"""Twilio Media Streams framing helpers and human-transfer control.

Twilio sends JSON envelopes over the WebSocket:
  connected -> start -> media (many) -> stop
Inbound media carries base64 mulaw/8k in 20 ms frames (160 bytes each). Outbound
audio uses the same media envelope. A `clear` envelope flushes Twilio's playback
buffer, which is how the agent yields instantly on barge-in.
"""
from __future__ import annotations

import base64
import json
import logging
from dataclasses import dataclass
from typing import Any

import httpx

from app.config import Settings, get_settings

log = logging.getLogger("voice_agent.telephony")

# 20 ms of mulaw/8k audio = 160 bytes. Framing outbound TTS into these keeps
# Twilio's jitter buffer happy and pacing smooth.
FRAME_BYTES = 160


@dataclass
class StartInfo:
    stream_sid: str
    call_sid: str | None
    from_number: str | None
    to_number: str | None


def parse_start(msg: dict[str, Any]) -> StartInfo:
    start = msg.get("start", {})
    params = start.get("customParameters", {}) or {}
    return StartInfo(
        stream_sid=start.get("streamSid") or msg.get("streamSid", ""),
        call_sid=start.get("callSid"),
        from_number=params.get("from") or start.get("from"),
        to_number=params.get("to") or start.get("to"),
    )


def decode_media(msg: dict[str, Any]) -> bytes:
    """Extract raw mulaw bytes from an inbound media envelope."""
    return base64.b64decode(msg["media"]["payload"])


def media_frames(stream_sid: str, audio: bytes) -> list[str]:
    """Split mulaw audio into serialized 20 ms media envelopes for Twilio."""
    out: list[str] = []
    for i in range(0, len(audio), FRAME_BYTES):
        frame = audio[i : i + FRAME_BYTES]
        payload = base64.b64encode(frame).decode("ascii")
        out.append(json.dumps({
            "event": "media",
            "streamSid": stream_sid,
            "media": {"payload": payload},
        }))
    return out


def clear_frame(stream_sid: str) -> str:
    """Envelope that flushes Twilio's outbound buffer (barge-in)."""
    return json.dumps({"event": "clear", "streamSid": stream_sid})


def mark_frame(stream_sid: str, name: str) -> str:
    return json.dumps({"event": "mark", "streamSid": stream_sid, "mark": {"name": name}})


class TransferController:
    """Redirects a live Twilio call to a human operator via the REST API."""

    def __init__(self, client: httpx.AsyncClient, settings: Settings | None = None) -> None:
        self._client = client
        self._s = settings or get_settings()

    async def transfer_to_human(self, call_sid: str) -> bool:
        """Redirect the in-progress call to a <Dial> to the operator number.

        Returns True on success. On any failure the caller keeps the AI session
        and the pipeline speaks a graceful fallback instead of dropping the call.
        """
        if not (self._s.twilio_account_sid and self._s.twilio_auth_token
                and self._s.human_operator_number and call_sid):
            log.warning("Transfer not configured; cannot escalate call %s", call_sid)
            return False

        twiml = (
            f'<?xml version="1.0" encoding="UTF-8"?><Response>'
            f'<Say>Connecting you with a team member now.</Say>'
            f'<Dial>{self._s.human_operator_number}</Dial>'
            f'</Response>'
        )
        url = (
            f"https://api.twilio.com/2010-04-01/Accounts/"
            f"{self._s.twilio_account_sid}/Calls/{call_sid}.json"
        )
        try:
            resp = await self._client.post(
                url,
                data={"Twiml": twiml},
                auth=(self._s.twilio_account_sid, self._s.twilio_auth_token),
                timeout=5.0,
            )
            resp.raise_for_status()
            return True
        except Exception as exc:  # noqa: BLE001
            log.warning("Twilio transfer failed for %s: %s", call_sid, exc)
            return False
