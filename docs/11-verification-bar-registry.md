# 11 — Bar-Registry Verification ("verified" that is 100% true)

This is the design that lets us *honestly* claim "verified attorney". It replaces
the old format-only check (any 5–6 digit number → verified) with a real match
against the official Israel Bar Association registry, with a manual-review
fallback for anything not 100% certain.

## 1. Principle
We grant the **✓ verified** badge only when we can confirm, against an
authoritative source, that the submitted **name + license number** belong to an
**active** licensed attorney. Anything less → `pending` → human review. We never
auto-pass a mismatch.

## 2. Source of truth
The Israel Bar Association publishes its members list (the "ספר עורכי הדין")
as a public, periodically-updated dataset, plus a public search form. There is
**no clean real-time API**, so we **ingest snapshots** of the official dataset
into our own `bar_registry` table and match against it.

> Reality check: the open-data portal blocks automated fetch and the primary
> distribution is a periodic file (PDF/dataset). So ingestion is a **batch**
> process (operator-assisted import of the official snapshot), not a live API
> call. This is deliberate — we control data quality and never depend on a
> fragile live scrape.

## 3. Data model (see doc 04 §B)
- `bar_registry(jurisdiction, license_no, full_name, name_normalized, status,
  license_year, source_version, ingested_at)` — unique `(jurisdiction, license_no)`.
- `verification_requests(...)` — records every submission, the match result, and
  any reviewer decision (full audit).

## 4. Matching algorithm
Given `(jurisdiction, license_no, submitted_name)`:

1. **Lookup** by `(jurisdiction, license_no)` in `bar_registry`.
   - Not found → `not_found` → **pending** (manual review).
2. **Status check**: if found but `status != 'active'` → `suspended` →
   **pending** (manual review; never auto-verify a suspended/inactive license).
3. **Name match**: normalize both names (see §5) and compare.
   - Exact normalized match → `auto_matched` → **verified**.
   - High-similarity (above threshold, e.g. token-set ratio ≥ 0.92) but not exact
     → `name_mismatch` → **pending** with the candidate attached for fast review.
   - Low similarity → `name_mismatch` → **pending**.
4. Write the outcome to `verification_requests` and (only on `auto_matched`) set
   `ldr_profiles.verification_status = 'verified'`.

**Only the server (Edge Function with service role) can set `verified`.** The
client can never self-verify (enforced by RLS: clients may set status to
`pending` at most).

## 5. Name normalization (Hebrew-aware)
To match real-world name variants safely:
- Trim, collapse whitespace, lowercase (for Latin), strip honorifics
  (עו״ד / עוה״ד / advocate / adv.).
- Normalize Hebrew finals (ם→מ, ן→נ, ץ→צ, ף→פ, ך→כ) and remove niqqud/punctuation.
- Remove geresh/gershayim and quotation marks.
- Compare as a **token set** (order-independent) so "ישראל ישראלי" matches
  "ישראלי ישראל". Exact token-set equality → auto; near → review.

Conservative by design: when in doubt, route to a human. False "verified" is
unacceptable; a slightly slower onboarding is fine.

## 6. Anti-abuse
- **Rate-limit** verification submissions per user/IP to prevent name/number
  enumeration against the registry.
- Do not reveal *which* field failed in a way that enables brute-forcing a name
  for a given license number.
- Log every attempt to `verification_requests` + `audit_logs`.

## 7. Ingestion pipeline
1. Operator obtains the latest official snapshot (dataset/PDF) — manual step,
   because the source is not a live API.
2. Convert to normalized rows (license_no, full_name, status, year).
3. `POST /v1/admin/registry/ingest` (or scheduled job) upserts into `bar_registry`
   with a new `source_version`; computes `name_normalized`.
4. Re-evaluate any `pending` requests that now find an active exact match
   (optional auto-resolve on re-ingest).
- Cadence: re-ingest on each official publication; track `source_version` for
  auditability ("verified against snapshot X").

## 8. Multi-jurisdiction (P3)
The same model generalizes: one `bar_registry` keyed by `jurisdiction`, with a
per-jurisdiction **ingestion adapter** and possibly per-jurisdiction
normalization rules. Verification logic is jurisdiction-parameterized.

## 9. Honesty guarantees (what we can claim)
- "Every verified member matched an active license in the official Bar registry
  (snapshot `source_version`)" — **true**.
- We do **not** claim real-time verification (the source isn't real-time).
- We do **not** auto-verify mismatches, suspended, or not-found licenses.

## 10. Scaffold in this repo
- `supabase/migrations/0001_bar_registry.sql` — tables + RLS + indexes.
- `supabase/functions/_shared/normalize.ts` — Hebrew-aware name normalization.
- `supabase/functions/verify-attorney/index.ts` — the matching Edge Function
  (service role; the only path that can set `verified`).

These are starting points wired to the schema above; the live ingestion step
(obtaining and importing the official snapshot) is operational and documented in
§7.
