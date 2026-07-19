# 05 — System Architecture

## 1. Principles
- **Trust-first, security-by-default**: RLS on every table; least privilege.
- **Multi-tenant from the schema up**, even while the pilot is single-tenant.
- **Boring, scalable core**: Postgres + a thin service layer; add complexity only
  when a metric demands it.
- **Stateless edges, stateful core**: all state in Postgres/Storage; compute is
  horizontally scalable and replaceable.

## 2. High-level diagram
```
            ┌──────────────────────────────────────────────┐
            │                 Clients                        │
            │  Web (React/Vite)   Mobile (P2)   Firm console │
            └───────────────┬──────────────────────────────┘
                            │ HTTPS / JWT
                ┌───────────▼───────────┐
                │   Edge / API Gateway   │  (Supabase Edge Functions /
                │  authn, rate-limit,    │   later a dedicated API service)
                │  tenant resolution     │
                └───────┬───────┬────────┘
        ┌───────────────┘       └────────────────┐
        ▼                                         ▼
┌────────────────┐                      ┌────────────────────┐
│ Postgres (RLS) │◄── Realtime ────────►│   AI Gateway        │
│ + pgvector     │                      │ (RAG, guardrails,   │
│ + audit (WORM) │                      │  model routing)     │
└──────┬─────────┘                      └─────────┬──────────┘
       │                                          │
       ▼                                          ▼
┌────────────┐   ┌─────────────┐        ┌──────────────────┐
│  Storage   │   │  Job queue  │        │  LLM providers    │
│ (private)  │   │ (async)     │        │  (Claude, etc.)   │
└────────────┘   └─────────────┘        └──────────────────┘
        │
        ▼
┌──────────────────────┐   ┌───────────────┐   ┌──────────────┐
│ External integrations │   │  PSP (escrow) │   │ Bar registry │
│ (email, search, geo)  │   │  settlement   │   │ ingestion    │
└──────────────────────┘   └───────────────┘   └──────────────┘
```

## 3. Component responsibilities

### 3.1 Clients
- **Web** (current `ldr/web`): React + Vite + TS. Talks to Supabase via the JS
  client (RLS-enforced) for CRUD, and to Edge Functions for privileged/complex
  operations (verification, AI, settlement).
- **Mobile** (P2): React Native sharing the API/types.
- **Firm console** (P2): same web app, enterprise routes gated by RBAC.

### 3.2 Edge / API Gateway
- Authenticates JWT (Supabase Auth).
- Resolves **tenant context** from the user's profile/roles and injects it.
- Rate limiting, request validation, idempotency keys for mutations.
- Hosts privileged operations that must not run client-side:
  - `verify-attorney` (registry match)
  - `ai/*` (model routing + guardrails)
  - `referrals/settle` (PSP)
  - `gdpr/export|erase`

### 3.3 Data tier — Postgres
- Single source of truth. **RLS** is the primary authorization boundary.
- `pgvector` for embeddings (tenant-scoped retrieval).
- **Audit logs** append-only (WORM): no UPDATE/DELETE grants, monthly partitions.
- Read replicas added when read load justifies (search, feed).

### 3.4 Realtime
- Supabase Realtime for live feed, notifications, referral status, presence (P2).

### 3.5 Job queue (async)
- For: registry ingestion, embedding generation, email/digest, AI batch jobs,
  reputation rollups. Start with Supabase scheduled functions / `pg_cron`;
  graduate to a dedicated queue (e.g. PGMQ or external) when volume requires.

### 3.6 AI Gateway (doc 07)
- All AI calls funnel through one service that enforces: tenant isolation,
  confidentiality policy, prompt templates, citation/grounding, logging to
  `ai_jobs`, and cost/quotas.

### 3.7 External integrations
- **Email** (transactional + digests), **Geo** (map tiles/geocoding),
  **Search** (Postgres FTS now; dedicated engine later if needed),
  **PSP** for real settlement, **Bar-registry** ingestion source.

## 4. Multi-tenancy model
- **Shared database, shared schema, tenant_id discriminator** + RLS. Simplest to
  operate; strong isolation enforced by policy, not just app code.
- Global public tenant (`tenant_id IS NULL`) hosts the open professional network.
- Firm tenants get private knowledge/analytics; members can still participate in
  the global network with their identity.
- Escalation path if a large enterprise demands physical isolation:
  schema-per-tenant or DB-per-tenant for that customer only (doc 10, P3).

## 5. Environments & delivery
- **Environments:** local → preview (per-PR, Vercel) → staging → production.
- **Frontend:** Vercel (current). **Backend:** Supabase project per environment.
- **Migrations:** versioned SQL in `supabase/migrations`, applied via CI.
- **Config:** public keys in client (RLS-protected); secrets in Edge Function
  env / secret manager — never in the bundle.

## 6. Observability
- Structured logs from Edge Functions; DB logs + slow-query monitoring.
- Product analytics events (privacy-respecting) for the north-star + funnels.
- Error tracking (frontend + functions). Uptime/synthetic checks on critical
  flows (login, verify, create referral).
- `audit_logs` for security/compliance (separate from product analytics).

## 7. Scalability strategy (in order, demand-driven)
1. Denormalize hot reads (reputation already on profile).
2. Add Postgres read replicas for feed/search.
3. Introduce a dedicated search engine if FTS ceilings are hit.
4. Move embeddings to a managed vector store if pgvector limits appear.
5. Extract high-traffic services (AI gateway, search) into their own deployables.
6. Per-tenant physical isolation only for enterprise customers that require it.

## 8. Failure & resilience
- Idempotent mutations (referral state transitions, settlement) keyed by request id.
- Escrow/settlement is a state machine with explicit, audited transitions;
  no money moves without a recorded dual signature + PSP confirmation.
- AI is non-critical-path: degrade gracefully (feature disabled, never blocks core).
- Backups: PITR on Postgres; storage versioning for legal documents.
