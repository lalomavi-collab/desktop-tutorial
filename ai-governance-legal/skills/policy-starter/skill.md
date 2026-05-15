# Skill: policy-starter

## Purpose

Draft a firm AI usage policy adapted to the organization's practice profile, drawing from published model policies (ABA, state bars, ILTA, CLOC, NIST AI RMF, EU AI Act, peer firm policies). Output is a full first-draft policy — not a finished policy. Every output is a privileged draft for attorney review.

---

## Invocation

```
/ai-governance-legal:policy-starter
```

---

## Instructions

You are assisting an attorney in drafting an AI usage policy for their organization. Read the practice profile at `~/.claude/plugins/config/claude-for-legal/ai-governance-legal/CLAUDE.md` before starting. If no profile exists, say: "No practice profile found. I'll generate a general-purpose AI usage policy. For a policy tailored to your organization, run /ai-governance-legal:cold-start-interview first."

Before drafting, ask:
1. Is this policy for internal use by employees, or does it also govern client-facing AI tools?
2. Is there an existing policy you want to replace or expand? (If yes, read it.)
3. Are there any specific topics the policy must address? (e.g., generative AI, AI in client work, vendor tools only)

---

### Research sources (cite all with [RESEARCH])

Draw from the following when drafting. Tag all references [RESEARCH] — these are training-data citations and must be independently verified:

- ABA Formal Opinion 512 (Generative AI) and prior AI opinions
- State bar AI opinions and ethics guidance (generically — verify current guidance for applicable jurisdictions)
- ILTA Generative AI Guidance and Model Policy Framework
- CLOC AI Usage Guidelines
- NIST AI Risk Management Framework (AI 100-1) — governance and risk management concepts
- EU AI Act — deployer obligations (Articles 26, 50, and related recitals) where applicable [STATUTE]
- Published peer organization/firm AI usage policies (generically — describe common provisions without naming specific organizations)
- EEOC, FTC, and CFPB guidance on AI fairness and consumer protection where applicable [GUIDANCE]

---

### Policy structure

Draft the policy with the following sections. Adapt section content to the practice profile — where profile positions are defined, use them. Where gaps exist, flag attorney decision points inline with `[ATTORNEY DECISION REQUIRED: ...]`.

---

#### Section 1 — Purpose and scope

- State the purpose: responsible, effective, and compliant use of AI tools
- Define who the policy applies to (employees, contractors, secondees, law firm: lawyers and staff)
- Define what AI systems are covered: all AI tools used for organizational work, including generative AI, decision-support systems, and AI-powered vendor tools
- State what is out of scope (e.g., personal use on personal devices unrelated to work)

Note: If the organization is both a builder and deployer per the practice profile, the policy should address both roles. Flag this if applicable.

#### Section 2 — Definitions

Define at minimum:
- Artificial Intelligence (AI) system
- Generative AI
- High-risk AI system (per applicable regulation — [STATUTE] if EU AI Act applies)
- Automated decision-making
- Personal data / special-category data (cross-reference privacy policy)
- Approved AI tool
- Human oversight

Draft definitions should be consistent with applicable regulations. Flag where definitions may need alignment with regulatory definitions: `[ATTORNEY DECISION REQUIRED: align with regulatory definition in [jurisdiction]]`

#### Section 3 — Approved and prohibited uses

**Approved uses:**
- List use cases from the practice profile's approved registry [POLICY]
- Add common approved uses based on practice profile context (e.g., drafting assistance, research summarization, document review support) — flag each as `[ATTORNEY DECISION REQUIRED: confirm approved]` if not in registry

**Prohibited uses (red lines):**
- List all red lines from the practice profile [POLICY]
- Add standard prohibitions drawn from model policies [RESEARCH], such as:
  - Using AI to generate false statements of fact in court filings or client communications
  - Using AI to make fully automated decisions on matters affecting individual legal rights without human review
  - Inputting confidential client data into non-approved AI tools
  - Using AI to bypass conflict checks, privilege analysis, or professional responsibility rules
- Flag any prohibition that requires an attorney decision about scope: `[ATTORNEY DECISION REQUIRED: define scope of prohibition]`

#### Section 4 — Human oversight requirements

- State the general principle: AI outputs require human review before use in client work, filings, communications, or decisions affecting individuals
- Specify oversight requirements by use case tier (adapt from practice profile risk tiers):
  - Critical: senior attorney review, documented sign-off required
  - High: attorney review required; no self-service use
  - Medium: professional review required; spot-check audits
  - Low: user review sufficient; standard quality control
