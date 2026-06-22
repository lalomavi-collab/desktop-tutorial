"""LDR Peer Room — the anonymous collaborative Decision Room.

This is the social heart of LDR: lawyers exchange tactical strategies and vote
on anonymized cases ("peer predictions"), flagging blind spots. The crowdsourced
signal here is what the AI Core learns from over time.

This skeleton uses an in-memory store. Production swaps `_STORE` for Postgres
(see k8s/postgres-statefulset.yaml) with row-level security; peers are identified
only by a salted, non-reversible hash.
"""
from __future__ import annotations

import hashlib
import os
from datetime import datetime, timezone
from typing import Optional

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field

app = FastAPI(title="LDR Peer Room", version="0.1.0")

# case_id -> {"case": {...}, "predictions": [...]}
_STORE: dict[str, dict] = {}

_PEER_SALT = os.environ.get("LDR_PEER_SALT", "dev-salt-change-me")


def hash_peer(peer_identity: str) -> str:
    return hashlib.sha256(f"{_PEER_SALT}:{peer_identity}".encode()).hexdigest()[:32]


class CaseIn(BaseModel):
    case_id: str
    legal_domain: str
    economic_exposure: str
    risk_factors: list[str] = Field(default_factory=list)
    proposed_strategy: Optional[str] = None


class PredictionIn(BaseModel):
    peer_identity: str = Field(description="Authenticated peer identity; hashed before storage.")
    success_probability: float = Field(ge=0, le=1)
    alternative_strategy: Optional[str] = Field(default=None, max_length=4000)
    flagged_blind_spots: list[str] = Field(default_factory=list)


@app.get("/healthz")
async def healthz() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/v1/cases")
async def open_case(case: CaseIn) -> dict:
    """Register an anonymized case so peers can review it."""
    _STORE.setdefault(case.case_id, {"case": case.model_dump(), "predictions": []})
    return {"case_id": case.case_id, "status": "open"}


@app.get("/v1/cases")
async def list_open_cases() -> list[dict]:
    """Browse anonymized cases awaiting peer review."""
    return [
        {**entry["case"], "prediction_count": len(entry["predictions"])}
        for entry in _STORE.values()
    ]


@app.post("/v1/cases/{case_id}/predictions")
async def submit_prediction(case_id: str, pred: PredictionIn) -> dict:
    entry = _STORE.get(case_id)
    if entry is None:
        raise HTTPException(status_code=404, detail="Unknown case_id")
    record = {
        "peer_id_hash": hash_peer(pred.peer_identity),
        "success_probability": pred.success_probability,
        "alternative_strategy": pred.alternative_strategy,
        "flagged_blind_spots": pred.flagged_blind_spots,
        "submitted_at": datetime.now(timezone.utc).isoformat(),
    }
    entry["predictions"].append(record)
    return {"case_id": case_id, "accepted": True, "total_predictions": len(entry["predictions"])}


@app.get("/v1/cases/{case_id}/consensus")
async def consensus(case_id: str) -> dict:
    """Aggregate peer wisdom for a case."""
    entry = _STORE.get(case_id)
    if entry is None:
        raise HTTPException(status_code=404, detail="Unknown case_id")
    preds = entry["predictions"]
    probs = [p["success_probability"] for p in preds]
    blind_spots: dict[str, int] = {}
    for p in preds:
        for b in p["flagged_blind_spots"]:
            blind_spots[b] = blind_spots.get(b, 0) + 1
    return {
        "case_id": case_id,
        "peer_count": len(preds),
        "mean_success_probability": (sum(probs) / len(probs)) if probs else None,
        "top_blind_spots": sorted(blind_spots.items(), key=lambda kv: kv[1], reverse=True),
    }
