# 06 — API Design

Two complementary surfaces:

1. **Data API (Supabase/PostgREST)** — direct, RLS-enforced CRUD from the client
   for standard reads/writes (feed, profiles, questions, etc.). Authorization is
   the RLS policy; the client cannot exceed its row permissions.
2. **Service API (Edge Functions / RPC)** — for privileged or multi-step
   operations that must not run client-side. Documented below.

## Conventions
- Transport: HTTPS, JSON. Auth: `Authorization: Bearer <jwt>`.
- Versioning: path prefix `/v1`.
- Tenant: resolved server-side from the JWT/profile; never trusted from the body.
- Errors: RFC-7807-style `{ "type", "title", "status", "detail", "code" }`.
- Idempotency: mutating service calls accept `Idempotency-Key` header.
- Pagination: cursor-based `?cursor=&limit=` returning `{ items, next_cursor }`.
- All write endpoints emit an `audit_logs` entry.

---

## A. Auth & Profile
Handled by Supabase Auth + Data API:
- `POST /auth/v1/signup`, `/token` (sign-in), `/recover` (reset) — Supabase.
- `GET/PATCH ldr_profiles` (self row via RLS).

## B. Verification (Service API) — doc 11
### `POST /v1/verification/submit`
```jsonc
// body
{ "full_name": "ישראל ישראלי", "license_no": "12345",
  "jurisdiction": "IL", "license_type": "lawyer" }
// 200
{ "status": "pending|verified",
  "match_result": "auto_matched|name_mismatch|not_found|suspended",
  "request_id": "uuid" }
```
- Server runs the registry match; only the server can set `verified`.
- Never returns *why* a name failed in a way that lets users brute-force names.

### `POST /v1/verification/review` *(platform_admin)*
```jsonc
{ "request_id": "uuid", "decision": "approve|reject", "reason": "..." }
```

### `POST /v1/admin/registry/ingest` *(platform_admin / scheduled)*
Triggers ingestion of a new Bar-registry snapshot into `bar_registry`.

## C. Knowledge (mostly Data API)
- `POST ldr_questions`, `POST ldr_answers`, `POST ldr_posts`.
- `POST /v1/questions/{id}/accept-answer` *(asker only)* — atomic: sets
  `accepted_answer_id`, writes `reputation_events`, recomputes `expertise_scores`.
- `POST ldr_post_likes` / `DELETE` — upvotes (RLS: one per user).

## D. Search (Service API)
### `GET /v1/search?q=&type=lawyers|knowledge|posts&filters=...`
- MVP: Postgres FTS + trigram + array filters.
- P2: `type=semantic` routes to vector search (doc 07), tenant-scoped.
- Results carry a `rank` blended with reputation/expertise weighting.

## E. Referrals (Service API for state transitions)
State machine is enforced server-side (never trust client status):
```
proposed ──accept──► in_progress ──all milestones released──► completed
   │                      │
   └──cancel──► cancelled └──open dispute──► disputed
```
### `POST /v1/referrals`
```jsonc
{ "provider_id":"uuid","jurisdiction":"DE","brief":"...",
  "fee":2000,"currency":"EUR",
  "milestones":[{"title":"Due diligence","amount":800}] }
```
- Server validates **fee-split legality** for `jurisdiction` (P2 rules engine).
  Unlawful split → `409 { code: "fee_split_not_permitted" }`.
### `POST /v1/referrals/{id}/accept` *(provider)*
### `POST /v1/referrals/{id}/milestones/{mid}/sign` *(party A or B)*
- Dual-signature gate: milestone `released` only when both signed; writes
  `referral_events`.
### `POST /v1/referrals/{id}/settle` *(P2)* — invokes PSP per fee-split terms.
### `POST /v1/referrals/{id}/dispute` *(either party, P2)* — freezes releases.

## F. Client Marketplace (P1)
- `POST /v1/client/needs` *(client_users)* — post a legal need.
- `GET /v1/client/needs/{id}/matches` — ranked attorney shortlist.
- `POST /v1/needs/{id}/quotes` *(verified attorney)* — submit a quote.

## G. AI (Service API) — doc 07
### `POST /v1/ai/summarize`
```jsonc
{ "source": { "kind":"document|thread", "id":"uuid" } }
// 200 → { "summary":"...", "citations":[{ "source_id","quote" }], "job_id":"uuid" }
```
### `POST /v1/ai/search` — semantic RAG over tenant-scoped knowledge.
### `POST /v1/ai/draft` *(P2)* — `{ "kind":"letter|clause|motion", "context":{...} }`.
### `POST /v1/ai/analyze-contract` *(P2)* — returns clause risk flags + diffs.
- All AI endpoints: enforce confidentiality policy, log to `ai_jobs`, return
  citations, and apply per-plan quotas (doc 09).

## H. Enterprise (P2)
- `POST /v1/firms/{id}/members` (invite), `PATCH .../roles` (RBAC),
  `GET /v1/firms/{id}/analytics`.

## I. Platform / Compliance
- `POST /v1/gdpr/export` / `POST /v1/gdpr/erase` — data-subject requests.
- `GET /v1/admin/audit?filters=...` *(platform_admin)* — read audit logs.

---

## Rate limiting & abuse
- Per-user and per-tenant token buckets at the gateway.
- Stricter limits on: verification submit (anti-enumeration), AI endpoints
  (cost), search, and quote submission (anti-spam).

## Webhooks (P2)
- Outbound: referral status changes, settlement events, verification decisions
  (for firm integrations). Signed payloads; retried with backoff.
