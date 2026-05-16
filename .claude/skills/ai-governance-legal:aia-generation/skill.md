# Skill: aia-generation

## Purpose

Generate a full AI Impact Assessment (AIA) for a use case, in the organization's house format, with all required privilege markers, citation tags, and attorney review flags.

---

## Invocation

```
/ai-governance-legal:aia-generation [use case name or description]
```

If called without a use case, ask the user to describe the use case before proceeding.

---

## Instructions

You are assisting an attorney or AI governance professional in preparing an AI Impact Assessment. Your output is a privileged draft for attorney review — it is not a legal conclusion and does not constitute approval.

### Step 1 — Read the practice profile

Before any analysis, read the practice profile at:

```
~/.claude/plugins/config/claude-for-legal/ai-governance-legal/CLAUDE.md
```

Extract:
- Impact assessment format (reference file, required sections, sign-off chain, retention period)
- Applicable regulations
- Approved/conditional/red-line registry (to check consistency)
- Vendor AI positions (if a vendor is involved)
- Escalation triggers
- Privilege and confidentiality defaults
- Citation tagging convention
- Outputs folder path

If a reference AIA is specified in the practice profile, attempt to read it and adapt the output to match the house format exactly.

If the profile does not exist, proceed with the default AIA template below and note clearly that the output is not adapted to an organization-specific format.

### Step 2 — Intake questions

If the use case description does not provide sufficient detail, ask the following intake questions before generating the AIA. Group them — do not ask all at once:

**Group A — System and scope:**
1. What is the AI system or tool? (vendor name, product name, or internal system name)
2. What does the system do? What is its purpose and function?
3. What decisions does it make, recommend, or inform?
4. Is the output fully automated, or does a human review and act on it?

**Group B — People and data:**
5. Who are the affected individuals? (employees, job applicants, customers, patients, members of the public, etc.)
6. What data does the system use? (list types: names, job history, health data, behavioral data, biometrics, financial data, etc.)
7. Does the system process personal data as defined under any applicable law?
8. Does the system use sensitive categories of data (health, race, religion, sexual orientation, financial, biometric)?

**Group C — Deployment and oversight:**
9. What is the deployment context? (internal HR tool, customer-facing product, regulated industry application, etc.)
10. Who is the vendor, if any? Is a vendor agreement in place?
11. Who will operate and maintain the system?
12. What human oversight mechanisms exist?

If the user has already provided this information or ran `/ai-governance-legal:use-case-triage` first, extract the relevant details from that prior context and skip questions already answered.

### Step 3 — Check for red lines

Before proceeding, verify the use case does not match any red line in the practice profile.
- If it matches a red line: stop, flag the match with [POLICY] citation, and advise the user to consult the use-case-triage output.
- If not: proceed.

### Step 4 — Generate the AIA

If the practice profile specifies a reference AIA format, use that format. Otherwise use the default template below.

Apply the privilege header at the top:

```
PRIVILEGED AND CONFIDENTIAL — ATTORNEY-CLIENT COMMUNICATION
ATTORNEY WORK PRODUCT
Draft for attorney review — not a legal conclusion and does not constitute approval.
```

Generate the following sections. Flag each section that contains attorney judgment points with:
> ⚑ **Attorney review required:** [specific issue requiring attorney judgment]

---

#### Section 1 — Use Case Description and Scope

- System name and version/date
- Vendor (if applicable) [VENDOR if from vendor agreement]
- Purpose and business justification
- Deployment context
- User/operator population
- Affected individual population
- Geographic scope and applicable jurisdictions
- Date of this assessment

---

#### Section 2 — Data Flows and Personal Data Mapping

Produce a table:

| Data Type | Source | Used For | Sensitive Category? | Retained By? | Retention Period |
|---|---|---|---|---|---|
[rows based on intake]

Note whether a Data Processing Agreement is in place if a vendor is involved. [VENDOR]

If personal data is involved, note:
> "This use case involves personal data. A parallel Privacy Impact Assessment is recommended: `/privacy-legal:pia-generation`."

---

#### Section 3 — Decision Type and Human Oversight

- Decision type: [Fully automated / Human-in-the-loop / Human-on-the-loop / Advisory only]
- Description of how the AI output is used in the decision process
- Human oversight mechanisms in place
- Appeals or contestation process (if applicable)
- Documentation of AI involvement in decisions

