"""FastAPI streaming server: Twilio Media Streams <-> Deepgram <-> Claude <-> ElevenLabs.

One WebSocket connection carries one phone call. The server runs two cooperating
loops per call:

  * inbound loop    : reads Twilio envelopes and forwards caller audio to STT.
  * transcript loop : consumes STT events, drives turns, handles barge-in.

The design keeps the audio path free of blocking work: persistence is
fire-and-forget, actions run in the background, and TTS is streamed and
cancellable so the agent yields the instant the caller speaks over it.
"""
from __future__ import annotations

import asyncio
import logging
import time
from contextlib import asynccontextmanager

import httpx
from anthropic import AsyncAnthropic
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.responses import PlainTextResponse

from app.actions.executor import ActionExecutor
from app.config import get_settings
from app.governance.escalation import EscalationMatrix
from app.governance.risk import RiskEngine
from app.llm.claude_orchestrator import ClaudeJudge, ClaudeOrchestrator, SpeechChunk, ToolCall
from app.models import CallStatus, EscalationReason, Role
from app.rag.retriever import Embedder, Retriever
from app.state import db, session as session_mod
from app.stt.deepgram_client import DeepgramSTT, transcripts
from app.telephony import twilio_stream as tw
from app.tts.elevenlabs_client import ElevenLabsTTS

logging.basicConfig(level=logging.INFO)
log = logging.getLogger("voice_agent.main")

GREETING = "Thanks for calling {company}. How can I help you today?"


@asynccontextmanager
async def lifespan(app: FastAPI):
    settings = get_settings()
    await db.init_pool()
    # Shared clients live for the process, not per call, to avoid setup latency.
    app.state.http = httpx.AsyncClient()
    app.state.anthropic = AsyncAnthropic(api_key=settings.anthropic_api_key)
    log.info("Voice agent up. e2e budget=%dms", settings.e2e_latency_budget_ms)
    try:
        yield
    finally:
        await app.state.http.aclose()
        await db.close_pool()


app = FastAPI(title="Voice AI Agent", lifespan=lifespan)


@app.get("/healthz")
async def healthz() -> dict:
    return {"status": "ok"}


@app.post("/twiml")
async def twiml() -> PlainTextResponse:
    """TwiML Twilio fetches on inbound call: open a bidirectional media stream."""
    settings = get_settings()
    host = settings.supabase_url or "your-host"
    ws_url = f"wss://{host}/ws".replace("https://", "").replace("http://", "")
    xml = (
        '<?xml version="1.0" encoding="UTF-8"?><Response>'
        f'<Connect><Stream url="{ws_url}"/></Connect>'
        '</Response>'
    )
    return PlainTextResponse(content=xml, media_type="text/xml")


@app.websocket("/ws")
async def media_stream(ws: WebSocket) -> None:
    await ws.accept()
    pipeline = CallPipeline(ws, ws.app)
    try:
        await pipeline.run()
    except WebSocketDisconnect:
        log.info("Caller disconnected")
        await pipeline.on_disconnect()
    except Exception as exc:  # noqa: BLE001
        log.exception("Pipeline crashed: %s", exc)
        await pipeline.on_disconnect(status=CallStatus.FAILED)


