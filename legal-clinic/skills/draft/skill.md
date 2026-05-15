# Skill: draft

## Purpose

First-draft generation for legal documents. Practice-area templates, jurisdiction-aware, explicitly a starting point. Does not produce final work product — every output requires student analysis and attorney review before use.

---

## Invocation

```
/legal-clinic:draft [document type]
```

Examples:
```
/legal-clinic:draft asylum application
/legal-clinic:draft eviction answer
/legal-clinic:draft protective order motion
/legal-clinic:draft demand letter
/legal-clinic:draft hardship letter
```

---

## Output label

```
[AI-ASSISTED DRAFT — requires student analysis and attorney review]
PRIVILEGED AND CONFIDENTIAL — ATTORNEY-CLIENT COMMUNICATION
ATTORNEY WORK PRODUCT

IMPORTANT: This is a first draft. It is not ready to file, send, or show to a client. The student must:
1. Verify all facts against case notes.
2. Verify all legal citations and rule statements in the jurisdiction.
3. Fill in all [FACT NEEDED] and [STUDENT ANALYSIS] gaps.
4. Have the supervising attorney review before any document leaves the clinic.
```

---

## Instructions

Read `CLAUDE.md` for: jurisdiction(s), supervision model, review gates for the relevant practice area, and any heightened-confidentiality flags.

---

### Step 1 — Intake

Ask the student:
1. What document type is needed?
2. What practice area and case type?
3. Which court or agency (if filing)?
4. What facts are available? (Ask the student to summarize from case notes — do not ask for client-identifying information beyond what is necessary for the draft.)
5. Are there any existing drafts, templates, or prior versions to draw from?

---

### Step 2 — Jurisdiction check

Identify the applicable jurisdiction from `CLAUDE.md` and the student's response. Flag any jurisdiction-specific requirements:

- Local rules: `[VERIFY: check [court] local rules for formatting, page limits, service requirements]`
- Form requirements: `[VERIFY: check whether [court/agency] requires a specific form — do not use this draft if a mandatory form exists]`
- Filing deadlines: `[VERIFY: confirm deadline — student calculates from triggering event per local rules; do not rely on any date in this draft without verification]`

---

### Step 3 — Draft

Produce the first draft using the appropriate template for the document type. Scaffold per the pedagogy posture set in `CLAUDE.md` for this practice area (assist / guide / teach):

- **Assist**: fuller scaffold with sample language; student verifies and edits.
- **Guide**: structure and section headers; student drafts the substantive content.
- **Teach**: framework and placeholders only; student researches and writes.

Apply inline markers throughout:

- `[FACT NEEDED: description]` — where a required fact was not provided. Never guess.
- `[VERIFY: claim — check source]` — where a legal rule or local practice is stated but needs confirmation.
- `[UNCERTAIN: reason]` — where the draft is genuinely unsure (minority rule, unclear local practice, etc.).
- `[STUDENT ANALYSIS: what analysis is needed here]` — where a legal argument or application needs student reasoning.

---

### Document type templates (defaults — customized by /build-guide)

**Asylum application (Form I-589 support — personal statement)**
- Structure: country conditions context → applicant's background → persecution account → nexus to protected ground → fear of future persecution → any bars to asylum (student checks)
- Markers: `[FACT NEEDED: specific incidents of persecution]`, `[VERIFY: country conditions — check State Dept. reports, UNHCR, clinic's country conditions resources]`, `[UNCERTAIN: nexus analysis — state which protected ground applies and why]`

**Eviction answer**
- Structure: caption → general denial → affirmative defenses (waiver, retaliation, habitability, payment, procedural defects) → any counterclaims
- Markers: `[FACT NEEDED: date notice received]`, `[VERIFY: local rule for answer deadline]`, `[STUDENT ANALYSIS: which affirmative defenses apply on these facts?]`

**Protective order motion / petition**
- Structure: caption → statutory basis → relationship of parties → acts of abuse/harassment (chronological) → current danger → relief requested
- Markers: `[FACT NEEDED: specific incidents — date, location, what occurred, any witnesses]`, `[VERIFY: statutory standard for [jurisdiction] — confirm grounds]`, `[UNCERTAIN: whether prior incidents within lookback period — check statute]`

**Demand letter**
- Structure: identification of parties → statement of facts → legal basis for claim → specific demand → deadline for response → consequences of non-response
- Markers: `[FACT NEEDED: amount owed / specific relief sought]`, `[VERIFY: applicable statute / cause of action]`, `[STUDENT ANALYSIS: is the demand proportionate and realistic?]`
- Flag for review: `CHECK WITH PROFESSOR BEFORE SENDING` (demand letters go out under the clinic's name)

**Hardship letter (immigration)**
- Structure: relationship to qualifying relative → qualifying relative's ties to U.S. → hardship factors (medical, financial, emotional, country conditions) → exceptional and extremely unusual hardship standard
- Markers: `[FACT NEEDED: specific hardship details for qualifying relative]`, `[VERIFY: applicable hardship standard for this visa category]`, `[UNCERTAIN: weight of hardship factors — highly fact-specific]`

---

### Step 4 — Review gate

Apply supervision flags per `CLAUDE.md` review gates for this practice area:

- If formal review queue enabled: queue the draft for professor review; append note: "Queued for supervisor review — do not file or send until approved."
- If configurable flags enabled and this document type is a flagged trigger: append `CHECK WITH PROFESSOR BEFORE FILING` / `CHECK WITH PROFESSOR BEFORE SENDING`.
- If lighter-touch: standard output gate applies.

---

## Constraints

- Never produce a draft that purports to be ready to file or send.
- Never fill in a `[FACT NEEDED]` placeholder — if the fact was not provided, leave the flag.
- Never state a legal rule as settled if it is jurisdiction-specific or uncertain — use `[VERIFY]` or `[UNCERTAIN]`.
- If a mandatory official form exists for the document type, flag it and do not produce a substitute.
- Heightened-confidentiality restrictions (per `CLAUDE.md`) take precedence — if this practice area is restricted, apply additional safeguards.
