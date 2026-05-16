# Skill: policy-monitor

## Purpose

Two modes: (1) **Sweep mode** — scan the configured outputs folder for recent AIAs, triage outputs, and vendor reviews, then identify drift between what the AI policy says and what assessments are approving in practice; (2) **Direct query mode** — evaluate whether a proposed new practice is consistent with current policy and practice profile. Every output is a privileged draft for attorney review.

---

## Invocation

```
/ai-governance-legal:policy-monitor
/ai-governance-legal:policy-monitor [proposed practice description]
```

---

## Instructions

Read the practice profile at `~/.claude/plugins/config/claude-for-legal/ai-governance-legal/CLAUDE.md` before starting. If no profile exists, say: "No practice profile found. Run /ai-governance-legal:cold-start-interview first."

Determine mode from the invocation:
- **No argument** → Sweep mode
- **Argument provided** → Direct query mode

---

## Sweep Mode

### When to use

Run periodically (recommended: monthly or after any significant AI governance activity) to catch drift before it becomes a compliance or policy problem.

### Step 1 — Locate outputs

Read the outputs folder path from the practice profile (`## Outputs folder`). If no folder is configured, say: "No outputs folder configured. Run /ai-governance-legal:cold-start-interview and specify an outputs folder path to enable sweep mode. Switching to direct query mode — provide a proposed practice to evaluate."

Attempt to list and read files in the outputs folder. Look for: AIA documents, triage outputs, vendor review outputs, and any other governance artifacts.

### Step 2 — Analyze for drift

For each output found, extract:
- What was approved, conditionally approved, or flagged
- What conditions were attached
- What risk tier was assigned
- What regulations were cited as applicable

Compare this portfolio of decisions against the practice profile:

1. **Registry drift** — Are assessments approving use cases that are not in the approved or conditional registry? Flag each instance.
2. **Condition drift** — Are assessments attaching different conditions than the registry specifies? Flag inconsistencies.
3. **Tier calibration drift** — Are assessments consistently assigning different risk tiers than you would expect given the use case types? Flag pattern.
4. **Regulatory coverage drift** — Are assessments citing regulations not in the practice profile's applicable list? Flag for review.
5. **Red line proximity** — Are any approved use cases closely adjacent to red lines in ways that may need clarification?

### Step 3 — Identify patterns

Summarize patterns across the portfolio:
- What types of use cases are being assessed most frequently?
- Are certain risk categories (bias, data use, automation) consistently flagged but not addressed?
- Is the sign-off chain being followed?

### Step 4 — Draft practice profile amendments

For each drift pattern identified, draft a proposed amendment to `CLAUDE.md`. Show the current text and proposed replacement.

Gate all amendments behind explicit confirmation:
> "I've identified [N] practice profile amendments to address the drift patterns above. Shall I update `~/.claude/plugins/config/claude-for-legal/ai-governance-legal/CLAUDE.md`? Please review each proposed change and say 'yes' to apply, 'no' to skip, or 'edit' to modify."

Only write changes after explicit per-change confirmation.

---

## Direct Query Mode

### When to use

When evaluating a proposed new practice, policy change, tool approval, or process before it is implemented.

### Step 1 — Understand the proposed practice

If the argument is incomplete, ask:
1. What is the proposed practice, tool, or policy change?
2. Who would it affect, and at what scale?
3. Is personal data involved?

### Step 2 — Consistency check

Compare the proposed practice against:
- The practice profile's red lines [POLICY]
- The approved and conditional use case registry [POLICY]
- The applicable regulations list [STATUTE]
- The escalation triggers [POLICY]

Classify the proposed practice as:
- **Consistent** — aligns with current policy; no amendment needed
- **Conditional** — consistent if specific conditions are met; list them
- **Inconsistent** — conflicts with current policy; explain the conflict
- **Gap** — not covered by current policy; policy needs to be updated to address it
- **Uncertain** — cannot determine without attorney judgment; flag the question

### Step 3 — Draft policy language (if needed)

If the practice is in a "Gap" category, draft proposed policy language to cover it. Present as a proposed addition to `CLAUDE.md` — do not apply without confirmation.

---

## Output format

```
PRIVILEGED AND CONFIDENTIAL — ATTORNEY-CLIENT COMMUNICATION
ATTORNEY WORK PRODUCT
Draft for attorney review — not a legal conclusion.

## Policy Monitor — [Sweep / Direct Query: description]
Date: [today's date]

---

### Summary
[2–3 sentences on overall finding: drift detected or not, consistency status, urgency.]

---

### Findings

[For sweep: list each drift pattern with specific examples from outputs reviewed.]
[For direct query: state the classification (Consistent / Conditional / Inconsistent / Gap / Uncertain) with reasoning.]

---

### Proposed practice profile amendments

[Show each proposed change as: CURRENT → PROPOSED, with rationale. Label each with a priority: Critical / High / Medium / Low.]

[Gate line:]
> "Review the proposed amendments above. To apply, say 'apply amendment [number]' or 'apply all'. To skip, say 'skip [number]'. To modify, say 'edit [number]'."

---

### Attorney flags

[Items requiring attorney judgment before any amendment is applied.]

---

Citations: [list tagged sources]
Prepared by AI assistant — draft for attorney review. [Date]
```

---

## Constraints

- Never apply practice profile amendments without explicit, per-change user confirmation.
- Never conclude that policy is "compliant" or "sufficient" — monitor and flag.
- If the outputs folder cannot be read, say so clearly and suggest switching to direct query mode.
- All proposed policy language is a draft — mark it clearly as requiring attorney review before adoption.
- Do not make legal conclusions about regulatory applicability — flag uncertainties.
