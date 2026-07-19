# 04 — Database Schema

Target schema on **Postgres (Supabase)**. Builds on the existing pilot tables
(prefixed `ldr_`) and adds the domains required by the brief. Security model is
**Row-Level Security (RLS) on every table** — see doc 08 for policy patterns.

Conventions:
- `id uuid primary key default gen_random_uuid()` unless noted.
- `created_at timestamptz not null default now()`, `updated_at` maintained by trigger.
- Soft-delete via `deleted_at timestamptz` on user-content tables.
- `tenant_id uuid` on every multi-tenant table (NULL = global public tenant).
- Enums implemented as Postgres `enum` types or `text` + `check` for flexibility.

---

## A. Identity & Tenancy

### `tenants`
| column | type | notes |
|---|---|---|
| id | uuid PK | |
| kind | text | `global` \| `firm` |
| name | text | |
| created_at | timestamptz | |

### `ldr_profiles` (extends existing)
| column | type | notes |
|---|---|---|
| id | uuid PK | = `auth.users.id` |
| tenant_id | uuid FK→tenants | NULL = global |
| display_name | text | |
| avatar_url | text | |
| headline | text | |
| bio | text | |
| jurisdiction | text | primary jurisdiction |
| practice_areas | text[] | taxonomy keys |
| languages | text[] | ISO codes |
| experience_tier | enum | `junior`\|`mid`\|`senior` |
| license_type | enum | `lawyer`\|`intern` |
| license_no | text | |
| license_doc | text | storage path (private) |
| verification_status | enum | `unverified`\|`pending`\|`verified`\|`rejected` |
| reputation | int | denormalized score |
| contribution_count | int | |
| prediction_count | int | |
| is_admin | bool | platform trust team |
| lat / lng | float8 | map (nullable) |
| firm_id | uuid FK→tenants | if firm member |
| created_at / updated_at | | |

### `roles`, `user_roles` (RBAC — doc 08)
- `roles(id, key, description)` — e.g. `platform_admin`, `firm_admin`, `member`, `viewer`.
- `user_roles(user_id, role_id, tenant_id)` — role is scoped to a tenant.

---

## B. Verification (doc 11)

### `bar_registry` (ingested official source of truth)
| column | type | notes |
|---|---|---|
| id | uuid PK | |
| jurisdiction | text | e.g. `IL` |
| license_no | text | indexed |
| full_name | text | as published |
| name_normalized | text | normalized for matching (indexed) |
| status | text | `active`\|`suspended`\|`inactive` |
| license_year | int | |
| source_version | text | dataset snapshot id |
| ingested_at | timestamptz | |

Unique: `(jurisdiction, license_no)`. Index: `(jurisdiction, name_normalized)`.

### `verification_requests`
| column | type | notes |
|---|---|---|
| id | uuid PK | |
| user_id | uuid FK→profiles | |
| submitted_name | text | |
| submitted_license_no | text | |
| jurisdiction | text | |
| match_result | enum | `auto_matched`\|`name_mismatch`\|`not_found`\|`suspended`\|`manual_approved`\|`manual_rejected` |
| matched_registry_id | uuid FK→bar_registry | nullable |
| reviewer_id | uuid FK→profiles | nullable |
| reason | text | rejection/notes |
| created_at | timestamptz | |

---

## C. Knowledge Network

### `ldr_posts` (exists), `ldr_post_likes` (exists)
- `posts(id, tenant_id, author_id, body, created_at, deleted_at)`
- `post_likes(post_id, user_id)` unique pair.

### `ldr_questions`, `ldr_answers` (exist)
- `questions(id, tenant_id, author_id, title, body, practice_area, jurisdiction, accepted_answer_id, created_at)`
- `answers(id, question_id, author_id, body, created_at)` + `answer_votes(answer_id, user_id, value)`.

### `topics` / `post_topics` (P1 taxonomy)
- `topics(id, key, label, parent_id)` — practice-area ontology.
- Join tables tag posts/questions to topics.

### Knowledge libraries (P2)
- `documents(id, tenant_id, owner_id, kind, title, storage_path, visibility, created_at)` — `kind ∈ template|precedent|contract|caselaw`.
- `document_topics`, `document_versions` for versioning.

---

## D. Reputation & Badges

### `ldr_endorsements` (exists)
- `endorsements(endorser_id, endorsed_id)` unique pair → feeds reputation.

