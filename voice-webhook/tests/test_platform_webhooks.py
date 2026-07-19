"""Tests for the Vapi/Retell adapters and their webhook endpoints."""
from app.adapters import parse_retell, parse_vapi
from app.config import Settings
from app.deps import get_settings_dep
from app.main import app
from tests.conftest import FakeExtractor, FakeRepo

VAPI_EOC = {
    "message": {
        "type": "end-of-call-report",
        "durationSeconds": 905,
        "customer": {"number": "+972522490420"},
        "call": {"id": "vapi-call-1"},
        "artifact": {"transcript": "User: I need advice on a shareholder dispute."},
        "analysis": {"summary": "Client asked about a dispute."},
    }
}

RETELL_ENDED = {
    "event": "call_ended",
    "call": {
        "call_id": "retell-1",
        "from_number": "+972500000001",
        "transcript": "User: advice on a dispute please.",
        "duration_ms": 905000,
    },
}


# ── adapter unit tests ────────────────────────────────────────────────────
def test_parse_vapi_end_of_call():
    w = parse_vapi(VAPI_EOC)
    assert w is not None
    assert w.call_sid == "vapi-call-1"
    assert w.caller_phone == "+972522490420"
    assert w.duration_seconds == 905
    assert "dispute" in w.transcript


def test_parse_vapi_ignores_status_update():
    assert parse_vapi({"message": {"type": "status-update"}}) is None


def test_parse_vapi_duration_from_timestamps():
    payload = {
        "message": {
            "type": "end-of-call-report",
            "startedAt": 1000, "endedAt": 1000 + 905000,
            "customer": {"number": "+972"}, "call": {"id": "x"},
            "artifact": {"transcript": "hi"},
        }
    }
    w = parse_vapi(payload)
    assert w.duration_seconds == 905


def test_parse_retell_call_ended():
    w = parse_retell(RETELL_ENDED)
    assert w is not None
    assert w.call_sid == "retell-1"
    assert w.caller_phone == "+972500000001"
    assert w.duration_seconds == 905


def test_parse_retell_ignores_call_started():
    assert parse_retell({"event": "call_started", "call": {}}) is None


# ── endpoint tests ────────────────────────────────────────────────────────
def test_vapi_endpoint_processes_billable(make_client, billable_extraction):
    repo = FakeRepo()
    client = make_client(FakeExtractor(result=billable_extraction), repo)
    resp = client.post("/webhook/vapi", json=VAPI_EOC)
    assert resp.status_code == 200
    body = resp.json()
    assert body["processed"] is True
    assert body["amount"] == 590.0            # 0.5h * 1000 + 18% VAT
    assert repo.ingest_calls[0]["call_sid"] == "vapi-call-1"


def test_vapi_endpoint_ignores_non_terminal_event(make_client, billable_extraction):
    repo = FakeRepo()
    client = make_client(FakeExtractor(result=billable_extraction), repo)
    resp = client.post("/webhook/vapi", json={"message": {"type": "status-update"}})
    assert resp.status_code == 200
    assert resp.json()["status"] == "ignored"
    assert repo.ingest_calls == []            # nothing processed


def test_retell_endpoint_processes(make_client, billable_extraction):
    repo = FakeRepo()
    client = make_client(FakeExtractor(result=billable_extraction), repo)
    resp = client.post("/webhook/retell", json=RETELL_ENDED)
    assert resp.status_code == 200
    assert resp.json()["processed"] is True
    assert repo.ingest_calls[0]["call_sid"] == "retell-1"


def test_webhook_secret_is_enforced(make_client, billable_extraction):
    client = make_client(FakeExtractor(result=billable_extraction), FakeRepo())
    # Re-point settings to one that requires a secret.
    secret_settings = Settings(
        STANDARD_HOURLY_RATE=1000.0, BILLING_VAT_RATE=0.18,
        VOICE_WEBHOOK_SECRET="s3cret",
    )
    app.dependency_overrides[get_settings_dep] = lambda: secret_settings

    # Missing secret -> 401.
    resp = client.post("/webhook/vapi", json=VAPI_EOC)
    assert resp.status_code == 401

    # Correct secret -> processed.
    resp = client.post(
        "/webhook/vapi", json=VAPI_EOC, headers={"x-vapi-secret": "s3cret"}
    )
    assert resp.status_code == 200
    assert resp.json()["processed"] is True
