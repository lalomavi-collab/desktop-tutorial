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
2. Deploy `lalum-fin-issue` (default JWT verification on). It reuses the `INVOICE4U_API_KEY` secret.
3. Leave `FIN_INVOICE4U_ENV` unset (QA). Issue rehearsal documents. They are stamped `is_test` and never count in reports.
4. Before switching to `prod`, verify against Invoice4U: that your QA key issues all five types, the allocation number appears for a document above the threshold, and a credit invoice and a receipt against a rehearsal invoice are accepted.
5. Set `FIN_INVOICE4U_ENV=prod` with the production key. Stop issuing from Invoice4U's own screen at the same moment, so numbering has one source.

## Known limits of phase 1

- Customers that already exist in Invoice4U must be linked by pasting their Invoice4U customer number; a duplicate name is rejected by Invoice4U on creation.
- History from Invoice4U is mirrored read-only in the "ארכיון Invoice4U" tab (migration 0015, function `lalum-fin-import`, env `FIN_IMPORT_ENV`, default prod). The overview report adds archived invoices, invoice-receipts and credits to revenue and VAT by issue date, shows that part separately, and counts a document once if it also exists in the ledger. Foreign currency documents are converted with the rate Invoice4U stored on them. Open balances for archived invoices are NOT computed: the search results carry no links between receipts, credits and invoices, and Invoice4U's Paid and Balance fields read zero for every tax invoice, so they cannot be trusted.
- Expenses are entered by hand. The invoice-processing agent under `python/agents` is the natural feeder later.
- Allocation number thresholds and the 18 percent VAT default are not hard law in this code: the rate is stored on each document, and thresholds are enforced by Invoice4U and the Tax Authority, not here.
