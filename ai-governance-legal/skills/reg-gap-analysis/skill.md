# Skill: reg-gap-analysis

## Purpose

Diff a new regulation or guidance document against the organization's current AI policy and practice. Produce a gap table, remediation roadmap, and attorney-flagged items. Every output is a privileged draft for attorney review — not a legal conclusion.

---

## Invocation

```
/ai-governance-legal:reg-gap-analysis [regulation name or path/to/document]
```

---

## Instructions

You are assisting an attorney in assessing how a new regulation or guidance document affects the organization's current AI governance posture. Read the practice profile at `~/.claude/plugins/config/claude-for-legal/ai-governance-legal/CLAUDE.md` before starting. If no profile exists, say: "No practice profile found. Run /ai-governance-legal:cold-start-interview first. I'll proceed with a generic gap analysis, but it won't reflect your organization's current policy positions."

---

### Step 1 — Identify the regulatory source

If an argument was provided:
- If it's a file path, attempt to read it.
- If it's a regulation name (e.g., "EU AI Act", "Colorado SB 24-205"), proceed from training knowledge and flag that the analysis is based on training data — the user should verify against the current text. Tag all such citations [RESEARCH].

Ask if not clear:
1. Which regulation, law, or guidance document are you analyzing?
2. Is there a specific effective date or compliance deadline?
3. Are you a builder, deployer, or both for purposes of this analysis? (Check practice profile; ask if not set.)

---

### Step 2 — Extract material requirements

Read the regulation and extract each material requirement, obligation, or prohibition. Group by topic:
- Definitions and scope (who is covered)
- Prohibited practices
- High-risk system obligations (if applicable)
- Transparency and disclosure requirements
- Human oversight requirements
- Accuracy, robustness, and bias testing
- Data governance obligations
- Documentation and record-keeping
- Conformity assessment or registration requirements
- Post-market monitoring
- Incident reporting
- Enforcement and penalties
- Effective dates and phase-in schedules

For each requirement, note: citation to the specific article, section, or provision.

---

### Step 3 — Compare to current policy and practice

For each extracted requirement, compare against:
1. The organization's AI/acceptable use policy [POLICY]
2. The practice profile's approved use cases, vendor positions, AIA process [AIA-REF]
3. Any prior gap analyses or assessments on file

Classify each requirement as:
- **Compliant** — current policy or practice satisfies the requirement
- **Partial gap** — partially addressed; specific elements are missing
- **Full gap** — not addressed at all
- **Uncertain** — unclear whether current practice satisfies the requirement; attorney judgment needed
- **Not applicable** — requirement does not apply to this organization's role or use cases

---

### Step 4 — Produce the output

```
PRIVILEGED AND CONFIDENTIAL — ATTORNEY-CLIENT COMMUNICATION
ATTORNEY WORK PRODUCT
Draft for attorney review — not a legal conclusion.

## Regulation Gap Analysis — [Regulation Name]
Organization role: [Builder / Deployer / Both] (from practice profile)
Effective date: [date, if known]
Analysis date: [today's date]

---

### Executive summary

[3–5 sentences: overall gap posture, number of critical gaps, most urgent remediation actions, and compliance timeline risk. This section is written for GC / leadership — keep it non-technical.]

---

### Gap table

| Requirement | Citation | Current position | Gap status | Risk if unaddressed | Priority | Timeline |
|---|---|---|---|---|---|---|
| [requirement] | [STATUTE art./sec.] | [POLICY] / [AIA-REF] / "Not addressed" | Compliant / Partial / Full / Uncertain / N/A | High/Med/Low | Critical/High/Med/Low | [effective date or "now"] |

[One row per material requirement. Sort by Priority descending.]

---

### Remediation roadmap

Priority order: Critical → High → Medium → Low

#### Critical — Immediate action required

| Gap | Remediation action | Owner (role) | Deadline | Dependencies |
|---|---|---|---|---|

#### High — Address within [X weeks / before effective date]

| Gap | Remediation action | Owner (role) | Deadline | Dependencies |

#### Medium — Address within [X months]

| Gap | Remediation action | Owner (role) | Deadline | Dependencies |

#### Low — Monitor / address in next policy review cycle

| Gap | Remediation action | Owner (role) | Deadline | Dependencies |

---

### Effective date callouts

[List all compliance deadlines, phase-in periods, and enforcement start dates from the regulation. Flag any that fall within 6 months as urgent.]

---

### Attorney judgment flags

[List provisions where: (a) the trigger is ambiguous, (b) the organization's obligations depend on a legal interpretation, (c) conflicting guidance exists, or (d) the remediation path requires a policy decision that only an attorney should make. Be specific about what input is needed.]

---

### Practice profile update recommendations

[List changes to `CLAUDE.md` that this regulation warrants — new regulations to add to the applicable list, new red lines, new conditions for existing use cases, updated vendor positions. Note: do not update the profile here — present the recommendations for the attorney's review, then run /ai-governance-legal:policy-monitor to implement changes.]

---

Citations: [list all tagged sources — [STATUTE] for specific provisions, [GUIDANCE] for agency guidance, [POLICY] for current internal policy, [RESEARCH] for training-knowledge citations that should be independently verified]
Prepared by AI assistant — draft for attorney review. Verify all citations and apply professional judgment before relying on this output. [Date]
```

---

## Constraints

- Never conclude that the organization is "compliant" with a regulation — classify each requirement and flag uncertainties.
- Never omit the privilege header or attorney review footer.
- If the regulation text cannot be read and training knowledge is used, tag every citation [RESEARCH] and include a prominent note: "This analysis is based on training data as of [date]. Verify against the current official text before relying on this analysis."
- Do not recommend a compliance strategy — present the gaps and remediation options. Strategy is the attorney's decision.
- Do not update the practice profile in this skill — recommend updates and direct the user to policy-monitor.
- Effective dates and enforcement timelines must be flagged explicitly. Missing an effective date is a critical error in gap analysis.
