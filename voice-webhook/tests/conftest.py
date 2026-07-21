"""Shared test fixtures: fakes for the extractor and Supabase repo so the
webhook tests exercise routing/orchestration without any network calls.
"""
from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from app.config import Settings
from app.deps import get_extractor, get_repo, get_settings_dep
from app.intent import ExtractionError
from app.main import app
from app.schemas import CallExtraction


class FakeExtractor:
    """Returns a canned extraction, or raises to simulate an LLM outage."""

    def __init__(self, result: CallExtraction | None = None, error: str | None = None):
        self.result = result
        self.error = error
        self.calls: list[str] = []

    async def extract(self, transcript: str) -> CallExtraction:
        self.calls.append(transcript)
        if self.error is not None:
            raise ExtractionError(self.error)
        assert self.result is not None
        return self.result


class FakeRepo:
    """Records ingest_call kwargs and returns a deterministic id set."""

    def __init__(self, unprocessed: list[dict] | None = None):
        self.ingest_calls: list[dict] = []
        self._unprocessed = unprocessed or []

    async def ingest_call(self, **kwargs):
        self.ingest_calls.append(kwargs)
        return {
            "call_id": "call-123",
            "client_id": "contact-456",
            "created_lead": True,
        }

    async def fetch_unprocessed(self, limit: int = 50):
        return self._unprocessed[:limit]


def _billable_extraction() -> CallExtraction:
    return CallExtraction.model_validate(
        {
            "client_intent": "Consultation",
            "summary": "Client asked about a shareholder dispute and next steps.",
            "suggested_task": {
                "title": "Send engagement letter",
                "priority": "High",
                "due_days_offset": 2,
            },
            "is_billable": True,
        }
    )


def _non_billable_extraction() -> CallExtraction:
    return CallExtraction.model_validate(
        {
            "client_intent": "Support",
            "summary": "Caller only wanted to reschedule an existing meeting.",
            "suggested_task": {
                "title": "Confirm new meeting time",
                "priority": "Low",
                "due_days_offset": 1,
            },
            "is_billable": False,
        }
    )


@pytest.fixture
def settings() -> Settings:
    return Settings(
        STANDARD_HOURLY_RATE=1000.0,
        BILLING_VAT_RATE=0.18,
        BILLING_CURRENCY="ILS",
        BILLING_INCREMENT_MINUTES=15,
    )


@pytest.fixture
def make_client(settings):
    """Build a TestClient wired to the given extractor + repo fakes."""

    def _make(extractor: FakeExtractor, repo: FakeRepo) -> TestClient:
        app.dependency_overrides[get_extractor] = lambda: extractor
        app.dependency_overrides[get_repo] = lambda: repo
        app.dependency_overrides[get_settings_dep] = lambda: settings
        return TestClient(app)

    yield _make
    app.dependency_overrides.clear()


@pytest.fixture
def billable_extraction() -> CallExtraction:
    return _billable_extraction()


@pytest.fixture
def non_billable_extraction() -> CallExtraction:
    return _non_billable_extraction()