### `reputation_events` (P1 — auditable ledger)
| column | type | notes |
|---|---|---|
| id | uuid PK | |
| user_id | uuid FK | |
| kind | text | `answer_accepted`\|`endorsement`\|`referral_completed`\|`upvote`\|... |
| points | int | signed delta |
| ref_table / ref_id | text/uuid | source object |
| created_at | timestamptz | |

`reputation` on profile = materialized sum (trigger or scheduled rollup).

### `expertise_scores` (P1)
- `(user_id, practice_area, score)` — per-area expertise; powers Expert badges & matching.

### `ratings`
- `ratings(id, rater_id, ratee_id, context_table, context_id, stars, comment, created_at)` — e.g. rating a completed referral.

---

## E. Referral Marketplace

### `ldr_referrals` (extends existing)
| column | type | notes |
|---|---|---|
| id | uuid PK | |
| requester_id | uuid FK | |
| provider_id | uuid FK | |
| jurisdiction | text | |
| brief | text | anonymized |
| fee | numeric | nullable |
| currency | text | |
| status | enum | `proposed`\|`in_progress`\|`completed`\|`cancelled`\|`disputed` |
| milestones | jsonb | `[{id,title,amount,done,signed_a,signed_b,signed_at}]` |
| fee_split_pct | numeric | provider share (P2) |
| settlement_ref | text | PSP reference (P2) |
| created_at / updated_at | | |

### `ldr_connections` (exists) — professional connections
- `(requester_id, addressee_id, status)` — `pending|accepted`.

### `referral_events` — immutable lifecycle log (audit)
- `(id, referral_id, actor_id, event, payload jsonb, created_at)`.

---

## F. Client Marketplace (P1)

### `client_needs`
| column | type | notes |
|---|---|---|
| id | uuid PK | |
| client_id | uuid FK→client_users | |
| category | text | |
| jurisdiction | text | |
| budget_min / budget_max | numeric | |
| description | text | |
| status | enum | `open`\|`matched`\|`closed` |
| created_at | | |

### `client_users`, `matches`, `quotes`
- `client_users(id, email, name, verified_intent bool, created_at)` — separate from attorney `auth.users`.
- `matches(id, need_id, attorney_id, score, created_at)`.
- `quotes(id, need_id, attorney_id, amount, message, status, created_at)`.

---

## G. AI Layer (doc 07)

### `embeddings` (pgvector)
- `(id, tenant_id, source_table, source_id, chunk, embedding vector(N), created_at)` — index with `ivfflat`/`hnsw`. Tenant-scoped retrieval.

### `ai_jobs`
- `(id, tenant_id, user_id, kind, input_ref, status, output jsonb, model, tokens, created_at)` — every AI action logged for audit, billing, and quality.

---

## H. Platform / Compliance (doc 08)

### `audit_logs` (immutable, append-only)
- `(id, tenant_id, actor_id, action, target_table, target_id, ip, user_agent, payload jsonb, created_at)`. No update/delete grants; partitioned by month.

### `data_requests` (GDPR)
- `(id, subject_id, kind, status, created_at, completed_at)` — `kind ∈ export|erase`.

### `notifications`
- `(id, user_id, kind, payload jsonb, read_at, created_at)`.

---

## Entity-relationship overview
```
auth.users 1───1 ldr_profiles ─────┬──< user_roles >── roles
                  │                 │
                  │                 ├──< verification_requests >── bar_registry
                  │                 │
   posts >── post_likes            ├──< reputation_events
   questions >── answers >── votes  ├──< expertise_scores
                  │                 │
   ldr_referrals (requester/provider) ──< referral_events
   ldr_connections (req/addr)
   client_needs >── matches/quotes ── client_users
   embeddings / ai_jobs (tenant-scoped)
   audit_logs (append-only, all tenants)
```

## Indexing & performance notes
- Hot paths: feed (`posts` by `created_at`), search (GIN on `practice_areas`,
  trigram on names/titles), referral lists by participant.
- Reputation reads are denormalized onto `ldr_profiles` to avoid sums on render.
- `bar_registry` matching is index-backed on `(jurisdiction, license_no)` and
  `(jurisdiction, name_normalized)`.
- Vector search isolated per tenant via `tenant_id` filter + partitioned indexes.
