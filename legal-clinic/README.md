# Claude for Law School Clinics

Supercharging access to justice through AI-enabled clinical legal education.

A plugin for law school clinics — the institutions where law students, supervised by clinical professors, provide free legal services to people who can't afford representation. Immigration, housing, family law, consumer protection, criminal defense, civil rights.

Every output is a draft for student analysis and attorney review — marked, gated, and logged. The plugin scaffolds the work; a student reasons through it; a supervising attorney reviews. Nothing leaves the clinic without going through the supervision model the professor set at setup.

---

## The problem this solves

Clinics are structurally capacity-constrained. A supervising professor manages 5–10 students. Each student carries a handful of cases while juggling classes. Students turn over every semester. Administrative tasks — intake write-up, first drafts, research starting points, status updates — consume hours that could go to advising clients. The result: long waitlists, limited caseloads, people who give up waiting.

This plugin cuts the time cost of everything around the lawyering, so the same students and professor serve meaningfully more clients — and students spend more time on the analysis and strategy that make clinical education worthwhile.

It accelerates the non-educational parts. It preserves the analytical work. That's the design principle.

---

## Who uses it

| Role | Runs | Gets |
|---|---|---|
| Supervising professor | `/cold-start-interview` (once), `/supervisor-review-queue` (if formal review enabled) | Clinic context configured, student work reviewed |
| Students | `/ramp` (start of semester), then `/client-intake`, `/draft`, `/memo`, `/research-start`, `/status`, `/client-letter` | Starting points — never final work product |

---

## Commands

| Command | What it does | What it doesn't do |
|---|---|---|
| `/cold-start-interview` | Professor. One-time clinic config: practice areas, jurisdiction, supervision style, handbook/rules upload | — |
| `/build-guide` | Professor. Author a per-practice-area guide: intake questions, pedagogy posture (assist / guide / teach), review gates, cross-plugin checks | Doesn't replace `/cold-start-interview` — this tunes skills for one practice area |
| `/ramp` | Students. Semester onboarding: clinic procedures, tool walkthrough, practice exercises | Doesn't replace the professor's orientation |
| `/client-intake` | Structured intake: practice-area templates, cross-area issue spotting, conflict flags, triage | Doesn't decide whether to take the case |
| `/draft [doc]` | First draft: asylum apps, eviction answers, protective orders, demand letters — jurisdiction-aware | Doesn't produce final work product |
| `/memo` | IRAC-scaffolded case analysis with research gaps flagged | Doesn't write the analysis — scaffolds it |
| `/research-start [issue]` | Research roadmap: statutes, case law areas, Westlaw search terms | Leads, not authoritative citations — students verify everything |
| `/status [audience]` | Case status summary: client-facing, internal, or court-ready | Doesn't file anything |
| `/client-letter [type]` | Routine correspondence: appointment confirms, doc requests, brief updates | Doesn't do substantive advice — that's `/status client` or a conversation |
| `/deadlines` | Track case deadlines — add, cross-case rollup with warnings at 14/7/3/1 days, overdue flags | Doesn't calculate deadlines from triggering events; student does the math per local rules |
| `/client-comms-log [case]` | Append-only per-case communication log — calls, emails, letters, in-person | Doesn't store substantive legal analysis; comm record only |
| `/semester-handoff` | End-of-semester offboarding — per-case handoff memos for the next cohort | Doesn't close cases; cases closing at semester end get a final `/status internal` memo |
| `/supervisor-review-queue` | Professor, if formal review enabled. What's waiting, approve/edit/return | Optional — one of three supervision models |

---

## Ethical and confidentiality preconditions

Before using this plugin with real client matters, confirm with your clinic's supervising attorney and your school's IT / ethics office:

1. **Account tier and data retention.** Your Claude account tier and its data retention and training policies. Team, Enterprise, Work, Education, and individual accounts have different guarantees about retention, training use, and subprocessor handling. Confirm what applies to the clinic's account.

2. **Client consent and disclosure.** Your client consent and disclosure practices for AI-assisted work per ABA Formal Opinion 512 (2024), your state bar's AI guidance (if any), and Model Rules 1.1, 1.4, 1.6, and 5.3. Decide whether and how the clinic discloses AI use to clients; document it.

3. **Privilege and confidentiality handling.** How privileged and confidential material will be handled — what gets pasted into sessions, where outputs are stored, who has access, how long material is retained, how student turnover affects access.

4. **Heightened confidentiality areas.** Whether any of your clinic's practice areas involve heightened confidentiality (immigration, criminal defense, domestic violence, some family and civil rights matters) that require additional safeguards — and decide whether the plugin is appropriate for those case types at all.

**Do not skip this step.** The cold-start interview captures these decisions as Part 0 before any other configuration.

---

## Confidence markers

Skills across this plugin flag confidence inline so students and supervising attorneys can see where the scaffold is uncertain vs. where it's asserting.

