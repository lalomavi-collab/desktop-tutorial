# Skill: supervisor-review-queue

## Purpose

Optional formal review workflow. Only active if the professor chose "Formal review queue" at setup. Shows what is waiting for review, allows the professor to approve, edit, or return with comments. All actions are logged.

---

## Invocation

```
/legal-clinic:supervisor-review-queue
/legal-clinic:supervisor-review-queue approve [item ID]
/legal-clinic:supervisor-review-queue return [item ID] [comments]
/legal-clinic:supervisor-review-queue edit [item ID]
```

---

## Instructions

Read `CLAUDE.md`. If supervision model is not "Formal review queue," say: "The formal review queue is not active for this clinic. Your supervision model is [model]. To enable the queue, update CLAUDE.md."

---

### Queue display

```
SUPERVISOR REVIEW QUEUE
As of [date/time]

Pending review: [count]

──────────────────────────────────────────
[Item ID] | [Case ID] | [Document type] | Submitted by [student] on [date]
Status: Awaiting review
Summary: [1-line description]
──────────────────────────────────────────
[Item ID] | ...
──────────────────────────────────────────

To review an item: /legal-clinic:supervisor-review-queue review [item ID]
To approve: /legal-clinic:supervisor-review-queue approve [item ID]
To return with comments: /legal-clinic:supervisor-review-queue return [item ID] [comments]
```

### Review mode

When the professor reviews an item, display:
1. Full document with `[AI-ASSISTED DRAFT]` label visible.
2. Student's completed sections.
3. Any remaining `[STUDENT ANALYSIS]` gaps (flagged as incomplete).
4. `[VERIFY]` and `[UNCERTAIN]` markers highlighted.

Professor actions:
- **Approve**: mark approved in `review-queue.yaml`; notify student; document is cleared for use per clinic procedures.
- **Return**: add professor's comments; status set to "Returned — student revises"; student receives comment.
- **Edit**: professor makes direct edits; re-displays for confirmation before saving.

---

### Queue log

All queue activity is logged to `supervisor-review-queue/references/review-queue.yaml`:

```yaml
- item_id: "RQ-001"
  case_id: "2024-NNN"
  document_type: "Eviction Answer"
  student: "[name]"
  submitted: "YYYY-MM-DD"
  status: approved          # pending / approved / returned / closed
  reviewed_by: "[professor]"
  reviewed_date: "YYYY-MM-DD"
  professor_notes: ""
```

---

## Constraints

- Only active if supervision model is "Formal review queue" in `CLAUDE.md`.
- Approval does not mean the document is ready to file — it means the professor has reviewed the draft. All court-facing documents require professor signature per applicable rules.
- Queue log is append-only — entries are not deleted.
- If queue is empty, say so; do not display placeholder items.
