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

- Software registration field: the practice's business id (`עוסק מורשה`) is the owner's own Teudat Zehut, `031471261`
  (9 digits, Israeli ID check digit valid: digit sum 30, divisible by 10). The first number given, `0314717261`, was
  10 digits and did not pass the check; the owner retyped it directly from the ID card. Use `031471261`, not
  `99999999`, wherever the registration field is required.
- Numbering: must continue from the last Invoice4U number per document type, not restart. `lalum_fin_series` has to be
  seeded from the archive's highest `doc_number` per type before the own engine seals its first document of that type.
  Done: `lalum_fin_seed_series_from_archive(firm)` (migration `0017_lalum_finance_series_seed.sql`) does this seeding;
  it is a callable function, not run automatically, so it must actually be called once per firm before the first real
  `lalum_fin_seal_document` call, or that call will start the type's series at 1.
- Shaam onboarding (permissions, sandbox access): deferred on purpose. The practice owner and a future session do this
  together, directly on the Tax Authority site, only at the final stage before the 2027-01-01 switch, not before.

## Decided by the practice owner (2026-10-10), not independently verified

These three were never confirmed against a primary Tax Authority or accountant source (the accountant email
drafted for them was not sent). The owner chose to proceed on the strict reading rather than wait, so the design
takes the safer side of each question. If a verified answer later turns out looser, nothing here needs to get
stricter; if it turns out stricter still, revisit.

1. Sequence integrity: numbering must be strictly continuous, no gaps. Already the design's own rule regardless
   (see Numbering and sealing below): a number is never reused or deleted, and a failed document is marked VOID in
   place rather than skipped, so there is no gap, only an explained VOID entry.
2. Uniform-structure file module: build it, on the assumption that the stricter, common-practice reading applies
   even though own-use software may be exempt. Not yet built (see Phases).
3. A number consumed by a document that fails before issue: confirmed no requirement beyond what is already built,
   the `VOID` status with its reason. No code change needed here.

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
  The archive tab already reports numbering gaps; `lalum_fin_seed_series_from_archive(firm)` does the one-time seed
  from it, built, but must be called per firm before the first real seal (see Phases below).

## Phases

1. Done: read-only archive of Invoice4U history, reconciliation by type and year, gap detection.
2. Next: run the ledger in parallel on the Invoice4U QA environment; fix what the rehearsal exposes.
3. Build, split in three:
   - Done: `lalum_fin_series` (per firm and type, numbers never reused or deleted), the DRAFT -> SEALING
     state machine, and the hash chain (`lalum_fin_seal_document`, `lalum_fin_void_document`). Database
     only, no Tax Authority call. Migration `0016_lalum_finance_series.sql`.
   - Done: `lalum_fin_seed_series_from_archive(firm)` (migration `0017_lalum_finance_series_seed.sql`) seeds
     `lalum_fin_series.last_number` per type from `lalum_fin_archive`'s highest `doc_number`. Not yet called
     for the practice's firm: still to do, before any real sealing, regardless of the Shaam timeline.
   - Still to build, blocked: the Shaam client and the SEALING -> ALLOCATED -> SEALED edge function (the
     live gov.il call), plus PDF generation. Deliberately held until the final stage before the switch: the
     practice owner does Shaam onboarding together with a future session, directly on the Tax Authority
     site, not before.
   - Done: the uniform-structure file export module (the owner's decision above, taking the stricter reading
     rather than wait for a verified answer), `src/lib/cockpit/shaamExport.ts`. Builds INI.TXT and BKMVDATA.TXT
     from the finance ledger via `@accounter/shaam-uniform-format-generator` (pinned exactly at `0.2.6`: its
     `latest`, `0.2.7`, ships a broken `dist/`). Round trips through that package's own parser and
     cross-validator (`npm run shaam-check`). Scope: documents only (C100/D110/D120), no B100/B110/M100, since
     the practice issues sales documents and keeps no general ledger. Not yet run through the Tax Authority's
     own official file-checker at misim.gov.il: that is a required step before this output is ever used for a
     real filing, not something this module's own tests can substitute for.
4. Parallel run: each real document produced twice (here as shadow, Invoice4U as the issuing source) for several VAT
   periods; totals and numbering compared.
5. Switch: issuing moves here. Invoice4U stays read-only for the archive and as an emergency fallback.

## Scope guard

This design is for the practice's own use. Letting another firm issue documents through it turns it into software
"for use by others": registration with the Tax Authority, the uniform-structure module and the software-house security
undertakings then apply. That is a separate decision, not a feature flag.