| Marker | Meaning |
|---|---|
| `[AI-ASSISTED DRAFT — requires student analysis and attorney review]` | Baseline label on every output. Strip before anything goes to client or court. |
| `[UNCERTAIN: reason]` | Genuinely unsure — minority rule, debatable issue, unfamiliar jurisdiction. Verify before relying. |
| `[VERIFY: claim — check source]` | Likely correct but unverified. Student confirms against primary source. |
| `[RESEARCH NEEDED: ...]` | Memo gap — rule statement missing, student runs `/research-start` to fill. |
| `[STUDENT ANALYSIS: ...]` | Memo scaffold — application is blank by design. Student reasons through it. |
| `[STUDENT CONCLUSION: ...]` | Memo scaffold — conclusion is blank by design. |
| `[FACT NEEDED: ...]` | Draft scaffold — required fact missing from case notes. Student gets it; no guessing. |
| `CHECK WITH [PROFESSOR] BEFORE SENDING / BEFORE FILING` | Supervision flag for configurable-flags mode. |

Trust the flags more than the absence of flags. An unflagged statement means the skill is confident — it does not mean verification is skipped.

---

## Supervision workflow (configurable)

The cold-start interview asks the professor to choose one of three supervision models:

| Model | Description |
|---|---|
| **Formal review queue** | Client/court-bound output queues, professor approves, all logged via `/supervisor-review-queue` |
| **Configurable flags** | Certain triggers label output "CHECK WITH PROFESSOR," no queue mechanism |
| **Lighter-touch** | Standard safeguard labels on everything, professor supervises through existing clinic structure |

Changeable later by editing `CLAUDE.md` directly.

---

## Semester turnover: the `/ramp` solution

Every semester, clinics rebuild from scratch. `/ramp` is the interactive onboarding — it reads the clinic handbook the professor uploaded at setup and teaches it, with low-stakes practice exercises before the student touches a real case.

`/ramp --card` generates the one-page student reference card: commands, what Claude can and can't help with, verification habits. Hand it out on day one.

---

## Framework: ABA Formal Opinion 512 (2024)

The ethical framework this plugin operates within. Lawyers may use generative AI but must ensure competence in the technology, maintain confidentiality, supervise outputs, communicate with clients about AI use where appropriate, and verify before relying. The safeguards — labels, confidence indicators, verification prompts, the explicit non-authority of research outputs — are built for this model.

---

## Skills

| Skill | Purpose |
|---|---|
| `cold-start-interview` | Professor's one-time setup — practice areas, jurisdiction, supervision style, seed docs |
| `build-guide` | Professor's per-practice-area guide — intake, pedagogy posture (assist/guide/teach), review gates, cross-plugin checks |
| `ramp` | Student semester onboarding — procedures, tools, practice exercises |
| `client-intake` | Practice-area-specific intake with cross-area issue spotting, conflict flags, triage |
| `draft` | First-draft generation — practice-area templates, jurisdiction-aware, explicitly starting point |
| `memo` | IRAC scaffolding with research gaps flagged — the analysis is the student's |
| `research-start` | Research roadmap — leads not authorities, students verify and develop |
| `status` | Audience-aware case summaries — client / internal / court |
| `client-letter` | Routine correspondence from templates |
| `supervisor-review-queue` | Optional formal review workflow — only active if professor chose it |
| `deadlines` | Per-case deadline tracking, cross-case rollup, warning cadence, overdue flags |
| `client-comms-log` | Append-only per-case communication record — calls, emails, letters, in-person |
| `semester-handoff` | End-of-semester offboarding memos; mirror of `/ramp` |
| `form-generation` | *(deprecated → `/draft`)* |
| `plain-language-letters` | *(deprecated → `/client-letter`, `/status client`)* |

---

## Connectors and citation verification

Connect a research tool first — the citation guardrails depend on it. Without one, every cite is tagged `[verify]` and the reviewer note records that sources weren't verified. The plugin works either way; it does more verification when a research tool is connected.

Supported connectors: **CourtListener** (U.S. court opinions and PACER dockets), **Descrybe** (primary-law search, citation lookup, quoted-language verification).

Citations retrieved through a connected tool are tagged with their source and traceable. Citations from model knowledge or web search are tagged `[verify]` or `[verify-pinpoint]` and must be checked against a primary source before relying.

---

## File structure

```
legal-clinic/
├── .claude-plugin/plugin.json
├── .mcp.json
├── CLAUDE.md                          # Professor's clinic config — written by cold-start
├── README.md
├── deadlines.yaml                     # Operational deadline ledger
├── skills/
│   ├── cold-start-interview/
│   ├── build-guide/
│   ├── ramp/
│   ├── client-intake/
│   │   └── references/intake-templates/
│   ├── draft/
│   ├── memo/
│   ├── research-start/
│   ├── status/
│   ├── client-letter/
│   ├── supervisor-review-queue/
│   │   └── references/review-queue.yaml
│   ├── deadlines/
│   ├── client-comms-log/
│   ├── semester-handoff/
│   ├── form-generation/               # deprecated → /draft
│   └── plain-language-letters/        # deprecated → /client-letter, /status client
├── handoffs/
│   └── [YYYY-term]/
│       ├── _summary.md
│       └── [case-id].md
├── client-comms/
│   └── [case-id]/
│       └── log.md
└── hooks/hooks.json
```

---

## Testing & QA

Some features reference external integrations (document management, case management, research tools). These are not bundled — if you have an MCP server for one in your environment, the relevant features will use it. Without one, the plugin falls back to file upload and manual workflows. Run `/legal-clinic:integrations` to see what's available in your environment.

---

> **Not legal advice.** Every output is a privileged draft for student analysis and attorney review. The plugin scaffolds the work; the student and supervising attorney do the lawyering.
