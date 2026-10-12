// Reports built from the ledger and the Invoice4U archive: the income report for the accountant, revenue by customer and
// receivables aging. Pure functions, checked by `npm run finance-check`. Amounts are in shekels, signed (credits negative).
import { archiveRevenueEffect, openBalance, splitName } from "./finance.ts";
import type { ArchiveDoc, FinCustomer, FinDocument, FinPayment, Period } from "./finance.ts";

export type IncomeKind = "INVOICE" | "INVOICE_RECEIPT" | "CREDIT";
export const INCOME_KIND_LABEL: Record<IncomeKind, string> = { INVOICE: "חשבוניות מס", INVOICE_RECEIPT: "חשבוניות מס קבלה", CREDIT: "חשבוניות זיכוי" };
const KIND_ORDER: IncomeKind[] = ["INVOICE", "INVOICE_RECEIPT", "CREDIT"];
const r2 = (n: number): number => Math.round(Number(n.toFixed(6)) * 100) / 100;
const within = (iso: string, p: Period): boolean => iso >= p.from && iso <= p.to;
const ARCHIVE_KIND: Record<number, IncomeKind> = { 1: "INVOICE", 3: "INVOICE_RECEIPT", 4: "CREDIT" };

export interface IncomeRow {
  date: string; kind: IncomeKind; number: number | null; customer: string; net: number; vat: number; total: number;
  source: "ledger" | "archive"; customerKey: string;
}

/** Issued, real income documents in the period: invoices and invoice-receipts add, credits subtract. A document held in both
 *  places is counted once, from the ledger. */
export function incomeRows(docs: FinDocument[], archive: ArchiveDoc[], customers: FinCustomer[], p: Period): IncomeRow[] {
  const byId = new Map(customers.map((c) => [c.id, c]));
  const byI4u = new Map(customers.filter((c) => c.i4u_customer_id != null).map((c) => [c.i4u_customer_id as number, c]));
  const rows: IncomeRow[] = [];
  const inLedger = new Set<string>();
  for (const d of docs) {
    if (d.status !== "ISSUED" || d.is_test) continue;
    if (d.i4u_doc_id) inLedger.add(d.i4u_doc_id);
    if (d.doc_type !== "INVOICE" && d.doc_type !== "INVOICE_RECEIPT" && d.doc_type !== "CREDIT") continue;
    if (!within(d.issue_date, p)) continue;
    const sign = d.doc_type === "CREDIT" ? -1 : 1;
    const c = byId.get(d.customer_id);
    rows.push({
      date: d.issue_date, kind: d.doc_type, number: d.doc_number, customer: c ? splitName(c.name).name : "לקוח לא ידוע",
      customerKey: c?.id ?? "unknown", net: r2(sign * d.subtotal), vat: r2(sign * d.vat_amount), total: r2(sign * (d.subtotal + d.vat_amount)), source: "ledger",
    });
  }
  for (const a of archive) {
    const kind = ARCHIVE_KIND[a.i4u_doc_type];
    if (!kind || inLedger.has(a.i4u_doc_id) || !within(a.issue_date, p)) continue;
    const e = archiveRevenueEffect(a);
    const c = a.i4u_client_id != null ? byI4u.get(a.i4u_client_id) : undefined;
    const name = c ? splitName(c.name).name : a.gname?.trim() || "לקוח לא ידוע";
    rows.push({
      date: a.issue_date, kind, number: a.doc_number, customer: name, customerKey: c?.id ?? `casual:${name}`,
      net: e.net, vat: e.vat, total: r2(e.net + e.vat), source: "archive",
    });
  }
  return rows.sort((x, y) => x.date.localeCompare(y.date) || (x.number ?? 0) - (y.number ?? 0));
}

export interface IncomeGroup { kind: IncomeKind; rows: IncomeRow[]; net: number; vat: number; total: number }
export function incomeByKind(rows: IncomeRow[]): { groups: IncomeGroup[]; net: number; vat: number; total: number } {
  const groups = KIND_ORDER.map((kind) => {
    const rs = rows.filter((r) => r.kind === kind);
    return { kind, rows: rs, net: r2(rs.reduce((a, r) => a + r.net, 0)), vat: r2(rs.reduce((a, r) => a + r.vat, 0)), total: r2(rs.reduce((a, r) => a + r.total, 0)) };
  });
  return { groups, net: r2(groups.reduce((a, g) => a + g.net, 0)), vat: r2(groups.reduce((a, g) => a + g.vat, 0)), total: r2(groups.reduce((a, g) => a + g.total, 0)) };
}

