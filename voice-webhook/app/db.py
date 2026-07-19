"""Supabase integration.

All writes for a single call go through one Postgres function
(``lalum_ingest_call``) so the calls_meta / crm_tasks / billing_ledgers inserts
commit or roll back together. The function is invoked over PostgREST's RPC
endpoint with the service-role key.
"""
from __future__ import annotations

import logging
from typing import Any, Optional

import httpx

from .config import Settings

logger = logging.getLogger(__name__)


class SupabaseError(RuntimeError):
    """Raised when Supabase rejects a request or is unreachable."""


class SupabaseRepository:
    """Minimal PostgREST client scoped to the calls it needs to make."""

    def __init__(self, settings: Settings, client: httpx.AsyncClient | None = None):
        self._settings = settings
        self._owns_client = client is None
        self._client = client or httpx.AsyncClient(
            timeout=settings.http_timeout_seconds
        )

    @property
    def _headers(self) -> dict[str, str]:
        key = self._settings.supabase_service_role_key
        return {
            "apikey": key,
            "Authorization": f"Bearer {key}",
            "Content-Type": "application/json",
        }

    def _rpc_url(self, fn: str) -> str:
        base = self._settings.supabase_url.rstrip("/")
        return f"{base}/rest/v1/rpc/{fn}"

    async def ingest_call(
        self,
        *,
        call_sid: str,
        caller_phone: str,
        duration_seconds: int,
        transcript: str,
        summary: Optional[str],
        client_intent: Optional[str],
        is_billable: bool,
        is_processed: bool,
        process_error: Optional[str],
        task_title: Optional[str],
        task_priority: Optional[str],
        due_days_offset: Optional[int],
        billed_hours: Optional[float],
        hourly_rate: Optional[float],
        amount: Optional[float],
        currency: str,
    ) -> dict[str, Any]:
        """Run the transactional ingest function and return its JSON result.

        Works for both the happy path (processed=True, with task + billing) and
        the degraded path (processed=False), where the function only records the
        raw call so it can be retried later.
        """
        payload = {
            "p_call_sid": call_sid,
            "p_caller_phone": caller_phone,
            "p_duration_seconds": duration_seconds,
            "p_transcript": transcript,
            "p_summary": summary,
            "p_client_intent": client_intent,
            "p_is_billable": is_billable,
            "p_is_processed": is_processed,
            "p_process_error": process_error,
            "p_task_title": task_title,
            "p_task_priority": task_priority,
            "p_due_days_offset": due_days_offset,
            "p_billed_hours": billed_hours,
            "p_hourly_rate": hourly_rate,
            "p_amount": amount,
            "p_currency": currency,
        }
        return await self._rpc(self._settings.ingest_rpc, payload)

    async def fetch_unprocessed(self, limit: int = 50) -> list[dict[str, Any]]:
        """Return raw call rows still awaiting a successful LLM pass."""
        base = self._settings.supabase_url.rstrip("/")
        table = self._settings.unprocessed_view
        url = (
            f"{base}/rest/v1/{table}"
            f"?is_processed=eq.false&order=created_at.asc&limit={limit}"
        )
        try:
            resp = await self._client.get(url, headers=self._headers)
            resp.raise_for_status()
        except httpx.HTTPError as exc:
            raise SupabaseError(f"fetch_unprocessed failed: {exc}") from exc
        return resp.json()

    async def _rpc(self, fn: str, payload: dict[str, Any]) -> dict[str, Any]:
        url = self._rpc_url(fn)
        try:
            resp = await self._client.post(url, headers=self._headers, json=payload)
            resp.raise_for_status()
        except httpx.HTTPStatusError as exc:
            body = exc.response.text if exc.response is not None else ""
            raise SupabaseError(f"rpc {fn} failed: {exc} {body}") from exc
        except httpx.HTTPError as exc:
            raise SupabaseError(f"rpc {fn} failed: {exc}") from exc

        data = resp.json()
        # A jsonb-returning function comes back either as the object itself or
        # wrapped in a single-element list depending on PostgREST negotiation.
        if isinstance(data, list):
            return data[0] if data else {}
        return data or {}

    async def aclose(self) -> None:
        if self._owns_client:
            await self._client.aclose()
