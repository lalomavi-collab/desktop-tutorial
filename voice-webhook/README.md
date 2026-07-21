# LALUM Voice Call Webhook

Production FastAPI backend that ingests completed-call webhooks from the Voice
AI agent (LiveKit / Twilio), enriches them with Claude, and syncs the result to
Supabase in a single transaction.

## Flow

```
Voice AI agent  ──POST /webhook/livekit/ended──▶  FastAPI
                                                    │
                                    1. Claude 3.5 Sonnet extracts
                                       intent, summary, task, is_billable
                                                    │
                                    2. billing math (round up to 15 min)
                                                    │
                                    3. one transactional RPC writes:
                                       lalum_calls_meta
                                       lalum_crm_tasks
                                       lalum_billing_ledgers (if billable)
```

## Endpoints

| Method | Path                       | Purpose                                        |
| ------ | -------------------------- | ---------------------------------------------- |
| GET    | `/health`                  | Liveness probe                                 |
| POST   | `/webhook/livekit/ended`   | Ingest a completed call (native payload)       |
| POST   | `/webhook/vapi`            | Ingest a Vapi end-of-call report               |
| POST   | `/webhook/retell`          | Ingest a Retell call_ended webhook             |
| POST   | `/internal/retry?limit=50` | Reprocess calls stored with `is_processed=false` |

`/webhook/vapi` and `/webhook/retell` accept the hosted platform's own payload
shape and translate it (see `app/adapters.py`) into the same internal flow. They
ignore non-terminal events (mid-call status updates) with a 200. Set
`VOICE_WEBHOOK_SECRET` to require the platform to authenticate via the
`x-vapi-secret` / `x-webhook-secret` header. Agent setup lives in `agent/`
(`lalum_voice_agent.he.md`, `vapi_assistant.json`, `routing_setup.he.md`).

### `POST /webhook/livekit/ended`

Request body:

```json
{
  "call_sid": "CA_123",
  "caller_phone": "+972522490420",
  "duration_seconds": 905,
  "transcript": "full transcript text"
}
```

Response (processed):

```json
{
  "status": "processed",
  "call_sid": "CA_123",
  "processed": true,
  "client_id": "…",
  "call_id": "…",
  "created_lead": true,
  "is_billable": true,
  "billed_hours": 0.5,
  "amount": 450.0
}
```

## Data model

The live database keys registered clients (`lalum_profiles`) to auth users and
has no phone column, so inbound callers are matched and, when new, created as
**leads** in `lalum_contacts` (keyed by phone). The migration adds:

- `lalum_contacts`: phone-keyed contacts/leads, optional link to a profile.
- `lalum_calls_meta`: one row per call (transcript, summary, intent, flags).
- `lalum_crm_tasks`: one follow-up task per call, with a computed `due_date`.
- `lalum_billing_ledgers`: one billing line per billable call.
- `lalum_ingest_call(...)`: `security definer` function that does every write
  for a call atomically and is idempotent per `call_sid`.

Apply it with the SQL in
[`../supabase/migrations/0003_voice_call_sync.sql`](../supabase/migrations/0003_voice_call_sync.sql).

## Billing rule

Round call duration **up** to the nearest 15-minute block, price at the net
`STANDARD_HOURLY_RATE` (1,000 ILS), then add `BILLING_VAT_RATE` (18%). The
ledger stores net, VAT, and the gross total charged to the client.

| Duration | Billed hours | Net (₪) | VAT 18% (₪) | Gross (₪) |
| -------- | ------------ | ------- | ----------- | --------- |
| 10 s     | 0.25         | 250     | 45          | 295       |
| 900 s    | 0.25         | 250     | 45          | 295       |
| 905 s    | 0.50         | 500     | 90          | 590       |
| 3600 s   | 1.00         | 1000    | 180         | 1180      |

A duration of 0 bills nothing.

## Resiliency

If Claude is unreachable or returns an unusable payload, the raw call is still
written to `lalum_calls_meta` with `is_processed = false` and a
`process_error`, and the webhook returns `200`. `POST /internal/retry` (run it
from a cron / scheduler) re-runs those transcripts; because the ingest is
idempotent per `call_sid`, a successful retry upgrades the row in place without
duplicating its task or billing line.

## Run locally

```bash
cd voice-webhook
python -m venv .venv && source .venv/bin/activate
pip install -r requirements-dev.txt
cp .env.example .env   # fill in secrets

uvicorn app.main:app --reload
```

## Test

```bash
pip install -r requirements-dev.txt
pytest
```

Tests cover the billing rounding math and the webhook routing (billable,
non-billable, LLM-failure retry path, and payload validation), with the Claude
and Supabase calls faked so no network or secrets are needed.

## Configuration

All via environment variables (see `.env.example`): `SUPABASE_URL`,
`SUPABASE_SERVICE_ROLE_KEY`, `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL`,
`STANDARD_HOURLY_RATE`, `BILLING_CURRENCY`, `BILLING_INCREMENT_MINUTES`.
