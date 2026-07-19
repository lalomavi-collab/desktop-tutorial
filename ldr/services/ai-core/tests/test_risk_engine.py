import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.risk_engine import assess  # noqa: E402


def test_score_rises_with_exposure():
    low = assess("Real_Estate_TAMA38", "under_1M", ["funding_gap"])
    high = assess("Real_Estate_TAMA38", "over_100M", ["funding_gap"])
    assert high["risk_score"] > low["risk_score"]


def test_listener_mode_has_no_recommendations(monkeypatch):
    monkeypatch.setenv("LDR_AI_MODE", "listener")
    out = assess("Commercial_Dispute", "5M_to_10M", ["valuation_dispute"])
    assert out["recommendations"] == []
    assert out["mode"] == "listener"


def test_suggester_mode_emits_recommendations(monkeypatch):
    monkeypatch.setenv("LDR_AI_MODE", "suggester")
    out = assess("Commercial_Dispute", "5M_to_10M", ["valuation_dispute", "funding_gap"])
    assert len(out["recommendations"]) >= 1
