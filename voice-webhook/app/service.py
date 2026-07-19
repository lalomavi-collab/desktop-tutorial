"""Call-processing orchestration.

Ties the extractor, billing math, and Supabase repository together. Isolated
from FastAPI so it can be unit tested directly and reused by the retry worker.
"""
from __future__ import annotations

import logging

from .billing import build_billing_line
from .config import Settings
from .db import SupabaseRepository
from .intent import ExtractionError, IntentExtractor
from .schemas import CallEndedWebhook, CallExtraction, IngestResult

logger = logging.getLogger(__name__)


async def process_call(
    webhook: CallEndedWebhook,
    *,
    extractor: IntentExtractor,
    repo: SupabaseRepository,
    settings: Settings,
) -> IngestResult:
    """Extract intent, compute billing, and persist a call transactionally.

    Resiliency: if extraction fails, the raw call is still stored with
    ``is_processed=false`` and an error note so a later retry can complete it.
    The webhook caller always gets a 200 in that case, so the voice platform
    does not hammer us with its own retries over a transient LLM outage.
    """
    try:
        extraction = await extractor.extract(webhook.transcript)
    except ExtractionError as exc:
        logger.warning("call %s stored unprocessed: %s", webhook.call_sid, exc)
        return await _store_unprocessed(webhook, repo, settings, reason=str(exc))

    return await _store_processed(webhook, extraction, repo, settings)


async def _store_processed(
    webhook: CallEndedWebhook,
    extraction: CallExtraction,
    repo: SupabaseRepository,
    settings: Settings,
) -> IngestResult:
    billed_hours = None
    amount = None
    hourly_rate = None
    if extraction.is_billable:
        line = build_billing_line(
            webhook.duration_seconds,
            settings.standard_hourly_rate,
            increment_minutes=settings.billing_increment_minutes,
            currency=settings.billing_currency,
        )
        billed_hours = line.billed_hours
        amount = line.amount
        hourly_rate = line.hourly_rate

    result = await repo.ingest_call(
        call_sid=webhook.call_sid,
        caller_phone=webhook.caller_phone,
        duration_seconds=webhook.duration_seconds,
        transcript=webhook.transcript,
        summary=extraction.summary,
        client_intent=extraction.client_intent.value,
        is_billable=extraction.is_billable,
        is_processed=True,
        process_error=None,
        task_title=extraction.suggested_task.title,
        task_priority=extraction.suggested_task.priority.value,
        due_days_offset=extraction.suggested_task.due_days_offset,
        billed_hours=billed_hours,
        hourly_rate=hourly_rate,
        amount=amount,
        currency=settings.billing_currency,
    )

    return IngestResult(
        status="processed",
        call_sid=webhook.call_sid,
        processed=True,
        client_id=_maybe_str(result.get("client_id")),
        call_id=_maybe_str(result.get("call_id")),
        created_lead=result.get("created_lead"),
        is_billable=extraction.is_billable,
        billed_hours=billed_hours,
        amount=amount,
    )


async def _store_unprocessed(
    webhook: CallEndedWebhook,
    repo: SupabaseRepository,
    settings: Settings,
    *,
    reason: str,
) -> IngestResult:
    result = await repo.ingest_call(
        call_sid=webhook.call_sid,
        caller_phone=webhook.caller_phone,
        duration_seconds=webhook.duration_seconds,
        transcript=webhook.transcript,
        summary=None,
        client_intent=None,
        is_billable=False,
        is_processed=False,
        process_error=reason,
        task_title=None,
        task_priority=None,
        due_days_offset=None,
        billed_hours=None,
        hourly_rate=None,
        amount=None,
        currency=settings.billing_currency,
    )
    return IngestResult(
        status="stored_unprocessed",
        call_sid=webhook.call_sid,
        processed=False,
        client_id=_maybe_str(result.get("client_id")),
        call_id=_maybe_str(result.get("call_id")),
        created_lead=result.get("created_lead"),
        detail=reason,
    )


def _maybe_str(value) -> str | None:
    return None if value is None else str(value)
