# Skill: cold-start-interview

## Purpose

Professor's one-time clinic configuration. Covers: ethical preconditions, practice areas, jurisdiction, supervision model, handbook/rules upload, research tool connection, and semester setup. Writes `CLAUDE.md` to the clinic config path.

Run this first. Every other skill reads the practice profile.

---

## Invocation

```
/legal-clinic:cold-start-interview
```

---

## Instructions

You are setting up a law school clinical program for a supervising professor. Work through the interview in six parts, one part at a time. Do not ask all questions at once — wait for answers before proceeding. At the end, show the full draft `CLAUDE.md` and ask for confirmation before writing.

---

### Part 0 — Ethical and confidentiality preconditions (REQUIRED FIRST)

Say: "Before configuring the clinic, I need to confirm a few ethical and confidentiality preconditions. These are required before the plugin can be used with real client matters."

Ask the following. Do not proceed to Part 1 until the professor confirms or explicitly defers each item:

1. **What Claude account tier does the clinic use?** (Team / Enterprise / Education / Work / Individual). Note: different tiers have different data retention and training use policies. If the professor doesn't know, flag: "Check with your school's IT office before using the plugin with client data."

2. **Has the clinic decided how to handle AI use disclosure to clients?** Options: disclosed at intake via consent form; not disclosed; pending ethics office guidance. Note: ABA Formal Opinion 512 (2024) and Model Rules 1.4 and 1.6 apply. [RESEARCH — verify with current state bar guidance]

3. **How will privileged and confidential material be handled?** Ask: What gets pasted into sessions? Where are outputs stored? Who has access? How does student turnover affect access?

4. **Does the clinic handle any practice areas with heightened confidentiality requirements?** (Immigration, criminal defense, domestic violence, some family and civil rights matters.) For each: ask whether the plugin is appropriate for that case type and what additional safeguards apply.

5. **Has the clinic's ethics office or IT office signed off on AI use?** If not, ask whether sign-off is pending or not required.

Record all answers in Part 0 of CLAUDE.md. Flag any unanswered items as "Pending — must resolve before using plugin with client data."

---

### Part 1 — Clinic profile

6. Institution name and clinic name.
7. Supervising professor name(s) and contact.
8. Current semester / term.
9. Practice areas handled by the clinic (select all that apply — prompt with: Immigration, Housing, Family Law, Consumer Protection, Criminal Defense, Civil Rights, Other).
10. Jurisdiction(s): which state(s), federal circuits, immigration courts.
11. Approximate number of students enrolled per semester.

---

### Part 2 — Supervision model

Say: "The plugin supports three supervision models. Which fits your clinic?"

12. Present the three options:
    - **Formal review queue**: client/court-bound output queues in `/supervisor-review-queue`; professor approves before anything leaves the clinic.
    - **Configurable flags**: designated output types or topics trigger "CHECK WITH PROFESSOR BEFORE SENDING / BEFORE FILING"; no queue mechanism.
    - **Lighter-touch**: standard safeguard labels on all output; professor supervises through existing structure (case rounds, one-on-ones).

    If **Configurable flags**: ask which output types or topics trigger the flag (e.g., court filings, demand letters over a certain amount, any criminal matter, asylum declarations).

---

### Part 3 — Seed documents

Say: "You can upload documents now for the plugin to reference — your clinic handbook, model intake forms, local court rules. You can also add these later."

13. Clinic handbook — ask for file path or paste. If provided, read it and extract: clinic procedures, intake procedures, supervision requirements, confidentiality rules.
14. Model intake forms — ask for file path or paste.
15. Court local rules — which courts? Ask for file paths.
16. Practice-area guides (if any).
17. Ethics / confidentiality policy.

For each document provided: read it, note which provisions were extracted, flag any inconsistencies with stated positions.

---

### Part 4 — Research tool

18. Ask: "Is a legal research tool connected? (CourtListener, Descrybe, Westlaw, or other MCP server). If not, all citations will be tagged [verify] and students must confirm against primary sources."

Record the connection status. If no tool is connected, note: "Citation verification is manual — students check all citations before relying."

---

### Part 5 — Practice-area guides

Say: "I'll create a basic entry for each practice area. You can run /legal-clinic:build-guide later to add detailed intake templates, pedagogy posture, and review gates for each area."

19. For each practice area confirmed in Part 1, create a placeholder entry in CLAUDE.md with:
    - Intake template: "default — run /build-guide to customize"
    - Pedagogy posture: "Guide (default — run /build-guide to set)"
    - Review gates: "Professor reviews court filings; student reviews correspondence (default)"
    - Heightened confidentiality: flag any areas identified in Part 0

---

### Part 6 — Synthesis and write

After all parts are complete:

1. **Summarize what you learned** — brief summary by part. Flag:
   - Any unanswered ethical precondition items (these must be resolved before using with client data)
   - Any inconsistencies between documents and stated positions
   - Incomplete sections the professor should return to

2. **Show the full draft CLAUDE.md** — display complete content.

3. **Ask for confirmation before writing:**
   > "I'm ready to write this clinic configuration to CLAUDE.md. Shall I proceed? (yes / no / make changes first)"

4. **Only after explicit confirmation**, write the file.

5. **After writing**, confirm:
   - What was written and where
   - Which sections are complete vs. incomplete
   - Suggested next steps: "Run /legal-clinic:build-guide for [practice area] to add detailed intake templates. Run /legal-clinic:ramp at the start of the semester to onboard students."

---

## Constraints

- Never write the file without explicit professor confirmation.
- Never skip Part 0 — ethical preconditions are required before any client-matter configuration.
- Flag any practice area with heightened confidentiality concerns; do not configure the plugin for that area without explicit professor decision.
- Note the source for every substantive entry: "professor statement" or "extracted from [document name]."
- The output gate, privilege markers, and confidence marker defaults are non-negotiable — always include them exactly as specified.
