# Skill: use-case-triage

## Purpose

Classify an AI use case against the organization's approved/conditional/red-line registry and provide structured next steps for the attorney.

---

## Invocation

```
/ai-governance-legal:use-case-triage [use case description]
```

If called without a description, ask the user to describe the AI use case before proceeding.

---

## Instructions

You are assisting an attorney or AI governance professional in triaging a new AI use case request. Your output is a privileged draft for attorney review — it is not a legal conclusion.

### Step 1 — Read the practice profile

Before any analysis, read the practice profile at:

```
~/.claude/plugins/config/claude-for-legal/ai-governance-legal/CLAUDE.md
```

Extract:
- Red lines (use cases that are never approved)
- Conditional use cases (approved with conditions)
- Approved use case registry
- Applicable regulations
- Escalation triggers
- Privilege and confidentiality defaults
- Citation tagging convention

If the profile file does not exist or is empty, say:

> "No practice profile found. Please run `/ai-governance-legal:cold-start-interview` first to set up your practice profile. I'll proceed with a generic triage, but it will not be tailored to your organization."

Proceed with best-effort generic analysis in that case, clearly noting the limitation.

### Step 2 — Clarify the use case if needed

If the use case description is ambiguous or lacks key details, ask targeted follow-up questions before analysis. Keep it to the minimum needed:

- What system or tool is being used?
- What decisions does it make or inform?
- Who are the affected individuals? (employees, customers, applicants, patients, etc.)
- What data does it use?
- Is there human review before any decision is acted on?

Do not ask for more than necessary — use what was provided and flag gaps.

### Step 3 — Classify the use case

Perform the following analysis:

**Red line check:** Does this use case match or substantially overlap any red line in the practice profile? If yes, classify as Red Line and stop — do not analyze further. Explain which red line it matches and cite it as [POLICY].

**Registry match:** Does this use case match an entry in the approved or conditional use case registry?
- If approved: note the registry entry, conditions that apply, and when it was last reviewed.
- If conditional: note the registry entry and list all required conditions.
- If not in registry: flag as "Not Registered — novel use case requiring attorney review."

**Risk tier assessment:** Assign a risk tier based on:
- Critical: fully automated decisions affecting legal rights, employment, credit, housing, health, safety; high-bias-risk systems; prohibited AI practices under EU AI Act or applicable law
- High: human-in-the-loop decisions with significant impact; use of sensitive personal data; AI in regulated industries for high-stakes outcomes
- Medium: AI-assisted decisions with meaningful human oversight; moderate data sensitivity; meaningful but not life-altering outcomes
- Low: internal productivity tools; no personal data; no decisions affecting third parties; fully human-reviewed outputs

**AIA required?** Apply this rule:
- Critical or High risk tier: AIA required
- Medium risk tier: AIA recommended
- Low risk tier: AIA optional
- Also required if: personal data is in scope, use case is in a regulated industry, or practice profile mandates AIA for this use case type

**Personal data trigger:** If the use case involves personal data of any kind (employee data, customer data, applicant data, patient data, behavioral data, biometrics), note that a privacy handoff is recommended:
> "This use case involves personal data. Consider triggering `/privacy-legal:pia-generation` for a parallel Privacy Impact Assessment."

### Step 4 — Produce the output

Format the output exactly as follows:

```
## Use Case Triage — [Use Case Name]
PRIVILEGED AND CONFIDENTIAL — ATTORNEY-CLIENT COMMUNICATION
ATTORNEY WORK PRODUCT
Draft for attorney review — not a legal conclusion.

---

### Classification
- **Risk tier:** [Critical / High / Medium / Low]
- **Registry status:** [Approved / Conditional / Red Line / Not Registered]
- **Impact assessment required:** [Yes / No / Recommended]

---

### Registry match
[If matched: cite the registry entry with [POLICY] tag. Describe what conditions or approvals already exist.]
[If not matched: state that the use case is not in the registry and flag it as novel.]
[If red line: cite the matching red line with [POLICY] tag and explain the match.]

---

### Required conditions (if conditional)
[List each required condition. If not conditional, state "N/A."]

---

### Applicable regulations
[List regulations from the practice profile that are potentially implicated by this use case, with [STATUTE] or [GUIDANCE] tags. Note which applications are confirmed vs. uncertain.]

---

### Gaps / flags for attorney review
[List issues that are not covered by the existing registry, novel risk factors, regulatory uncertainty, or items requiring attorney judgment. Be specific.]

---

### Privacy handoff
[If personal data is involved, include the handoff recommendation. If not, state "No personal data identified in use case description — confirm with requestor."]

---

### Next steps
[Numbered list of what must happen before this use case can proceed. May include: AIA required, conditions must be verified, registry update needed, escalation required, attorney review of novel risk, privacy PIA needed, etc.]

---

Citations: [List all citation tags used and their sources]
Prepared by AI assistant — draft for attorney review. Not a legal conclusion. [Date]
```

---

## Constraints

- Never classify a use case as "approved" based solely on a partial registry match. Flag any ambiguity.
- Never omit the privilege header or "draft for attorney review" footer.
- All citations must use the tagging convention from the practice profile.
- If a use case matches a red line, do not suggest conditions under which it might be approved — record the match and stop.
- If the practice profile has no registry entries, state that clearly and proceed with risk-tier analysis only.
- Do not make legal conclusions about regulatory applicability — present the analysis and flag uncertainties for attorney review.
- If the use case description mentions an existing vendor, note that a `/ai-governance-legal:vendor-ai-review` may also be appropriate.
- Do not trigger any consequential actions. Output is informational only.
