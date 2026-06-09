# CLAUDE.md - ALGO Legal Billing

Project context for Claude Code. Read this before making changes.

## What this is
A single-page React app for automated legal time capture and invoicing. Owner: Dr. Avraham Lalum (LALUM). Bilingual (Hebrew RTL + English LTR). All state is client-side; no backend.

## Stack
- React 18 + Vite. No TypeScript, no Tailwind, no CSS files.
- Icons: `lucide-react` only.
- Styling: inline `style={{}}` objects driven by a single `C` color token map at the top of `src/ALGO.jsx`. Do not introduce a CSS framework - keep the inline-token approach for consistency.

## Commands
- `npm run dev` - dev server on http://localhost:5173
- `npm run build` - production build to `dist/`
- `npm run preview` - serve the build

## Architecture (all in `src/ALGO.jsx`)
1. THEME - `C` map (jet black, charcoal #1A1A1A surfaces, gold #D4AF37, white) + font stacks `SANS` / `MONO`. `VAT = 0.18` (Israeli VAT).
2. NLP ENGINE - pure functions: `extractHours` (Hebrew words: שעה/שעות, חצי שעה=0.5, רבע שעה=0.25, שעה וחצי=1.5, שעתיים=2; digits incl. comma decimals), `matchClient` (substring + token + Levenshtein fuzzy match, threshold 0.55), `buildDescription` (strips hours phrase + client tokens + stopwords), `parseEntry` (orchestrates).
3. PERSISTENCE - `loadState` / `saveState` / `clearStorage` against `localStorage` keys `algo.clients.v1`, `algo.logs.v1`. Every accessor is wrapped in try/catch so a blocked store degrades to in-memory. State is hydrated via lazy `useState(() => loadState(...))` and written via `useEffect`.
4. COMPONENT `ALGO` - state for clients, logs, NLP input, invoice modal, toast, reset arming.
5. Sub-components: `Toggle`, `StatusBadge`, `Stat`, `Token`, `ClientEditRow`, `InvoiceModal`.

## Export & backup
- Invoice modal "הורד PDF": `html2canvas` rasterizes the sheet (browser renders Hebrew RTL correctly) and `jspdf` wraps it. Both are loaded via dynamic `import()`, so the app still loads if the libs are absent - the click then surfaces a guidance toast. "Print" uses `window.print()`.
- Header "גיבוי" exports `{app, version, clients, logs}` as JSON; "שחזור" re-imports it (validates clients/logs are arrays); "איפוס נתונים" is the two-click destructive reset.
- Export deps: `jspdf`, `html2canvas` (in package.json, pulled by `npm install`).

## Domain rules (do not break without asking)
- Line total = hours x matched client rate. Editing a client rate retroactively recalculates that client's Pending lines.
- Billing run invoices ONLY Pending entries whose client has `autoBill: true`, groups per client, then flips lines to `Invoiced`. Manual (autoBill off) clients are intentionally held back.
- Unmatched clients are logged in red with total 0, never silently dropped.
- Invoice numbers: `INV-YYYYMM-NNN`. VAT line shown at 18%.

## Conventions
- Hebrew text: use `dir="auto"` on cells/inputs; never hardcode RTL on the whole app.
- No em/en dashes anywhere - regular hyphen only.
- Currency via the `ils0` / `ils2` Intl formatters (ILS, he-IL).
- Bump the version suffix on localStorage keys (`.v2`) if the data shape changes, to avoid clashing with old saved records.

## Likely next tasks
- jsPDF export of the invoice modal.
- JSON backup export/import.
- Retainer / fixed-fee entry types.
- Optional Supabase sync (owner runs Supabase eu-central-1).
