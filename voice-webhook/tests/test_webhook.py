"""Webhook routing + orchestration tests (no network)."""
from tests.conftest import FakeExtractor, FakeRepo

ENDPOINT = "/webhook/livekit/ended"

VALID_PAYLOAD = {
    "call_sid": "CA_test_001",
    "caller_phone": "+972522490420",
    "duration_seconds": 905,
    "transcript": "Hello, I'd like advice on a shareholder dispute.",
}


def test_health(make_client):
    client = make_client(FakeExtractor(error="unused"), FakeRepo())
    resp = client.get("/health")
    assert resp.status_code == 200
    assert resp.json() == {"status": "ok"}


def test_billable_call_routes_task_and_billing(make_client, billable_extraction):
    extractor = FakeExtractor(result=billable_extraction)
    repo = FakeRepo()
    client = make_client(extractor, repo)

    resp = client.post(ENDPOINT, json=VALID_PAYLOAD)

    assert resp.status_code == 200
    body = resp.json()
    assert body["processed"] is True
    assert body["is_billable"] is True
    # 905s -> two 15-min blocks -> 0.5h * 900 = 450.
    assert body["billed_hours"] == 0.5
    assert body["amount"] == 450.0
    assert body["client_id"] == "contact-456"

    # The transcript was analysed and one transactional ingest was performed.
    assert extractor.calls == [VALID_PAYLOAD["transcript"]]
    assert len(repo.ingest_calls) == 1
    sent = repo.ingest_calls[0]
    assert sent["call_sid"] == "CA_test_001"
    assert sent["caller_phone"] == "+972522490420"
    assert sent["is_processed"] is True
    assert sent["client_intent"] == "Consultation"
    assert sent["task_title"] == "Send engagement letter"
    assert sent["task_priority"] == "High"
    assert sent["due_days_offset"] == 2
    assert sent["billed_hours"] == 0.5
    assert sent["amount"] == 450.0
    assert sent["hourly_rate"] == 900.0


def test_non_billable_call_has_no_billing(make_client, non_billable_extraction):
    extractor = FakeExtractor(result=non_billable_extraction)
    repo = FakeRepo()
    client = make_client(extractor, repo)

    resp = client.post(ENDPOINT, json=VALID_PAYLOAD)

    assert resp.status_code == 200
    body = resp.json()
    assert body["processed"] is True
    assert body["is_billable"] is False
    assert body["billed_hours"] is None
    assert body["amount"] is None

    sent = repo.ingest_calls[0]
    assert sent["is_billable"] is False
    assert sent["billed_hours"] is None
    assert sent["hourly_rate"] is None
    # A task is still created for a non-billable call.
    assert sent["task_title"] == "Confirm new meeting time"
    assert sent["is_processed"] is True


def test_llm_failure_stores_unprocessed(make_client):
    extractor = FakeExtractor(error="Claude timeout")
    repo = FakeRepo()
    client = make_client(extractor, repo)

    resp = client.post(ENDPOINT, json=VALID_PAYLOAD)

    # Caller still gets a 200 so the voice platform does not retry-storm us.
    assert resp.status_code == 200
    body = resp.json()
    assert body["processed"] is False
    assert body["status"] == "stored_unprocessed"
    assert "Claude timeout" in body["detail"]

    # The raw call is persisted for later retry, with no task/billing.
    sent = repo.ingest_calls[0]
    assert sent["is_processed"] is False
    assert sent["process_error"] == "Claude timeout"
    assert sent["summary"] is None
    assert sent["client_intent"] is None
    assert sent["task_title"] is None
    assert sent["billed_hours"] is None


def test_missing_field_is_rejected(make_client, billable_extraction):
    client = make_client(FakeExtractor(result=billable_extraction), FakeRepo())
    bad = dict(VALID_PAYLOAD)
    del bad["caller_phone"]
    resp = client.post(ENDPOINT, json=bad)
    assert resp.status_code == 422


def test_blank_call_sid_is_rejected(make_client, billable_extraction):
    client = make_client(FakeExtractor(result=billable_extraction), FakeRepo())
    bad = dict(VALID_PAYLOAD, call_sid="   ")
    resp = client.post(ENDPOINT, json=bad)
    assert resp.status_code == 422


def test_negative_duration_is_rejected(make_client, billable_extraction):
    client = make_client(FakeExtractor(result=billable_extraction), FakeRepo())
    bad = dict(VALID_PAYLOAD, duration_seconds=-5)
    resp = client.post(ENDPOINT, json=bad)
    assert resp.status_code == 422


def test_retry_reprocesses_unprocessed_rows(make_client, billable_extraction):
    unprocessed = [
        {
            "call_sid": "CA_old_1",
            "caller_phone": "+972500000001",
            "duration_seconds": 905,
            "transcript": "Old transcript needing a second pass.",
        }
    ]
    extractor = FakeExtractor(result=billable_extraction)
    repo = FakeRepo(unprocessed=unprocessed)
    client = make_client(extractor, repo)

    resp = client.post("/internal/retry")

    assert resp.status_code == 200
    body = resp.json()
    assert body["attempted"] == 1
    assert body["processed"] == 1
    assert body["still_unprocessed"] == 0
    # The stored transcript was re-analysed and re-ingested as processed.
    assert repo.ingest_calls[0]["call_sid"] == "CA_old_1"
    assert repo.ingest_calls[0]["is_processed"] is True
