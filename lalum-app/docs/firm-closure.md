# Closing a firm (offboarding a tenant)

Status: the checklist is built (migration 0062). Every other step below is a manual procedure today; what is not built is listed at the end.

## What it means

A firm leaves the platform as a sequence: **stop activity, hand over the files, start the retention clock, revoke access and secrets, scrub after retention, keep a tombstone.** It is never a `DELETE` of the firm row. Verified on the live project on 2026-10-20:

- About 50 tables cascade from `lalum_firms`. A delete would drop matters, tax documents, trust ledger and signatures silently.
- The audit chain refuses row deletion (append only, by design), so a firm that has audit rows cannot be deleted. The firm row stays as a tombstone.
- Stored originals (250 today) are outside the foreign key graph and would be orphaned in Storage.
- Members' logins (`auth.users`) and secrets (`lalum_private.firm_secrets`, tax connections) are not removed by any cascade.

## Statuses (already in the schema)

`lalum_firms.status` is constrained to `ACTIVE | SUSPENDED | CANCELED`. Use them as: `ACTIVE` working, `SUSPENDED` closing (frozen, export allowed), `CANCELED` closed (dormant, then tombstone). Verified: the intake pipeline refuses any firm that is not `ACTIVE` (HTTP 402). **Not verified:** whether row level security or login behaves differently for `SUSPENDED` or `CANCELED`; the repository code uses the status only for display and for that pipeline check.

## Procedure

| Step | What happens | Today |
|---|---|---|
| 0. Check | Run `select public.lalum_firm_closure_checklist(:firm)` as a partner of the firm (behind MFA) or as the platform admin (second factor session). It returns counts and amounts only. Blockers: client money held, a legal hold, a pending statutory deadline, a signature in flight, a tax document mid issuance. Do not begin while a blocker is non zero. | Built |
| 1. Freeze | Status `SUSPENDED`. Revoke the intake token (`lalum_rotate_intake_token`, then discard it) and the tax connections. Tell the clients. | Manual |
| 2. Hand over | Per matter archive export (the cockpit has an archive export, its completeness is not reviewed). A firm wide package (matters, financial ledger, audit chain with the result of `lalum_verify_audit_chain`, a manifest with hashes) is not built. | Partly |
| 3. Retention clock | `lalum_purge_blocker` blocks a purge only when `handling_ended_at` is set. **On the live project it is set on none of the 22 matters, so no retention block works today.** At closure set it to the closing date on every unpurged matter that has none. | Manual SQL |
| 4. Revoke access | Ban members' logins in Auth, except one custodian with read access. | Manual |
| 5. Scrub | After retention, per matter, through the existing flow: bin, request purge (typed confirmation, legal hold and retention checks), remove originals from Storage, finish purge. The matter row stays, blanked, with `MATTER_PURGED` in the chain. | Existing flow |
| 6. Tombstone | Status `CANCELED`. The firm row and the audit chain stay (the chain holds ids and counts only since 0061). | Manual |

Step 3 today is an update run by the platform admin after the checklist, for example
`update public.lalum_cockpit_matters set handling_ended_at = date '2026-12-31' where firm_id = :firm and purged_at is null and handling_ended_at is null;`
It bypasses any audited path, so write the date, the firm and the reason in the closure record until an audited function replaces it.

## Decisions that are the owner's

1. **Who holds the data after closure.** Recommended: the firm stays responsible for its client data and LALUM acts as processor; the contract must say what is returned, when it is deleted, and who is the custodian of the files. Not analysed here.
2. **Retention periods.** The product shows 7 years from the end of handling (25 for real estate documents). **This was not verified** against the Bar rules' own text, and no period for tax documents was verified. Per the repository rule, none of it may be encoded as law before two independent sources agree.
3. **The audit chain.** Keep it (ids and counts only). Two older `SIGNATURE_SIGNED` rows keep a signer name; accept or record an exception.
4. **Notifying clients and the Bar,** and any duty on closing a practice, are for the owner to confirm. Not analysed here.

## State of the live firm on 2026-10-20 (dry run of the checklist logic, read only)

No blockers and no warnings. Info: 8 live matters, 14 in the bin, 22 matters without a retention clock, 250 originals in Storage, 1 member, no tax connection, no intake token set.

## Not built

An audited `begin closing` function (status, retention clock and revocations in one step, with `CLOSURE_STARTED` in the chain); the firm wide export package; a finishing function that scrubs what retention allows and writes the tombstone; blocking logins in one call; a rehearsal on a Supabase branch with a fake firm. Build these when a second tenant is close.

Tests: `supabase/tests/firm_closure_checklist.sql` (40 assertions, run after the stubs, 0018, 0014, 0019 and 0062; it creates stand ins for the tables no repository migration builds).
