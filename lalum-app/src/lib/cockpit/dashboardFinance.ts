// Bookkeeping figures for the cockpit dashboard. Read only, from the same tables and the same functions the finance tabs use,
// so the dashboard can never disagree with them. Needs finance level 1 (view); below that nothing is loaded.
import { supabase } from "../supabase";
import { isOpenProforma, monthPeriod, summarize } from "./finance";
import type { ArchiveDoc, FinCustomer, FinDocument, FinExpense, FinPayment } from "./finance";
import { incomeByKind, incomeRows, INCOME_KIND_LABEL, receivablesAging, AGING_BUCKETS } from "./financeReports";
import { todayIL } from "./arAging";

/** Columns read from the history archive. FinanceHome reads the same ones. */
export const ARCHIVE_COLS = "id, i4u_doc_id, i4u_doc_type, doc_number, issue_date, i4u_client_id, subject, currency, subtotal, vat_amount, total, allocation_number, status_id, paid, balance, rate:raw->>ConversionRate, gname:raw->GeneralCustomer->>Name";
const MONTH_SHORT = ["ינו׳", "פבר׳", "מרץ", "אפר׳", "מאי", "יוני", "יולי", "אוג׳", "ספט׳", "אוק׳", "נוב׳", "דצמ׳"];

export interface FinanceDash {
  months: string[]; revenue: number[]; expenses: number[];
  aging: { label: string; value: number }[]; receivable: number;
  mix: { label: string; value: number }[]; mixTotal: number;
  openProformas: { count: number; total: number }; archiveCount: number;
}

export async function loadFinanceDash(firmId: string): Promise<FinanceDash | null> {
  if (!supabase) return null;
  const lv = await supabase.rpc("lalum_fin_level", { p_firm: firmId });
  if (typeof lv.data !== "number" || lv.data < 1) return null;
  const [c, d, p, e] = await Promise.all([
    supabase.from("lalum_fin_customers").select("*"),
    supabase.from("lalum_fin_documents").select("*"),
    supabase.from("lalum_fin_payments").select("*"),
    supabase.from("lalum_fin_expenses").select("*"),
  ]);
  if (c.error || d.error || p.error || e.error) return null;
  const archive: ArchiveDoc[] = [];
  for (let off = 0; ; off += 1000) {
    const r = await supabase.from("lalum_fin_archive").select(ARCHIVE_COLS).range(off, off + 999);
    if (r.error) return null;
    archive.push(...((r.data as ArchiveDoc[] | null) ?? []));
    if (!r.data || r.data.length < 1000) break;
  }
  return computeFinanceDash((c.data as FinCustomer[]) ?? [], (d.data as FinDocument[]) ?? [], (p.data as FinPayment[]) ?? [], (e.data as FinExpense[]) ?? [], archive, todayIL());
}

export function computeFinanceDash(customers: FinCustomer[], docs: FinDocument[], pays: FinPayment[], exps: FinExpense[], archive: ArchiveDoc[], today: string): FinanceDash {
  const y = Number(today.slice(0, 4)), m = Number(today.slice(5, 7));
  const months: string[] = [], revenue: number[] = [], expenses: number[] = [];
  for (let k = 5; k >= 0; k--) {
    const idx = m - 1 - k, yy = y + Math.floor(idx / 12), mm = ((idx % 12) + 12) % 12 + 1;
    const s = summarize(docs, pays, exps, monthPeriod(yy, mm), archive);
    months.push(MONTH_SHORT[mm - 1]); revenue.push(Math.round(s.revenueNet)); expenses.push(Math.round(s.expenses));
  }
  const ag = receivablesAging(docs, pays, customers, today);
  const yearAgo = `${y - 1}${today.slice(4)}`;
  const grouped = incomeByKind(incomeRows(docs, archive, customers, { from: yearAgo, to: today }));
  const mix = grouped.groups.map((g) => ({ label: INCOME_KIND_LABEL[g.kind], value: g.rows.length }));
  const open = docs.filter((x) => isOpenProforma(x, docs));
  return {
    months, revenue, expenses,
    aging: AGING_BUCKETS.map((label, i) => ({ label, value: Math.round(ag.totals[i] ?? 0) })), receivable: Math.round(ag.total),
    mix, mixTotal: mix.reduce((t, x) => t + x.value, 0),
    openProformas: { count: open.length, total: Math.round(open.reduce((t, x) => t + x.total, 0)) }, archiveCount: archive.length,
  };
}
