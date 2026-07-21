"""Tests for the LiveKit worker's webhook posting (no network)."""
import asyncio
import sys
from pathlib import Path

import httpx
import pytest

# The agent scaffold lives beside the app, not in a package.
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "agent"))

import livekit_worker as worker  # noqa: E402


def test_build_call_payload_coerces_duration():
    payload = worker.build_call_payload(
        call_sid="CA_9", caller_phone="+972500000000",
        duration_seconds=90.7, transcript="hi",
    )
    assert payload == {
        "call_sid": "CA_9",
        "caller_phone": "+972500000000",
        "duration_seconds": 90,
        "transcript": "hi",
    }


def test_post_call_ended_sends_payload():
    seen = {}

    def handler(request: httpx.Request) -> httpx.Response:
        seen["url"] = str(request.url)
        seen["json"] = request.content
        return httpx.Response(200, json={"status": "processed", "processed": True})

    async def run():
        transport = httpx.MockTransport(handler)
        async with httpx.AsyncClient(transport=transport) as client:
            return await worker.post_call_ended(
                call_sid="CA_10",
                caller_phone="+972522490420",
                duration_seconds=905,
                transcript="advice about a dispute",
                webhook_url="https://example.test/webhook/livekit/ended",
                client=client,
            )

    result = asyncio.run(run())
    assert result["processed"] is True
    assert seen["url"] == "https://example.test/webhook/livekit/ended"
    assert b"CA_10" in seen["json"]
    assert b"905" in seen["json"]


def test_post_call_ended_requires_url():
    async def run():
        await worker.post_call_ended(
            call_sid="x", caller_phone="y", duration_seconds=1,
            transcript="z", webhook_url="",
        )

    with pytest.raises(RuntimeError):
        asyncio.run(run())
