// Renders a document in a design as one self-contained HTML page (A4, RTL), for the preview frame, the suggestion thumbnails and print.
// Pure, so scripts/doc-design-check.mjs renders every layout for every document type and checks the required details are all there.
//
// Every required detail of the document type (REQUIRED_FIELDS) is printed with data-req="<key>", in every layout, whatever the design.
// A design changes how the page looks, never what it says. Every text that comes from the ledger or the brand profile is escaped.
//
// Modes: "sample" (made up figures) and "preview" (a real draft). Both carry a watermark saying the page is not a tax document: the
// document the customer receives is the one the issuing provider produces and signs. A mode without the watermark arrives with the
// own engine, for sealed documents only, and is deliberately not here yet.
import { FONTS, REQUIRED_FIELDS, onColour } from "./docDesign.ts";
import type { DesignSpec, FontKey } from "./docDesign.ts";

export type RenderDocType = keyof typeof REQUIRED_FIELDS;
export interface RenderIssuer { name: string; taxId: string; entity: "INDIVIDUAL" | "COMPANY"; address: string; phone?: string | null; email?: string | null; website?: string | null }
export interface RenderCustomer { name: string; taxId: string | null; address?: string | null; email?: string | null; phone?: string | null }
export interface RenderPayment { method: string; date: string; amount: number; ref?: string | null }
export interface RenderDoc {
  docType: RenderDocType; number: number | null; issueDate: string; dueDate?: string | null; subject?: string | null;
  lines: Array<{ name: string; qty: number; price: number }>; subtotal: number; vatRate: number; vatAmount: number; total: number;
  allocationNumber?: string | null; payments?: RenderPayment[]; relatedDoc?: string | null; notes?: string | null;
}
export interface RenderBrand { logoUrl: string | null; logoAlt: string; bank?: { bank: string; branch: string; account: string } | null; footerNote?: string | null }
export interface RenderOpts { mode: "sample" | "preview"; copy?: boolean }

export const TITLE: Record<RenderDocType, string> = {
  PROFORMA: "חשבון עסקה", INVOICE: "חשבונית מס", RECEIPT: "קבלה", INVOICE_RECEIPT: "חשבונית מס קבלה", CREDIT: "חשבונית מס זיכוי",
};
export const WATERMARK: Record<RenderOpts["mode"], string> = {
  sample: "דוגמה לעיצוב בלבד. אינו מסמך מס.",
  preview: "תצוגה מקדימה. אינו מסמך מס. המסמך החוקי מופק ונחתם במערכת ההנפקה.",
};

