"""LDR AI Core Service — Risk Score + recommendations. Stateless (Deployment + HPA)."""
from __future__ import annotations

from typing import Optional

from fastapi import FastAPI
from pydantic import BaseModel, Field

from .risk_engine import assess, current_mode

app = FastAPI(title="LDR AI Core", version="0.1.0")


class CaseIn(BaseModel):
    case_id: str
    legal_domain: str
    economic_exposure: str
    risk_factors: list[str] = Field(default_factory=list)
    proposed_strategy: Optional[str] = None
    peer_predictions: list[dict] = Field(default_factory=list)


@app.get("/healthz")
async def healthz() -> dict[str, str]:
    return {"status": "ok", "mode": current_mode()}


@app.post("/v1/cases")
async def score_case(case: CaseIn) -> dict:
    peer_probs = [
        p["success_probability"]
        for p in case.peer_predictions
        if "success_probability" in p
    ]
    insights = assess(
        case.legal_domain,
        case.economic_exposure,
        case.risk_factors,
        peer_success_probabilities=peer_probs,
    )
    return {"case_id": case.case_id, "ai_insights": insights}
