"""Deepgram streaming Speech-to-Text over WebSocket.

Audio arrives as Twilio mulaw/8k frames and is forwarded verbatim to Deepgram,
which handles noise filtering, endpointing (VAD), and interim/final results.
Transcript events are pushed onto a queue the pipeline consumes.

Latency notes:
  * interim_results=true lets the pipeline react to partial speech (barge-in).
  * endpointing controls how quickly an utterance is declared final; lower is
    snappier but riskier on hesitant speakers. Tuned via config.
"""
from __future__ import annotations

import asyncio
import json
import logging
from dataclasses import dataclass
from typing import AsyncIterator
from urllib.parse import urlencode

import websockets

from app.config import Settings, get_settings

log = logging.getLogger("voice_agent.stt")

_DG_URL = "wss://api.deepgram.com/v1/listen"


@dataclass
class TranscriptEvent:
    text: str
    is_final: bool          # Deepgram marked this segment final
    speech_final: bool      # endpointing fired: the utterance is complete
    confidence: float


class DeepgramSTT:
    def __init__(self, settings: Settings | None = None) -> None:
        self._s = settings or get_settings()
        self._ws: websockets.WebSocketClientProtocol | None = None
        self._queue: asyncio.Queue[TranscriptEvent] = asyncio.Queue()
        self._reader: asyncio.Task | None = None

    async def connect(self) -> None:
        params = {
            "model": self._s.deepgram_model,
            "language": self._s.deepgram_language,
            "encoding": self._s.audio_encoding,      # mulaw
            "sample_rate": self._s.sample_rate,       # 8000
            "channels": 1,
            "interim_results": "true",
            "smart_format": "true",
            "punctuate": "true",
            "endpointing": self._s.endpointing_ms,
            "vad_events": "true",
        }
        url = f"{_DG_URL}?{urlencode(params)}"
        self._ws = await websockets.connect(
            url, additional_headers={"Authorization": f"Token {self._s.deepgram_api_key}"}
        )
        self._reader = asyncio.create_task(self._read_loop())

    async def send_audio(self, mulaw_frame: bytes) -> None:
        if self._ws is not None:
            await self._ws.send(mulaw_frame)

    def events(self) -> "asyncio.Queue[TranscriptEvent]":
        return self._queue

    async def finalize(self) -> None:
        """Ask Deepgram to flush any buffered audio into a final transcript."""
        if self._ws is not None:
            await self._ws.send(json.dumps({"type": "Finalize"}))

    async def close(self) -> None:
        try:
            if self._ws is not None:
                await self._ws.send(json.dumps({"type": "CloseStream"}))
                await self._ws.close()
        finally:
            if self._reader is not None:
                self._reader.cancel()

    async def _read_loop(self) -> None:
        assert self._ws is not None
        try:
            async for raw in self._ws:
                msg = json.loads(raw)
                if msg.get("type") != "Results":
                    continue
                alt = msg.get("channel", {}).get("alternatives", [{}])[0]
                text = (alt.get("transcript") or "").strip()
                if not text:
                    continue
                await self._queue.put(
                    TranscriptEvent(
                        text=text,
                        is_final=bool(msg.get("is_final")),
                        speech_final=bool(msg.get("speech_final")),
                        confidence=float(alt.get("confidence") or 0.0),
                    )
                )
        except websockets.ConnectionClosed:
            log.info("Deepgram connection closed")
        except Exception as exc:  # noqa: BLE001
            log.warning("Deepgram read loop error: %s", exc)


async def transcripts(stt: DeepgramSTT) -> AsyncIterator[TranscriptEvent]:
    """Convenience async iterator over the event queue."""
    q = stt.events()
    while True:
        yield await q.get()
