# 08 — Security Architecture

Security is the product. For a legal network, a breach of confidentiality or a
fake "verified" attorney is existential. This document defines the controls.

## 1. Threat model (top risks)
1. **Impersonation** — someone poses as a licensed attorney. → Verification (doc 11), identity binding, re-verification.
2. **Confidentiality breach** — client-identifying or privileged data leaks. → Data minimization, tenant isolation, RLS, AI guardrails.
3. **Unauthorized access / privilege escalation** — cross-tenant or cross-user reads. → RLS + RBAC, server-side tenant resolution.
4. **Referral/settlement fraud** — fake completions, fee theft. → State machine, dual signatures, PSP, audit, dispute flow.
5. **Reputation gaming / Sybil** — fake accounts inflating scores. → Verification gate, anti-gaming signals, rate limits.
6. **Data-subject rights failure** — GDPR/Israeli PPL non-compliance. → DSAR tooling, retention policy, lawful basis.

## 2. Authentication
- Supabase Auth (email+password) now; **MFA** and **SSO/SAML/SCIM** for firms (P2).
- Short-lived JWTs; refresh rotation; secure, httpOnly storage where applicable.
- Password policy (min length, breach check), reset via verified email only.

## 3. Authorization — two layers

### 3.1 Row-Level Security (RLS) — primary boundary
Every table has RLS enabled. Authorization is enforced by the database, not just
app code, so a compromised client cannot exceed its permissions.

Policy patterns:
- **Self-only:** `user_id = auth.uid()` (e.g. own profile edits, own likes).
- **Tenant-scoped read:** `tenant_id = current_tenant() OR tenant_id IS NULL`
  (global public content readable; firm content only within the firm).
- **Verified-only participation:** writes to referrals/answers require the actor's
  profile `verification_status = 'verified'`.
- **Append-only audit:** `audit_logs` grants INSERT only; no UPDATE/DELETE to anyone.

### 3.2 RBAC — roles & permissions
- Roles: `platform_admin`, `trust_team`, `firm_admin`, `member`, `viewer`,
  `client`. Scoped per tenant via `user_roles(user_id, role_id, tenant_id)`.
- Privileged Service-API operations (verification review, registry ingest, audit
  read, firm management) check role server-side, independent of RLS.
- Principle of least privilege; admin actions are always audited.

## 4. Tenant isolation
- `tenant_id` discriminator + RLS (doc 05 §4). Tenant context is resolved
  server-side from the JWT/profile and **never** accepted from the request body.
- AI retrieval, search, and analytics all carry the tenant filter; cross-tenant
  retrieval is impossible by policy, not convention.

## 5. Attorney–client confidentiality (privilege)
- **Data minimization:** the platform never requires client-identifying data to
  function. Case validation uses **anonymized briefs**; referrals carry only what
  the referring attorney chooses to share.
- Knowledge sharing is designed around anonymized facts and legal questions.
- AI guardrails detect and contain client-identifying data (doc 07 §5–6).
- Documents are private by default in Storage (signed, time-limited URLs);
  sharing is explicit and revocable.

## 6. Audit & non-repudiation
- `audit_logs` is append-only (WORM), monthly-partitioned, covering: auth events,
  verification decisions, referral state transitions, settlement, role changes,
  data exports/erasure, admin actions.
- Referral milestones use **dual digital signatures** recorded immutably →
  non-repudiation for fee splits and completions.

## 7. Data protection
- **In transit:** TLS everywhere. **At rest:** managed encryption (Postgres +
  Storage). Secrets in a secret manager / Edge env, never in the client bundle.
- Backups: Postgres PITR; Storage versioning for legal documents. Restore tested.
- Key management via the platform provider's KMS; rotate on schedule.

## 8. Privacy & compliance (GDPR + Israeli PPL)
- **Lawful basis** documented per data category; consent where required.
- **DSAR tooling** (`data_requests`): export and erasure flows (doc 06 §I).
  Erasure honors legal-hold and audit-retention exceptions.
- **Retention policy** per data type (profiles, documents, AI inputs, audit).
- **Data residency:** EU/Israel region options for enterprise; documented sub-
  processors (LLM providers, PSP, email).
- **DPA** with sub-processors; LLM providers configured to not train on our data.

## 9. Application security
- Input validation + parameterized queries (no string-built SQL).
- Output encoding; CSP; anti-CSRF on cookie-based flows; SSRF protection on any
  server-side fetch (registry/AI).
- Rate limiting & idempotency (doc 06). Anti-enumeration on verification.
- Dependency scanning, secret scanning, SAST in CI; least-privilege CI tokens.

## 10. Operational security
- Environment separation (dev/staging/prod) with separate Supabase projects/keys.
- Access reviews for admin/trust roles; just-in-time elevation where possible.
- Incident response runbook: detect → contain → eradicate → notify (breach
  notification within statutory windows) → post-mortem.
- Pen-test before public launch and annually thereafter.

## 11. Trust & safety (anti-abuse)
- Verification gate as the first line against Sybil/impersonation.
- Moderation queue + reporting (P1); reputation penalties for confirmed abuse.
- Anomaly signals on referral/settlement and reputation events.
