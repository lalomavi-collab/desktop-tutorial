"""LDR Ingestion Service.

Receives the already-anonymized LdrCase from the client, runs the PII tripwire,
builds a Risk Vector, and forwards it to the peer-room and ai-core services.
This service is stateless and horizontally scalable (Deployment + HPA).
"""
from __future__ import annotations

import logging
import os

import httpx
from fastapi import FastAPI, HTTPException

from .models import LdrCase, RiskVector
from .pii_tripwire import scan_for_pii
from .risk_vector import build_risk_vector

logger = logging.getLogger("ldr.ingestion")

AI_CORE_URL = os.environ.get("AI_CORE_URL", "http://ai-core:8080")
PEER_ROOM_URL = os.environ.get("PEER_ROOM_URL", "http://peer-room:8080")

app = FastAPI(title="LDR Ingestion Service", version="0.1.0")


@app.get("/healthz")
async def healthz() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/v1/cases", response_model=RiskVector)
async def ingest_case(case: LdrCase) -> RiskVector:
    """Ingest an anonymized case and fan it out to peer-room + ai-core."""
    # Defense-in-depth: reject anything that still smells like raw PII.
    hits = scan_for_pii(case.proposed_strategy)
    if hits:
        logger.warning("PII tripwire fired for case %s: %s", case.case_id, hits)
        raise HTTPException(
            status_code=422,
            detail=f"Payload appears to contain raw identifiers ({', '.join(hits)}). "
            "Anonymization must complete on the client before ingestion.",
        )

    vector = build_risk_vector(case)

    # Fan-out (best-effort; failures are logged, not fatal, in this skeleton).
    async with httpx.AsyncClient(timeout=5.0) as client:
        for name, url in (("ai-core", AI_CORE_URL), ("peer-room", PEER_ROOM_URL)):
            try:
                await client.post(f"{url}/v1/cases", json=case.model_dump(mode="json"))
            except httpx.HTTPError as exc:  # pragma: no cover - network skeleton
                logger.error("Failed to forward case %s to %s: %s", case.case_id, name, exc)

    return vector
