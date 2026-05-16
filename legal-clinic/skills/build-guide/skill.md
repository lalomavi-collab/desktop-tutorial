# Skill: build-guide

## Purpose

Professor's per-practice-area guide. Tunes intake questions, pedagogy posture (assist / guide / teach), review gates, and cross-plugin checks for one practice area. Does not replace `/cold-start-interview` — it refines what cold-start created.

---

## Invocation

```
/legal-clinic:build-guide [practice area]
```

Example:
```
/legal-clinic:build-guide Immigration
```

---

## Instructions

Read the clinic `CLAUDE.md` before starting. Identify the practice area being configured. Work through the sections below with the professor, then write the completed guide entry back to `CLAUDE.md`.

---

### Section 1 — Intake template

Ask the professor to describe or upload the clinic's intake questions for this practice area.

If no existing template: prompt with common questions for the practice area (immigration: country of origin, basis for relief, prior immigration history, criminal history, family ties; housing: landlord name, lease type, notice received, amount owed, hearing date; etc.).

Build the intake template as a structured question list. Flag questions where the student must exercise judgment before asking (e.g., questions about criminal history require rapport-building first).

---

### Section 2 — Pedagogy posture

Ask the professor: "For this practice area, how much scaffolding should the plugin provide to students?"

Present three options:

- **Assist** — full scaffold: detailed prompts, sample language, completed sections for student to verify. Best for complex/unfamiliar areas or new students.
- **Guide** — partial scaffold: question prompts and section headers; student fills in reasoning and conclusions. Best for intermediate skill development.
- **Teach** — minimal scaffold: framework only; student does research, drafting, and analysis with light structure. Best for advanced students on familiar area.

Record the professor's choice. Note that posture can be changed per-case by the professor.

---

### Section 3 — Review gates

Ask: "For this practice area, what output types require your review before leaving the clinic?"

Common gates to prompt with:
- All court filings
- All client-facing correspondence
- Asylum declarations and supporting statements
- Demand letters
- Any output on a case designated high-priority or complex
- Any output involving a vulnerable client (minor, trafficking survivor, DV survivor)

Record gates. These drive the supervision-flag behavior in `/draft`, `/status`, and `/client-letter` for this practice area.

---

### Section 4 — Cross-plugin checks

Ask: "Are there any triggers in this practice area that should prompt a cross-plugin handoff?"

Examples to prompt with:
- Immigration case involving DV → flag for privacy review
- Housing case involving disability → flag for ADA/FHA analysis
- Family law case involving child abuse → mandatory reporting check
- Criminal matter involving immigration consequences → cross-check with immigration skill

Record any cross-checks. These appear as advisory flags in skill output, not automatic handoffs.

---

### Section 5 — Heightened confidentiality notes

If this practice area was flagged in Part 0 of cold-start:
- Confirm what safeguards apply.
- Note any restrictions: e.g., "No client documents uploaded to sessions; plugin used for research and drafting only on anonymized facts."
- Record whether the professor has confirmed the plugin is appropriate for this area.

---

### Write

After completing all sections:
1. Show the completed practice-area guide entry.
2. Ask for confirmation before writing.
3. Write to the relevant section of `CLAUDE.md`.
4. Confirm what was written and suggest next steps.

---

## Constraints

- Never write without professor confirmation.
- If the practice area was not in the cold-start configuration, flag it and ask whether to add it.
- Pedagogy posture is advisory — the student and professor can override per-case.
- Cross-plugin checks are recommendations — not automatic triggers.