export interface CustomerRevenue { key: string; customer: string; documents: number; net: number; vat: number; total: number }
export function revenueByCustomer(rows: IncomeRow[]): CustomerRevenue[] {
  const m = new Map<string, CustomerRevenue>();
  for (const r of rows) {
    const x = m.get(r.customerKey) ?? { key: r.customerKey, customer: r.customer, documents: 0, net: 0, vat: 0, total: 0 };
    x.documents += 1; x.net = r2(x.net + r.net); x.vat = r2(x.vat + r.vat); x.total = r2(x.total + r.total);
    m.set(r.customerKey, x);
  }
  return [...m.values()].sort((a, b) => b.net - a.net);
}

export const AGING_BUCKETS = ["טרם הגיע המועד", "1 עד 30 ימים", "31 עד 60 ימים", "61 עד 90 ימים", "מעל 90 ימים"] as const;
export interface AgingRow { customerId: string; customer: string; buckets: number[]; total: number }
const daysBetween = (fromIso: string, toIso: string): number => Math.round((Date.parse(`${toIso}T00:00:00Z`) - Date.parse(`${fromIso}T00:00:00Z`)) / 86400000);

/** Open balances of issued invoices from the ledger, by days past the due date (the issue date when there is none). The archive
 *  carries no trustworthy balances, so it is not part of this report. */
export function receivablesAging(docs: FinDocument[], pays: FinPayment[], customers: FinCustomer[], today: string): { rows: AgingRow[]; totals: number[]; total: number } {
  const byId = new Map(customers.map((c) => [c.id, c]));
  const m = new Map<string, AgingRow>();
  for (const d of docs) {
    const bal = openBalance(d, docs, pays);
    if (bal <= 0) continue;
    const late = daysBetween(d.due_date ?? d.issue_date, today);
    const i = late <= 0 ? 0 : late <= 30 ? 1 : late <= 60 ? 2 : late <= 90 ? 3 : 4;
    const row = m.get(d.customer_id) ?? { customerId: d.customer_id, customer: byId.get(d.customer_id) ? splitName(byId.get(d.customer_id)!.name).name : "לקוח לא ידוע", buckets: [0, 0, 0, 0, 0], total: 0 };
    row.buckets[i] = r2(row.buckets[i] + bal); row.total = r2(row.total + bal);
    m.set(d.customer_id, row);
  }
  const rows = [...m.values()].sort((a, b) => b.total - a.total);
  const totals = AGING_BUCKETS.map((_, i) => r2(rows.reduce((a, r) => a + r.buckets[i], 0)));
  return { rows, totals, total: r2(totals.reduce((a, b) => a + b, 0)) };
}

/** CSV that Excel opens correctly in Hebrew: a byte order mark, quoted text, plain numbers. */
export function toCsv(header: string[], lines: Array<Array<string | number | null>>): string {
  const cell = (v: string | number | null): string => (typeof v === "number" ? v.toFixed(2) : `"${String(v ?? "").replace(/"/g, '""')}"`);
  return "﻿" + [header.map((h) => cell(h)).join(","), ...lines.map((l) => l.map(cell).join(","))].join("\r\n");
}

