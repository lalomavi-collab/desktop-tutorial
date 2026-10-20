# Closing a firm (offboarding a tenant)

Status: the checklist (0062) and begin closing / cancel closing (0063) are built. The other steps below are manual today; what is not built is listed at the end.

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
| 1. Freeze | `lalum_firm_begin_closing` sets the status to `SUSPENDED` and clears the intake token (see below). Revoke the tax connections and their vault secrets by hand. Tell the clients. | Built, tax connections manual |
| 2. Hand over | Per matter archive export (the cockpit has an archive export, its completeness is not reviewed). A firm wide package (matters, financial ledger, audit chain with the result of `lalum_verify_audit_chain`, a manifest with hashes) is not built. | Partly |
| 3. Retention clock | `lalum_purge_blocker` blocks a purge only when `handling_ended_at` is set. **On the live project it is set on none of the 22 matters, so no retention block works today.** `lalum_firm_begin_closing` sets it to the effective date on every unpurged matter that has none, and stores which ones, so cancelling undoes exactly those. | Built |
| 4. Revoke access | Ban members' logins in Auth, except one custodian with read access. | Manual |
| 5. Scrub | After retention, per matter, through the existing flow: bin, request purge (typed confirmation, legal hold and retention checks), remove originals from Storage, finish purge. The matter row stays, blanked, with `MATTER_PURGED` in the chain. | Existing flow |
| 6. Tombstone | Status `CANCELED`. The firm row and the audit chain stay (the chain holds ids and counts only since 0061). | Manual |

## Begin closing and cancel closing (0063)

`lalum_firm_begin_closing(firm, effective_date, reason, typed_firm_name, dry_run default true)`. Only the platform admin in a second factor session may call it: a partner asks, LALUM executes.

1. **Dry run first (the default).** It changes nothing and returns whether it would proceed, the blockers, how many matters would get a retention clock, how many of those are in the bin, whether the intake token would be cleared, and the manual steps.
2. **A real run** (`dry_run := false`) needs the firm's exact name typed, a reason of at least 10 characters, an effective date from today to one year ahead (a past date would shorten retention), and zero blockers from the checklist. It then sets the status to `SUSPENDED`, starts the retention clock where there is none (a matter that already has a date keeps it), clears the intake token, writes the closure record (`lalum_firm_closures`, with the reason and the ids it clocked) and `CLOSURE_STARTED` to the audit chain (ids, counts and fixed words only; the reason text is not in the chain).
3. **Read before a real run.** A matter in the bin also gets a retention clock, so it cannot be purged until the retention period after the effective date ends. The dry run counts them (`bin_matters_not_purgeable_until_retention_ends`).
4. **Not done by it, listed in the result as manual steps:** the tax connections and their vault secrets, members' logins, the handover export.

`lalum_firm_cancel_closing(firm, reason)` takes it back: the previous status returns, the clocks it set are cleared (only those still equal to the effective date; one changed later is left alone), the closure record is marked cancelled, `CLOSURE_CANCELLED` goes to the chain. It refuses while a purge is in progress. It cannot restore the intake token: issue a new one.

**Do not run a real closing on the live firm.** It is the only tenant and the owner's own: suspending it stops the intake pipeline (HTTP 402), and its 14 bin matters would become unpurgeable for the retention period. A dry run is safe and is the way to look.

## Decisions that are the owner's

1. **Who holds the data after closure.** Recommended: the firm stays responsible for its client data and LALUM acts as processor; the contract must say what is returned, when it is deleted, and who is the custodian of the files. Not analysed here.
2. **Retention periods.** The product shows 7 years from the end of handling (25 for real estate documents). **This was not verified** against the Bar rules' own text, and no period for tax documents was verified. Per the repository rule, none of it may be encoded as law before two independent sources agree.
3. **The audit chain.** Keep it (ids and counts only). Two older `SIGNATURE_SIGNED` rows keep a signer name; accept or record an exception.
4. **Notifying clients and the Bar,** and any duty on closing a practice, are for the owner to confirm. Not analysed here.

## State of the live firm on 2026-10-20 (dry run of the checklist logic, read only)

No blockers and no warnings. Info: 8 live matters, 14 in the bin, 22 matters without a retention clock, 250 originals in Storage, 1 member, no tax connection, no intake token set.

## Not built

The firm wide export package; a finishing function that scrubs what retention allows and writes the tombstone; blocking logins and revoking tax connections in one call; a rehearsal of a real closing on a Supabase branch with a fake firm. Build these when a second tenant is close.

Tests: `supabase/tests/firm_closure_checklist.sql` (40 assertions) and `supabase/tests/firm_begin_closing.sql` (58 assertions), run after the stubs, 0018, 0014, 0019, 0059, 0060, 0061, 0062 and 0063. They create stand ins for the tables no repository migration builds, and run in any order.
