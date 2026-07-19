"""Tests for the ingestion service: PII tripwire + risk vector."""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.models import LdrCase  # noqa: E402
from app.pii_tripwire import scan_for_pii  # noqa: E402
from app.risk_vector import build_risk_vector  # noqa: E402


def _clean_case() -> LdrCase:
    return LdrCase(
        case_id="11111111-1111-4111-8111-111111111111",
        legal_domain="Real_Estate_TAMA38",
        economic_exposure="10M_to_15M",
        risk_factors=["regulatory_delay", "funding_gap"],
        proposed_strategy="Negotiate with [PARCEL] holders; phase the permit risk.",
    )


def test_clean_case_passes_tripwire():
    assert scan_for_pii(_clean_case().proposed_strategy) == []


def test_tripwire_catches_raw_id_and_email():
    assert "israeli_id" in scan_for_pii("client 123456789 lives there")
    assert "email" in scan_for_pii("contact a@b.com")


def test_risk_vector_counts_factors():
    vector = build_risk_vector(_clean_case())
    assert vector.factor_count == 2
    assert vector.legal_domain.value == "Real_Estate_TAMA38"
