# Audit log hygiene (migration 0061)

The audit log (`lalum_matter_audit_log`) is an append-only hash chain. Whatever is written into it stays, so the rules are about what goes in.

## Rules in the database

- **A matter with a history is not deleted.** `matter_id` is `ON DELETE RESTRICT`. The app never deletes a matter row: the bin flags it,
  `lalum_finish_purge_matter` clears the children, blanks the title, sets `purged_at` and appends `MATTER_PURGED`. A hard `DELETE` of a matter
  that has audit rows now fails with a foreign key error instead of a trigger error. A matter with no audit rows can still be deleted.
  Deleting a whole firm is still impossible while it has audit rows (its rows cascade into the trigger); there is no offboarding procedure yet.
- **No personal names in the chain, referenced by id.** `lalum_append_audit` refuses a `meta` key named `name`, `full_name`, `signer_name`,
  `client_name`, `first_name`, `last_name`, `phone`, `address`, `id_number`, `tax_id` or `email`, at any depth, in any case. Values are not
  inspected (the existing rule against e-mail addresses in values stays). The signer's typed name lives in
  `lalum_signature_requests.signed_name`; the chain records only the request id.
- The rule fails closed: a writer that starts sending one of those keys makes its own call raise, and the feature that called it fails loudly.
  Today's writers send ids, counts, enums and fixed words only (checked against the live functions and the pipeline's meta).

## What this does not cover

- **Documented exception: two existing `SIGNATURE_SIGNED` rows.** Recorded on 2026-10-20 at the owner's instruction. Two rows written before 0061
  carry the signer's typed name in `meta` (checked on the live project: exactly two rows have a `name` key). The chain is append only and each row is
  hashed into the next, so rewriting or deleting either one breaks verification of every later row of that firm. They are therefore left as they are.
  - *Scope:* these two rows only. From 0061 on, `lalum_portal_sign` writes the request id alone and `lalum_append_audit` refuses a personal data key, so no new row can add to the exception.
  - *Where the name lives:* `lalum_signature_requests.signed_name`, which can be erased with the signature record. The chain copy cannot.
  - *If an erasure request names one of these signers:* erase the signature record, state in the reply that two audit entries keep the name for the integrity of the log, and take the legal view (a record kept to prove who signed, and the log's integrity purpose) from counsel for that case. This is a recorded position, not a legal analysis.
  - *Revisit when:* a second tenant joins, or the first erasure request that touches these rows. The remedy then is a new chain segment agreed with the owner, never an edit in place.
- **Free text.** Migration 0064 moves the partner's conflict note out of the chain. `lalum_set_conflict_status` now writes the text to `lalum_conflict_notes`
  (readable by the firm's partner or admin, no direct write grant) and puts only `note_chars` and `note_sha256` into `meta`, so the chain still proves which
  text was recorded. `lalum_finish_purge_matter` clears the notes with the matter's other children. Checked on the live project on 2026-10-20: no
  `CONFLICT_STATUS_SET` row exists yet, so no earlier note sits in the chain. Test: `supabase/tests/conflict_notes.sql`.
- This is a technical control, not a legal analysis of retention or erasure duties for the log. That question stays with the owner.

## Tests

`supabase/tests/audit_log_hygiene.sql` (run after the stubs, 0018, 0014, 0019, 0059, 0060, 0061, with a stand-in `lalum_signature_requests`
and an `extensions.digest` shim, as in the header of the file). `audit_log_hardening.sql` for 0060 still passes.
