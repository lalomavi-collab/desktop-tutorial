# Finance ledger (חיוב והגדרות > הנהלת חשבונות)

Phase 1 for the practice only. The ledger lives in Supabase; legally numbered tax documents are
issued by Invoice4U through the `lalum-fin-issue` edge function.

## Pieces

- `supabase/migrations/0014_lalum_finance_ledger.sql`: customers, documents, payments, expenses. Firm partners and admins with MFA only. An issued document cannot be edited or deleted; cancel with a credit invoice.
- `supabase/functions/lalum-fin-issue`: creates the document in Invoice4U with an idempotency key (`CreateDocumentWithIdentifierValidation`), stores number, allocation number and PDF link. `reconcile` asks Invoice4U whether an uncertain attempt produced a document.
- `src/lib/cockpit/finance.ts` mirrors the database totals. `npm run finance-check` pins both to the same cases.
- UI: `src/pages/cockpit/finance/`, mounted as the first tab of `/settings/billing`.

## Rollout order

1. Apply migration 0014 to the Supabase project.
2. Deploy `lalum-fin-issue` (default JWT verification on). QA mode reads its own secret, `FIN_INVOICE4U_QA_KEY`, and refuses without it; the production key `INVOICE4U_API_KEY` is read only when `FIN_INVOICE4U_ENV=prod`.
3. Leave `FIN_INVOICE4U_ENV` unset (QA). Issue rehearsal documents. They are stamped `is_test` and never count in reports.
4. Before switching to `prod`, verify against Invoice4U: that your QA key issues all five types, the allocation number appears for a document above the threshold, and a credit invoice and a receipt against a rehearsal invoice are accepted.
5. Set `FIN_INVOICE4U_ENV=prod` with the production key. Stop issuing from Invoice4U's own screen at the same moment, so numbering has one source.

## Known limits of phase 1

- Customers that already exist in Invoice4U must be linked by pasting their Invoice4U customer number; a duplicate name is rejected by Invoice4U on creation.
- Invoice4U replies are read in one place, `supabase/functions/_shared/invoice4u.ts` (`npm run invoice4u-reply-check`). A refused key (UnauthorizedUser, ID 80) and a reply with nothing in it are named as such (`invoice4u_unauthorized`, `provider_unreadable`) instead of reading as "customer already exists" or "no customers"; both happened from 21.10.2026. A document is marked issued only with a document number: no error and no number is stored as UNCERTAIN, and reconcile decides. The documents tab has "בדיקת חיבור למערכת ההנפקה" (level 3, `action: "check"`), a read only GetDocuments call that says whether the key is accepted; run it after every key change.
- History from Invoice4U is mirrored read-only in the "ארכיון Invoice4U" tab (migration 0015, function `lalum-fin-import`, env `FIN_IMPORT_ENV`, default prod). The overview report adds archived invoices, invoice-receipts and credits to revenue and VAT by issue date, shows that part separately, and counts a document once if it also exists in the ledger. Foreign currency documents are converted with the rate Invoice4U stored on them. Open balances for archived invoices are NOT computed: the search results carry no links between receipts, credits and invoices, and Invoice4U's Paid and Balance fields read zero for every tax invoice, so they cannot be trusted.
- Expenses are entered by hand. The invoice-processing agent under `python/agents` is the natural feeder later.
- An imported expense line carries `import_key` (date, supplier, description, total, VAT and reference, joined with `|`), unique per firm (migration 20261027220000). The historical import panel inserts with ON CONFLICT DO NOTHING on it, so running the same import twice adds nothing; it reads the keys already in the books, marks those lines "כבר בספרים", and disappears once every line is in. A line entered by hand has no key. Any new import must build its key the same way.
- Allocation number thresholds and the 18 percent VAT default are not hard law in this code: the rate is stored on each document, and thresholds are enforced by Invoice4U and the Tax Authority, not here.

## Status on 12 October 2026

Migrations applied to the live project, in order: 0014 ledger, 0015 archive, 0018 casual customers, 0022 internal note, matter reference,
retainer fields and the date rule, 0023 retainer drafts, 0024 permission levels, 0025 pro forma link. (0016 and 0017, series and sealing,
belong to the own issuing engine; see `finance-engine-design.md`.)

Edge functions: `lalum-fin-issue` (issuing and reconcile, level 3 required), `lalum-fin-import` (read only import from Invoice4U, admin),
`lalum-fin-report-mail` (test copy of the income report to the signed in user only; sender `no-reply@lalumapp.com`, the only verified Resend domain).