- Address duty of competence: attorneys using AI must understand the tool's capabilities and limitations [RESEARCH — ABA Model Rules 1.1 comment 8 re: technology]
- `[ATTORNEY DECISION REQUIRED: specify what "meaningful human review" means for your practice]`

#### Section 5 — Data handling and confidentiality

- Prohibit inputting client confidential information, attorney-client privileged communications, or work product into non-approved AI tools
- Require DPA or equivalent before using any AI tool that processes personal data
- Require disclosure review before inputting any matter-specific information into AI tools
- Cross-reference: data classification policy, privacy policy, conflict of interest policy
- For law firms: address professional responsibility obligations regarding confidentiality (Model Rule 1.6 equivalent) [RESEARCH]
- `[ATTORNEY DECISION REQUIRED: define approved tools list and data classification thresholds]`

#### Section 6 — Vendor and third-party AI tools

- Require legal review before onboarding any AI vendor that: processes personal data, accesses internal systems, or makes or informs consequential decisions
- Require DPA/data processing terms for all AI vendors processing personal data
- Prohibit training-on-data provisions without explicit approval
- Require vendor AI agreements to include: audit rights, incident notification, model change notice, and data deletion on termination [POLICY — from practice profile vendor positions]
- Reference: /ai-governance-legal:vendor-ai-review for contract review workflow
- `[ATTORNEY DECISION REQUIRED: define approval threshold and who approves vendor AI tools]`

#### Section 7 — Incident and error reporting

- Define what constitutes an AI incident: material error, bias event, unexpected output, data exposure, vendor breach affecting AI systems
- Require reporting to [role — e.g., General Counsel / AI Governance Lead] within [timeframe]
- Require documentation of significant AI errors, even if not client-facing
- Address client notification obligations if AI-assisted work contains material errors [RESEARCH — professional responsibility obligations vary by jurisdiction]
- `[ATTORNEY DECISION REQUIRED: set reporting timeframe and escalation path]`

#### Section 8 — Training requirements

- Require baseline AI literacy training for all staff using AI tools
- Require advanced training for attorneys using AI in client-facing work
- Require refresher training when: new tools are onboarded, significant regulatory changes occur, or material AI incidents are identified
- `[ATTORNEY DECISION REQUIRED: specify training provider, frequency, and documentation requirements]`

#### Section 9 — Governance and accountability

- Name the governance owner (e.g., General Counsel, AI Governance Committee)
- Describe the use case approval process — reference /ai-governance-legal:use-case-triage and /ai-governance-legal:aia-generation
- Describe the escalation path (from practice profile escalation triggers [POLICY])
- State accountability: individuals are responsible for AI outputs they submit or rely on
- `[ATTORNEY DECISION REQUIRED: confirm governance owner and committee structure]`

#### Section 10 — Compliance and enforcement

- State consequences for policy violations
- Note that violations may also implicate professional responsibility rules, regulatory obligations, or client contractual commitments
- `[ATTORNEY DECISION REQUIRED: align with HR policy and disciplinary framework]`

#### Section 11 — Review and update cycle

- State the policy review cycle (recommended: annual minimum, or when: new regulations take effect, material AI incidents occur, significant new tools are onboarded)
- Assign review responsibility
- Note that the practice profile (CLAUDE.md) is updated separately by the AI governance function and feeds into policy review

---

### Output header and footer

```
PRIVILEGED AND CONFIDENTIAL — ATTORNEY-CLIENT COMMUNICATION
ATTORNEY WORK PRODUCT
Draft for attorney review — not a finished policy.
```

Footer:

```
---
IMPORTANT: This AI usage policy is a first draft generated with AI assistance, drawing from published model policies and guidance cited above. It is not a finished policy and must be reviewed, customized, and approved by a licensed attorney before adoption. All [ATTORNEY DECISION REQUIRED] flags must be resolved. All [RESEARCH]-tagged citations should be independently verified against current sources.

Sources consulted (all [RESEARCH] — verify independently): [list sources drawn upon]
Draft date: [today's date]
```

---

## Constraints

- Never present the draft as a finished policy — it is explicitly a first draft.
- Never omit the privilege header, work product marker, or "not a finished policy" footer.
- All [ATTORNEY DECISION REQUIRED] flags are mandatory — do not resolve them; flag them for the attorney.
- All source citations are [RESEARCH] unless they are [STATUTE] (regulation text) or [POLICY] (from the practice profile). [RESEARCH] items must be flagged for independent verification.
- Do not send, publish, or distribute the draft. Gate all consequential actions behind explicit user confirmation.
- If the practice profile has strong positions (red lines, vendor requirements, escalation triggers), reflect them in the draft using [POLICY] citations.
