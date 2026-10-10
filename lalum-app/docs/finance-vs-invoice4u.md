# LALUM books compared with Invoice4U

Sources: screenshots of the Invoice4U dashboard (home screen) supplied on 10 October 2026, the Invoice4U API
documentation, and the first import of the practice's own history (23 months, 273 documents, 109 customers).
Items marked "not verified" were not visible in the screenshots or the data.

## What Invoice4U's home screen offers, and where LALUM stands

| Invoice4U | LALUM today | Gap and priority |
| --- | --- | --- |
| Quick document: type buttons (tax invoice, receipt, tax invoice-receipt, credit) and a customer search on one card | A full editor in the documents tab, five types | Equivalent, but slower for the common case. P2: a "new document" shortcut on the overview with type and customer |
| Existing customers and casual customers toggle | Existing customers only. 42 of 145 historic invoice-receipts (29 percent) and one credit were issued to casual customers | **P1.** The issuing function sends a customer id and cannot send a one-off customer. Without this, a third of real work cannot be issued here |
| Duplicate an existing document | None | **P1.** Most documents repeat (see monthly invoices below) |
| Last 10 documents with email, view and duplicate icons per row | List with edit, delete, PDF link, receipt, credit | Email after issue and in-app view are missing. P2 |
| Tab of open pro formas (חשבונות עסקה פתוחים) | Pro formas appear in the list, with no "open" view and no conversion | **P1.** Pro forma is the step before most tax documents here (91 pro formas against 145 invoice-receipts). Needs a filter and "convert to invoice-receipt" |
| Revenue chart, 12 months, before VAT, with a toggle | Numbers per month, no chart | P2. The figures already match Invoice4U to the shekel |
| Personal area: plan expiry, credit, documents used 5 of 50 | Not applicable | None. LALUM has no document quota |
| Sidebar: documents, customers, reports, clearing, transfers, expenses, accounting, inventory, time clock, market, add-ons, settings | Overview, documents, customers, expenses, archive | Reports export and the customer statement are P2. Inventory, market and add-ons are not needed for the practice. Time recording exists separately in `algo-billing` |

## Patterns in the practice's own data

- **Monthly retainer.** Tax invoices 10001 to 10014 are exactly 10,000 before VAT, issued on the 1st to 5th of each month since
  August 2025. **P1:** a recurring document template that creates the draft each month (it should create a draft for
  review, not issue by itself).
- **Currency.** Invoice4U stores the shekel as the symbol. One US$ invoice-receipt (70034, rate 3.612) and two foreign pro
  formas exist. Foreign documents are now converted with the stored rate.
- **Credit pair.** On 30 September 2026 invoice-receipt 70144 was credited by 50004 and re-issued as 70145. The two nets
  differ by 0.21 (22,087.50 against 22,087.29). Immaterial, but worth a line to the accountant.
- **19 receipts on one day.** Receipts 30001 to 30019 were all issued on 18 June 2025, 11,800 each. Not revenue under the
  report rule. Worth confirming what they settle.
- **Allocation numbers.** Every tax document above 5,000 before VAT issued since 1 June 2026 carries one (checked against 16 rows).
- **Open balances cannot be computed from the archive.** The search results carry no links between receipts, credits and
  invoices, and Paid and Balance read zero for every tax invoice. Real open balances need either the reference links from a
  per-document fetch (`GetDocument`) or the receipts matched by customer and amount. Not done.

## Reconciliation result

Revenue before VAT by issue month (invoices and invoice-receipts, minus credits) matches the Invoice4U chart in all twelve
months from November 2025 to October 2026, differences under one shekel from rounding. Twelve-month total 534,662.70 against
534,663. Months before November 2025 are imported but not checked against anything: the dashboard chart does not reach them.
Document numbering is continuous in all five series.

## Order of work proposed

1. P1 together: casual customers, duplicate document, open pro formas with conversion, recurring monthly template.
2. P2: chart, email and PDF view, reports export for the accountant, customer statement.
3. Then the Shaam allocation step and the numbering engine described in `finance-engine-design.md`.