Rules the ledger now enforces:
- Permission levels: 0 none, 1 view, 2 drafts and customers, 3 issue, payments and expenses, 4 admin. A partner or admin member without an explicit
  row is level 4. `lalum_fin_can(firm)` still means admin; `lalum_fin_can(firm, n)` means level n. Every level needs the second factor when
  the firm requires it. Changes go through `lalum_fin_set_level` and the append only audit log. Deleting a draft stays at admin level.
- Date rule at issue: not in the future (Israel date), not earlier than the latest issued, non test document of the same type.
- A pro forma is open until an issued invoice or invoice-receipt points at it (`source_proforma_id`). Invoice4U is not told about the link.
- Retainer drafts: one draft tax invoice per active retainer customer and month, never issued automatically.

Accounting basis: the practice works on the cash basis (the Invoice4U setting). A tax invoice or tax invoice-receipt is issued when the money
arrives, so it is income and not a debt. What a customer owes is an open pro forma. The constant `ACCOUNTING_BASIS` in `src/lib/cockpit/finance.ts`
holds this, pending the accountant's confirmation.

Reports tab: income report for bookkeeping, revenue by customer, receivables aging (open pro formas), VAT support card, CSV and print. The
overview shows income over time by week, month and year. The averages count only periods that have ended.

Not built, and why: receipt on account and cancellation receipt (API behaviour unverified, needs a rehearsal in the Invoice4U test environment);
the accountant's scheduled report (needs the owner's approval of a test message and the accountant's answers); PCN874 (needs the accountant and
the official validator); the own issuing engine and the Tax Authority allocation client.

## Tax engine and profit and loss before and after tax (October 2026)

Tab "רווח והפסד ומס" under the overview rubric. Migration `0082_lalum_finance_tax_engine.sql` and the edge function `lalum-fin-tax-advisor` were applied and deployed to the live project on 23 October 2026.

- `src/lib/cockpit/taxEngine.ts`: pure, deterministic. Expense normalization, VAT, accounting profit, the tax reconciliation, the tax liability, the vaults. `npm run tax-check` pins a realistic month to the agora.
- `src/lib/cockpit/taxParams.ts`: every statutory figure, per year, with a status. The shipped 2026 row is a DRAFT: it was not read from the Tax Authority or the National Insurance Institute, and the keren hishtalmut and pension income ceilings are deliberately unset (the deduction is then not applied and a warning shows). No figure is called final until a row is VERIFIED, which the database table enforces with a date and two sources.
- Keeping the figures current: enter each new year as a row in `lalum_tax_params` (it overrides the file) or in `taxParams.ts`. `.github/workflows/tax-params-watch.yml` checks weekly: the engine tests fail the run, while a current year that is missing or a draft (or, from November, a missing next year) leaves a warning and one open issue instead of a red run. Detecting is automatic; applying a figure is not, on purpose.
- Design decisions that differ from a naive reading: advances already paid count as cash out (otherwise safe-to-spend is overstated by exactly that amount); a period shorter than a year is taxed by annualizing the income and scaling back; pension deposits are deducted first and only the remainder earns the credit, so a deposit is never both deducted and credited in full; recognized VAT, unrecognized VAT and the deductible amount are computed and not stored.
- AI: `supabase/functions/lalum-fin-tax-advisor` classifies one expense (rates come from a fixed table, not from the model, except MIXED_CUSTOM) and writes a CFO audit from the engine's figures. It never computes tax and never saves anything.
- Source documents of expenses: `lalum-app/supabase/functions/lalum-fin-expense-doc` and migration `20261027100000_lalum_fin_expense_docs.sql`. A private bucket (`finance-expense-docs`, service role only) and a record per document (`lalum_fin_expense_docs`), several per expense (invoice, receipt, credit note). The object path is the file's sha256 and the upload never overwrites; a replacement marks the earlier row as superseded and keeps its file. No deletion while the expense is in tax retention (0070), and an expense with a document cannot be deleted. Attaching needs level 3 and is audited (`FIN_EXPENSE_DOC_ATTACHED`); opening needs level 1, a bookkeeper included, is audited (`FIN_EXPENSE_DOC_VIEWED`), and gives a 60 second link. The same file behind two expenses is reported on upload. The expenses tab is readable from level 1 and writable from level 3. Checks: `npm run fin-expense-doc-check`, `supabase/tests/fin_expense_docs.sql`.
