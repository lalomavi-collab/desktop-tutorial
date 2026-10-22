# Invoice4U feature inventory and LALUM build spec

Source: read-only mapping of the live Invoice4U account by Chrome Claude, 10 and 11 October 2026 (document creation forms,
cancel and link flows, drafts, item catalog, clearing, CSV templates). Nothing was saved, issued or sent during mapping.
Tags: (L) seen live, (C) taken from the client code or translation file, not seen live. Every (C) item must be treated as a
hypothesis until checked against a real run. No customer names, amounts or bank details were recorded.

Scope per the owner's decisions: five document types only (tax invoice, receipt, tax invoice-receipt, credit, pro forma).
Quote, work order, delivery note, purchase order, deposit, inventory, time clock and market are out of scope.

## 1. Form structure shared by all document types (L)

Header, transaction details, footer. The differences between types are in section 2.

| Element | Invoice4U behaviour | LALUM today | Action |
| --- | --- | --- | --- |
| Number | Next number shown up front, per type, not editable | Assigned at issue by Invoice4U | Own series exists (0016, 0017). Show next number once we issue ourselves |
| Date | Empty by default. Allowed range: from the date of the last document of the same type up to today. No back dating, no future dating | No rule | **Adopt.** Enforce in the database at issue time. Ask the accountant to confirm wording of the bookkeeping instruction |
| Due date | Tax invoice and pro forma. Default end of current month. Set by customer payment terms | Payment terms per customer is decided (G4), not built | P1 part 2 |
| Currency | 25 currencies. Foreign currency adds an editable exchange rate (prefilled with today's rate) and an option to issue in shekel presentation. Pay on document disappears for foreign currency | Currency stored per document, conversion with stored rate in the archive only | P2. Rate field editable, prefilled from a rate source, stored on the document |
| Language | Hebrew or English | Hebrew only | P3 |
| Customer | Existing, casual (name, ID, email), or self invoice (tax invoice only) | Existing and casual (invoice-receipt and credit) | Done. Self invoice is not needed |
| Subject | Optional free text | Exists | None |
| Lines | VAT status per line (taxable or exempt), code, description (500), quantity (default 1), price before VAT and price with VAT computed both ways | Lines with quantity and price, VAT per document | P2. Add exempt line status (foreign client, Eilat) |
| Discount | Document level, amount or percent. A line level discount exists but is off by default and enabled in account settings, so it does not show on the form (corrected after the customers round) | None | P2. Both levels, line level on from the start |
| Rounding | "Round amount" checkbox, default on | Totals computed in the database | Decide with the accountant whether rounding to whole shekels is allowed. P2 |
| Notes | One external note (5,000 chars) printed at the bottom. Fixed text block printed from settings. **No internal note that is not printed** | Notes field on the document | **Improve.** Add `internal_note`, never printed, never in the PDF |
| Attachments | Up to 3 files (JPG, PDF, PNG), 2MB each, 5MB total | None | P3 |
| Payment reminder | Per document, none or 5, 7, 10 days after due date (C) | None | P3. Only after email sending exists |
| Pay on document | Allow or not, installments 1 to 12, embedded payment link | `lalum-pay` links exist separately | P3 |
| Allocation number | "I want an allocation number" checkbox on documents | Handled by Invoice4U today | Required in the own engine. Design in `finance-engine-design.md` |
| Actions | Save draft, preview, create document | Save draft, issue | Add preview (PDF draft with watermark) in the own engine phase |

## 2. Matrix by document type (L)

| Type | Series | Due date | Customer | Lines | Payments | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| Tax invoice | 10xxx | yes | existing or self invoice | yes | no | Pay on document |
| Receipt | 30xxx | no | existing, mandatory | no (subject only) | yes | |
| Tax invoice-receipt | 70xxx | no | existing or casual | yes | yes | Panel to link previous documents |
| Credit | 50xxx | no | existing or casual | yes, column "amount to credit" | no | No rounding checkbox |
| Pro forma | 90xxx | yes | existing, mandatory | yes | no | Allocation number checkbox, pay on document |

LALUM already follows the same customer rules for casual customers: invoice-receipt and credit only. Invoice4U also allows
casual customers on quotes, which are out of scope.

## 3. Payment methods on receipts and invoice-receipts (L)

Eight methods. Several rows can be added to one document. A running "total paid" is shown.

| Method | Fields |
| --- | --- |
| Credit card (default) | card type, card number, expiry MM/YY, number of installments (default 1) |
| Cash | none |
| Cheque | bank, branch (depends on bank), account number, cheque number |
| Bank transfer | bank, branch, account number |
| Bit | extra details |
| PayBox | extra details |
| Other | free text |
| Tax withheld at source | none, counts as a payment, totals before and after withholding |

Design decision for LALUM: store the **last four digits only** for cards. Invoice4U keeps the full card number as free text
on the receipt, and its bulk CSV import takes number, expiry and CVV in clear text. Do not copy either. A cheque row needs
bank, branch, account and cheque number, because cheque tracking is how deposits are reconciled.

## 4. Flows between documents

### 4.1 Linking to previous documents (L)
On a tax invoice-receipt, after choosing a customer a notice offers earlier documents to link. Search by type (pro forma,
work order, quote, delivery note), date range (default three months back). Columns: type, number, issue date, total, balance,
"update amount" for partial linking. Documents with different exchange rates cannot be linked together. The new document
closes the linked ones.

### 4.2 Converting a pro forma (L)
There is no convert button. A pro forma becomes a receipt or an invoice-receipt through the linking panel or through "create
linked document" in the document report. A tax invoice can be linked only to a receipt.

### 4.3 Cancelling (L and C)

| Source | Can be cancelled | Cancelling document |
| --- | --- | --- |
| Receipt | yes | cancellation receipt |
| Tax invoice | yes | credit |
| Tax invoice-receipt | yes | credit |
| Pro forma and everything else | no | close the status and issue a new document |

Documents created in the old Invoice4U system cannot be cancelled. The cancelling document is the evidence of cancellation.
LALUM today: credit only, against invoice or invoice-receipt. **Gap:** cancellation receipt for a receipt. Adopt the same
matrix.

### 4.4 Invoice for receipt (L)
A screen that produces tax invoices for receipts that already exist (filter by date and payment type: card or cheque).
This is the mirror of the practice's prepaid cheque pattern: the receipt is issued first, the tax invoice follows. It is
the model for the "receipt on account" concept in P1 part 2: a customer balance of receipts not yet matched to an invoice,
and an action that issues the invoice against them.

### 4.5 Retainer (L)
One screen issues the month's pro formas for every customer flagged as retainer: month and year pickers, a table of
customer, item description, amount before VAT, amount with VAT, multi select, button "create pro forma". This is the only
recurring document mechanism in the forms. Standing orders in clearing are a second one. LALUM design: a monthly
**draft** template per customer, created on a schedule, never issued without a person pressing issue.

### 4.6 Duplicate (L)
Via the top search "duplicate document / navigate", by type, number, customer or subject. No button inside the form.
LALUM already has a duplicate button per document, which is better.

### 4.7 Drafts (L and C)
Search by date range and type with quick ranges. Actions: open draft, delete one, delete marked, email the draft to the
user. Behaviour: save as draft on every form, a check for an existing draft when opening a form, automatic draft save before
redirecting to create a customer, and a `FromDraft` flag on the issued document. LALUM has drafts. **Gaps:** auto save
before leaving the form, list filter by type and date. P2.

### 4.8 Document report actions (L)
Per row: view, lock, email, WhatsApp, create linked document, cancel, email status (sent, opened), allocation number view.
Bulk: close marked, reopen marked, send to my email, send to customer email, print. Validations: cannot close a closed
document, cannot reopen an open one. LALUM has none of these beyond list and PDF link. P2: email to customer with sent and
opened status, bulk close.

**Status 21 October 2026:** per document view, send by e-mail (customer, extra addresses, own copy as bcc, editable subject and text, PDF attached with the link in the body), WhatsApp with the message prepared (click to chat, logged as opened, no delivery receipt), copy link, print, a send log per document, a "sent" line in the list, and bulk send to customers or to the owner. Migration 0077 and the function `lalum-fin-doc-send`. Still open: lock and bulk close, SMS.

**Status 22 October 2026 (migration 0078):** delivery and open status per send (delivered, opened, bounced, complained) from the mail provider through the webhook function `lalum-fin-doc-send-webhook`, shown in the send log and as a line in the list; send from the history archive (the link is asked of `lalum-fin-archive-pdf` at send time, so it works only while that function returns a link). An open is a tracking image loading: shown when known, never shown as "not opened". It needs open tracking switched on for the sending domain at the mail provider, which also puts the image into every other mail from that domain. Update 22 October 2026: while the provider returns no print link for history documents (GetDocument answers `d:null` even with a fresh API key), an archive document can be sent with a PDF the partner downloads from Invoice4U and attaches by hand in the send panel (PDF only, up to 4 MB, checked again by the function; the mail carries the file and no link; WhatsApp is not offered for a hand attached file). Still open: lock and bulk close, SMS.

### 4.9 Email, SMS and signature (C only, not seen live)
Email dialog after creation: recipient list with extra addresses, free text for the email body, optional SMS to a phone
number. Warnings when the customer has no email. Default recipient is the user, plus the customer if an email exists. The
customer signature feature is an integration with a third party signing product and is limited by a quota. A graphic
business signature is set in the document design settings. Original and "true copy" labels are print modes. For LALUM:
email from avraham@lalum.co only (decision G3). Signature integration is not needed.

## 5. Item catalog (L)

Fields: code (optional), description (required, 500 chars), price before VAT, price with VAT (the two update each other on
blur, VAT 18 percent, rounded to two decimals). List with search, active and inactive, bulk delete, bulk activate and
deactivate. CSV import with a template (item name plus one of the two prices are required). LALUM has no catalog. A law
practice bills a small set of services. P2: a catalog of recurring items, used by the document line picker.

## 6. Clearing (C, partly L)

Provider connected: Cardcom. Charge a customer, charge by token, refund transaction. Step 2 is the provider's hosted page.
The client code lists five other providers. Installments plus "receipt now, tax invoice at each due date" is an automated
process. A soft block warns when no Tax Authority connection exists and the document is above the allocation threshold.
LALUM keeps `lalum-pay` for its own payment links (decision G5, clearing stays as is). Nothing to build here now.

## 7. CSV templates (L)

Items (12 columns), customers basic (11) and advanced (19, with contact, accounting contact and an internal note), bulk
issuing for each type including variants with payment method columns. Customer templates keep original spelling errors in the
headers (`BussinesNumber`, `ExtrnalNumber`). Bulk issuing templates carry card number, expiry and CVV in clear text, which
fails card industry rules. LALUM: customer CSV import and export are P3. Never import card data.

## 8. Mapping status

| Area | Status |
| --- | --- |
| Document forms, 9 types | Done (L) |
| Payment methods, currency, discount, rounding | Done (L) |
| Linking, conversion, cancel matrix | Done, partly (C) |
| Drafts, item catalog, CSV templates | Done |
| Email dialog, signature, partial credit | (C) only. Needs a test customer and a rehearsal in the QA environment |
| Documents list (`/reports/document`) | Done in part: columns, filters, statuses (open, closed, credited, partly credited) and actions are known (section 11 and 4.8) |
| Customers screen and customer card | Done (section 10) |
| Reports and accounting exports | Done (section 11) |
| Settings | Done (section 16). Business details, bank details and numbering were reported by the owner earlier and are not repeated in the map |
| Expenses | Not activated (separate legacy app). Section 14. Recommended not to activate |
| Inventory, time clock, marketplace, add-ons | Done (section 15) |
| Standing orders, clearing, payment page, transfers | Done in part (section 13); standing orders and tokens are paid add-ons, locked |

## 10. Customers module (L unless marked)

Invoice4U's customer module is thin. Mapped read-only; nothing saved. No names, tax ids, emails or amounts were recorded.

**List.** Simple search plus advanced search on 9 fields (one shows only customers created from leads). Four columns; the
external bookkeeping number is editable inline. Four row actions: customer report, update details, issue document, notes log.
Export to Excel only.

**Card.** Three tabs for a new customer; two more for an existing one ("balance adjustment", "card details management").
Payment terms: 8 options from immediate to net 30 plus 120, default immediate. Name, tax id and bookkeeping number must each
be unique. One internal note field per customer, shown on quotes only if ticked, otherwise private. One contact and one
accounting contact, as plain text fields.

**Notes log.** Activity journal per customer, 3 entry types, each can be emailed.

**Ledger (כרטסת).** Debit, credit and balance columns, plus a separate column for pro formas. A statement can be emailed to the
customer. The open invoices report totals each currency separately.

**Absent:** customer groups or tags, a standing customer discount, several contacts, merge, archive (a customer is marked
inactive), an aging report by day ranges, and a casual customer entity (a casual customer exists only as fields on the
document, with no card and no ledger).

**Deleting** is allowed only for a customer with no documents (C, from the translation file, not tried).
Price lists live in the locked inventory module and were not mapped.

**Details from the full customers report (L unless marked)**

- Card tabs: details, contact, monthly retainer; an existing customer adds balance adjustment and card token management.
- Several extra e-mail addresses, each with a "send documents here too" tick (default on). LALUM has one e-mail. P2: extra
  addresses with the same flag, needed for sending.
- A non numeric tax id field (C: used for foreign customers). LALUM accepts any text in `tax_id`; keep it free text and skip
  checksum validation for foreign customers.
- External bookkeeping number: auto filled running number, unique, 10 chars. Not needed unless the accountant's software asks.
- Retainer tab holds the monthly pro forma template per customer: a flag, a description, and an amount (before or with VAT).
  One billing line per customer. LALUM design: store `retainer_description` and `retainer_amount` on the customer and create a
  monthly draft from them (decided already as draft only, never auto issue).
- The ledger has a separate column for pro formas, which are not accounting documents and stay out of debit. The amounts are
  shown in shekels after conversion. The open invoices report offers filters for overdue or not and for type (tax invoice or
  pro forma), and totals per currency.
- Standing orders and a stored card token are managed from the customer card (service paid, not active in this account).
  Out of scope.
- Importing customers rejects duplicates by name, tax id or bookkeeping number; no merge exists.
- Whether an inactive customer is hidden from the document form's customer picker is not verified.

**LALUM position**

| Item | Today | Action |
| --- | --- | --- |
| Uniqueness | Not enforced | Enforce unique tax id when present (23 of 109 have none, so it cannot be mandatory) and unique name. 7 e-mails are shared, so e-mail stays non unique |
| Payment terms | Not built (decision G4) | P2, with due date on invoice and pro forma |
| Internal note per customer | `notes` exists | Keep, never printed |
| Contacts | One e-mail, one phone | P3: a separate contacts table, accounting contact for statements |
| Archive | `archived` flag exists | Better than Invoice4U. Merge with soft delete is P3 |
| Statement and ledger | Archive revenue only, no balances | P1 part 2 (receipt on account) then P2 customer statement by e-mail |
| Aging report | None | P2, per currency |
| Manual balance adjustment | None | Do not build. Corrections go through credit documents. If ever needed: reason, audit trail, partner only |
| Client, matter, document hierarchy | Client and document | **Not now.** The mapping suggested it, but it is not required to replace Invoice4U and it changes every table and every report. Add an optional free text `matter_ref` on the document first, and revisit only if reports by matter become a real need |

## 11. Reports (L unless marked)

Seven reports in the menu: documents list, customer ledger, income for bookkeeping, income chart, open invoices, income by
item, payments. Common parts: date range with quick buttons, branch, per column filter, totals row, paging. Export to Excel
and PDF, e-mail and print (the e-mail dialog takes one address and offers no format or body). **No CSV export.** Amounts are
converted to shekels at an undeclared rate, except the open invoices report which totals per currency.

| Report | Shows | Note for LALUM |
| --- | --- | --- |
| Documents list | One tab per type. Header: period total, daily average, monthly and yearly forecast. Status filter: open, closed, credited, partly credited | We have a list. Add the status filter and the forecast line, P2 |
| Customer ledger | Debit, credit, pro forma column, balance | P2, after receipt on account |
| Income for bookkeeping | One table per document type (tax invoice, invoice-receipt, credit) with net, VAT, rounding, total and a link to each document | The accountant report. Our archive summary already matches it by month |
| Income chart | Monthly net income, 12 months, current or previous year | P2 |
| Open invoices | Overdue filter, type filter, totals per currency | P2, per currency |
| Income by item | Quantity, average price and total per item | Needs an item catalog. P3 |
| Payments | By payment method, with cheque number and last card digits | P2, after the payment methods table |

**Not in this account:** VAT report and PCN874 (inside a locked bookkeeping module; the accountant prepares both from her own
software), an aging report by day ranges, and income by customer. These three are the real gaps, and each can be built from
data we hold: a VAT report by period, `ar_aging` (0 to 30, 31 to 60, 61 to 90, over 90) and `revenue_by_customer`.

**Accounting exports (inside account settings, sent by e-mail only, never downloaded):**
- Export to a bookkeeping package: card mapping (cash, credit, cheques, transfers by currency, other; purchases, input VAT,
  tax withheld, output VAT, income, exempt income, casual customer card, lawyer expenses, lawyer deposits), Windows or DOS
  format, optional separate card for deposits and for casual customers.
- Uniform structure file (Directive 36): period and e-mail, then "produce".

**Automatic income report to the accountant (L for the settings, C for the content).** In account settings: frequency (none,
monthly, every two months), accountant e-mail, day of month 1 to 28. This account: monthly on the 1st. The content is the
income report of the previous period split by tax invoices, invoice-receipts and credits, each with a link to the document.
The e-mail format (probably a PDF with links) is **not verified**; ask the accountant for one real e-mail.

**LALUM decision (owner, 11 October 2026):** the accountant report is built as a feature of the system, not as an accountant
login. It is a scheduled report with PDF and Excel attached together, several recipients, an editable subject and body, a send
log and a "send now" button. Nothing is sent before the owner approves a test to himself. Add direct download for
accounting exports with an audit log entry.

## 12. Users and permission levels (decision, 11 October 2026)

The owner runs the practice alone today. The finance module is built so that staff can be added later without redesign.
Today `lalum_fin_can(firm)` allows only partners and admins with a second factor, which is one level. Replace it with a
level per user.

| Level | Can do |
| --- | --- |
| none | No access to finance |
| view | Read documents, customers, reports |
| draft | view, plus create and edit drafts and customers. Cannot issue |
| issue | draft, plus issue, cancel through a credit, record payments and expenses |
| admin | issue, plus settings, series, users, exports, manual corrections |

Rules: the level is stored in `lalum_fin_permissions (firm_id, user_id, level)` and read by `lalum_fin_can(firm, min_level)`;
the second factor stays mandatory for `issue` and `admin`; the owner is `admin` and cannot remove the last admin; every
issue, cancel, export and permission change writes an audit row with user and time; an accountant, if ever added, gets `view`
limited to reports and exports, created on request only. Row level security and the edge functions both check the level,
because the browser is never the control.

## 13. Clearing, payment page and transfers (L for screens, C for the locked add-ons)

Nothing was charged, credited, transferred or subscribed to during mapping.

- **Clearing setup:** there is no screen to choose a clearing company. The terminal is set up through Invoice4U's customer
  service; the charge screen shows read only that the account is connected to Cardcom. The number of credit installments and
  charging without CVV are terminal settings, not interface settings.
- **Charge types:** regular, installments (2 to 12) and a credit transaction whose range is set in the terminal. With
  installments there is an option to issue the receipt now and a tax invoice on each due date (an automatic process the owner
  must confirm). This is a good feature to copy later.
- **Payment page for the customer:** title, price, 4 currencies, page state, the document type produced; design with a logo or
  image and 10 background templates; payment by card and/or PayPal, with or without installments. The customer fills name,
  phone, e-mail and tax id, then sees the processor's card window.
- **Clearing log:** filters by status, transaction type, currency, card number and customer; an error detail column; export to
  Excel, e-mail and print, no PDF.
- **Card refund:** only against an existing transaction in the system. Partial refund allowed. Can issue a credit invoice
  automatically.
- **Paid add-ons, locked in this account:** saved cards (token) 12 NIS a month, standing orders 29 NIS, sales pages 19 NIS.
  Fields known from the translation file only.
- **"Transfers"** is not an outgoing bank transfer. It is a service that sends the customer a payment link for a bank transfer
  (Open Finance); when the money arrives, an invoice-receipt is produced automatically. 2 NIS plus VAT per operation, not
  enabled here. It includes setting the practice's receiving bank accounts and a transfers report with 9 statuses.

**LALUM position**

| Item | Decision |
| --- | --- |
| Own clearing adapter with stored tokens | **Not now.** The mapping suggests a Cardcom adapter with built in tokens. That puts card handling and its processor obligations inside our system for a practice that charges a handful of customers by transfer or cheque. Keep `lalum-pay` links as they are (decision G5). Revisit only if card charges become a meaningful share |
| Card data | Never store a card number or CVV. If clearing is ever added: last four digits and the processor token only, refunds tied to a charge id and capped at the remaining amount, an automatic credit invoice |
| Receipt now, invoice at each installment date | Not needed. Our pattern is a monthly retainer and prepaid cheques, handled by receipts on account (section 9) |
| Payment page and transfer links | P3, only through `lalum-pay`. An Open Finance provider is worth a look for large fees because it avoids clearing commission. Not before the core ledger is in use |
| Clearing log | Not applicable without clearing |

## 14. Expenses and accounting export (L for the export, expenses not activated)

**Expenses and bookkeeping** are a separate legacy application (its own host, embedded in a frame) that is not activated in this
account. Clicking "manage expenses" opens a sign up window; the transactions list fails with a server error from that host.
Live mapping would need joining the service, which is irreversible in the account. **Decision (recommended): do not activate.**
LALUM already has its own expenses tab, and the mapped features (receipt upload, OCR with an approval queue, suppliers, profit
and loss, VAT, advance payments, PCN) are things we build ourselves on our own data. Known without activation: expense entry,
supplier invoice upload from computer or phone, OCR with a "to analyse and approve" queue, supplier management and the reports
above. Expense categories: no information found.

**Export to a bookkeeping package (L, fully mapped)**
- Packages: Hashavshevet (Windows or DOS; ZIP with `Movein.doc`, `.dat`, `.prm`) and "Financit" as export formats. Other packages (Rivhit, Priority, double entry bookkeeping) exist only as marketplace services, not as export formats (corrected after step 7).
- Dates: sequential only. Cannot export a date earlier than the last export, cannot include today; only the last export can be
  cancelled.
- Content: income documents only (7 kinds of invoices, receipts and credits) as debit and credit journal lines. Expenses are not
  exported.
- Card mapping: about 25 cards: cash boxes by payment method and currency, income, output and input VAT, tax withheld, and two
  cards for lawyers: lawyer expenses and lawyer deposits.
- Uniform structure file: start and end date, e-mail; the files arrive by e-mail within an hour. No template builder.

**LALUM position**

| Item | Decision |
| --- | --- |
| Trust money and disbursements | A separate entity with a ledger per matter, not a column on income. Invoice4U separates them from fee income only at export. This is a Bar Association rule, not only bookkeeping. #732 (billing model) already carries trust tables; do not duplicate them here, consume them |
| Income and expenses in one database | Yes. Required for profit and loss, net VAT and PCN874 straight from our data |
| Period lock after export | Adopt. After an export, documents dated inside the exported range are frozen for the export purposes, and a later export starts after the last one |
| Hashavshevet export | Build only after the accountant confirms the package and sends her card list. The mapping above is the checklist |
| Uniform structure file | #755 builds it in this repository. It must pass the Tax Authority's own validator before any use |
| Expenses OCR | Later. Use the existing invoice agent under `python/agents`, with an approval queue and the client never trusted |

## 15. Inventory, time clock, marketplace and add-ons (L unless marked)

Nothing was installed, activated or saved; four activation windows were closed without confirming.

- **Inventory:** items, warehouses, suppliers, quantities, sale and purchase price lists. Locked in the package; mapped from the
  page structure and the translation file only (C). An inventory item has purchase price, supplier, warehouse, stock alert and
  serial number. A price list has a name, a discount (percent or amount) and assigned customers, assigned from the price list
  screen, not from the customer card. Not needed by a law practice. A per customer price list would be useful, but it exists
  only in the locked module.
- **Time clock:** it is an **employee attendance clock** (in and out, hour quotas, overtime at 125 to 200 percent, a payroll
  employee number), not billable time. The service is active but the only employee is inactive, so adding a report was blocked.
  Screens: employees, projects, reports, an employee entry link, self reporting per customer, and conversion of hours to a tax
  invoice or pro forma. It passes hours only: no hourly rate, no activity description, no time rounding; a project is a name and a
  status. Weak for a law practice.
- **Marketplace:** 30 integrations, "details" button only, no direct install. Clearing (Pay, Isracard, Upay, Bit, Apple Pay, Google
  Pay), web shops (WordPress, Shopify, Magento, Cashcow), automation (Zapier, Integromat), mailing (several), bookkeeping
  (Hashavshevet, Rivhit, Priority, Financit, Taxplanner, double entry).
- **Add-ons:** mailing, lead CRM, API and document signing. The CRM is built on old pages: a lead form with source, agent,
  contact and address; no sales stages and no conversion to a matter. The API screen was deliberately not opened, to avoid
  exposing keys.

**LALUM position**

| Item | Decision |
| --- | --- |
| Billable time, rates, fee agreements, detailed fee invoice | This is the largest gap against what a law practice needs, but it is **not the finance ledger's lane**. The billing model PR (#732) already carries time entries, rate cards, fee terms per matter, milestones and the link from ledger to matter. Do not rebuild it here. The finance module's job is to accept a draft generated from those entries. Order: settle #732, then a "draft from time entries" action. Rate priority matter, then client, then default |
| Inventory and price lists | Not needed |
| Marketplace, mailing, shop and automation integrations | Not needed |
| Lead CRM | Exists in other lanes of this app (inquiries, leads). Not part of finance |
| Document signing | Already exists in this app (`lalum_signature_requests`, `lalum-esign`). Linking a signed fee agreement to a matter is a later step |
| API access to the books | Later and read only, behind the permission levels of section 12 |

## 16. Account settings (L unless marked)

Nothing was saved, no API key generated, no payment made. Thirteen sub sections; the facts that matter:

- **Users and permissions:** locked in this package; opens only from the 100 documents a month plan. Per translation file (C): a
  user has e-mail, name, mobile and a predefined permission type. Open or closed per module (issuing, customers, reports,
  clearing, settings). **No permission per customer, matter or branch.**
- **Branches:** name, description, e-mail, default account, status; can show on the document next to or instead of the business
  name. The account has **2 businesses**.
- **Design and templates:** 21 default settings (language, original and copy, dates, rounding, decimals, pay button, reminders,
  line discount and more), logo, graphic signature and illustration, 18 templates, 13 colours, a fixed text per document type.
- **E-mail templates:** exactly one, rich text, global to all documents, no variables, none per type.
- **Notifications:** payment reminder 2, 5, 7 or 10 days after the due date, SMS per document type, the accountant report. No
  notification centre.
- **Integrations and API:** one key per account. The existing key is never displayed and **creating a new key overwrites it**. No
  webhooks. "Israel Invoices": the Tax Authority authorisation, valid for a year, with renew and disconnect.
- **Plan:** 50 documents a month, valid until 5 March 2027. Four yearly plans at 21, 31, 44 or 89 NIS a month before VAT for 50 to
  500 documents and 2 to 5 businesses.
- **Security:** second factor (off or on), change of e-mail and password (8 to 16 characters with upper, lower, digit, symbol).
  **No login log and no change log.**
- **Backup and export:** no full backup and no export of all data. The nearest are the uniform structure file, Excel from each
  report, and the API.
- **Hidden expenses menu (step 6 addendum):** also holds income entry, equipment purchase, tax year setting and a monthly profit
  and loss report.

**Account level switches worth copying or checking (L, from the full settings report)**

| Setting at Invoice4U | Current value | LALUM |
| --- | --- | --- |
| Accounting basis (accrual or cash) | cash is the practice's basis per the owner (open question A5 for the accountant) | Store it as a firm setting, because revenue recognition by issue date versus receipt date depends on it |
| Allocation number for every document (yes or no) | decided per document today | Own engine: request for every document above the threshold and on customer request |
| Business type (licensed dealer, exempt, company and others) | licensed dealer | Firm setting, drives VAT defaults |
| VAT rate in the system (0 or 18) | 18 | Per document already; keep a firm default |
| Document date: manual or current | manual | Manual, bounded by the date rule of migration 0022 |
| Automatic invoice at the due date | off | Same stance: drafts only, never automatic issue |
| Document defaults | language Hebrew, 2 decimals, rounding on, reminder none, item discount off, send for signature off | Reminder and discount options at P2 and P3 as listed above |
| Credit card companies | five defaults, each with a bookkeeping number | Only relevant to the accounting export |
| Business switch and "copy customer list" | 2 businesses | Not needed for a single practice |

**Consequences for LALUM**

| Finding | Action |
| --- | --- |
| One API key; a new key overwrites the old one | **Never generate a key from the Invoice4U screen** while LALUM issues through it. The stored `INVOICE4U_API_KEY` would stop working at once. If a rotation is ever needed, change the secret and the key in the same minute, in a quiet hour |
| Two businesses in the account | Confirm which business our key issues under before the first production document. The issuing function does not choose a branch or business today |
| Plan ends 5 March 2027 | The renewal date is the natural deadline for the parallel run. Decide by February whether to renew for one more year as a fallback, because the archive stays readable only while the account is alive |
| No full export and no change log at Invoice4U | Our archive is the only independent copy of the history. Schedule the read only import (monthly, and after each issuing day) and keep the immutable archive trigger. Keep exporting the uniform structure file from Invoice4U once a quarter until the switch |
| No second factor enabled at Invoice4U | The owner should switch it on now. It protects the only key that can issue legal documents |
| Permissions only per module, none per customer or matter | LALUM: levels per user (section 12) plus an optional matter reference now, matter level rules later when the billing model lands |
| One key, no webhooks | LALUM: several keys with scopes and rotation, and webhooks, only if an external API is ever offered. Not needed for own use |
| One e-mail template, no variables | LALUM: templates with variables per document type and per reminder step. P2, together with e-mail sending from avraham@lalum.co |
| No audit log | LALUM: append only audit of issue, cancel, export, permission change and login. Part of the permission migration |
| Tax Authority authorisation valid a year | Shaam onboarding for LALUM: ask the authority whether the authorisation is per software or per business, and its renewal period |

## 9. Build order for LALUM

P1 part 2 (next). Step A is done: migration 0022 (`internal_note`, `matter_ref`, retainer fields on the customer, the date rule at issue) is applied and the editor and customer form carry the fields. Step B is done too: migration 0023 and the button "retainer drafts for the current month" create one DRAFT tax invoice per active retainer customer, idempotent per customer and month, never issued automatically. Tested in a rolled back transaction. Not applied on purpose: the series and sealing migrations 0016 and 0017, because 0016 replaces the guard on the issued documents table and nothing uses it until the own engine starts. Remaining:
1. Open pro formas view with filter, and conversion to invoice-receipt or receipt through a link record. Linked documents
   close the source. Block linking when the exchange rates differ.
2. Receipt on account: customer balance of receipts not yet matched to an invoice, and "issue invoice for receipts".
   Covers the prepaid cheque pattern and the 19 receipts of 18 June 2025.
3. Recurring monthly draft per customer (the 10,000 plus VAT retainer). Creates a draft only.
4. `internal_note` field, never printed.
5. Date rule at issue: not earlier than the last issued document of the same type, not in the future.
6. Cancellation matrix: cancellation receipt for a receipt.
7. Payment methods table: eight methods with their fields, card last four digits only.

P2 (reports): accountant report feature with log, VAT report, aging view, revenue by customer. P2: customer payment terms and due date, exempt line status, discount (line and document), foreign currency rate field,
email to customer with status, bulk close, catalog of items, draft auto save, overview shortcut and chart, accountant
monthly report.

P1 part 2 also gets the permission levels of section 12 as a migration of its own, before any second user exists.

P3: attachments, payment reminders, pay on document, language, CSV import and export of customers.

Open points for the accountant: rounding to whole shekels, wording of the date rule, treatment of tax withheld at source in
reports, cash basis recognition (A5).
