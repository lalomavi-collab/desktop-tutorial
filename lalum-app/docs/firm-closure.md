# Closing a firm (offboarding a tenant)

Status: the checklist (0062), begin closing / cancel closing (0063), finish closing (0065), the export package (0066 and the client side ZIP builder) are built. The originals are not part of the ZIP yet. The other steps below are manual today; what is not built is listed at the end.

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
| 2. Hand over | Per matter archive export (the cockpit has one, see the gaps below). Firm wide: `lalum_firm_export_manifest`, `lalum_firm_export_page` and `lalum_firm_export_originals` (0066) give the database half. The ZIP builder is built (screen `/workspace/export`, "ייצוא נתוני המשרד"); the batch signer for the originals is not. | Partly |
| 3. Retention clock | `lalum_purge_blocker` blocks a purge only when `handling_ended_at` is set. **On the live project it is set on none of the 22 matters, so no retention block works today.** `lalum_firm_begin_closing` sets it to the effective date on every unpurged matter that has none, and stores which ones, so cancelling undoes exactly those. | Built |
| 4. Revoke access | Ban members' logins in Auth, except one custodian with read access. | Manual |
| 5. Scrub | After retention, per matter, through the existing flow: bin, request purge (typed confirmation, legal hold and retention checks), remove originals from Storage, finish purge. The matter row stays, blanked, with `MATTER_PURGED` in the chain. | Existing flow |
| 6. Tombstone | `lalum_firm_finish_closing` sets the status to `CANCELED` once every matter is purged, no tax connection and no intake token is left and the checklist has no blocker. The firm row, the closure record and the audit chain stay (the chain holds ids and counts only since 0061). | Built |

## Begin closing and cancel closing (0063)

`lalum_firm_begin_closing(firm, effective_date, reason, typed_firm_name, dry_run default true)`. Only the platform admin in a second factor session may call it: a partner asks, LALUM executes.

1. **Dry run first (the default).** It changes nothing and returns whether it would proceed, the blockers, how many matters would get a retention clock, how many of those are in the bin, whether the intake token would be cleared, and the manual steps.
2. **A real run** (`dry_run := false`) needs the firm's exact name typed, a reason of at least 10 characters, an effective date from today to one year ahead (a past date would shorten retention), and zero blockers from the checklist. It then sets the status to `SUSPENDED`, starts the retention clock where there is none (a matter that already has a date keeps it), clears the intake token, writes the closure record (`lalum_firm_closures`, with the reason and the ids it clocked) and `CLOSURE_STARTED` to the audit chain (ids, counts and fixed words only; the reason text is not in the chain).
3. **Read before a real run.** A matter in the bin also gets a retention clock, so it cannot be purged until the retention period after the effective date ends. The dry run counts them (`bin_matters_not_purgeable_until_retention_ends`).
4. **Not done by it, listed in the result as manual steps:** the tax connections and their vault secrets, members' logins, the handover export.

`lalum_firm_cancel_closing(firm, reason)` takes it back: the previous status returns, the clocks it set are cleared (only those still equal to the effective date; one changed later is left alone), the closure record is marked cancelled, `CLOSURE_CANCELLED` goes to the chain. It refuses while a purge is in progress. It cannot restore the intake token: issue a new one.

**Do not run a real closing on the live firm.** It is the only tenant and the owner's own: suspending it stops the intake pipeline (HTTP 402), and its 14 bin matters would become unpurgeable for the retention period. A dry run is safe and is the way to look.

## Finish closing (0065)

`lalum_firm_finish_closing(firm, reason, typed_firm_name, dry_run default true)`. Same gate as 0063: only the platform admin in a second factor session, a dry run by default, the firm's exact name typed and a reason of at least 10 characters for a real run.

