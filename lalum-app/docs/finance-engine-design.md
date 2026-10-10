# Own document engine: design and open questions

Goal: issue tax documents from LALUM itself and retire Invoice4U for issuing. This document fixes the design
and lists what must be verified with the accountant and the Tax Authority before any of it is built.
Status of each fact is marked. Nothing here is legal advice.

## Verified against Tax Authority sources (gov.il)

- An allocation number is requested from the Tax Authority API before the invoice is locked. It applies when the
  amount before VAT exceeds the threshold, VAT is non-zero, the customer is a licensed dealer and asked for it. A
  number can be requested for any invoice. Threshold since 1 June 2026: 5,000 NIS.
  Sources: the Israel Invoice model page and API description for software houses on gov.il.
- The call is OAuth2, carries a unique invoice id (`ID_INVOICE`), a reference number (mandatory from 2025) and the
  software registration number. The allocation number is printed on the invoice, 9 right-most digits emphasised.
- There is an emergency number mechanism, used only after repeated failures of the normal service, each number once.
- Registration of accounting software is mandatory for software designed for sale, rent or use by others, including
  free use. Software for one's own use is outside that duty (gov.il service page; PwC summary of the 2003 directive).
  A registration certificate does not certify that the software meets the bookkeeping instructions.
- Software houses may reach the API through a third-party intermediary service.

## Answered by the practice owner (2026-10-10)

- Software registration field: the practice's business id (`עוסק מורשה`) is `0314717261`. Use this, not `99999999`,
  wherever the registration field is required.
- Numbering: must continue from the last Invoice4U number per document type, not restart. `lalum_fin_series` has to be
  seeded from the archive's highest `doc_number` per type before the own engine seals its first document of that type.
  Not yet done: `lalum_fin_seal_document` today starts a type's series at 1 on first use (see migration
  `0016_lalum_finance_series.sql`); a seeding step from `lalum_fin_archive` is still needed before any real sealing.
- Shaam onboarding (permissions, sandbox access): deferred on purpose. The practice owner and a future session do this
  together, directly on the Tax Authority site, only at the final stage before the 2027-01-01 switch, not before.

## Still NOT verified. Ask the accountant, then the Tax Authority API support (APISupport@taxes.gov.il)

1. Bookkeeping instructions for self-built software used only by the practice: required sequence integrity,
   original and copy handling, signing, backup, retention period.
2. Whether the uniform-structure file module is required for own-use software.
3. Treatment of a number consumed by a document that fails before issue (see below, already built in the database
   layer as the `VOID` status; the open part is purely the accountant question, not the code).

## Numbering and sealing

Rules the design enforces regardless of the answers above:

- One series per document type. A number, once assigned, is never reused and never deleted.
- Because the Tax Authority call needs the reference number, the number is assigned BEFORE that call, inside the
  transaction that moves the document from DRAFT to SEALING. If sealing later fails permanently, the document stays in
  the series as VOID with its reason, never as a hole.
- Flow: DRAFT -> SEALING (number assigned, content frozen) -> ALLOCATED (Tax Authority number stored) -> SEALED (hash
  chain entry written, PDF produced). Documents below the threshold or for non-dealers skip the allocation step.
- Tamper evidence: each sealed document stores the SHA-256 of its canonical content and the previous document's hash
  in the same series, so any later change breaks the chain and is detectable by a verification query.
- PDF: original once, copies marked as copies, allocation number printed per the rule above. Produced after SEALED so the
  PDF is a pure function of stored data.
- Continuity with Invoice4U: confirmed. The first number per type is set from the archive's highest number plus one.
  The archive tab already reports numbering gaps; `lalum_fin_series` still needs a one-time seed from it (not built yet).

## Phases

1. Done: read-only archive of Invoice4U history, reconciliation by type and year, gap detection.
2. Next: run the ledger in parallel on the Invoice4U QA environment; fix what the rehearsal exposes.
3. Build, split in three:
   - Done: `lalum_fin_series` (per firm and type, numbers never reused or deleted), the DRAFT -> SEALING
     state machine, and the hash chain (`lalum_fin_seal_document`, `lalum_fin_void_document`). Database
     only, no Tax Authority call. Migration `0016_lalum_finance_series.sql`.
   - Still to build, not blocked: seed `lalum_fin_series.last_number` per firm and type from
     `lalum_fin_archive`'s highest `doc_number`, so the series continues from Invoice4U instead of starting
     at 1. Needed before any real sealing, regardless of the Shaam timeline.
   - Still to build, blocked: the Shaam client and the SEALING -> ALLOCATED -> SEALED edge function (the
     live gov.il call), plus PDF generation. Deliberately held until the final stage before the switch: the
     practice owner does Shaam onboarding together with a future session, directly on the Tax Authority
     site, not before.
4. Parallel run: each real document produced twice (here as shadow, Invoice4U as the issuing source) for several VAT
   periods; totals and numbering compared.
5. Switch: issuing moves here. Invoice4U stays read-only for the archive and as an emergency fallback.

## Scope guard

This design is for the practice's own use. Letting another firm issue documents through it turns it into software
"for use by others": registration with the Tax Authority, the uniform-structure module and the software-house security
undertakings then apply. That is a separate decision, not a feature flag.
