# Skill: deadlines

## Purpose

Per-case deadline tracking. Add deadlines, view cross-case rollup with warnings at 14/7/3/1 days before the deadline, flag overdue items. Does not calculate deadlines from triggering events — the student does that per local rules.

---

## Invocation

```
/legal-clinic:deadlines                        # View all deadlines, warnings, overdue
/legal-clinic:deadlines [case ID]              # View deadlines for one case
/legal-clinic:deadlines add                    # Add a new deadline
/legal-clinic:deadlines update [case ID]       # Update or extend a deadline
/legal-clinic:deadlines close [deadline ID]    # Mark deadline as met or case closed
```

---

## Instructions

Read `deadlines.yaml`. Read `CLAUDE.md` for warning cadence (default: 14, 7, 3, 1 days).

---

### Add a deadline

Ask the student:
1. Case ID
2. Client alias (no identifying information)
3. Brief description of the matter (no PII)
4. Deadline date (student provides — skill does not calculate)
5. Deadline type: court filing / response / statute of limitations / administrative / other
6. Assigned student
7. Notes (optional)

Write to `deadlines.yaml`. Confirm: "Deadline added for [case ID]: [deadline type] on [date]."

Reminder: `[VERIFY: confirm this deadline date against local rules — the skill does not calculate deadlines from triggering events]`

---

### Rollup view

```
CLINIC DEADLINE ROLLUP — [date]
[AI-ASSISTED DRAFT — verify all dates independently]

OVERDUE
──────────────────────────────────────────
[Case ID] | [type] | Due [date] | [days overdue] days overdue | [student]
  ⚠ OVERDUE — [VERIFY: confirm status with assigned student]

WARNING — DUE WITHIN 14 DAYS
──────────────────────────────────────────
[Case ID] | [type] | Due [date] | [days remaining] days | [student]

[Case ID] | [type] | Due [date] | [days remaining] days | [student]
  ⚠ DUE IN [N] DAYS

UPCOMING — MORE THAN 14 DAYS OUT
──────────────────────────────────────────
[Case ID] | [type] | Due [date] | [student]

CLOSED / MET
──────────────────────────────────────────
[Count] closed deadlines — /legal-clinic:deadlines closed to view

──────────────────────────────────────────
NOTE: Deadline dates entered by students. This rollup does not verify date calculations.
[VERIFY: confirm each deadline independently against local rules and court orders]
```

---

## Constraints

- Never calculate a deadline from a triggering event — that is the student's responsibility per local rules.
- Always include the `[VERIFY]` reminder — deadline dates are entered by students and not independently confirmed.
- Overdue items are flagged but not automatically escalated — the student or professor takes action.
- No client-identifying information in the deadline ledger — case ID and alias only.
