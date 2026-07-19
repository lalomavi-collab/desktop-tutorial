"""ElevenLabs streaming Text-to-Speech.

Synthesis requests output_format=ulaw_8000, which is exactly Twilio's wire format
(mulaw, 8 kHz). That removes any resampling step between TTS and the phone,
saving both CPU and latency. Audio is streamed back chunk by chunk so playback
starts before the full sentence is rendered.

The flash model is selected in config for its low first-byte latency, which is
the dominant TTS contribution to the sub-600ms end-to-end budget.
"""
from __future__ import annotations

import logging
from typing import AsyncIterator

import httpx

from app.config import Settings, get_settings

log = logging.getLogger("voice_agent.tts")

_BASE = "https://api.elevenlabs.io/v1/text-to-speech"


class ElevenLabsTTS:
    def __init__(self, client: httpx.AsyncClient, settings: Settings | None = None) -> None:
        self._client = client
        self._s = settings or get_settings()

    async def synthesize(self, text: str) -> AsyncIterator[bytes]:
        """Yield mulaw/8k audio chunks for one piece of text.

        Raises nothing into the caller on transport errors: it logs and stops the
        stream so the call can continue with the next sentence.
        """
        url = f"{_BASE}/{self._s.elevenlabs_voice_id}/stream"
        params = {"output_format": "ulaw_8000", "optimize_streaming_latency": "3"}
        payload = {
            "text": text,
            "model_id": self._s.elevenlabs_model,
            "voice_settings": {"stability": 0.5, "similarity_boost": 0.8},
        }
        headers = {
            "xi-api-key": self._s.elevenlabs_api_key,
            "accept": "audio/basic",
            "content-type": "application/json",
        }
        try:
            async with self._client.stream(
                "POST", url, params=params, json=payload, headers=headers, timeout=10.0
            ) as resp:
                resp.raise_for_status()
                async for chunk in resp.aiter_bytes():
                    if chunk:
                        yield chunk
        except Exception as exc:  # noqa: BLE001
            log.warning("TTS synthesis failed for %r: %s", text[:40], exc)
            return
