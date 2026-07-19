"""RAG + Prompt Orchestration Layer.

Ties retrieval, guardrails, and Claude streaming together. The turn is streamed
token by token and flushed to TTS at sentence boundaries, so the first spoken
words leave the server long before the full reply is generated. This is the main
lever on Time-to-First-Byte and the sub-600ms end-to-end budget.

The generator yields two event types:
  * SpeechChunk : a complete sentence ready for the risk check then TTS.
  * ToolCall    : a structured function call for the Action Execution Layer.
"""
from __future__ import annotations

import logging
import re
from dataclasses import dataclass, field
from typing import AsyncIterator

from anthropic import AsyncAnthropic

from app.actions.tools import TOOLS
from app.config import Settings, get_settings
from app.llm.prompts import build_context_turn, build_system_blocks
from app.models import KnowledgeChunk
from app.rag.retriever import Retriever

log = logging.getLogger("voice_agent.llm")

# Flush a chunk to TTS as soon as a sentence terminator is followed by space,
# keeping spoken latency low while avoiding mid-word cuts.
_SENTENCE_END = re.compile(r"([.!?…])(\s+|$)")


@dataclass
class SpeechChunk:
    text: str


@dataclass
class ToolCall:
    name: str
    input: dict = field(default_factory=dict)


class ClaudeOrchestrator:
    def __init__(
        self,
        retriever: Retriever,
        client: AsyncAnthropic | None = None,
        settings: Settings | None = None,
    ) -> None:
        self._s = settings or get_settings()
        self._retriever = retriever
        self._client = client or AsyncAnthropic(api_key=self._s.anthropic_api_key)
        self._system = build_system_blocks(self._s)

    async def stream_turn(
        self, history: list[dict], user_text: str
    ) -> AsyncIterator[SpeechChunk | ToolCall]:
        """Retrieve context, then stream Claude, yielding speech + tool events."""
        chunks: list[KnowledgeChunk] = await self._retriever.retrieve(user_text)
        context_block = self._retriever.format_context(chunks)
        turn_text = build_context_turn(user_text, context_block)

        messages = [*history, {"role": "user", "content": turn_text}]

        buffer = ""
        async with self._client.messages.stream(
            model=self._s.claude_model,
            max_tokens=self._s.claude_max_tokens,
            system=self._system,
            tools=TOOLS,
            messages=messages,
        ) as stream:
            async for event in stream:
                if event.type == "content_block_delta" and event.delta.type == "text_delta":
                    buffer += event.delta.text
                    # Emit every complete sentence the moment it lands.
                    while True:
                        match = _SENTENCE_END.search(buffer)
                        if not match:
                            break
                        cut = match.end()
                        sentence = buffer[:cut].strip()
                        buffer = buffer[cut:]
                        if sentence:
                            yield SpeechChunk(sentence)

            # Flush any trailing partial sentence.
            if buffer.strip():
                yield SpeechChunk(buffer.strip())

            # Surface structured tool calls after the text has been spoken.
            final = await stream.get_final_message()
            for block in final.content:
                if getattr(block, "type", None) == "tool_use":
                    yield ToolCall(name=block.name, input=dict(block.input or {}))


class ClaudeJudge:
    """Lightweight LLM judge used by the hybrid risk detector for grey areas."""

    def __init__(self, client: AsyncAnthropic | None = None, settings: Settings | None = None) -> None:
        self._s = settings or get_settings()
        self._client = client or AsyncAnthropic(api_key=self._s.anthropic_api_key)

    async def judge(self, text: str) -> tuple[bool, float]:
        """Return (is_risky, compliance_score) for a candidate utterance."""
        prompt = (
            "You are a compliance reviewer for a legal-services phone agent. "
            "Rate how safe this sentence is to say to a caller. Reply with ONLY a "
            "number from 0.0 (unsafe: gives legal advice, guarantees an outcome, "
            "makes a financial or binding commitment, or exposes private data) to "
            "1.0 (clearly safe).\n\n"
            f"SENTENCE: {text}\nSCORE:"
        )
        resp = await self._client.messages.create(
            model=self._s.claude_judge_model,
            max_tokens=8,
            messages=[{"role": "user", "content": prompt}],
        )
        raw = resp.content[0].text.strip() if resp.content else "1.0"
        try:
            score = max(0.0, min(1.0, float(re.findall(r"[0-9]*\.?[0-9]+", raw)[0])))
        except (IndexError, ValueError):
            score = 1.0
        return score < self._s.compliance_min_score, score
