# Skill: semester-handoff

## Purpose

End-of-semester offboarding. Produces per-case handoff memos for the next cohort of students. Does not close cases — cases closing at semester end get a final `/status internal` memo first, then are marked closed in the handoff document.

---

## Invocation

```
/legal-clinic:semester-handoff
/legal-clinic:semester-handoff [case ID]
```

---

## Output label

```
[AI-ASSISTED DRAFT — requires student analysis and attorney review]
PRIVILEGED AND CONFIDENTIAL — ATTORNEY-CLIENT COMMUNICATION
ATTORNEY WORK PRODUCT

HANDOFF DOCUMENT — [Semester/Year]
For incoming student use only. Do not share outside the clinic.
```

---

## Instructions

Read `CLAUDE.md` and `deadlines.yaml`. For each active case (or the specified case):

---

### Per-case handoff memo

Ask the departing student to provide:
1. Case summary (current status in 2–3 sentences)
2. What has been done this semester (key actions, filings, communications)
3. What is still open and needs to be done next semester
4. Upcoming deadlines (student provides; skill flags for verification)
5. Where to find case documents
6. Key contacts (by role, not identifying information where possible)
7. Anything the incoming student should know about working with this client

Produce the handoff memo:

```
CASE HANDOFF MEMO
[AI-ASSISTED DRAFT — requires student analysis and attorney review]
PRIVILEGED AND CONFIDENTIAL — ATTORNEY WORK PRODUCT

Case ID: [ID]
Practice area: [area]
Departing student: [name]
Supervising attorney: [name]
Handoff date: [date]
Semester: [outgoing] → [incoming]

──────────────────────────────────────────
MATTER SUMMARY
──────────────────────────────────────────
[2–3 sentence summary: client situation (by alias), what they are seeking, what proceeding this is]

──────────────────────────────────────────
WHAT WAS DONE THIS SEMESTER
──────────────────────────────────────────
[Chronological bullet list of key actions, filings, communications, meetings]

──────────────────────────────────────────
OPEN ISSUES AND NEXT STEPS
──────────────────────────────────────────
[What the incoming student needs to do, in priority order]
[FACT NEEDED: any open fact questions that still need answers]
[RESEARCH NEEDED: any legal issues that still need research]

──────────────────────────────────────────
UPCOMING DEADLINES
──────────────────────────────────────────
[List all deadlines from deadlines.yaml for this case]
[VERIFY: incoming student confirms each deadline against local rules before relying]

──────────────────────────────────────────
WHERE TO FIND DOCUMENTS
──────────────────────────────────────────
[File location, folder structure, case management system (if used)]

──────────────────────────────────────────
KEY CONTACTS
──────────────────────────────────────────
[List by role — court clerk, opposing counsel, agency contact — with contact information; client contact through clinic procedures]

──────────────────────────────────────────
NOTES FOR INCOMING STUDENT
──────────────────────────────────────────
[Departing student's practical notes: communication preferences, anything unusual about this matter, anything that helped or would have helped]

──────────────────────────────────────────
STATUS AT HANDOFF
──────────────────────────────────────────
[ ] Active — continuing next semester
[ ] Closing this semester — final /status internal memo attached
[ ] Closed — see closing documentation

Supervising attorney review:
[ ] Reviewed   [ ] Approved for handoff   [ ] Revisions needed
Notes: ___
```

---

### Semester summary

After all case handoffs are produced, generate a semester summary for the professor:

```
SEMESTER HANDOFF SUMMARY — [Semester/Year]

Active cases passing to next semester: [count]
Cases closing this semester: [count]
Cases closed during semester: [count]

Deadlines active at handoff: [list from deadlines.yaml]
[VERIFY: professor confirms deadline list is complete]

Incoming student orientation: /legal-clinic:ramp — ready to run for new cohort
```

---

### Cases closing at semester end

For cases the professor marks as closing:
1. Run `/status internal` to produce final status memo.
2. Mark case as closed in handoff document.
3. Note in `deadlines.yaml`: mark all deadlines as closed.
4. Produce case closing letter using `/client-letter close` if client notification is needed.

---

## Constraints

- Never mark a case as closed without professor confirmation.
- Handoff documents require supervising attorney review before being passed to incoming students.
- No client-identifying information in handoff file names — case ID only.
- Incoming students run `/ramp` before accessing handoff documents — flagged in semester summary.
