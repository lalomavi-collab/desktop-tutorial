# AI Governance Legal Plugin

In-house AI governance counsel workflows — use case triage, AI impact assessments, vendor AI review, and regulation-to-policy gap analysis.

> **Every output is a draft for attorney review — cited, flagged, and gated — not a legal conclusion.**

---

## What it does

This plugin gives in-house AI governance counsel a structured, repeatable workflow for the most common AI legal tasks:

- **Triaging** new AI use case requests against an approved/conditional/red-line registry
- **Generating** AI Impact Assessments (AIAs) that match your house format and sign-off chain
- **Reviewing** vendor AI agreements against your organization's negotiation positions
- **Analyzing** regulatory gaps between new laws/guidance and your current AI policy
- **Monitoring** policy drift across your portfolio of assessments and approvals
- **Drafting** AI usage policies adapted to your practice profile
- **Isolating** client matters in private practice to prevent context leakage

All outputs are privilege-marked, citation-tagged, and gated — nothing consequential is filed, sent, or executed without explicit attorney confirmation.

---

## Who it's for

| Role | Primary skills used |
|---|---|
| In-house AI/privacy counsel | use-case-triage, aia-generation, reg-gap-analysis |
| In-house commercial/procurement | vendor-ai-review |
| Legal operations / governance leads | policy-monitor, policy-starter |
| Outside counsel (multi-client) | matter-workspace + all skills |
| Legal team leads setting up the plugin | cold-start-interview |

---

## First run — cold start

Before using any other skill, run the setup interview:

```
/ai-governance-legal:cold-start-interview
```

This will ask you 10 questions about your organization, read any existing policy documents you point it to, and write a practice profile to:

```
~/.claude/plugins/config/claude-for-legal/ai-governance-legal/CLAUDE.md
```

Every subsequent skill reads this profile to tailor its output to your organization. You can re-run the interview at any time to update the profile.

---

## Commands

### `/ai-governance-legal:cold-start-interview`

Interviews you to build or update your practice profile. Covers: builder vs. deployer role, jurisdictions, industry, applicable regulations, red lines, existing policy documents, reference assessments, vendor positions, escalation chain, and outputs folder path.

Run this first. Re-run whenever your practice profile changes.

---

### `/ai-governance-legal:use-case-triage [use case description]`

Classifies an AI use case against your approved/conditional/red-line registry.

**Output includes:**
- Risk tier (Critical / High / Medium / Low)
- Registry status (Approved / Conditional / Red Line / Not Registered)
- Whether an impact assessment is required
- Required conditions if conditional
- Gaps and flags for attorney review
- Next steps before the use case can proceed

**Example:**
```
/ai-governance-legal:use-case-triage Using AI to screen resumes for our open engineering roles
```

Automatically triggers a privacy handoff recommendation when personal data is involved.

---

### `/ai-governance-legal:aia-generation [use case name]`

Runs a full AI Impact Assessment for a use case.

If called without full intake data, the skill asks intake questions. It then generates an AIA in your house format covering: use case scope, data flows, decision type, risk identification, regulatory analysis, mitigation measures, residual risk, conditions for approval, and sign-off requirements.

**Output is:**
- Privilege-marked
- Citation-tagged per your convention
- Checked against your policy for consistency
- Flagged for attorney review on uncertain points
- Linked to a privacy handoff if personal data is in scope

---

### `/ai-governance-legal:vendor-ai-review [path/to/agreement or paste agreement text]`

Reviews a vendor AI agreement against your organization's vendor positions.

Produces a term-by-term analysis covering: data use/training prohibition, DPA status, sub-processor disclosure, audit rights, incident notification SLA, model change notice, accuracy/bias representations, indemnification for AI outputs, IP ownership, liability caps, exit/data deletion rights, and compliance certifications.

**Output includes:**
- Deal-breakers and must-fix items listed first
- Gap table: Current position | House position | Gap | Risk | Proposed redline
- Draft redline language for key gaps
- Escalation list per your escalation triggers

---

### `/ai-governance-legal:reg-gap-analysis [regulation name or path/to/document]`

Diffs a new regulation or guidance document against your current AI policy and practice.

