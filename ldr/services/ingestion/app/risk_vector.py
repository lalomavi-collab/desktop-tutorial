"""Build the categorical Risk Vector from an anonymized case."""
from __future__ import annotations

from .models import LdrCase, RiskVector


def build_risk_vector(case: LdrCase) -> RiskVector:
    return RiskVector(
        case_id=case.case_id,
        legal_domain=case.legal_domain,
        economic_exposure=case.economic_exposure,
        risk_factors=case.risk_factors,
        factor_count=len(case.risk_factors),
    )
