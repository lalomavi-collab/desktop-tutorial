# Skill: research-start

## Purpose

Research roadmap for a legal issue. Gives the student leads and a research plan — not authoritative citations. Students verify and develop everything. This is both an ethical safeguard and a pedagogical feature: students still learn to research; they start from a better place.

---

## Invocation

```
/legal-clinic:research-start [legal issue]
```

Examples:
```
/legal-clinic:research-start asylum nexus to political opinion
/legal-clinic:research-start eviction retaliation defense New York
/legal-clinic:research-start FCRA accuracy dispute obligations
```

---

## Output label

```
[AI-ASSISTED DRAFT — requires student analysis and attorney review]

RESEARCH NOTE: This output provides leads and a research framework — not authoritative citations.
Every source listed must be independently verified before relying on it.
If a research tool is connected (CourtListener / Descrybe), retrieved citations are tagged [VERIFIED: source].
All other citations are tagged [VERIFY] and require student confirmation against a primary source.
```

---

## Instructions

Read `CLAUDE.md` for: jurisdiction, practice area, research tool connection status.

---

### Step 1 — Clarify the issue

Ask the student (if not clear from invocation):
1. What is the precise legal question?
2. What jurisdiction? (State, federal circuit, agency)
3. What is the client's position? (What outcome are we researching toward?)
4. What does the student already know? (Avoid duplicating what they've found.)

---

### Step 2 — Research roadmap

Produce the following for the identified issue:

```
RESEARCH ROADMAP
[AI-ASSISTED DRAFT — requires student analysis and attorney review]

Issue: [stated issue]
Jurisdiction: [jurisdiction]
Research tool status: [Connected: source / Not connected — all citations are [VERIFY]]

─────────────────────────────────────────
1. PRIMARY SOURCES — where to look first
─────────────────────────────────────────

Statutes:
  - [Statute name, code section] — [what it covers]
    [VERIFY: confirm current version in [jurisdiction]; check for recent amendments]
  - [Additional statutes if applicable]

Regulations:
  - [Regulation, CFR section or state equivalent] — [what it covers]
    [VERIFY: confirm effective date and current version]

─────────────────────────────────────────
2. CASE LAW — leading authorities to find
─────────────────────────────────────────

[List the types of cases to look for — circuit precedent, state appellate, administrative — without citing specific cases as authoritative.]

Key doctrinal areas:
  - [Doctrinal area 1]: look for cases addressing [specific element or standard]
    [VERIFY: check [circuit/state] for leading case on this point]
  - [Doctrinal area 2]: look for cases addressing [specific element or standard]
    [VERIFY: check whether circuit split exists — [UNCERTAIN: this is a contested area]]

Search strategy:
  - Westlaw / Lexis terms: [suggested search strings in Boolean or natural language]
  - CourtListener: [suggested search if tool connected]
  - Descrybe: [suggested search if tool connected]

─────────────────────────────────────────
3. SECONDARY SOURCES — background and synthesis
─────────────────────────────────────────

  - [Treatise or practice guide name] — [what it covers; good for: background / jurisdiction-specific practice / forms]
    [VERIFY: check library access; confirm current edition]
  - [Agency guidance, practice advisory, or bar publication] — [what it covers]
    [VERIFY: confirm this is current — agency guidance updates frequently]

─────────────────────────────────────────
4. PRACTICE-SPECIFIC RESOURCES
─────────────────────────────────────────

[Resources specific to the practice area — e.g., ILRC practice advisories for immigration; NHLP for housing; NCLC for consumer; NACDL for criminal]
  [VERIFY: confirm currency and applicability to your jurisdiction]

─────────────────────────────────────────
5. KEY ISSUES TO RESOLVE — research agenda
─────────────────────────────────────────

Before completing the analysis, the student should be able to answer:
  1. [Specific question the research should answer]
  2. [Specific question]
  3. [Specific question]
  [UNCERTAIN: [issue] — the answer may turn on jurisdiction-specific authority that the skill does not know well. Verify carefully.]

─────────────────────────────────────────
6. CITATION CHECKLIST
─────────────────────────────────────────

Before relying on any source:
  [ ] Confirmed current and in force (not repealed, superseded, or overruled)
  [ ] Confirmed pinpoint — page, paragraph, or subsection cited is the relevant provision
  [ ] Confirmed jurisdiction — applies to this client's case
  [ ] Shepardized / KeyCited — no negative history for case citations
```

---

### Research tool integration

If a research tool is connected:
- Retrieve leading cases on the identified doctrinal areas.
- Tag retrieved citations `[VERIFIED: CourtListener]` or `[VERIFIED: Descrybe]`.
- Note: verified means retrieved from a connected source — students still Shepardize / KeyCite before filing.

If no tool connected:
- All citations remain `[VERIFY]`.
- Note at top: "No research tool connected. All citations are research leads — verify each against a primary source before relying."

---

## Constraints

- Never present any citation as authoritative without a `[VERIFIED]` tag from a connected research tool.
- Even `[VERIFIED]` citations require Shepardizing / KeyCiting before filing.
- Never state a rule of law as settled if there is circuit split, state variation, or recent development — use `[UNCERTAIN]`.
- Research roadmap is a starting point — not a complete research product. The student develops the research from these leads.