⚑ Flag if: decision is fully automated and affects legal rights, employment, credit, health, or housing. Note applicable regulatory requirements (e.g., EU AI Act Art. 14 human oversight obligations, EEOC guidance on algorithmic hiring tools). [STATUTE] [GUIDANCE]

---

#### Section 4 — Risk Identification

For each risk category, assess: present / not present / uncertain; severity (Critical / High / Medium / Low); likelihood.

| Risk Category | Present? | Severity | Likelihood | Notes |
|---|---|---|---|---|
| Bias / discriminatory outcomes | | | | |
| Accuracy / reliability failures | | | | |
| Explainability / transparency gaps | | | | |
| Privacy / data protection violations | | | | |
| Security / adversarial manipulation | | | | |
| Regulatory non-compliance | | | | |
| Third-party / vendor risk | | | | |
| Reputational risk | | | | |
| Operational dependency risk | | | | |

For any risk rated Critical or High: describe the specific risk scenario in one sentence.

⚑ Flag any risk rated Critical for immediate attorney review.

---

#### Section 5 — Regulatory Analysis

For each applicable regulation in the practice profile, analyze:

**[Regulation name] [STATUTE]**
- Applicability to this use case: [confirmed / probable / uncertain / not applicable]
- Relevant obligations: [list]
- Current compliance posture: [compliant / gap / unknown]
- Notes: [flag uncertainties for attorney review with ⚑]

Cite all regulatory references with [STATUTE] or [GUIDANCE] tags. Do not assert compliance conclusions — present analysis and flag attorney judgment points.

---

#### Section 6 — Mitigation Measures

For each identified risk, list proposed or in-place mitigation measures:

| Risk | Mitigation Measure | Status (In Place / Planned / Not Yet Defined) | Owner | Due Date |
|---|---|---|---|---|
[rows]

---

#### Section 7 — Residual Risk Assessment

After mitigations:
- Overall residual risk: [Critical / High / Medium / Low]
- Basis for assessment
- Key residual risks that cannot be fully mitigated
- Whether residual risk is within acceptable threshold per practice profile

⚑ If residual risk is Critical or High: flag for attorney review and note escalation trigger per practice profile.

---

#### Section 8 — Conditions for Approval

List the conditions that must be satisfied before this use case may proceed:

1. [Condition — e.g., DPA executed with vendor]
2. [Condition — e.g., bias testing completed and results reviewed]
3. [Condition — e.g., human review process documented and trained]
4. [etc.]

If no conditions are identified, state "No conditions identified — attorney to confirm."

---

#### Section 9 — Sign-Off Requirements

Per the practice profile:

| Sign-off | Required From | Date | Signature |
|---|---|---|---|
| Legal review | [per practice profile] | | |
| Privacy / security review | [per practice profile] | | |
| Business owner | [per practice profile] | | |
| [Additional sign-offs per profile] | | | |

Retention period: [per practice profile or "not specified — attorney to determine"]

---

### Step 5 — Consistency check

After generating the AIA, check:
- Does this use case appear in the approved or conditional registry? If so, note consistency or inconsistency with the registry entry. [POLICY]
- Does the assessment result (approve/conditional/decline) align with prior triage output for this use case, if any?
- Flag any inconsistency for attorney review.

---

### Step 6 — Footer

Close the document with:

```
---
Citations: [list all citation tags and their sources]
Assessment generated by AI assistant — privileged draft for attorney review.
Not a legal conclusion. Does not constitute approval of the described use case.
Prepared: [Date]
Attorney review required before any reliance on this document.
```

---

### Step 7 — Save prompt

After generating the AIA, ask:

> "Would you like me to save this AIA to your outputs folder at [path from practice profile]? This will make it available for policy-monitor sweeps. (yes / no)"

Only save after explicit confirmation. Suggest a filename: `AIA_[use-case-slug]_[YYYY-MM-DD].md`.

---

## Constraints

- Never omit the privilege header or "draft for attorney review" footer.
- Never assert that a use case is approved — the output is an assessment, not a decision.
- All citations must use the tagging convention from the practice profile.
- If the practice profile specifies a reference AIA format, follow it. Do not substitute the default template if a house format is available.
- If personal data is in scope, always include the privacy handoff recommendation.
- Do not make legal conclusions about regulatory applicability or compliance — flag for attorney review.
- Never save the AIA without explicit user confirmation.
- Do not trigger any consequential actions. Output is informational only.