- **It refuses (`BLOCKED`) while** any matter of the firm is not purged, a tax connection is left, an intake token is set, or the closing checklist reports a blocker. The dry run lists each one.
- **It reports, and does not gate,** `members_logins_not_banned` (members whose Auth login has no future `banned_until`). The platform does not own Auth and one custodian may stay, so banning is the manual step it names.
- **A real run** sets the status to `CANCELED`, stamps `finished_at`, `finished_by` and `finish_reason` on the closure record, and writes `CLOSURE_FINISHED` to the chain with counts and fixed words only (the reason text is not in the chain).
- **It cannot be undone.** `lalum_firm_cancel_closing` only works on `SUSPENDED`, and `lalum_firm_begin_closing` refuses a firm that is not `ACTIVE`. A firm that must come back is a new decision by the owner, not a function.
- Test: `supabase/tests/firm_finish_closing.sql`, run after the stubs, 0018, 0014, 0019, 0059, 0060, 0061, 0062, 0063 and 0065.

## Export package (0066)

The firm is owed its own records, complete and checkable. 0066 adds the read side; the ZIP is assembled in the browser (`src/lib/cockpit/firmExportCore.ts`, `firmExport.ts`, screen `src/pages/cockpit/FirmExport.tsx`). The Edge Function that signs the originals in one batch is **not built yet**, so the ZIP does not contain them.

- `lalum_firm_export_manifest(firm)`: per included table a row count and a sha256, the audit chain check (`lalum_verify_audit_chain`, first broken sequence or none, head sequence and hash), the originals in Storage (count, bytes, how many have no sha256), the excluded tables with a reason, and `unclassified`. Writes one `FIRM_EXPORT_MANIFEST` row to the chain (counts only).
- `lalum_firm_export_page(firm, table, offset, limit)`: the rows of one table as the exact JSON text the hash was computed over, ordered by that text, at most 500 per call. Join all pages of a table with newlines and the sha256 equals the manifest value, so the receiver can verify each `.jsonl` file without trusting the platform.
- `lalum_firm_export_originals(firm)`: document, matter, path, sha256, size, mime and file name for every stored original of a live matter; writes one `FIRM_EXPORT_ORIGINALS` row. Signing the paths and zipping them is the Edge Function's job, in one batch with one audit row. Do not use `lalum_open_original` for 250 files: it writes one chain row and one 60 second link per file.
- **Who may call:** a partner or admin of the firm behind MFA with financial permission, or the platform admin in a second factor session. Allowed in any firm status, `CANCELED` included.
- **Classification, not silence.** Every table with a `firm_id` is included or excluded with a reason (blind index hashes, tax connection credentials, delivery queues, counters, platform records, client portal access, timers, import logs). A table added later and not decided shows in `unclassified` and `complete` turns false: do not hand over a package that says `complete: false`. Checked on the live project on 2026-10-20: 46 included, 11 excluded, none unclassified, none missing `firm_id`. A listed table that loses its `firm_id` fails the manifest loudly instead of exporting an empty file.
- **Names.** Documents are stored with party names replaced by tokens such as `[CLIENT_NAME_1]`; the real names are in the originals. A package without the originals is not a handover. The manifest reports their count so the receiver can check it.
- **Known gap in the per matter export.** `ArchiveExport.tsx` tells the client the original is not kept by the platform and exports only the two text versions. The live project holds 250 originals (68 MB, largest 8.6 MB), each with a sha256. The text is stale and the export omits the originals. That is a copy and product decision for the owner, not changed here.
- **The ZIP (client side).** A partner or admin of the firm opens `/workspace/export` and presses one button. The builder asks for the manifest, pulls every page (at most 500 rows each), rebuilds each `data/<table>.jsonl` and **checks its sha256 against the manifest before anything is zipped**. It refuses, and downloads nothing, when the manifest says `complete: false` or lists an unclassified table, when a table's row count changes during the export, or when any file does not hash to its recorded value. It adds `PACKAGE.json` (files, row counts, hashes, the audit chain result and head, the excluded tables with reasons, the originals summary, `handover_complete`) and a Hebrew `README.txt`. A broken audit chain is reported in the README and on the screen, not hidden and not a reason to refuse: it is a finding the firm must see. The file name is `firm-export-<first 8 characters of the firm id>-<date>.zip`, never a firm or client name.
- **Originals are not in the ZIP.** The package states it plainly in three places (the screen, `PACKAGE.json` with `originals.included: false` and `handover_complete: false`, and the README). It does not call `lalum_firm_export_originals`, so no chain row claims an export of files that were not exported. A firm with no stored originals gets `handover_complete: true`. Until the batch signer exists, do not describe the ZIP as a complete handover of a firm that holds originals (the live firm holds 250).
- Checks: `npm run firm-export-check` (14 assertions on the builder against a fake database: hashes, paging, clamping, count change, a database that never ends a page, incomplete manifests, a manifest of the wrong shape, table names that are not plain identifiers, no dash punctuation in generated text, no row data in `PACKAGE.json`). Run in a real browser against a mock Supabase on 2026-10-20: the ZIP downloads, every file hashes to the manifest, a tampered page and an incomplete manifest download nothing, an attorney gets no button.
- Test: `supabase/tests/firm_export_package.sql`, run after the stubs, 0018, 0014, 0019, 0059, 0060, 0061, 0062, 0063 and 0066.

