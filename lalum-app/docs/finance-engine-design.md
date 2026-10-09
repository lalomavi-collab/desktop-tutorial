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

## NOT verified. Ask the accountant, then the Tax Authority API support (APISupport@taxes.gov.il)

1. Bookkeeping instructions for self-built software used only by the practice: required sequence integrity,
   original and copy handling, signing, backup, retention period.
2. Whether the uniform-structure file module is required for own-use software.
3. Which value goes in the software registration field when no certificate exists: the Tax Authority documents give
   both `99999999` and "the producer's company or identity number". Ask which applies.
4. Onboarding to Shaam: which permissions the practice owner must grant, sandbox access.
5. Whether numbering may continue from the last Invoice4U number per document type, or must restart.
6. Treatment of a number consumed by a document that fails before issue (see below).

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
- Continuity with Invoice4U: the first number per type is set from the archive's highest number plus one, if question 5
  allows it. The archive tab already reports numbering gaps.

## Phases

1. Done: read-only archive of Invoice4U history, reconciliation by type and year, gap detection.
2. Next: run the ledger in parallel on the Invoice4U QA environment; fix what the rehearsal exposes.
3. Build: series and sealing in the database (`lalum_fin_series`, sealing RPC, hash chain), PDF, Shaam client against the
   Tax Authority sandbox. Production Shaam only after questions 1 to 6 are answered.
4. Parallel run: each real document produced twice (here as shadow, Invoice4U as the issuing source) for several VAT
   periods; totals and numbering compared.
5. Switch: issuing moves here. Invoice4U stays read-only for the archive and as an emergency fallback.

## Scope guard

This design is for the practice's own use. Letting another firm issue documents through it turns it into software
"for use by others": registration with the Tax Authority, the uniform-structure module and the software-house security
undertakings then apply. That is a separate decision, not a feature flag.
