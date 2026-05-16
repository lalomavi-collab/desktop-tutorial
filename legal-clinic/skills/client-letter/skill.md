# Skill: client-letter

## Purpose

Routine correspondence templates. Appointment confirmations, document requests, brief status updates, follow-up letters. Does not handle substantive legal advice — use `/status client` for that.

---

## Invocation

```
/legal-clinic:client-letter [type]
```

| Type | Use for |
|---|---|
| `appointment` | Confirm or reschedule a client meeting |
| `doc-request` | Request documents from client |
| `follow-up` | Follow up on unreturned calls or missing items |
| `update` | Brief status update without substantive advice |
| `close` | Case closing letter |

---

## Output label

```
[AI-ASSISTED DRAFT — requires student analysis and attorney review]
Strip this label before sending to client.
```

---

## Instructions

Read `CLAUDE.md` for: clinic contact information, supervision model, review gates.

Ask the student:
1. What letter type?
2. What information should be included? (appointment date/time, documents needed, case update — student provides)
3. Is there anything sensitive about this client or matter that requires extra care?

---

### Letter templates

#### Appointment confirmation

```
[Date]

[Client alias — do not use identifying information in the file name]

Dear [Client name or "you"],

This letter confirms your appointment with [Clinic Name]:

Date: [date]
Time: [time]
Location: [address or video link]
Meeting with: [student name]

Please bring: [list any documents the student specifies]

If you cannot attend or need to reschedule, please contact us as soon as possible at [clinic contact].

[STUDENT ANALYSIS: Is any instruction in this letter unclear? Anything missing for this client's situation?]

Sincerely,
[Student name]
[Clinic Name]
[Contact information]
```

#### Document request

```
[Date]

Dear [Client name or "you"],

Thank you for meeting with us. To move your case forward, we need the following documents from you:

Documents needed:
  1. [Item — specific description]
  2. [Item]
  3. [Item]
  [FACT NEEDED: list any additional documents the student specified but did not include]

Please provide these by [date, if applicable].

You can bring them to our office at [address], email them to [clinic email], or [other method].

If you have any questions about what we need or have difficulty obtaining any of these documents, please contact us at [clinic contact].

[STUDENT ANALYSIS: Are the document descriptions clear to a non-lawyer? Is the deadline realistic?]

Sincerely,
[Student name]
[Clinic Name]
[Contact information]
```

#### Follow-up

```
[Date]

Dear [Client name or "you"],

We have been trying to reach you regarding your case. We want to make sure everything is okay and that you have not missed any important deadlines.

Please contact us as soon as possible at [clinic contact].

If we do not hear from you by [date], we may need to [consequence — e.g., close your file / notify the court / other — STUDENT ANALYSIS: what is the appropriate consequence to state?].

Sincerely,
[Student name]
[Clinic Name]
[Contact information]
```

#### Brief status update (no substantive advice)

```
[Date]

Dear [Client name or "you"],

We wanted to update you on your case. [One or two sentences of non-substantive update — e.g., "We have received your documents and are reviewing them." / "Your next court date is [date]."]

We will be in touch with more information soon. In the meantime, if you have questions, please contact us at [clinic contact].

[STUDENT ANALYSIS: Does this update include any substantive legal advice? If so, use /status client instead of this template.]

Sincerely,
[Student name]
[Clinic Name]
[Contact information]
```

#### Case closing letter

```
[Date]

Dear [Client name or "you"],

We are writing to let you know that [Clinic Name] is closing your file as of [date].

[Reason for closing — student provides: e.g., "The matter has been resolved." / "We are unable to continue representation at this time." / "You have obtained other counsel."]

[If applicable: "Your next deadline is [date]. You will need to [action required by client — STUDENT ANALYSIS: confirm this is accurate and appropriate to include]."

[If applicable: "We are returning / retaining your documents as follows: [description]."]

If you have any questions, please contact us at [clinic contact].

We wish you well.

Sincerely,
[Student name, Supervising Attorney name]
[Clinic Name]
[Contact information]
```

---

### Supervision flags

Apply per `CLAUDE.md`:
- Case closing letters: always flag `CHECK WITH PROFESSOR BEFORE SENDING` — closing a file is a significant step.
- If formal review queue enabled: queue all client letters for professor review.
- All other letters: flag per supervision model.

---

## Constraints

- Never include substantive legal advice in a client letter — use `/status client` for that.
- Never include client-identifying information in draft file names — use case ID and alias.
- Closing letters must be reviewed by supervising attorney before sending — always flag.
- Plain language throughout — flag any legal jargon for rewriting.
