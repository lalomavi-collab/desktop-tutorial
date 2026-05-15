# Skill: memo

## Purpose

IRAC-scaffolded case analysis. Provides the framework; the student provides the reasoning and conclusions. Flags research gaps for `/research-start`. Does not write the analysis — that is the educational core.

---

## Invocation

```
/legal-clinic:memo [issue or case description]
```

---

## Output label

```
[AI-ASSISTED DRAFT — requires student analysis and attorney review]
PRIVILEGED AND CONFIDENTIAL — ATTORNEY-CLIENT COMMUNICATION
ATTORNEY WORK PRODUCT

MEMO SCAFFOLD: This document provides structure and research prompts.
The [STUDENT ANALYSIS] and [STUDENT CONCLUSION] sections are blank by design.
The student completes those sections. The supervising attorney reviews the completed memo.
```

---

## Instructions

Read `CLAUDE.md` for: jurisdiction, practice area, pedagogy posture. Adapt scaffold depth to posture (assist / guide / teach).

---

### Step 1 — Identify the issue

Ask the student:
1. What is the legal issue or question to be analyzed?
2. What are the relevant facts? (Summary from case notes — no client-identifying information beyond what is needed.)
3. What jurisdiction applies?
4. What is the memo for? (Internal analysis / court filing support / professor review / other)

---

### Step 2 — Produce the IRAC scaffold

For each identified legal issue:

```
MEMORANDUM OF LAW
[AI-ASSISTED DRAFT — requires student analysis and attorney review]
PRIVILEGED AND CONFIDENTIAL — ATTORNEY WORK PRODUCT

TO: [Supervising Attorney]
FROM: [Student name]
DATE: [date]
RE: [Case ID] — [Legal issue]

─────────────────────────────────────────
ISSUE
─────────────────────────────────────────
[STUDENT ANALYSIS: State the precise legal question to be answered. One sentence.]

─────────────────────────────────────────
SHORT ANSWER
─────────────────────────────────────────
[STUDENT CONCLUSION: One paragraph. Answer the issue. Give the reason. This is blank until the student completes the analysis below.]

─────────────────────────────────────────
FACTS
─────────────────────────────────────────
[Student drafts the relevant facts section from case notes. Scaffold: list the key facts provided; flag missing facts.]

[FACT NEEDED: list any facts required for the analysis that were not provided]

─────────────────────────────────────────
RULE
─────────────────────────────────────────
[Scaffold: identify the applicable legal framework — statute, regulation, or common law rule. State the rule at a general level. Flag gaps.]

[RESEARCH NEEDED: identify the specific statutory provision — run /research-start on "[statute name], [jurisdiction]"]
[VERIFY: confirm this is the current version of the rule in [jurisdiction]]
[UNCERTAIN: reason, if the rule is contested or jurisdiction-specific]

Elements:
  1. [Element 1] — [RESEARCH NEEDED: definition and standard]
  2. [Element 2] — [RESEARCH NEEDED: definition and standard]
  3. [Element 3] — [RESEARCH NEEDED: definition and standard]

─────────────────────────────────────────
APPLICATION
─────────────────────────────────────────
[STUDENT ANALYSIS: Apply each element of the rule to the facts. For each element:
  — What does the element require?
  — Which facts support satisfaction of the element?
  — Which facts are problematic?
  — What is your conclusion on this element?
This section must be written by the student. Do not copy rule language — reason through it.]

Element 1 — [name]:
[STUDENT ANALYSIS]

Element 2 — [name]:
[STUDENT ANALYSIS]

Element 3 — [name]:
[STUDENT ANALYSIS]

Counter-arguments / weaknesses:
[STUDENT ANALYSIS: What is the strongest argument against your client's position? How would you respond?]

─────────────────────────────────────────
CONCLUSION
─────────────────────────────────────────
[STUDENT CONCLUSION: Summarize the analysis. State the bottom line. Note any significant uncertainties or conditions on your conclusion.]

─────────────────────────────────────────
RESEARCH GAPS (for /research-start)
─────────────────────────────────────────
[List all [RESEARCH NEEDED] items from above. Student runs /research-start on each before completing the memo.]

─────────────────────────────────────────
SUPERVISING ATTORNEY REVIEW
─────────────────────────────────────────
[ ] Reviewed   [ ] Approved   [ ] Returned for revision
Notes: ___
```

---

### Multiple issues

If the matter raises multiple issues, produce a separate IRAC scaffold for each. Flag if issues interact: `[STUDENT ANALYSIS: Note whether the conclusion on Issue 1 affects the analysis of Issue 2.]`

---

### Pedagogy posture adaptation

- **Assist**: fuller rule scaffolding, more detailed research prompts, sample application structure.
- **Guide**: rule skeleton + element list; student drafts rule statement and application.
- **Teach**: issue identification + blank IRAC framework only; student researches and fills in everything.

---

## Constraints

- Never write the `[STUDENT ANALYSIS]` or `[STUDENT CONCLUSION]` sections — these are blank by design.
- Never state a rule as settled without a `[VERIFY]` marker if it is jurisdiction-specific.
- Flag every research gap — do not state rules as authoritative without a source.
- If formal review queue is enabled, note: "Complete student analysis sections, then queue for supervisor review before finalizing."