For each material requirement: current policy position, gap (missing/partial/compliant), risk if not remediated, proposed remediation action, priority, and timeline.

**Output includes:**
- Executive summary of overall gap posture
- Remediation roadmap sorted by priority
- Effective date callouts
- Attorney judgment flags for provisions requiring policy decisions

---

### `/ai-governance-legal:policy-monitor`

**Sweep mode** (no argument): Scans your configured outputs folder for recent AIAs, triage outputs, and vendor reviews. Identifies drift between what your policy says and what your assessments are approving in practice. Proposes CLAUDE.md amendments — all gated behind confirmation.

**Direct query mode** (with argument): Evaluates whether a proposed new practice is consistent with your current policy and practice profile.

```
/ai-governance-legal:policy-monitor We're planning to allow business units to self-approve low-risk AI tools
```

---

### `/ai-governance-legal:policy-starter`

Drafts an AI usage policy adapted to your practice profile, drawing from: ABA guidance, state bar AI opinions, ILTA/CLOC guidelines, NIST AI RMF, EU AI Act deployer obligations, and published peer firm policies.

All source citations tagged [RESEARCH]. Attorney decision points flagged inline. Output is a full draft policy — not a finished policy.

---

### `/ai-governance-legal:matter-workspace [subcommand]`

Manages isolated matter workspaces for multi-client private practice.

| Subcommand | Action |
|---|---|
| `new [client/matter name]` | Create a new matter workspace |
| `list` | List all open matters with last-modified date |
| `switch [matter name]` | Switch active workspace context |
| `close [matter name]` | Archive a matter (confirms before closing) |
| `none` | Clear active matter — working at firm level |

**Example:**
```
/ai-governance-legal:matter-workspace new Acme Corp / AI procurement review
```

---

## Plugin triangle

This plugin is part of a coordinated legal plugin set. Cross-plugin handoffs are automatic:

| Trigger | Cross-plugin call |
|---|---|
| AI use case involves personal data | → `/privacy-legal:pia-generation` |
| AI component detected in a product launch | → `/product-legal:launch-review` |

These are recommendations — the attorney decides whether to invoke the cross-plugin workflow.

---

## File structure

```
ai-governance-legal/
├── CLAUDE.md                        # Practice profile (edit or re-run cold-start)
├── README.md                        # This file
└── skills/
    ├── cold-start-interview/
    │   └── skill.md
    ├── use-case-triage/
    │   └── skill.md
    ├── aia-generation/
    │   └── skill.md
    ├── vendor-ai-review/
    │   └── skill.md
    ├── reg-gap-analysis/
    │   └── skill.md
    ├── policy-monitor/
    │   └── skill.md
    ├── policy-starter/
    │   └── skill.md
    └── matter-workspace/
        └── skill.md
```

Runtime config is written to:

```
~/.claude/plugins/config/claude-for-legal/ai-governance-legal/
├── CLAUDE.md                        # Your practice profile
├── .active-matter                   # Currently active matter (if any)
└── matters/
    ├── [matter-slug]/
    │   └── matter.md
    └── archived/
        └── [matter-slug]/
            └── matter.md
```

---

## How it learns

Every skill reads the practice profile before generating output. Over time:

- Run `/ai-governance-legal:cold-start-interview` to add new regulations, update red lines, or add vendor positions
- Run `/ai-governance-legal:policy-monitor` (sweep mode) to catch policy drift and update the registry
- Edit `CLAUDE.md` directly to add approved use cases, adjust escalation triggers, or update the sign-off chain

The practice profile is the single source of truth. The more complete it is, the more tailored every output will be.

---

## Notes

- **Not legal advice.** Every output is a privileged draft for attorney review. The plugin does not make legal conclusions.
- **Privilege handling.** All outputs are privilege-marked by default. Do not share outputs outside the attorney-client relationship without reviewing privilege implications.
- **Matter isolation.** The matter-workspace skill provides structure for client separation — enforcement is the attorney's responsibility.
- **Citations.** All factual claims are tagged with citation markers. [RESEARCH]-tagged items should be independently verified before relying on them.
- **Output gate.** No file is sent, no contract is executed, no filing is made without explicit confirmation. The gate is a reminder — the attorney controls all consequential actions.