export const esc = (s: unknown) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string));
const amt = (n: number) => `<bdi dir="ltr">₪ ${new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(n) || 0)}</bdi>`;
const qty = (n: number) => `<bdi dir="ltr">${new Intl.NumberFormat("en-US", { maximumFractionDigits: 4 }).format(Number(n) || 0)}</bdi>`;
const date = (iso: string | null | undefined) => { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso ?? ""); return m ? `<bdi dir="ltr">${m[3]}/${m[2]}/${m[1]}</bdi>` : "לא צוין"; };
const ltr = (s: string) => `<bdi dir="ltr">${esc(s)}</bdi>`;
/** Only a data: image, an https URL or a path on this origin may be the logo's source. Anything else is dropped. */
export const safeLogoUrl = (u: string | null | undefined) =>
  u && (/^data:image\/(png|jpeg|webp|gif|svg\+xml);base64,[a-z0-9+/=]+$/i.test(u) || /^https:\/\/[^\s"'<>]+$/.test(u) || /^\/[a-z0-9/_.-]+$/i.test(u)) ? u : null;

/** The Google Fonts stylesheet for the families a design uses, or null when it uses only faces the app serves itself. */
export function fontsHref(keys: FontKey[]): string | null {
  const fams = [...new Set(keys.map((k) => FONTS[k].google).filter((g): g is string => !!g))];
  return fams.length ? `https://fonts.googleapis.com/css2?${fams.map((f) => `family=${f}`).join("&")}&display=swap` : null;
}

function css(s: DesignSpec): string {
  const p = s.palette;
  const band = onColour(p.primary, p.ink);
  const size = { airy: "11.5pt", regular: "10.5pt", compact: "9.5pt" }[s.density];
  const pad = { airy: "20mm 20mm 18mm", regular: "16mm 17mm 15mm", compact: "12mm 14mm 12mm" }[s.density];
  const cell = { airy: "9px 10px", regular: "7px 8px", compact: "4px 6px" }[s.density];
  const logoH = { s: 34, m: 52, l: 82 }[s.logo.size];
  // On a dark band a dark logo would vanish, so the band turns any logo white there. On a light band the chosen treatment stands.
  const treatment = s.layout === "band" && band === "#ffffff" ? "inverse" : s.logo.treatment;
  const filter = { original: "none", mono: "brightness(0) saturate(100%)", inverse: "brightness(0) invert(1)" }[treatment];
  return `
@font-face{font-family:'Lalum Serif';src:url('/fonts/lalum-serif-400.woff2') format('woff2');font-weight:400;font-display:swap}
@font-face{font-family:'Lalum Serif';src:url('/fonts/lalum-serif-700.woff2') format('woff2');font-weight:700;font-display:swap}
@page{size:A4;margin:0}
*{box-sizing:border-box}
html,body{margin:0;background:#e9e9e6}
body{color:${p.ink};font-family:${FONTS[s.fonts.body].css};font-size:${size};line-height:1.5;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.page{position:relative;width:210mm;min-height:297mm;margin:0 auto;background:${p.paper};padding:${pad};overflow:hidden;display:flex;flex-direction:column;gap:5mm}
h1,.h{font-family:${FONTS[s.fonts.heading].css};color:${p.primary};margin:0;font-weight:700;line-height:1.15}
.muted{color:${p.muted}}
.logo img{height:${logoH}px;max-width:62mm;object-fit:contain;filter:${filter};display:block}
.head{display:flex;justify-content:space-between;align-items:flex-start;gap:8mm}
.head.center{flex-direction:column;align-items:center;text-align:center}
.head.end{flex-direction:row-reverse}
.issuer{font-size:.92em;line-height:1.45}
.issuer .name{font-weight:700;font-size:1.12em}
.titlebox{display:flex;justify-content:space-between;align-items:flex-end;gap:6mm;border-bottom:2px solid ${p.primary};padding-bottom:3mm}
.titlebox h1{font-size:2em}
.titlebox .meta{text-align:left;font-size:.95em}
.copy{display:inline-block;border:1px solid ${p.accent};color:${p.ink};padding:1px 8px;border-radius:${s.corners}px;font-size:.85em;margin-top:2px}
.parties{display:grid;grid-template-columns:1fr 1fr;gap:6mm}
.box{border-radius:${s.corners}px}
.label{color:${p.muted};font-size:.85em}
table{width:100%;border-collapse:collapse}
th{font-weight:700;text-align:right;color:${p.primary};padding:${cell};border-bottom:1.5px solid ${p.primary};font-size:.9em}
td{padding:${cell};vertical-align:top}
td.n,th.n{text-align:left;white-space:nowrap}
.t-lines tbody td{border-bottom:1px solid color-mix(in srgb,${p.muted} 25%,transparent)}
.t-zebra tbody tr:nth-child(odd) td{background:${p.tint}}
.t-boxed th,.t-boxed td{border:1px solid color-mix(in srgb,${p.muted} 45%,transparent)}
.t-boxed th{background:${p.tint}}
.totals{margin-inline-start:auto;width:46%;min-width:70mm}
.totals td{padding:4px 8px}
.totals tr.grand td{font-weight:700;font-size:1.15em;color:${p.primary};border-top:2px solid ${p.primary}}
.alloc{font-size:.95em}
.alloc b{letter-spacing:.04em}
.foot{margin-top:auto;font-size:.82em;border-top:1px solid color-mix(in srgb,${p.muted} 30%,transparent);padding-top:3mm;display:flex;justify-content:space-between;gap:6mm}
.wm{position:absolute;inset:auto 0 46% 0;text-align:center;transform:rotate(-24deg);font-size:21pt;font-weight:700;color:color-mix(in srgb,${p.accent} 30%,transparent);pointer-events:none;z-index:2}
.L-band .bandtop{margin:-${pad.split(" ")[0]} -${pad.split(" ")[1]} 0;padding:9mm ${pad.split(" ")[1]} 7mm;background:${p.primary};color:${band};border-radius:0 0 ${s.corners * 2}px ${s.corners * 2}px}
.L-band .bandtop .h,.L-band .bandtop .muted{color:${band}}
.L-sidebar .page{padding-inline-start:calc(${pad.split(" ")[1]} + 14mm)}
.L-sidebar .page::before{content:"";position:absolute;inset:0 0 0 auto;width:9mm;background:${p.primary}}
.L-sidebar .page::after{content:"";position:absolute;inset:0 9mm 0 auto;width:1.6mm;background:${p.accent}}
.L-minimal .titlebox{border-bottom:none;padding-bottom:0}
.L-minimal th{border-bottom:1px solid ${p.ink};color:${p.ink}}
.L-letterhead .head{flex-direction:column;align-items:center;text-align:center;gap:3mm}
.L-letterhead .rule{height:0;border-top:2px solid ${p.primary};border-bottom:1px solid ${p.accent};padding-top:2px}
.L-letterhead .issuer{display:flex;flex-wrap:wrap;justify-content:center;gap:2px 14px}
.L-ledger .titlebox,.L-ledger .parties>div,.L-ledger .lines,.L-ledger .after{border:1.5px solid ${p.primary};padding:3mm 4mm;border-radius:${s.corners}px}
.L-ledger .titlebox{background:${p.tint}}
.L-ledger td.n{font-variant-numeric:tabular-nums}
@media print{html,body{background:none}.page{margin:0}}
`;
}

function header(s: DesignSpec, issuer: RenderIssuer, brand: RenderBrand): string {
  const logo = safeLogoUrl(brand.logoUrl);
  const logoHtml = logo ? `<div class="logo"><img src="${esc(logo)}" alt="${esc(brand.logoAlt)}"></div>` : "";
  const entity = issuer.entity === "COMPANY" ? "ח.פ." : "עוסק מורשה";
  const contact = [issuer.phone && ltr(issuer.phone), issuer.email && ltr(issuer.email), issuer.website && ltr(issuer.website)].filter(Boolean).join(" · ");
  const issuerHtml = `<div class="issuer">
    <div class="name h" data-req="issuer_name">${esc(issuer.name)}</div>
    <div data-req="issuer_tax_id"><span class="muted">${entity}</span> ${ltr(issuer.taxId)}</div>
    <div data-req="issuer_address">${esc(issuer.address)}</div>
    ${contact ? `<div class="muted">${contact}</div>` : ""}
  </div>`;
  const place = s.layout === "letterhead" ? "center" : s.logo.placement;
  const inner = `<div class="head ${place}">${logoHtml}${issuerHtml}</div>`;
  if (s.layout === "band") return `<div class="bandtop">${inner}</div>`;
  if (s.layout === "letterhead") return `${inner}<div class="rule"></div>`;
  return inner;
}

/** One document, one design, as a full HTML page. */
export function renderDocument(s: DesignSpec, brand: RenderBrand, issuer: RenderIssuer, customer: RenderCustomer, d: RenderDoc, o: RenderOpts): string {
  const req = new Set(REQUIRED_FIELDS[d.docType]);
  const fontLink = fontsHref([s.fonts.heading, s.fonts.body]);
  const number = d.number ? ltr(String(d.number)) : `<span class="muted" style="font-size:.45em;font-weight:400">(המספר יוקצה בעת ההפקה)</span>`;
  const lineRows = d.lines.map((l) => `<tr><td>${esc(l.name)}</td><td class="n">${qty(l.qty)}</td><td class="n">${amt(l.price)}</td><td class="n">${amt(l.qty * l.price)}</td></tr>`).join("");
  const lines = req.has("lines") ? `<div class="lines" data-req="lines"><table class="t-${s.table}"><thead><tr><th>תיאור</th><th class="n">כמות</th><th class="n">מחיר</th><th class="n">סה"כ</th></tr></thead><tbody>${lineRows || `<tr><td colspan="4" class="muted">אין שורות</td></tr>`}</tbody></table></div>` : "";
  const totals = `<table class="totals">
    ${req.has("subtotal") ? `<tr data-req="subtotal"><td>סה"כ לפני מע"מ</td><td class="n">${amt(d.subtotal)}</td></tr>` : ""}
    ${req.has("vat") ? `<tr data-req="vat"><td>מע"מ <bdi dir="ltr">${esc(d.vatRate)}%</bdi></td><td class="n">${amt(d.vatAmount)}</td></tr>` : ""}
    <tr class="grand" data-req="total"><td>${d.docType === "RECEIPT" ? 'סה"כ התקבל' : 'סה"כ לתשלום'}</td><td class="n">${amt(d.total)}</td></tr>
  </table>`;
  const payRows = (d.payments ?? []).map((p) => `<tr><td>${esc(p.method)}</td><td>${date(p.date)}</td><td>${p.ref ? ltr(p.ref) : ""}</td><td class="n">${amt(p.amount)}</td></tr>`).join("");
  const payments = req.has("payments") ? `<div data-req="payments"><div class="h" style="font-size:1.05em;margin-bottom:2mm">פרטי התקבולים</div><table class="t-${s.table}"><thead><tr><th>אמצעי תשלום</th><th>תאריך</th><th>אסמכתה</th><th class="n">סכום</th></tr></thead><tbody>${payRows || `<tr><td colspan="4" class="muted">ייקבע בעת ההפקה</td></tr>`}</tbody></table></div>` : "";
  const alloc = req.has("allocation_number")
    ? `<div class="alloc" data-req="allocation_number"><span class="label">מספר הקצאה: </span>${d.allocationNumber ? `<b>${ltr(d.allocationNumber)}</b>` : `<span class="muted">יודפס כאן כשהוא נדרש (מעל הסף, ללקוח עוסק מורשה)</span>`}</div>` : "";
  const related = req.has("related_doc") ? `<div data-req="related_doc"><span class="label">${d.docType === "CREDIT" ? "זיכוי בגין: " : "בגין: "}</span>${d.relatedDoc ? esc(d.relatedDoc) : `<span class="muted">המסמך המקורי ייקבע בעת ההפקה</span>`}</div>` : "";
  const bank = s.showBank && brand.bank ? `<div><span class="label">לתשלום בהעברה: </span>בנק ${esc(brand.bank.bank)}, סניף ${ltr(brand.bank.branch)}, חשבון ${ltr(brand.bank.account)}</div>` : "";
  const due = d.dueDate && d.docType !== "RECEIPT" ? `<div><span class="label">לתשלום עד: </span>${date(d.dueDate)}</div>` : "";
  return `<!doctype html><html lang="he" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width">
<title>${esc(TITLE[d.docType])} ${d.number ? esc(d.number) : ""}</title>
${fontLink ? `<link rel="stylesheet" href="${fontLink}">` : ""}<style>${css(s)}</style></head>
<body class="L-${s.layout}"><div class="page">
<div class="wm" aria-hidden="true">${esc(WATERMARK[o.mode])}</div>
${header(s, issuer, brand)}
<div class="titlebox"><div><h1 data-req="doc_title">${esc(TITLE[d.docType])} <span data-req="doc_number">${number}</span></h1>
  <span class="copy" data-req="copy_label">${o.copy ? "העתק נאמן למקור" : "מקור"}</span></div>
  <div class="meta"><div data-req="issue_date"><span class="label">תאריך: </span>${date(d.issueDate)}</div>${due}</div></div>
<div class="parties"><div class="box"><div class="label">לכבוד</div>
  <div data-req="customer_name"><b>${esc(customer.name)}</b></div>
  <div data-req="customer_tax_id"><span class="label">ת.ז. / ח.פ.: </span>${customer.taxId ? ltr(customer.taxId) : `<span class="muted">לא צוין</span>`}</div>
  ${customer.address ? `<div>${esc(customer.address)}</div>` : ""}${customer.email ? `<div class="muted">${ltr(customer.email)}</div>` : ""}</div>
  <div class="box">${d.subject ? `<div class="label">נושא</div><div>${esc(d.subject)}</div>` : ""}${related}</div></div>
${lines}
<div class="after">${totals}</div>
${payments}
${alloc}
${bank}
${d.notes ? `<div><span class="label">הערות: </span>${esc(d.notes)}</div>` : ""}
<div class="foot"><div>${esc(brand.footerNote ?? "")}</div><div class="muted">עמוד 1 מתוך 1</div></div>
</div></body></html>`;
}

/** Made up figures for the gallery and for a firm with no draft yet. Numbers are round so a wrong total shows at a glance. */
export function sampleDoc(docType: RenderDocType = "INVOICE"): { customer: RenderCustomer; doc: RenderDoc } {
  const lines = docType === "RECEIPT" ? [] : [{ name: "ליווי משפטי בעסקת מקרקעין", qty: 1, price: 12000 }, { name: "בדיקת נסח וחוות דעת", qty: 2, price: 1500 }];
  const subtotal = docType === "RECEIPT" ? 0 : 15000, vat = docType === "RECEIPT" ? 0 : 2700;
  return {
    customer: { name: "לקוח לדוגמה בע\"מ", taxId: "515555551", address: "רחוב הדוגמה 1, תל אביב", email: "client@example.com" },
    doc: {
      docType, number: null, issueDate: "2026-10-29", dueDate: docType === "PROFORMA" ? "2026-11-12" : null, subject: "ייצוג בעסקה",
      lines, subtotal, vatRate: 18, vatAmount: vat, total: 17700,
      payments: docType === "RECEIPT" || docType === "INVOICE_RECEIPT" ? [{ method: "העברה בנקאית", date: "2026-10-29", amount: 17700, ref: "123456" }] : [],
      relatedDoc: docType === "RECEIPT" ? "חשבונית מס 10015" : docType === "CREDIT" ? "חשבונית מס 10015" : null,
    },
  };
}
