"""Central, typed configuration loaded from the environment.

Everything latency-sensitive (model ids, endpointing windows, sample rates)
lives here so the hot path never hard-codes a tunable.
"""
from __future__ import annotations

import os
from dataclasses import dataclass, field
from functools import lru_cache


def _env(key: str, default: str | None = None, required: bool = False) -> str:
    val = os.getenv(key, default)
    if required and not val:
        raise RuntimeError(f"Missing required environment variable: {key}")
    return val or ""


@dataclass(frozen=True)
class Settings:
    # ── Anthropic (Claude) ────────────────────────────────────────────────────
    anthropic_api_key: str = field(default_factory=lambda: _env("ANTHROPIC_API_KEY", required=True))
    # Haiku for the low-latency turn model, Sonnet for reasoning-heavy fallbacks.
    claude_model: str = field(default_factory=lambda: _env("CLAUDE_MODEL", "claude-haiku-4-5-20251001"))
    claude_judge_model: str = field(default_factory=lambda: _env("CLAUDE_JUDGE_MODEL", "claude-haiku-4-5-20251001"))
    claude_max_tokens: int = field(default_factory=lambda: int(_env("CLAUDE_MAX_TOKENS", "512")))

    # ── Deepgram (STT) ────────────────────────────────────────────────────────
    deepgram_api_key: str = field(default_factory=lambda: _env("DEEPGRAM_API_KEY", required=True))
    deepgram_model: str = field(default_factory=lambda: _env("DEEPGRAM_MODEL", "nova-2-phonecall"))
    deepgram_language: str = field(default_factory=lambda: _env("DEEPGRAM_LANGUAGE", "en"))
    # Milliseconds of silence Deepgram waits before declaring an utterance final.
    endpointing_ms: int = field(default_factory=lambda: int(_env("DEEPGRAM_ENDPOINTING_MS", "300")))

    # ── ElevenLabs (TTS) ──────────────────────────────────────────────────────
    elevenlabs_api_key: str = field(default_factory=lambda: _env("ELEVENLABS_API_KEY", required=True))
    elevenlabs_voice_id: str = field(default_factory=lambda: _env("ELEVENLABS_VOICE_ID", required=True))
    elevenlabs_model: str = field(default_factory=lambda: _env("ELEVENLABS_MODEL", "eleven_flash_v2_5"))

    # ── Supabase / Postgres (state + pgvector RAG) ────────────────────────────
    database_url: str = field(default_factory=lambda: _env("DATABASE_URL", required=True))
    supabase_url: str = field(default_factory=lambda: _env("SUPABASE_URL"))
    supabase_service_key: str = field(default_factory=lambda: _env("SUPABASE_SERVICE_ROLE_KEY"))
    embedding_model: str = field(default_factory=lambda: _env("EMBEDDING_MODEL", "text-embedding-3-small"))
    embedding_provider: str = field(default_factory=lambda: _env("EMBEDDING_PROVIDER", "openai"))
    openai_api_key: str = field(default_factory=lambda: _env("OPENAI_API_KEY"))

    # ── Telephony / escalation ────────────────────────────────────────────────
    twilio_account_sid: str = field(default_factory=lambda: _env("TWILIO_ACCOUNT_SID"))
    twilio_auth_token: str = field(default_factory=lambda: _env("TWILIO_AUTH_TOKEN"))
    human_operator_number: str = field(default_factory=lambda: _env("HUMAN_OPERATOR_NUMBER"))
    n8n_webhook_url: str = field(default_factory=lambda: _env("N8N_WEBHOOK_URL"))

    # ── Audio framing (Twilio Media Streams: mulaw, 8 kHz, mono) ──────────────
    sample_rate: int = 8000
    audio_encoding: str = "mulaw"

    # ── Latency / governance budgets ──────────────────────────────────────────
    e2e_latency_budget_ms: int = 600
    rag_similarity_threshold: float = 0.72
    rag_top_k: int = 5
    # Compliance score below this is intercepted before speech.
    compliance_min_score: float = field(default_factory=lambda: float(_env("COMPLIANCE_MIN_SCORE", "0.60")))

    # ── Escalation thresholds ─────────────────────────────────────────────────
    max_frustration_events: int = 2
    max_repeat_loops: int = 3
    max_turns: int = 40

    company_name: str = field(default_factory=lambda: _env("COMPANY_NAME", "LALUM"))


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    """Process-wide singleton. Cached so import stays cheap on the hot path."""
    return Settings()