## Decisions that are the owner's

1. **Who holds the data after closure.** Recommended: the firm stays responsible for its client data and LALUM acts as processor; the contract must say what is returned, when it is deleted, and who is the custodian of the files. Not analysed here.
2. **Retention periods. Verified on 2026-10-20 against two independent sources each.**
   - *Attorney's client file:* Advocates Law s.90A(b), added by Amendment 42 (2024): **7 years** from the end of the attorney's handling or of the legal proceedings, unless the attorney and client agree otherwise in writing (s.90A(c)). Second Schedule item 3: documents of a real estate transaction or proceeding (in Israel or the Area) **25 years**, or another period agreed in writing. It covers "archival material" (any document that may serve as evidence), and **excludes internal documents** (drafts, internal notes) and anything another statute requires to be kept longer (s.90A(l)(2)). The 25 years attach to the document type, not to every document in a real estate matter. Sources: the consolidated statute text (Nevo) and the Knesset's published Amendment 42 text (Sefer HaChukim 3161) together with the Constitution Committee's press release. The old rules (5 years) are replaced; the amendment starts one year after publication, and the exact start date was not verified here.
   - *Accounting records:* Income Tax Instructions (Bookkeeping) 1973, instruction 25(c): **7 years from the end of the tax year, or 6 years from filing the return, whichever is later**; instruction 25(d): contracts, minutes and other documents kept voluntarily, **3 years at least** from filing. Sources: the consolidated text (Nevo) and the copy of the Instructions published by a law firm, matching a Deloitte guide and a CPA firm circular. Neither copy is the Official Gazette; check the Gazette before quoting a section number to a client.
   - The product's 7 and 25 match the law. The matter retention clock is a floor, not the whole duty: a firm that issued tax documents must also keep its accounting records for the tax period above, and the platform does not enforce that.
3. **The audit chain.** Keep it (ids and counts only). Two older `SIGNATURE_SIGNED` rows keep a signer name; accept or record an exception.
4. **Notifying clients and the Bar,** and any duty on closing a practice, are for the owner to confirm. Not analysed here.

## State of the live firm on 2026-10-20 (dry run of the checklist logic, read only)

No blockers and no warnings. Info: 8 live matters, 14 in the bin, 22 matters without a retention clock, 250 originals in Storage, 1 member, no tax connection, no intake token set.

## Not built

The batch signer for the originals (an Edge Function, deploy needs the owner's approval) and putting the originals in the ZIP; blocking logins and revoking tax connections in one call; a rehearsal of a real closing on a Supabase branch with a fake firm. Build these when a second tenant is close.

Tests: `supabase/tests/firm_closure_checklist.sql` (40 assertions) and `supabase/tests/firm_begin_closing.sql` (58 assertions), run after the stubs, 0018, 0014, 0019, 0059, 0060, 0061, 0062 and 0063. They create stand ins for the tables no repository migration builds, and run in any order.