const esc = (s: string): string => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const num = (n: number): string => n.toLocaleString("he-IL", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** The income report as e-mail HTML: one table per document type and the grand total. Every text is escaped. */
export function incomeHtml(title: string, income: ReturnType<typeof incomeByKind>): string {
  const cell = "padding:4px 8px;border-bottom:1px solid #ddd;text-align:right";
  const parts = [`<h2>${esc(title)}</h2>`];
  for (const g of income.groups) {
    parts.push(`<h3>${esc(INCOME_KIND_LABEL[g.kind])} (${g.rows.length})</h3>`);
    if (!g.rows.length) continue;
    parts.push(`<table style="border-collapse:collapse"><tr><th style="${cell}">תאריך</th><th style="${cell}">מספר</th><th style="${cell}">לקוח</th><th style="${cell}">לפני מע"מ</th><th style="${cell}">מע"מ</th><th style="${cell}">כולל מע"מ</th></tr>`);
    for (const r of g.rows) parts.push(`<tr><td style="${cell}">${esc(r.date)}</td><td style="${cell}">${r.number ?? ""}</td><td style="${cell}">${esc(r.customer)}</td><td style="${cell}">${num(r.net)}</td><td style="${cell}">${num(r.vat)}</td><td style="${cell}">${num(r.total)}</td></tr>`);
    parts.push(`<tr><td colspan="3" style="${cell}"><b>סה"כ</b></td><td style="${cell}"><b>${num(g.net)}</b></td><td style="${cell}"><b>${num(g.vat)}</b></td><td style="${cell}"><b>${num(g.total)}</b></td></tr></table>`);
  }
  parts.push(`<p><b>סה"כ הכנסות לפני מע"מ: ${num(income.net)}</b><br>מע"מ עסקאות: ${num(income.vat)}<br>כולל מע"מ: ${num(income.total)}</p>`);
  parts.push(`<p style="color:#666">דוח לעיון. זיכויים מופחתים. לפי תאריך המסמך.</p>`);
  return parts.join("");
}

export type Grain = "week" | "month" | "year";
export interface Bucket { key: string; label: string; from: string; to: string; net: number; vat: number; total: number; count: number; future: boolean }
export interface Series {
  grain: Grain; buckets: Bucket[]; net: number; vat: number; total: number; count: number;
  average: number; best: Bucket | null; lastVsPrevious: { last: Bucket; previous: Bucket; pct: number | null } | null;
}

const toDate = (isoDate: string): Date => new Date(`${isoDate}T00:00:00Z`);
const fmtIso = (d: Date): string => d.toISOString().slice(0, 10);
const addDays = (isoDate: string, n: number): string => { const d = toDate(isoDate); d.setUTCDate(d.getUTCDate() + n); return fmtIso(d); };
/** Israeli weeks start on Sunday. */
export const weekStart = (isoDate: string): string => addDays(isoDate, -toDate(isoDate).getUTCDay());
const dm = (isoDate: string): string => `${isoDate.slice(8, 10)}.${isoDate.slice(5, 7)}`;
const MONTH_SHORT = ["ינו׳", "פבר׳", "מרץ", "אפר׳", "מאי", "יוני", "יולי", "אוג׳", "ספט׳", "אוק׳", "נוב׳", "דצמ׳"];

/** Net income per week (the last 12 weeks up to today), per month (the 12 months of `year`) or per year (the last 5 years).
 *  A bucket after today is marked `future` and left out of the totals and the average. */
export function revenueBuckets(rows: IncomeRow[], grain: Grain, year: number, today: string): Series {
  const defs: Array<{ key: string; label: string; from: string; to: string }> = [];
  if (grain === "week") {
    const cur = weekStart(today);
    for (let i = 11; i >= 0; i--) { const from = addDays(cur, -7 * i); const to = addDays(from, 6); defs.push({ key: from, label: dm(from), from, to }); }
  } else if (grain === "month") {
    for (let m = 1; m <= 12; m++) {
      const from = `${year}-${String(m).padStart(2, "0")}-01`;
      const to = fmtIso(new Date(Date.UTC(year, m, 0)));
      defs.push({ key: from.slice(0, 7), label: MONTH_SHORT[m - 1], from, to });
    }
  } else {
    const ty = Number(today.slice(0, 4));
    for (let y = ty - 4; y <= ty; y++) defs.push({ key: String(y), label: String(y), from: `${y}-01-01`, to: `${y}-12-31` });
  }
  const buckets: Bucket[] = defs.map((d) => {
    const rs = rows.filter((r) => r.date >= d.from && r.date <= d.to);
    return {
      ...d, net: r2(rs.reduce((a, r) => a + r.net, 0)), vat: r2(rs.reduce((a, r) => a + r.vat, 0)),
      total: r2(rs.reduce((a, r) => a + r.total, 0)), count: rs.length, future: d.from > today,
    };
  });
  const live = buckets.filter((b) => !b.future);
  const net = r2(live.reduce((a, b) => a + b.net, 0));
  const withData = live.filter((b) => b.count > 0);
  // The current, still running bucket is not a fair "last" to compare with a full one, so compare the last two completed buckets.
  const done = live.filter((b) => b.to < today);
  const last = done[done.length - 1], prev = done[done.length - 2];
  return {
    grain, buckets, net, vat: r2(live.reduce((a, b) => a + b.vat, 0)), total: r2(live.reduce((a, b) => a + b.total, 0)),
    count: live.reduce((a, b) => a + b.count, 0),
    average: live.length ? r2(net / live.length) : 0,
    best: withData.length ? withData.reduce((a, b) => (b.net > a.net ? b : a)) : null,
    lastVsPrevious: last && prev ? { last, previous: prev, pct: prev.net !== 0 ? Math.round(((last.net - prev.net) / Math.abs(prev.net)) * 1000) / 10 : null } : null,
  };
}
