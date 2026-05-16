# Skill: client-comms-log

## Purpose

Append-only per-case communication log. Records calls, emails, letters, and in-person meetings. Does not store substantive legal analysis — that belongs in the case file and memos.

---

## Invocation

```
/legal-clinic:client-comms-log [case ID]
/legal-clinic:client-comms-log [case ID] add
/legal-clinic:client-comms-log [case ID] view
```

---

## Instructions

Read `CLAUDE.md` for any clinic-specific communication logging requirements. Logs are stored at `client-comms/[case-id]/log.md`.

---

### Add a log entry

Ask the student:
1. Case ID
2. Date and time of communication
3. Type: phone call / email / letter / in-person / voicemail / text (if clinic policy permits)
4. Who participated: student name, client alias (no identifying info), other parties if applicable
5. Brief description: what was discussed or transmitted (factual summary only — no legal analysis)
6. Follow-up needed: yes/no; if yes, what

Append to `client-comms/[case-id]/log.md`:

```
──────────────────────────────────────────
[Date] [Time] | [Type] | Logged by [student] on [log date]
Participants: [student], [client alias], [others]
Summary: [factual summary — 1–3 sentences]
Follow-up: [yes/no — if yes, description]
──────────────────────────────────────────
```

Confirm: "Entry added to communications log for [case ID]."

---

### View log

Display the full communication log for the case in chronological order. Newest entries first.

```
COMMUNICATIONS LOG — Case [case ID]
[AI-ASSISTED DRAFT — student-entered records]

[Most recent entry first]
──────────────────────────────────────────
[Date] | [Type] | [Student]
[Summary]
[Follow-up]
──────────────────────────────────────────
[Prior entries...]
```

---

## Constraints

- Append-only — entries are never edited or deleted after logging.
- No substantive legal analysis in the log — that belongs in memos and the case file.
- No client-identifying information in file names — case ID only.
- Log is not a substitute for the clinic's official case management system if one exists.
