# Skill: status

## Purpose

Audience-aware case status summaries. Produces client-facing, internal, or court-ready summaries. Does not file anything.

---

## Invocation

```
/legal-clinic:status [audience]
```

| Audience | What it produces |
|---|---|
| `client` | Plain-language summary for the client — no legal jargon, actionable next steps |
| `internal` | Working summary for clinic file — facts, status, open issues, next steps, deadlines |
| `court` | Formal status for court submission — style per local rules; flags for attorney review |

---

## Output label

```
[AI-ASSISTED DRAFT — requires student analysis and attorney review]
PRIVILEGED AND CONFIDENTIAL — ATTORNEY-CLIENT COMMUNICATION
ATTORNEY WORK PRODUCT

[For client-facing output: strip this header before sending to client.]
[For court output: CHECK WITH PROFESSOR BEFORE FILING]
```

---

## Instructions

Read `CLAUDE.md` for: jurisdiction, supervision model, review gates for the relevant practice area.

---

### Step 1 — Intake

Ask the student:
1. What audience? (client / internal / court)
2. What is the current status of the matter? (Ask student to summarize from case notes.)
3. What are the open issues and next steps?
4. Are there any upcoming deadlines? (Student provides — skill does not calculate from triggering events.)
5. What action, if any, does the client need to take?

---

### Step 2 — Produce summary per audience

#### Client-facing summary

```
[AI-ASSISTED DRAFT — strip header before sending]

Date: [date]
Case: [Case ID — no client-identifying information in header]

Dear [Client alias / "you"],

Here is an update on your case as of [date].

WHERE THINGS STAND
[Plain-language 2–3 sentence summary of current status. No legal jargon. What happened most recently?]

WHAT HAPPENS NEXT
[Numbered list of next steps — what the clinic will do, in what order, by when (if known).]

WHAT WE NEED FROM YOU
[Numbered list of anything the client must do — gather documents, attend appointments, make contact, etc. Be specific.]

IMPORTANT DATES
[List any dates the client must know about. Note: [VERIFY: confirm these dates before sending]]

QUESTIONS?
Contact [student name] at [clinic contact info].

[STUDENT ANALYSIS: Is the tone appropriate? Is anything unclear to a non-lawyer? Is there anything sensitive that needs to be reworded?]
```

#### Internal summary

```
[AI-ASSISTED DRAFT — attorney review required]
PRIVILEGED AND CONFIDENTIAL — ATTORNEY WORK PRODUCT

INTERNAL CASE STATUS MEMO
Date: [date]
Case ID: [ID]
Student: [name]
Supervising attorney: [name]

MATTER SUMMARY
[2–3 sentences: who the client is (by alias/ID), what they are seeking, what proceeding this is.]

CURRENT STATUS
[Paragraph: where the case stands. What has been done. What is pending.]

OPEN LEGAL ISSUES
[Bullet list of unresolved legal questions. Flag each that needs further research: [RESEARCH NEEDED: ...]]

MISSING FACTS
[FACT NEEDED items — list what is still needed to advance the matter.]

UPCOMING DEADLINES
[List deadlines — student confirms calculation per local rules]
[VERIFY: confirm each deadline date before relying]

NEXT STEPS
[Numbered action list with assigned responsibility: student / professor / client]

NOTES FOR PROFESSOR
[STUDENT ANALYSIS: Flag anything that needs professor guidance or decision.]
```

#### Court-ready status (if applicable)

```
[AI-ASSISTED DRAFT]
CHECK WITH PROFESSOR BEFORE FILING

[Court caption per local rules]
[VERIFY: confirm caption format against local rules for [court]]

STATUS REPORT / JOINT STATUS REPORT

Pursuant to [court order / local rule — VERIFY], the parties/[party] submits this status report:

1. Current status of the matter: [statement]
2. Matters remaining to be resolved: [statement]
3. Proposed schedule / next steps: [statement]

Respectfully submitted,

[Signature block — student does not sign; supervising attorney signs]
[VERIFY: confirm signature authority and bar admission requirements for this court]

[STUDENT ANALYSIS: Is any statement in this status report contested? Is there anything that requires attorney judgment before filing?]
```

---

### Step 3 — Supervision flags

Apply per `CLAUDE.md`:
- Court-facing output: always flag `CHECK WITH PROFESSOR BEFORE FILING`.
- Client-facing output: flag `CHECK WITH PROFESSOR BEFORE SENDING` if configurable-flags mode and correspondence is in the trigger list.
- If formal review queue enabled: queue for professor review.

---

## Constraints

- Never file or send any output — the skill produces drafts only.
- Never calculate deadlines from triggering events — list what the student provides, flag for verification.
- Client-facing output must be plain language — flag any legal jargon that slipped through.
- Court-facing output must note that a supervising attorney must sign all court submissions.
