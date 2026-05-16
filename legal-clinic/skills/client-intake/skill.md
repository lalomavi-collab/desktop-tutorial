# Skill: client-intake

## Purpose

Structured client intake. Runs practice-area-specific intake questions from the clinic's configured templates, spots cross-area issues, flags potential conflicts of interest, and produces a triage summary for the supervising attorney. Does not decide whether the clinic takes the case.

---

## Invocation

```
/legal-clinic:client-intake
/legal-clinic:client-intake [practice area]
```

---

## Output label

```
[AI-ASSISTED DRAFT — requires student analysis and attorney review]
PRIVILEGED AND CONFIDENTIAL — ATTORNEY-CLIENT COMMUNICATION
ATTORNEY WORK PRODUCT
```

---

## Instructions

Read `CLAUDE.md` to identify: practice areas, jurisdiction, supervision model, intake templates for the relevant practice area, and any heightened-confidentiality flags.

---

### Step 1 — Identify the matter

Ask the student:
1. What practice area does this matter fall under? (If unclear, present the clinic's practice areas.)
2. Has a conflict check been run? (Flag if not: `[FACT NEEDED: conflict check — run before continuing intake]`)
3. Is the client present or has the interview already happened? (Adjust mode: live intake guidance vs. write-up from notes.)

---

### Step 2 — Run intake questions

Load the intake template for the identified practice area from `CLAUDE.md`. If no custom template is configured, use the default questions for the practice area:

**Immigration (default)**
- Full name, date of birth, country of origin, nationality
- Current immigration status (if any); date of last lawful entry
- Basis for relief sought (asylum, TPS, DACA, adjustment, removal defense, other)
- Prior immigration proceedings (including prior removal orders, voluntary departure)
- Criminal history (any arrests, charges, convictions — including dismissed charges)
- Family ties in the U.S. and abroad
- Employment authorization status
- Imminent deadlines or hearing dates
- [FACT NEEDED: any information the student did not obtain]

**Housing (default)**
- Tenant name, address, unit type, lease or rental agreement
- Type of proceeding: eviction / lockout / habitability / subsidy / other
- Notice received: type, date received, deadline stated
- Rent amount, amount allegedly owed, any payment history
- Reason stated for eviction or dispute
- Landlord name and contact (if known)
- Any court hearing date scheduled
- Public housing / Section 8 / voucher involved? (Different rules apply — flag)
- [FACT NEEDED: any information the student did not obtain]

**Family Law (default)**
- Client name, opposing party name and relationship
- Type of matter: divorce / custody / support / protective order / guardianship / other
- Children involved: names, ages, current custody arrangement
- History of domestic violence or abuse (handle with care; do not rush)
- Existing court orders
- Imminent hearing dates or deadlines
- [FACT NEEDED: any information the student did not obtain]

**Consumer Protection (default)**
- Nature of dispute: debt collection / predatory lending / fraud / FCRA / other
- Creditor / collector name and contact
- Amount at issue; nature of alleged debt
- Communications received (letters, calls, texts)
- Any lawsuit filed; any judgment entered
- Client's credit report impact (if relevant)
- Statute of limitations issue? [VERIFY: check jurisdiction-specific SOL]
- [FACT NEEDED: any information the student did not obtain]

**Criminal Defense (default)**
- Client name, charges, case number, court
- Date of arrest; conditions of release / bond status
- Next court date
- Prior criminal history
- Immigration consequences flag: [UNCERTAIN: immigration consequences of this charge — run /research-start on immigration collateral consequences]
- Witnesses, co-defendants
- Client's account of events (narrative — student records, does not editorialize)
- [FACT NEEDED: any information the student did not obtain]

**Civil Rights (default)**
- Nature of claim: employment discrimination / police misconduct / public accommodations / education / housing / other
- Protected characteristic at issue
- Employer / agency / entity name
- Key dates: discriminatory act, any complaint filed, EEOC/DFEH charge (if applicable), charge number
- Exhaustion of administrative remedies status [VERIFY: check jurisdiction — exhaustion requirements vary]
- Witnesses, documents, evidence available
- Statute of limitations: [VERIFY: check applicable SOL for this claim and jurisdiction]
- [FACT NEEDED: any information the student did not obtain]

---

### Step 3 — Cross-area issue spotting

After completing the primary practice area intake, flag any cross-area issues identified. Present as advisory — student and professor decide whether to investigate further.

Common cross-area triggers:
- Immigration case with criminal history → immigration consequences analysis needed
- Housing case with disability → ADA / FHA / reasonable accommodation issues
- Family law case with DV history → protective order, confidentiality, mandatory reporting considerations
- Consumer case with credit report issues → FCRA cross-claim potential
- Criminal case with immigration client → deportation consequences; may require separate immigration counsel

Flag each: `[CROSS-AREA FLAG: immigration consequences — consider /research-start or referral to immigration unit]`

---

### Step 4 — Conflict check flag

If the student has not confirmed a conflict check was completed:

> `[FACT NEEDED: conflict check — required before advising client or accepting matter. Check clinic conflict database against: client name, opposing parties, related entities.]`

---

### Step 5 — Triage summary

Produce a structured triage memo for supervising attorney review:

```
INTAKE TRIAGE SUMMARY
[AI-ASSISTED DRAFT — requires student analysis and attorney review]
PRIVILEGED AND CONFIDENTIAL — ATTORNEY WORK PRODUCT

Client alias: [no identifying information in this field — use case ID]
Case ID: [assigned by student]
Practice area: [area]
Date of intake: [date]
Student: [name]

PRESENTING ISSUE
[2–3 sentence summary of the client's situation and what they are seeking]

KEY FACTS
[Bullet list of material facts from intake]

MISSING FACTS
[FACT NEEDED items — list what is still needed before the matter can be fully assessed]

CROSS-AREA FLAGS
[List any cross-area issues flagged, or "None identified"]

CONFLICT CHECK
[ ] Confirmed clear   [ ] Not yet run — [FACT NEEDED]

IMMINENT DEADLINES
[List any deadline mentioned — note that deadline calculation from triggering event is the student's responsibility per local rules]
[VERIFY: confirm deadline date against local rules before relying]

INITIAL TRIAGE ASSESSMENT
[STUDENT ANALYSIS: Is this matter within the clinic's practice areas and capacity? What is the student's initial view on merit and complexity? What is recommended next step?]

SUPERVISING ATTORNEY REVIEW
[ ] Reviewed   [ ] Case accepted   [ ] Case declined   [ ] Additional intake needed
Notes: ___
```

---

## Constraints

- Never decide whether the clinic accepts a case — that is the supervising attorney's determination.
- Never include client-identifying information in the case ID or alias fields.
- If heightened confidentiality rules apply to this practice area (per `CLAUDE.md`), note them at the top of the output.
- Flag all missing facts — never fill in facts the student did not provide.
- If formal review queue is enabled, queue the triage summary for professor review.
