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

- Business identity (confirmed by the owner 2026-10-13): the practice is an individual עוסק מורשה, number `031471261`
  (the owner's own Teudat Zehut, 9 digits, check digit valid: digit sum 30, divisible by 10). It is not a company. The
  old Invoice4U business names are out of scope and nothing is carried over from them automatically.
  Addresses are two different things: the finance system (A000 record, internal use) uses the real office, HaIrisim 8,
  Netanya; the official address shown to clients on the public site and on issued documents is Herzliya Pituach
  (HaMedina HaYehudim, number and postal code to be confirmed) until the owner decides otherwise. Documents are not
  issued by this system yet, so the client facing address is not configured here.
  Software registration number (accounting_software_number): the Tax Authority's own API description says that where
  the software has no registration certificate, the number of the producer of the document is written instead, so this
  system writes the business number.
- Numbering: must continue from the last Invoice4U number per document type, not restart. `lalum_fin_series` has to be
  seeded from the archive's highest `doc_number` per type before the own engine seals its first document of that type.
  Done: `lalum_fin_seed_series_from_archive(firm)` (migration `0017_lalum_finance_series_seed.sql`) does this seeding;
  it is a callable function, not run automatically, so it must actually be called once per firm before the first real
  `lalum_fin_seal_document` call, or that call will start the type's series at 1.
- Shaam onboarding (permissions, sandbox access): deferred on purpose. The practice owner and a future session do this
  together, directly on the Tax Authority site, only at the final stage before the 2027-01-01 switch, not before.
- 15 October 2026: the owner asked to start this earlier after all, on the strength that the practice is one
  self-employed business (`עוסק מורשה`) building the software for its own use, not for sale or rent to others; the
  Tax Authority's own guidance already exempts self-use software from the heavier software-house registration. On the
  Tax Authority's own registration screen the owner found a "number of users" field with no visible guidance for a
  one-person, self-use case. A clarification email was drafted asking how to fill that field for a sole self-use
  developer, and whether the lighter self-use registration path applies. No session here could send it (the connected
  Outlook account has read-only Graph permissions, no send/draft scope, and an attempted admin consent grant was
  declined on review: the app bundle also carries `Mail.Send`, `Files.ReadWrite.All`, `Calendars.ReadWrite` and Teams
  send, far more than drafting needs, an unjustified exposure for a mailbox that holds client correspondence). The
  owner sent it manually instead, 16 October 2026, 09:29 Israel time, to `mokedmh@shaam.gov.il` (a general Tax
  Authority service address found by web search, not an address this project independently verified as the correct
  one for software-house questions specifically).
- 19 October 2026: the owner also sent a more detailed version of the same question, from a personal Gmail account
  (`lalomavi@gmail.com`, not the firm's own Outlook), to `APISupport@taxes.gov.il` and `lakohot-bt@taxes.gov.il`.
  These are the verified correct addresses for this team: a reply came back the same day from `APISupport@taxes.gov.il`
  (signed "מלכה"). The reply answers part of the question, not all of it:
  - Registering as a software house (needed for the production environment) is not handled by this team; call the
    Tax Authority's general line, `*4954`, for that track.
  - The sandbox/test environment is different: any user can register there directly, no software-house registration
    needed. Registration is self-serve at `https://openapi-portal.taxes.gov.il/sandbox` (CREATE ACCOUNT & SIGN IN),
    with a reply expected within 5 business days. This is very likely why the registration screen the owner found
    showed no software-house-specific fields with sensible self-use answers: that screen was probably the sandbox
    flow, which does not carry the "number of users" question. The production software-house registration (where
    that field most likely lives) is a separate, later step, consistent with the plan to hold that off until just
    before the 2027-01-01 switch.
  - The other five questions in the owner's email (software registration number field, the correct host for test vs.
    production, access/refresh token lifetimes, whether a registered intermediary service may be used, expected
    turnaround and cost) were not answered in this reply and remain open.
  - The owner completed sandbox registration at the link above on 20 October 2026, via a separate browser session
    (not blocked by this environment's network policy, which still cannot reach any `gov.il` host). Awaiting the
    Tax Authority's response, up to 5 business days per their own reply.
  - Still on 20 October 2026, via that same separate browser session (the working environment here still cannot
    reach any `gov.il` host directly), the owner signed in to the portal and browsed the authenticated API Products
    catalog: 21 products, confirmed under business number `031471261` (matches the practice's own number, see
    above). The signed-out catalog shows only 4 of these, among them `EilatInvoices` (`EilatInvoiceApprovalApi`),
    which is scoped to Eilat free-trade-zone transactions, not the general invoice call. The likely candidate for
    the general allocation-number call is a different product, `invoices_approval`, whose listed services are
    `Invoices v2` and `Multi-invoices v2` (also `invoice-information v1`, `InvoiceDecisionApi v1`,
    `MultiInvoiceInformationApi v1`); a separate product plainly named `Invoices` appears to be query/information
    only. The portal's own Name search is unreliable (searching "Invoice" returned no results although matching
    products exist) so filtering by name should not be trusted; browsing the full catalog (21 products, one page
    at 75 items per page) is.
  - Still on 20 October 2026, the same browser session opened `Invoices v2`'s own OpenAPI 3.0.1 definition on the
    product page (`https://openapi-portal.taxes.gov.il/sandbox/product/28607/api/18168`) and read it directly, in
    page memory, no file saved. This confirms the candidate above: the service is titled "Allocation Number
    Retrieval Service for Invoices (Supplier Side)".
    - Call: `POST /Invoices/v2/Approval`. Sandbox host: `https://openapi.taxes.gov.il/shaam/tsandbox/Invoices/v2/Approval`
      (the same path also exists under `t-ita-api.taxes.gov.il` and `ita-api.taxes.gov.il`). The same service also
      exposes `GET /Invoices/v2/health` and `GET /Invoices/v2/alive`.
    - Request body (`InvoiceRequest`), 13 required fields: `invoice_id` (string, up to 50 chars, internal/temporary
      bookkeeping reference), `invoice_type` (one of the fixed codes 300, 305, 310, 320, 330, 332, 340, 345, 348),
      `vat_number`, `invoice_reference_number` (string, up to 20 chars, the mandatory reference number noted
      above), `customer_vat_number`, `invoice_date`, `invoice_issuance_date` (`YYYY-MM-DD`),
      `accounting_software_number` (int32, matches this design's own field of the same name), `amount_before_discount`,
      `discount`, `payment_amount`, `vat_amount`, `payment_amount_including_vat` (amounts as doubles). Optional
      fields include `action` (0, 3 or 4), customer/company identifiers, delivery/transport fields, up to three
      `additional_information*` fields reserved for future use, and an `items[]` array of invoice lines
      (`InvoiceItem`: index, catalog id, category, description, unit, quantity, unit price, discount, total,
      VAT rate, VAT amount).
    - Response (`ResponseApproval`): `status`, `message`, `confirmation_number` (string; this is the allocation
      number), `approved` (boolean). Documented response codes: 200, 400, 406, 500; a 400 example shows code 434,
      "Invoice date is too old for approval", with `confirmation_number` `"0"`.
    - Sandbox test VAT numbers documented on the page: `777777715` allocates; `777777723` simulates a delayed
      invoice; `777777731` an invoice found with no instruction on how to proceed; `777777749` an invoice found
      where the next step was already chosen.
    - Auth: OAuth2, authorization-code flow, provider `longtimetoken`
      (`.../longtimetoken/oauth2/authorize` and `.../oauth2/token`, same three hosts as above), scope `scope` or
      `invoices_scope` ("Security Option 1" / "Security Option 2" on the page), `Authorization: Bearer` header,
      JSON content type.
    - Not yet checked: `Multi-invoices v2` and `InvoiceDecisionApi` (the latter likely handles the "delayed
      invoice" case above). No PDF version of this definition was found on the page, only "Download as
      JSON/YAML" links that generate a temporary in-browser file, not a stable URL.
  - 20 October 2026, continued: the owner registered an application in the sandbox portal ("Get access"),
    named `lalum-invoices-sandbox`, redirect URI `https://localhost/callback`, subscribed to the product's
    Default Plan (100 calls/minute), covering `Invoices v2`, `Multi-invoices v2`, `InvoiceDecisionApi v1`,
    `MultiInvoiceInformationApi v1` and `invoice-Information v2`. This answers the open question above: the
    portal issued a **Key and Secret pair** ("Credentials for your new application", shown once), not only a
    bearer token, so a `client_id`/`client_secret`-style credential does exist. Handled carefully: no
    screenshot of the credentials dialog, the owner copied them directly into his own password vault, and no
    session here has seen or stored either value.
  - Still 20 October 2026: after the subscription completed, the same browser session checked the `Invoices v2`
    page again (view only) for anything new. Two of the three open questions above are now answered: the
    portal's "Key" is the OAuth2 `client_id`; and no `X-IBM-Client-Id` header is required, confirmed by the
    page's own Parameters list (only `Accept` and `Content-Type`, both optional) and its sample code (only
    `Authorization`, `content-type`, `accept`). Auth is OAuth2 authorization-code only. What this means in
    practice: getting an access token needs an interactive browser login (redirect to
    `https://localhost/callback`, then exchanging the returned code for a token), which only the owner can do
    (it needs his own sandbox login); not yet done. Still open: the token's and any refresh token's lifetime,
    and exactly how long the resulting access token stays usable before that login has to be repeated.
  - 20 October 2026, continued: the owner attempted the authorization-code login himself (browser, outside this
    environment, since gov.il is unreachable here either way), using a one-off local script (Python, run in his
    own terminal, never pasted into any session here) to exchange the returned code for a token. Along the way
    he deleted `lalum-invoices-sandbox` (kept only `lalum-invoices-sandbox-2`, to remove the ambiguity of two
    registered apps) and confirmed he still holds that app's Key and Secret. The token exchange returned
    `HTTP 401 Unauthorized` with no further detail (the first script version did not capture the response
    body on that specific request; a corrected version that does was handed to him but not yet run to
    completion). Root cause not yet established: candidates include a stale/expired authorization code (it is
    short-lived), a mismatch between the SMS/login verification step and the OAuth code itself (the owner was
    unsure which "code" was which at one point), or something the scope (`invoices_scope`) or redirect URI
    needs that is not yet understood. The owner is calling the Tax Authority's own support line to troubleshoot
    directly rather than continuing to guess. Paused here; token lifetime and refresh-token behavior remain
    unknown until a token is actually obtained.
  Separately still blocked on the client side: this working environment cannot reach gov.il at all (outbound network
  policy), so the two official API specification PDFs (`vat_software-houses-180724.pdf` edition 2.0 and
  `IncomeTax_software-houses-050623.pdf` edition 1.0, both under `gov.il/BlobFolder`) have not been read yet, and
  the live OAuth/HTTP call cannot be exercised from here either way. The request/response shape is specific
  enough that the typed client code is already built (`src/lib/cockpit/shaamClient.ts`, see Phases below), in
  TypeScript, consistent with the rest of this app and its existing Supabase edge functions (Deno); any live
  call this project makes stays in that same stack, not a separate language. Next: once the owner has a working
  access token (after Tax Authority support resolves the 401), a session here can build the edge function that
  performs the token exchange and the live call, reading Key/Secret from a Supabase edge function secret.
- Business address for the A000 record's `businessStreet`/`businessHouseNum`/`businessCity` (11 October 2026): האיריסים
  8, נתניה. `src/lib/cockpit/shaamExport.ts`, `LALUM_BUSINESS_ADDRESS`. Internal to the compliance file only, on the
  owner's explicit instruction: this does not go on the public site (footer, structured data, contact pages), which
  still carries the Herzliya Pituach office address. No postal code: not given, not guessed.

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
   - Done, and live: `lalum_fin_series` (per firm and type, numbers never reused or deleted), the DRAFT ->
     SEALING state machine, and the hash chain (`lalum_fin_seal_document`, `lalum_fin_void_document`).
     Database only, no Tax Authority call. Migration `0016_lalum_finance_series.sql`. Note: this migration
     and `0017` below sat merged on `main` for weeks without being applied to the real project
     (`meoymkcotomoluwlwues`); `lalum_fin_series` did not exist there until 11 October 2026, after two
     further migrations (`0018`, `0022`) had already landed on top of the gap. Checked both for conflicts
     before applying late: neither touches the guard trigger or status constraint this migration owns, so
     applying out of order was safe. Flagging this so the same gap is checked for on the next migration.
   - Done, and seeded: `lalum_fin_seed_series_from_archive(firm)` (migration
     `0017_lalum_finance_series_seed.sql`) seeds `lalum_fin_series.last_number` per type from
     `lalum_fin_archive`'s highest `doc_number`. Run for the practice's firm on 11 October 2026: INVOICE
     10014, RECEIPT 30019, INVOICE_RECEIPT 70145, CREDIT 50004, PROFORMA 90091 (273 archive rows total,
     matching the archive's own row count exactly). The first number sealed by the own engine for each
     type will be one above these.
   - Done, 20 October 2026 (built earlier than the original plan below, per the owner's 15 October decision
     to start now): the pure request/response mapping for the live "Invoices v2 Approval" call,
     `src/lib/cockpit/shaamClient.ts`. Builds the `InvoiceRequest` body from a sealed `FinDocument`
     (reusing `DOC_TYPE_CODE` from `shaamExport.ts` for `invoice_type`), parses `ResponseApproval`
     (reusing `allocationShort` from `financeAllocation.ts`), and flags missing or malformed required
     fields before ever sending anything. No network code: `npm run shaam-client-check` proves the mapping
     against the definition's own documented examples, not that gov.il accepts a real call.
   - Still to build, blocked: the actual OAuth2 call and the SEALING -> ALLOCATED -> SEALED edge function
     that uses the client above. Blocked on two unknowns the Tax Authority's reply has not addressed:
     whether the credential from registering an application ("Get access") is a long-lived token to use
     directly or a client_id/client_secret pair to exchange per call, and access/refresh token lifetimes.
     PDF generation is separately still to build. Originally deliberately held until the final stage before
     the switch; the owner's 15 October decision moved the client code earlier, but the live call itself
     still needs the owner's own application registration first.
   - Done: the uniform-structure file export module (the owner's decision above, taking the stricter reading
     rather than wait for a verified answer), `src/lib/cockpit/shaamExport.ts`. Builds INI.TXT and BKMVDATA.TXT
     from the finance ledger via `@accounter/shaam-uniform-format-generator` (pinned exactly at `0.2.6`: its
     `latest`, `0.2.7`, ships a broken `dist/`). Round trips through that package's own parser and
     cross-validator (`npm run shaam-check`). Scope: documents only (C100/D110/D120), no B100/B110/M100, since
     the practice issues sales documents and keeps no general ledger. Not yet run through the Tax Authority's
     own official file-checker at misim.gov.il: that is a required step before this output is ever used for a
     real filing, not something this module's own tests can substitute for.
   - Done: a "קובץ מבנה אחיד" screen in the finance cockpit (`ShaamExportTab.tsx`). Owner picks a period
     (defaults to the quarter just ended), the screen filters to `SEALED` documents in range and downloads
     the two files. Pure client-side; nothing to export yet since the own engine cannot reach SEALED
     without the Shaam edge function below, and Invoice4U already files its own uniform-structure file for
     the current period. Becomes useful the moment that edge function ships.
4. Parallel run: each real document produced twice (here as shadow, Invoice4U as the issuing source) for several VAT
   periods; totals and numbering compared.
5. Switch: issuing moves here. Invoice4U stays read-only for the archive and as an emergency fallback.

## Scope guard

This design is for the practice's own use. Letting another firm issue documents through it turns it into software
"for use by others": registration with the Tax Authority, the uniform-structure module and the software-house security
undertakings then apply. That is a separate decision, not a feature flag.
