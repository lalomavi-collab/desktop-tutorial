# Skill: ramp

## Purpose

Student semester onboarding. Reads the clinic handbook and practice profile, teaches clinic procedures interactively, walks through the plugin's commands, and runs low-stakes practice exercises before the student touches a real case.

`/ramp --card` generates the one-page student reference card.

---

## Invocation

```
/legal-clinic:ramp
/legal-clinic:ramp --card
```

---

## Instructions

Read `CLAUDE.md` and the clinic handbook (if uploaded at setup) before starting. Address the student directly. Work through the sections below interactively.

---

### Section 1 — Welcome and orientation

Say:
> "Welcome to [Clinic Name]. I'm here to help you get up to speed on how the clinic works and how to use this tool. I'll walk you through clinic procedures, show you how to use each command, and we'll do a practice exercise before you work on a real case. This usually takes about 30–45 minutes."

---

### Section 2 — Clinic procedures

Teach the following from the clinic handbook (if uploaded) or from the practice profile:

1. **Supervision model**: explain which model the professor chose (formal queue / configurable flags / lighter-touch) and what it means for the student's workflow.
2. **Confidentiality rules**: what can and cannot go into a session. Specific rules from the clinic's confidentiality policy.
3. **Client communication**: how to schedule, how to document calls and meetings, when to use `/client-comms-log`.
4. **Deadline tracking**: how to add deadlines, the warning cadence, the student's responsibility for calculating deadlines from triggering events.
5. **Review and approval**: what requires professor review, how to flag output for review.

Pause after each section and ask if the student has questions.

---

### Section 3 — Plugin walkthrough

Walk through each command with a brief description and example invocation. Cover in order:

1. `/client-intake` — intake walkthrough
2. `/research-start` — research roadmap, not citations
3. `/draft` — first draft, always a starting point
4. `/memo` — IRAC scaffold, student does the analysis
5. `/status` — audience-aware summaries
6. `/client-letter` — routine correspondence only
7. `/deadlines` — add and track deadlines
8. `/client-comms-log` — communication record
9. `/semester-handoff` — end of term

Explain confidence markers: `[AI-ASSISTED DRAFT]`, `[UNCERTAIN]`, `[VERIFY]`, `[RESEARCH NEEDED]`, `[STUDENT ANALYSIS]`, `[STUDENT CONCLUSION]`, `[FACT NEEDED]`. Emphasize: the markers are prompts to verify — nothing is trusted without student review.

---

### Section 4 — Practice exercises

Run the student through two or three low-stakes exercises using fictional clients. Do not use real case data.

**Exercise 1: Practice intake**
Present a fictional client scenario from the clinic's primary practice area. Run through `/client-intake` with the student answering as if they conducted the interview.

**Exercise 2: Practice research start**
Take a legal issue from the practice intake. Run `/research-start` on it. Walk the student through reading and evaluating the output — what to verify, what's a research lead vs. an authority.

**Exercise 3 (optional): Practice draft or memo**
If time permits, run a partial `/draft` or `/memo` on the fictional scenario. Walk through the scaffold markers and what the student is expected to fill in.

After exercises, ask: "Any questions before you work on a real case?"

---

### `/ramp --card` mode

Generate a one-page student reference card covering:

```
CLINIC QUICK REFERENCE — [Clinic Name] — [Semester]

COMMANDS
/client-intake      Start here for a new client
/draft [doc]        First draft — always a starting point
/memo               IRAC scaffold — you write the analysis
/research-start     Research leads — verify everything
/status [audience]  Case summary: client / internal / court
/client-letter      Routine correspondence only
/deadlines          Track and check deadlines
/client-comms-log   Log every client contact
/semester-handoff   End-of-semester offboarding

CONFIDENCE MARKERS — what they mean
[AI-ASSISTED DRAFT]     Every output. Strip before anything goes out.
[UNCERTAIN: ...]        Check this — the tool isn't sure.
[VERIFY: ...]           Likely right — confirm before relying.
[RESEARCH NEEDED: ...]  You run /research-start on this gap.
[STUDENT ANALYSIS: ...] You reason through this.
[FACT NEEDED: ...]      Get the fact — don't guess.

VERIFICATION HABITS
1. Check every citation against a primary source.
2. Confirm every rule statement in the jurisdiction.
3. Get every missing fact before relying on a draft.
4. Professor reviews [per supervision model] before anything leaves.

SUPERVISION MODEL: [formal queue / configurable flags / lighter-touch]
[If configurable flags: "Output flagged CHECK WITH PROFESSOR means exactly that."]
```

---

## Constraints

- Never use real client data in practice exercises.
- Ramp does not replace the professor's orientation — tell the student this.
- If the clinic handbook was not uploaded at setup, note which procedures could not be confirmed from the handbook and flag for the professor.
