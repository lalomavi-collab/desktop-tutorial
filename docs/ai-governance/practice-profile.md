<!-- SETUP PAUSED AT: Part 4 governance and escalation — run /ai-governance-legal:cold-start-interview to resume -->
# AI Governance Practice Profile

*Partial, written 2026-10-18. Edit this file directly.*

## Who's using this
Lawyer (Dr. Avraham Lalum, Adv., Notary). Practice setting: boutique law firm (partners and a small team), Israel.

## Company profile
LALUM & Co. Law firm plus a legal-AI platform (LALUM Legal Engine). Two focus areas: real estate and urban renewal (Israel and abroad), and AI.
**AI role:** Both builder and deployer. Per-system roles are recorded in ai-systems.yaml (EU AI Act roles are per system).
**Regulatory footprint:** Israeli Privacy Protection Law (Amendment 13) [verify against current law]. EU AI Act only if EU users are exposed: stated as mostly Israel, possibly a few EU users. [PENDING: confirm nexus per system]
**Users:** website visitors and clients, and the partners and team (internal cockpit).

## Inventory
14 systems found by code scan (see ai-systems.yaml once written). System 1 CONFIRMED 2026-10-18: provider, limited risk. Gaps: no AI disclosure in the chat; no written AI policy.

## Use case registry
*From interview 2026-10-18. Stated positions, not a formally reviewed policy (no written AI policy exists). Treat as starting points.*

| Use case | Position | Conditions / reason |
|---|---|---|
| AI drafts first version of an agreement or opinion | Conditional | A lawyer reviews and approves before anything goes to a client. Full human review. |
| Client agreement text pasted into an external AI tool | Conditional | Only through pii-gateway (PII redaction). Without redaction: Never. [verify against current Israeli law] |
| job_agent (applications in the owner's name) | Conditional | Human approval before each submission. |
| daily-audit-automerge (automatic merge) | Conditional | Only when the build passes, on a restricted branch. Never for legal text, sources, or ruling verification. |
| Avatar video simulating the owner (Synthesia) | Conditional | Conspicuous disclosure that it is synthetic; only owner-approved content. [verify against current AI Act text, Art. 50] |
| AI makes a final decision on a matter, client or candidate with no human | Never | Professional responsibility cannot be delegated. |

### Red lines
- Client document or data reaches an AI vendor without redaction or a contractual basis.
- AI-generated citation of a ruling or statute published without verification against the source (standing project rule: two independent sources).
- Storing the content of client chat conversations.

### Governance tiers
| Tier | Approval | Examples |
|---|---|---|
| Standard | Owner | Internal productivity tools, assistive drafting |
| Elevated | Owner after privacy review | Client-facing AI, client data |
| High | Owner with outside counsel | Automated decisions, biometric, new AI product |
[PENDING: confirm tiers fit the team; owner approved the proposal on 2026-10-18]

## Impact assessment house style / vendor AI positions / policy commitments / escalation / seed documents
[PENDING]
