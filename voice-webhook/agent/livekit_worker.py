"""LALUM voice agent worker (LiveKit) — SCAFFOLD.

This is the piece that runs inside LiveKit: it answers the call, talks to the
caller using the fixed Hebrew script, and on hangup posts the call to our
webhook backend so it lands in Supabase.

It is intentionally a scaffold. The speech pipeline (STT, LLM, TTS) wiring is
specific to your LiveKit Agents SDK version and to the STT/TTS providers you
choose, so those spots are marked with TODO. The parts that are provider
agnostic (loading the system prompt, and posting the completed call to the
webhook) are fully implemented and testable.

Run (once completed):
    pip install "livekit-agents[anthropic]" livekit-plugins-...   # your STT/TTS
    python livekit_worker.py

Environment:
    LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET
    ANTHROPIC_API_KEY
    WEBHOOK_URL   e.g. https://<host>/webhook/livekit/ended
    (plus your STT/TTS provider keys)
"""
from __future__ import annotations

import os
import pathlib

import httpx

PROMPT_PATH = pathlib.Path(__file__).with_name("lalum_voice_agent.he.md")


def load_system_prompt() -> str:
    """Load the fixed Hebrew agent script that defines the persona and guards."""
    return PROMPT_PATH.read_text(encoding="utf-8")


def build_call_payload(
    *, call_sid: str, caller_phone: str, duration_seconds: int, transcript: str
) -> dict:
    """Shape the webhook payload. Pure, so it is trivially testable."""
    return {
        "call_sid": call_sid,
        "caller_phone": caller_phone,
        "duration_seconds": int(duration_seconds),
        "transcript": transcript,
    }


async def post_call_ended(
    *,
    call_sid: str,
    caller_phone: str,
    duration_seconds: int,
    transcript: str,
    webhook_url: str | None = None,
    client: httpx.AsyncClient | None = None,
    timeout: float = 15.0,
) -> dict:
    """Post a completed call to the backend webhook.

    Called when the LiveKit session ends. Fully implemented and unit-testable
    independently of LiveKit: pass a ``client`` backed by an httpx MockTransport
    in tests.
    """
    url = webhook_url or os.environ.get("WEBHOOK_URL", "")
    if not url:
        raise RuntimeError("WEBHOOK_URL is not set")
    payload = build_call_payload(
        call_sid=call_sid,
        caller_phone=caller_phone,
        duration_seconds=duration_seconds,
        transcript=transcript,
    )
    owns = client is None
    client = client or httpx.AsyncClient(timeout=timeout)
    try:
        resp = await client.post(url, json=payload)
        resp.raise_for_status()
        return resp.json()
    finally:
        if owns:
            await client.aclose()


# ── LiveKit entrypoint (adapt to your installed livekit-agents version) ──────
#
# The block below sketches the shape of the worker. Uncomment and adjust to the
# exact API of your livekit-agents version and your chosen STT/TTS plugins.
#
# from livekit import agents
# from livekit.agents import AgentSession, Agent, RoomInputOptions
# from livekit.plugins import anthropic  # LLM
# # from livekit.plugins import <your_stt>, <your_tts>
#
# async def entrypoint(ctx: agents.JobContext):
#     await ctx.connect()
#
#     # The caller's number and a call id come from the SIP participant metadata.
#     sip = _first_sip_participant(ctx)               # TODO: read from ctx.room
#     caller_phone = sip.get("phone", "unknown")
#     call_sid = sip.get("call_sid", ctx.room.name)
#
#     session = AgentSession(
#         llm=anthropic.LLM(model="claude-3-5-sonnet-latest"),
#         stt=...,   # TODO: a Hebrew-capable STT provider
#         tts=...,   # TODO: a Hebrew-capable TTS provider
#     )
#
#     transcript_parts: list[str] = []
#     # TODO: subscribe to transcription events and append to transcript_parts.
#
#     await session.start(
#         room=ctx.room,
#         agent=Agent(instructions=load_system_prompt()),
#         room_input_options=RoomInputOptions(),
#     )
#
#     async def on_shutdown():
#         # Fires when the caller hangs up: sync the call to Supabase.
#         await post_call_ended(
#             call_sid=call_sid,
#             caller_phone=caller_phone,
#             duration_seconds=_session_seconds(session),  # TODO
#             transcript="\n".join(transcript_parts),
#         )
#
#     ctx.add_shutdown_callback(on_shutdown)
#
#
# if __name__ == "__main__":
#     agents.cli.run_app(agents.WorkerOptions(entrypoint_fnc=entrypoint))