class CallPipeline:
    """Owns the state and components for a single live call."""

    def __init__(self, ws: WebSocket, app: FastAPI) -> None:
        self._ws = ws
        self._settings = get_settings()
        http: httpx.AsyncClient = app.state.http
        anthropic: AsyncAnthropic = app.state.anthropic

        retriever = Retriever(Embedder(self._settings, http))
        self._orchestrator = ClaudeOrchestrator(retriever, anthropic)
        self._risk = RiskEngine(judge=ClaudeJudge(anthropic))
        self._escalation = EscalationMatrix()
        self._actions = ActionExecutor(http)
        self._transfer = tw.TransferController(http)
        self._tts = ElevenLabsTTS(http)
        self._stt = DeepgramSTT()

        self._session: session_mod.CallSession | None = None
        self._stream_sid: str = ""
        self._call_sid: str | None = None

        self._utterance_parts: list[str] = []
        self._agent_speaking = False
        self._speaking_task: asyncio.Task | None = None
        self._turn_lock = asyncio.Lock()

    # ── Top-level run loop ─────────────────────────────────────────────────────
    async def run(self) -> None:
        consumer: asyncio.Task | None = None
        try:
            while True:
                msg = await self._ws.receive_json()
                event = msg.get("event")

                if event == "start":
                    await self._on_start(msg)
                    consumer = asyncio.create_task(self._transcript_loop())
                elif event == "media":
                    # Forward caller audio to STT (mulaw/8k, verbatim).
                    await self._stt.send_audio(tw.decode_media(msg))
                elif event == "stop":
                    break
                # "connected" and "mark" need no action here.
        finally:
            if consumer is not None:
                consumer.cancel()
            await self._stt.close()
            await self.on_disconnect()

    async def _on_start(self, msg: dict) -> None:
        info = tw.parse_start(msg)
        self._stream_sid = info.stream_sid
        self._call_sid = info.call_sid
        self._session = await session_mod.create_call(
            provider="twilio",
            provider_call_sid=info.call_sid,
            from_number=info.from_number,
            to_number=info.to_number,
        )
        await self._stt.connect()
        # Greet immediately so the caller is never met with silence.
        await self._speak(GREETING.format(company=self._settings.company_name), Role.AGENT)

    # ── Transcript consumer: barge-in + turn dispatch ──────────────────────────
    async def _transcript_loop(self) -> None:
        async for ev in transcripts(self._stt):
            if not ev.text:
                continue

            # Barge-in: caller speaks while the agent is talking -> yield now.
            if self._agent_speaking:
                await self._barge_in()

            if ev.is_final:
                self._utterance_parts.append(ev.text)

            if ev.speech_final:
                full = " ".join(self._utterance_parts).strip()
                self._utterance_parts.clear()
                if full:
                    await self._handle_turn(full, ev.confidence)

    async def _barge_in(self) -> None:
        """Stop speaking and flush Twilio's buffer so the caller is heard."""
        if self._speaking_task and not self._speaking_task.done():
            self._speaking_task.cancel()
        await self._safe_send(tw.clear_frame(self._stream_sid))
        self._agent_speaking = False

    # ── One conversational turn ────────────────────────────────────────────────
    async def _handle_turn(self, caller_text: str, confidence: float) -> None:
        assert self._session is not None
        # Serialize turns: never start generating a new reply mid-reply.
        async with self._turn_lock:
            started = time.monotonic()
            turn = self._session.next_turn()
            self._session.log_transcript(
                Role.CALLER, caller_text, turn_index=turn,
                stt_confidence=confidence,
            )
            self._session.add_caller_message(caller_text)

            # Caller-driven escalation (explicit human ask / frustration) first.
            pre = self._escalation.evaluate(self._session, caller_text, last_risk=None)
            if pre.escalate:
                await self._escalate(pre.reason)
                return

            spoken: list[str] = []
            last_risk = None
            escalate_after = False

            try:
                async for item in self._orchestrator.stream_turn(
                    self._session.history, caller_text
                ):
                    if isinstance(item, SpeechChunk):
                        risk = await self._risk.assess(item.text)
                        last_risk = risk
                        self._session.log_compliance(risk)
                        # Compliance Filter: speak the safe replacement, not the
                        # risky text, and remember to escalate if required.
                        to_say = item.text if risk.is_safe else (
                            risk.replacement_text or "Let me connect you with our team."
                        )
                        spoken.append(to_say)
                        await self._speak(to_say, Role.AGENT, turn_index=turn)
                        if risk.decision.value == "escalated":
                            escalate_after = True
                            break
                    elif isinstance(item, ToolCall):
                        # DOM layer: run the action off the hot path.
                        asyncio.create_task(self._run_action(item))
            except Exception as exc:  # noqa: BLE001
                log.warning("Turn generation failed: %s", exc)
                await self._speak(
                    "Sorry, I hit a snag. Let me connect you with someone who can help.",
                    Role.AGENT, turn_index=turn,
                )
                await self._escalate(EscalationReason.SYSTEM_ERROR)
                return

            reply = " ".join(spoken).strip()
            if reply:
                self._session.add_agent_message(reply)

            elapsed = int((time.monotonic() - started) * 1000)
            self._session.log_transcript(
                Role.AGENT, reply or "(silent)", turn_index=turn, latency_ms=elapsed,
            )
            if elapsed > self._settings.e2e_latency_budget_ms:
                log.info("Turn %d exceeded budget: %dms", turn, elapsed)

            # Post-turn escalation (compliance trigger, loops, runaway).
            post = self._escalation.evaluate(self._session, caller_text, last_risk)
            if escalate_after or post.escalate:
                reason = post.reason or EscalationReason.COMPLIANCE_TRIGGER
                await self._escalate(reason)

    async def _run_action(self, call: ToolCall) -> None:
        assert self._session is not None
        intent, outcome = await self._actions.execute(call)
        self._session.log_intent(intent, outcome)

    # ── Speaking (cancellable) ─────────────────────────────────────────────────
    async def _speak(self, text: str, role: Role, turn_index: int | None = None) -> None:
        """Synthesize and stream audio to Twilio. Cancellable for barge-in."""
        self._agent_speaking = True
        self._speaking_task = asyncio.create_task(self._stream_tts(text))
        try:
            await self._speaking_task
        except asyncio.CancelledError:
            pass
        finally:
            self._agent_speaking = False

    async def _stream_tts(self, text: str) -> None:
        async for audio in self._tts.synthesize(text):
            for frame in tw.media_frames(self._stream_sid, audio):
                await self._safe_send(frame)
        await self._safe_send(tw.mark_frame(self._stream_sid, "eos"))

    # ── Escalation to a human ──────────────────────────────────────────────────
    async def _escalate(self, reason: EscalationReason) -> None:
        assert self._session is not None
        log.info("Escalating call %s: %s", self._session.call_id, reason.value)
        self._session.log_transcript(
            Role.SYSTEM, f"escalation:{reason.value}",
        )
        await self._session.mark_escalated(reason)
        ok = self._call_sid is not None and await self._transfer.transfer_to_human(self._call_sid)
        if not ok:
            # Transfer path unavailable: keep the caller informed rather than drop.
            await self._speak(
                "I'm having trouble transferring you. Please call our office directly "
                "and a team member will assist you.",
                Role.AGENT,
            )

    # ── Cleanup ────────────────────────────────────────────────────────────────
    async def on_disconnect(self, status: CallStatus | None = None) -> None:
        if self._session is None:
            return
        final = status or (
            CallStatus.ESCALATED if self._session.escalated else CallStatus.COMPLETED
        )
        await self._session.finalize(final)
        self._session = None

    async def _safe_send(self, data: str) -> None:
        try:
            await self._ws.send_text(data)
        except (WebSocketDisconnect, RuntimeError):
            # Caller hung up mid-playback: stop cleanly, jitter/termination safe.
            raise WebSocketDisconnect()
