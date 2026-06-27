# 07 — AI Architecture

AI is a **central layer**, not a bolt-on — but it is always **non-critical-path**
(if AI is down, the core network still works) and always **confidentiality-safe**.

## 1. Design tenets
1. **Grounded & cited.** Legal answers/summaries must cite their sources
   (in-platform knowledge, the user's own documents). No ungrounded claims.
2. **Assistive, never advice.** Output is labeled as drafting/aid; the attorney
   remains the professional of record.
3. **Confidentiality by construction.** Client-identifying data never crosses the
   tenant boundary. Shared context is opt-in per document.
4. **Auditable.** Every AI action is logged (`ai_jobs`): input ref, model,
   tokens, output, user, tenant. For billing, quality, and compliance.
5. **Model-agnostic routing.** A gateway abstracts providers; default to the most
   capable current Claude models, route by task/cost/latency.

## 2. The AI Gateway
A single service all AI traffic flows through:
```
client → /v1/ai/* → [AI Gateway]
                       ├─ authn + tenant resolution
                       ├─ confidentiality policy (PII/client-data handling)
                       ├─ prompt assembly (templates + retrieved context)
                       ├─ model router (task → model, fallback)
                       ├─ guardrails (input/output filtering, citation check)
                       ├─ quota/cost enforcement (per plan, doc 09)
                       └─ logging → ai_jobs
                     → LLM provider(s)
```
Why a gateway: one place to enforce privacy, swap models, control cost, and keep
a complete audit trail.

## 3. Retrieval-Augmented Generation (RAG)
- **Ingestion:** documents/threads chunked → embedded → stored in `embeddings`
  (pgvector) with `tenant_id`, `source_table`, `source_id`.
- **Retrieval:** query embedded → vector search **filtered by tenant** → top-k
  chunks → assembled into the prompt with source metadata.
- **Citation:** the model is required to attribute statements to retrieved
  chunks; a post-step verifies cited chunk ids exist (drops uncited claims).
- **Isolation:** retrieval never crosses tenants. Global-tenant knowledge is
  retrievable by all; firm-tenant knowledge only within that firm.

## 4. Capabilities (phased)
| Capability | Phase | Notes |
|---|---|---|
| Document summarization | P1 | grounded, cited |
| Thread/discussion summarization | P1 | feed/Q&A digests |
| Smart search (semantic RAG) | P1 | `/v1/ai/search`, `/v1/search?type=semantic` |
| Expert finder | P1 | match question → specialist via embeddings + expertise_scores |
| Draft generation | P2 | letters, clauses, motions — editable artifacts |
| Contract analysis | P2 | clause extraction, risk flags, redline diff |
| Grounded legal Q&A assistant | P2 | cites in-platform + (later) licensed sources |
| Agentic workflows | P3 | multi-step, tool-using; human-in-the-loop checkpoints |

## 5. Guardrails
- **Input:** strip/parameterize secrets; detect client-identifying data and apply
  policy (warn/redact/keep-in-tenant) before any external call.
- **Output:** citation enforcement; jurisdiction-aware disclaimers; refusal on
  requests for unauthorized practice or to fabricate authority.
- **Hallucination control:** prefer "insufficient grounded sources" over guessing;
  surface confidence + sources to the user.
- **Prompt-injection defense:** treat retrieved/document content as untrusted;
  never let it override system policy or trigger tool calls without checks.

## 6. Data handling & privacy
- Default: AI requests run within the tenant boundary; document content is sent
  to the model provider only for that request and not used for provider training
  (enforce via provider settings/contract).
- Opt-in shared context: a user may expose a document to the global knowledge base
  for community RAG — explicit, revocable, audited.
- `ai_jobs` retains metadata + output; raw inputs follow the document's retention
  and GDPR rules (doc 08).

## 7. Evaluation & quality
- Golden-set evals per capability (summarization faithfulness, citation accuracy,
  expert-match precision@k).
- Human feedback loop: thumbs + correction capture → eval set growth.
- Regression gate in CI before changing models/prompts.

## 8. Cost & quotas
- Per-plan token/credit quotas enforced at the gateway (doc 09: AI subscription).
- Cheap-vs-quality routing: small models for tagging/classification, top models
  for drafting/analysis. Cache embeddings and frequent summaries.
