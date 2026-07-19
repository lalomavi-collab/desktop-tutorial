"""FastAPI application entry point.

Endpoints:
    GET  /health                  liveness probe
    POST /webhook/livekit/ended   ingest a completed call
    POST /internal/retry          reprocess calls stored with is_processed=false
"""
from __future__ import annotations

import logging

from fastapi import Depends, FastAPI, Header, HTTPException, Request

from .adapters import parse_retell, parse_vapi
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


def _check_secret(settings: Settings, provided: str | None) -> None:
    """Reject the request if a webhook secret is configured and does not match."""
    expected = settings.voice_webhook_secret
    if expected and provided != expected:
        raise HTTPException(status_code=401, detail="invalid webhook secret")


@app.post("/webhook/vapi", response_model=IngestResult)
async def vapi_webhook(
    request: Request,
    x_vapi_secret: str | None = Header(default=None),
    x_webhook_secret: str | None = Header(default=None),
    extractor: IntentExtractor = Depends(get_extractor),
    repo: SupabaseRepository = Depends(get_repo),
    settings: Settings = Depends(get_settings_dep),
) -> IngestResult:
    """Handle a Vapi end-of-call report from the hosted voice agent."""
    _check_secret(settings, x_vapi_secret or x_webhook_secret)
    payload = await request.json()
    webhook = parse_vapi(payload)
    if webhook is None:
        return IngestResult(status="ignored", call_sid="", processed=False)
    return await process_call(
        webhook, extractor=extractor, repo=repo, settings=settings
    )


@app.post("/webhook/retell", response_model=IngestResult)
async def retell_webhook(
    request: Request,
    x_webhook_secret: str | None = Header(default=None),
    extractor: IntentExtractor = Depends(get_extractor),
    repo: SupabaseRepository = Depends(get_repo),
    settings: Settings = Depends(get_settings_dep),
) -> IngestResult:
    """Handle a Retell call_ended webhook from the hosted voice agent."""
    _check_secret(settings, x_webhook_secret)
    payload = await request.json()
    webhook = parse_retell(payload)
    if webhook is None:
        return IngestResult(status="ignored", call_sid="", processed=False)
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
