# Document design: templates, logo and suggested designs

Owner's request, 29 October 2026: let the firm design its invoices, receipts and pro formas, choose among several designs (or as many
as the system can suggest), change the logo, and have the system propose designs matched to the logo from a few questions.

Status of each fact is marked. Nothing here is legal advice.

## The constraint that decides the architecture

Every tax document is issued today by Invoice4U (`lalum-fin-issue`, `CreateDocumentWithIdentifierValidation`). Invoice4U numbers the
document, requests the allocation number, renders the PDF and signs it ("מסמך ממוחשב חתום דיגיטלית" on its own documents). The PDF the
customer receives is Invoice4U's (`PrintOriginalPDFLink`, sent by `lalum-fin-doc-send`).

What Invoice4U lets a business change (verified 29.10.2026 on its help centre, articles "עיצוב חשבונית" and "האם יש אפשרות לעצב את
המסמך?", last modified 9.12.2023):

- Template and colour: "הגדרות החשבון > עיצוב והגדרות המסמך", chosen from its own set ("בחרו תבנית, צבע"). The account inventory of
  October 2026 counted 18 templates and 13 colours (`invoice4u-feature-inventory.md`, section on settings).
- Logo, graphic signature, illustration: "הגדרות החשבון > הגדרות המסמך", "טעינת לוגו", **jpg or gif, at most 250 by 250**.
- A fixed note printed on every document.
- All of it is account level: one look for every document. No per document design is described anywhere.

Not verified: whether the API takes any design field. The API help pages (`api.invoice4u.co.il/Services/ApiService.svc/help` and the QA
host) could not be read from the build environment, and no public page names such a field. The code sends none.

Observed on the practice's own documents (pro forma 90090, 29.09.2026, and invoice-receipt 1114577): the header prints the business
name as text ("LA LUM") and no logo. The logo slot in Invoice4U is empty, which also breaks the single logo rule of `CLAUDE.md`.

## Decision built in this change

1. **The legal document stays Invoice4U's.** A design made in LALUM is never sent to a customer as a second rendering of a document
   Invoice4U numbered. Two different renderings of one numbered tax document, one of them not produced or signed by the issuing
   software, is a risk the practice does not need (assessment, not a verified rule: confirm with the accountant before relying on it).
   Every page the renderer produces today carries a watermark saying it is not a tax document.
2. **What a design does today:** the gallery, the preview of real drafts, printing a watermarked preview, and the one time settings to
   copy into Invoice4U (closest colour, template style, and the logo as a JPG of 250 pixels on its long side, made by the screen itself).
3. **What it does later:** when the own engine seals documents (`finance-engine-design.md`, target 1.1.2027), the same renderer, without
   the watermark and only for a SEALED document, becomes the document. That mode is deliberately not in the code yet.

## How it works

- `src/lib/cockpit/docDesign.ts` (pure). A design is a small JSON spec: layout (classic, colour band, minimal, side band, letterhead,
  ledger), palette, heading and body fonts (Hebrew faces only), logo size, placement and treatment, table style, density, corners, bank
  line. `buildPalette` derives ink, secondary text and paper from two colours so body text clears 7:1 and headings 4.5:1 (WCAG).
  `logoColours` reads the logo's own colours from its pixels, skipping background and anti-aliasing; a logo with no colour (the LALUM
  wordmark) is treated as neutral and gets curated palettes, the first being the practice's document palette from `CLAUDE.md`.
  `suggestDesigns(answers, logo, page)` returns six designs per page: page 0 is the best fit in a fixed order, each further page a seeded
  variation, so there is no last page. Five questions: impression, amount of colour, type, logo prominence, number of lines.
- `src/lib/cockpit/docDesignRender.ts` (pure). Renders a document in a design as one A4 RTL HTML page. **A design changes how a document
  looks, never what it says:** every detail in `REQUIRED_FIELDS` for the document type is printed with `data-req`, in every layout.
  Everything from the ledger is escaped; the logo source must be a data image, https, or a path on this origin.
- `src/pages/cockpit/finance/DocDesignTab.tsx`: the "עיצוב מסמכים" tab under "הכנסות ולקוחות". Viewing from finance level 1, saving at
  level 4 (finance admin).
- Migration `20261029080000_lalum_fin_doc_design.sql`: `lalum_fin_doc_brand` (logo as a data URL up to about 300 KB, contact lines,
  bank details, footer note) and `lalum_fin_doc_designs` (named specs, a default per document type, archived rather than deleted). Writes
  only through three functions that write the audit chain; both tables are in the firm export. Tests: `supabase/tests/fin_doc_design.sql`.
- `npm run doc-design-check`: every layout x table style x density, for every document type and both modes, carries every required
  detail and the watermark; escaping; contrast of every suggestion; determinism and an endless supply of suggestions; no forbidden dashes.

## Required details per document type

The list in `REQUIRED_FIELDS` is the checklist the own engine must meet: issuer name, number and address; the document's title and
serial number; original or true copy; date; customer name and identity number; lines; amount before VAT, VAT rate and amount, total;
allocation number on tax invoices (printed when one is required); payments on receipts; the original document on receipts and credits.
It was assembled from the documents Invoice4U produces for the practice and from `finance-engine-design.md`. **Not yet checked line by
line against the bookkeeping instructions (הוראות מס הכנסה (ניהול פנקסי חשבונות), התשל"ג-1973) and VAT law.** That check is a condition
for the own engine's unwatermarked mode, not for this change.

## Logo

`CLAUDE.md` allows one logo for LALUM: the wordmark. The tab defaults to it (`public/lalum-logo.svg`) and offers "חזרה ללוגו הרשמי".
Uploading another logo is there for a firm that is not LALUM; for the practice's own documents it would break that rule.
