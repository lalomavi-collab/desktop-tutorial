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
- History from Invoice4U is mirrored read-only in the "ארכיון Invoice4U" tab (migration 0015, function `lalum-fin-import`, env `FIN_IMPORT_ENV`, default prod). The overview report adds archived invoices, invoice-receipts and credits to revenue and VAT by issue date, shows that part separately, and counts a document once if it also exists in the ledger. Foreign currency documents are converted with the rate Invoice4U stored on them. Open balances for archived invoices are NOT computed: the search results carry no links between receipts, credits and invoices, and Invoice4U's Paid and Balance fields read zero for every tax invoice, so they cannot be trusted.
- Expenses are entered by hand. The invoice-processing agent under `python/agents` is the natural feeder later.
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

Tab "רווח והפסד ומס" under the overview rubric. Migration `0082_lalum_finance_tax_engine.sql` is NOT applied by merging: it needs the owner's approval.

- `src/lib/cockpit/taxEngine.ts`: pure, deterministic. Expense normalization, VAT, accounting profit, the tax reconciliation, the tax liability, the vaults. `npm run tax-check` pins a realistic month to the agora.
- `src/lib/cockpit/taxParams.ts`: every statutory figure, per year, with a status. The shipped 2026 row is a DRAFT: it was not read from the Tax Authority or the National Insurance Institute, and the keren hishtalmut and pension income ceilings are deliberately unset (the deduction is then not applied and a warning shows). No figure is called final until a row is VERIFIED, which the database table enforces with a date and two sources.
- Keeping the figures current: enter each new year as a row in `lalum_tax_params` (it overrides the file) or in `taxParams.ts`. `.github/workflows/tax-params-watch.yml` fails weekly while the current year is missing or a draft, and from November when next year's row is absent. Detecting is automatic; applying a figure is not, on purpose.
- Design decisions that differ from a naive reading: advances already paid count as cash out (otherwise safe-to-spend is overstated by exactly that amount); a period shorter than a year is taxed by annualizing the income and scaling back; pension deposits are deducted first and only the remainder earns the credit, so a deposit is never both deducted and credited in full; recognized VAT, unrecognized VAT and the deductible amount are computed and not stored.
- AI: `supabase/functions/lalum-fin-tax-advisor` classifies one expense (rates come from a fixed table, not from the model, except MIXED_CUSTOM) and writes a CFO audit from the engine's figures. It never computes tax and never saves anything.
