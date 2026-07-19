"""FastAPI application entry point.

Endpoints:
    GET  /health                  liveness probe
    POST /webhook/livekit/ended   ingest a completed call
    POST /internal/retry          reprocess calls stored with is_processed=false
"""
from __future__ import annotations

import logging

from fastapi import Depends, FastAPI

from .config import Settings
from .db import SupabaseRepository
from .deps import get_extractor, get_repo, get_settings_dep
from .intent import IntentExtractor
from .schemas import CallEndedWebhook, IngestResult
from .service import process_call

logging.basicConfig(level=logging.INFO)

app = FastAPI(
    title="LALUM Voice Call Webhook",
    version="1.0.0",
    description="Ingests completed Voice AI calls and syncs them to Supabase.",
)


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/webhook/livekit/ended", response_model=IngestResult)
async def livekit_ended(
    webhook: CallEndedWebhook,
    extractor: IntentExtractor = Depends(get_extractor),
    repo: SupabaseRepository = Depends(get_repo),
    settings: Settings = Depends(get_settings_dep),
) -> IngestResult:
    """Handle a completed-call webhook from the Voice AI agent."""
    return await process_call(
        webhook, extractor=extractor, repo=repo, settings=settings
    )


@app.post("/internal/retry")
async def retry_unprocessed(
    limit: int = 50,
    extractor: IntentExtractor = Depends(get_extractor),
    repo: SupabaseRepository = Depends(get_repo),
    settings: Settings = Depends(get_settings_dep),
) -> dict[str, object]:
    """Reprocess calls that failed extraction on first arrival.

    Re-runs each stored transcript through Claude. The transactional ingest is
    idempotent per call_sid, so a successful retry upgrades the row in place and
    (re)creates its task and billing line without duplicating.
    """
    rows = await repo.fetch_unprocessed(limit=limit)
    results: list[IngestResult] = []
    for row in rows:
        webhook = CallEndedWebhook(
            call_sid=row["call_sid"],
            caller_phone=row["caller_phone"],
            duration_seconds=row.get("duration_seconds") or 0,
            transcript=row.get("transcript") or "",
        )
        results.append(
            await process_call(
                webhook, extractor=extractor, repo=repo, settings=settings
            )
        )
    retried = sum(1 for r in results if r.processed)
    return {
        "attempted": len(results),
        "processed": retried,
        "still_unprocessed": len(results) - retried,
        "results": [r.model_dump() for r in results],
    }
