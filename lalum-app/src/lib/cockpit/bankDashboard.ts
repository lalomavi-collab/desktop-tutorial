// The finance dashboard over the business bank account: where the money stands, what came in and went out each month,
// by category, what repeats, the next 30 days, and how much the owner can still draw this month. Pure functions, no I/O,
// inputs are never mutated. Checked by `npm run bank-dashboard-check`.
//
// Two layers, never mixed in one figure:
//  * Cash, from the bank lines (statement files, later a direct feed): balance, in, out, net, recurring charges, forecast.
//    Like Financy, moves between the owner's own accounts and currency conversions are left out of in and out. Unlike
//    Financy, the card bill counts as one outflow on the day it is charged, because the card's own lines do not reach us.
//  * Business, from the ledger and the tax engine (taxPnl.ts): profit, income tax and National Insurance for the month.
//
// Net in the bank is not money the owner can take: it holds VAT that belongs to the state, and nothing was set aside
// from it for income tax and National Insurance. So the drawable figure is the lower of two:
//  1. earned: the month's profit after income tax and National Insurance, less what the owner already took this month;
//  2. cash: the balance, less the VAT, income tax advance and National Insurance due in the next 30 days, less an
//     operating reserve (by default one month of the recurring business charges). The full 30 day running balance,
//     fixed charges included, is shown beside it and warns when it would fall below zero.
import { EXPENSE_CATEGORY, r2 } from "./finance.ts";

// ---------- Inputs ----------

export interface BankLine {
  id: string; bank_account_id: string; value_date: string; description: string | null; reference?: string | null;
  amount: number; balance_after: number | null; created_at?: string | null;
}
/** A reconciliation decision on a bank line (lalum_fin_recon_matches), made by hand or by the auto matcher. */
export interface ReconMatch {
  bank_line_id: string; target_kind: string; expense_id: string | null; matched_amount?: number | null; note?: string | null;
}
/** A balance the bank stated (lalum_fin_bank_balances): a statement closing or a feed reading. */
export interface StoredBalance { bank_account_id: string; as_of: string; balance: number; fetched_at?: string | null }
export interface BankAccount { id: string; bank_code: string; branch?: string | null; account_last4: string; label?: string | null; is_active: boolean }

// ---------- Categories ----------

/** IN counts as income, OUT as a business outflow, OWNER as money the owner took (draws, his own pension), MOVE is left out. */
export type Flow = "IN" | "OUT" | "OWNER" | "MOVE";
export interface Cat { key: string; label: string; group: string; flow: Flow }

const C = (key: string, label: string, group: string, flow: Flow): Cat => ({ key, label, group, flow });
export const CAT = {
  CLIENTS: C("CLIENTS", "תקבולים מלקוחות", "הכנסות", "IN"),
  REFUNDS: C("REFUNDS", "החזרים", "הכנסות", "IN"),
  UNMATCHED_IN: C("UNMATCHED_IN", "תקבול שעוד לא שויך", "הכנסות", "IN"),
  TAX_VAT: C("TAX_VAT", "מע״מ", "מסים", "OUT"),
  TAX_IT: C("TAX_IT", "מס הכנסה", "מסים", "OUT"),
  TAX_BL: C("TAX_BL", "ביטוח לאומי", "מסים", "OUT"),
  TAX_OTHER: C("TAX_OTHER", "מסים אחרים", "מסים", "OUT"),
  CARD: C("CARD", "כרטיס אשראי", "כרטיסים", "OUT"),
  BANK_FEES: C("BANK_FEES", "עמלות בנק", "בנק", "OUT"),
  OTHER_OUT: C("OTHER_OUT", "אחר", "אחר", "OUT"),
  UNMATCHED_OUT: C("UNMATCHED_OUT", "חיוב שעוד לא שויך", "לא מסווג", "OUT"),
  OWNER_DRAW: C("OWNER_DRAW", "משיכת בעלים", "בעלים", "OWNER"),
  OWNER_SAVINGS: C("OWNER_SAVINGS", "פנסיה וחיסכון אישי", "בעלים", "OWNER"),
  MOVE: C("MOVE", "העברה בין חשבונות או המרת מטבע", "לא נספר", "MOVE"),
} as const;
const expenseCat = (category: string | null | undefined): Cat => {
  const k = category && category in EXPENSE_CATEGORY ? category : "OTHER";
  return C(`EXP:${k}`, EXPENSE_CATEGORY[k], "ספקים והוצאות", "OUT");
};

/** The bank's text for a line, reduced to what identifies the counterparty: no digits, no punctuation, no trailing channel letters. */
export function normDesc(s: string | null | undefined): string {
  let t = (s ?? "").toLowerCase().replace(/\d+/g, " ").replace(/["'״׳.\-/\\,()]+/g, " ").replace(/\s+/g, " ").trim();
  for (let i = 0; i < 3; i++) t = t.replace(/\s[א-ת]$/, "").trim();
  return t;
}

// Only names that cannot mean anything else. Everything else waits for a person's decision or for a learned match.
const RULES: Array<[RegExp, Cat]> = [
  [/מע["״]?מ/, CAT.TAX_VAT],
  [/מס הכנסה/, CAT.TAX_IT],
  [/ב[י]?טוח לאומי/, CAT.TAX_BL],
  [/ויזה|visa|ישראכרט|מאסטרקארד|מסטרקארד|דיינרס|אמריקן אקספרס|^כאל\b|^מקס\b/i, CAT.CARD],
  [/^עמל|^עמ\.|עמלת|מסלול בסיסי|דמי ניהול חשבון|הקצאת אשראי/, CAT.BANK_FEES],
  [/מט["״]?ח/, CAT.MOVE],
  [/העברה עצמית/, CAT.OWNER_DRAW],
  [/החזרת שיק/, CAT.CLIENTS],
];
const ruleCat = (desc: string | null | undefined): Cat | null => {
  const d = desc ?? "";
  for (const [re, cat] of RULES) if (re.test(d)) return cat;
  return null;
};

export interface Classified extends BankLine {
  cat: Cat;
  /** How the category was reached: a reconciliation decision, a fixed rule, or the same counterparty decided before. */
  how: "MATCH" | "RULE" | "LEARNED" | "NONE";
}

function matchCat(m: ReconMatch, line: BankLine, expenseCategory: (id: string) => string | null | undefined): Cat {
  const rule = ruleCat(line.description);
  switch (m.target_kind) {
    case "income_doc": return CAT.CLIENTS;
    case "expense": return rule === CAT.BANK_FEES ? CAT.BANK_FEES : expenseCat(m.expense_id ? expenseCategory(m.expense_id) : null);
    case "tax": return rule && rule.group === "מסים" ? rule : CAT.TAX_OTHER;
    // The card bill is a transfer for the books (its lines are recorded one by one as expenses), but cash left the account.
    case "transfer": return rule === CAT.CARD ? CAT.CARD : CAT.MOVE;
    case "private": return /פנסיה|גמל|השתלמות|ביטוח מנהלים/.test(line.description ?? "") ? CAT.OWNER_SAVINGS : CAT.OWNER_DRAW;
    case "other": return line.amount > 0 ? CAT.REFUNDS : CAT.OTHER_OUT;
    default: return line.amount > 0 ? CAT.UNMATCHED_IN : CAT.UNMATCHED_OUT;
  }
}

/**
 * Category of every line. A reconciliation decision wins; then the fixed rules; then a counterparty whose earlier lines
 * (same text, same direction) were all decided the same way; otherwise the line stays unassigned, and still counts.
 */
export function classify(lines: BankLine[], matches: ReconMatch[], expenseCategory: (id: string) => string | null | undefined = () => null): Classified[] {
  // A line split across several targets takes the category of its largest part.
  const best = new Map<string, ReconMatch>();
  for (const m of matches) {
    const cur = best.get(m.bank_line_id);
    if (!cur || Math.abs(Number(m.matched_amount ?? 0)) > Math.abs(Number(cur.matched_amount ?? 0))) best.set(m.bank_line_id, m);
  }
  const first: Classified[] = lines.map((l) => {
    const m = best.get(l.id);
    if (m) return { ...l, cat: matchCat(m, l, expenseCategory), how: "MATCH" as const };
    const r = ruleCat(l.description);
    if (r) return { ...l, cat: r, how: "RULE" as const };
    return { ...l, cat: l.amount > 0 ? CAT.UNMATCHED_IN : CAT.UNMATCHED_OUT, how: "NONE" as const };
  });
  const learned = new Map<string, Cat | null>();
  for (const l of first) {
    if (l.how !== "MATCH") continue;
    const k = `${normDesc(l.description)}|${Math.sign(l.amount)}`;
    const prev = learned.get(k);
    learned.set(k, prev === undefined ? l.cat : prev && prev.key === l.cat.key ? prev : null);
  }
  return first.map((l) => {
    if (l.how !== "NONE") return l;
    const c = learned.get(`${normDesc(l.description)}|${Math.sign(l.amount)}`);
    return c ? { ...l, cat: c, how: "LEARNED" as const } : l;
  });
}

// ---------- Balance ----------

/**
 * A day's closing balance from its lines, whatever order they were stored in: the one "after" value no line of the day
 * starts from. Same rule as lalum_fin_bank_closing in the database (migration 20261029100000).
 */
export function dayClosing(lines: Array<Pick<BankLine, "amount" | "balance_after">>): number | null {
  const l = lines.filter((x) => x.balance_after != null);
  if (l.length === 0) return null;
  const n = new Map<string, { v: number; n: number }>();
  const add = (v: number, k: number) => { const key = r2(v).toFixed(2); const c = n.get(key) ?? { v: r2(v), n: 0 }; c.n += k; n.set(key, c); };
  for (const x of l) { add(Number(x.balance_after), 1); add(Number(x.balance_after) - Number(x.amount), -1); }
  const open = [...n.values()].filter((c) => c.n > 0);
  return open.reduce((a, c) => a + c.n, 0) === 1 ? open[0].v : r2(Number(l[l.length - 1].balance_after));
}

const byStoredOrder = (a: BankLine, b: BankLine) =>
  (a.created_at ?? "").localeCompare(b.created_at ?? "") || a.id.localeCompare(b.id);

/** Closing balance of every day that has lines with a running balance, per account, oldest first. */
export function dailyClosings(lines: BankLine[]): Map<string, Array<{ date: string; balance: number }>> {
  const days = new Map<string, Map<string, BankLine[]>>();
  for (const l of lines) {
    if (l.balance_after == null) continue;
    const acc = days.get(l.bank_account_id) ?? new Map<string, BankLine[]>();
    acc.set(l.value_date, [...(acc.get(l.value_date) ?? []), l]);
    days.set(l.bank_account_id, acc);
  }
  const out = new Map<string, Array<{ date: string; balance: number }>>();
  for (const [acc, m] of days) {
    out.set(acc, [...m.entries()].sort(([a], [b]) => a.localeCompare(b))
      .map(([date, ls]) => ({ date, balance: dayClosing([...ls].sort(byStoredOrder)) as number })));
  }
  return out;
}

export interface AccountBalance { accountId: string; balance: number | null; asOf: string | null; source: "STATED" | "LINES" | "NONE" }

/** Where each account stands: the newest stated balance, or the closing of the newest day of lines when that is newer. */
export function accountBalances(accounts: BankAccount[], lines: BankLine[], stored: StoredBalance[]): AccountBalance[] {
  const closings = dailyClosings(lines);
  return accounts.filter((a) => a.is_active).map((a) => {
    const st = stored.filter((s) => s.bank_account_id === a.id)
      .sort((x, y) => y.as_of.localeCompare(x.as_of) || (y.fetched_at ?? "").localeCompare(x.fetched_at ?? ""))[0];
    const days = closings.get(a.id) ?? [];
    const ln = days[days.length - 1];
    if (st && (!ln || st.as_of >= ln.date)) return { accountId: a.id, balance: r2(Number(st.balance)), asOf: st.as_of, source: "STATED" as const };
    if (ln) return { accountId: a.id, balance: ln.balance, asOf: ln.date, source: "LINES" as const };
    return { accountId: a.id, balance: null, asOf: null, source: "NONE" as const };
  });
}

/** Total balance by day across accounts, each account carried forward from its last known day. */
export function balanceSeries(lines: BankLine[]): Array<{ date: string; balance: number }> {
  const closings = dailyClosings(lines);
  const dates = [...new Set([...closings.values()].flatMap((d) => d.map((x) => x.date)))].sort();
  const idx = new Map<string, number>(), last = new Map<string, number>();
  return dates.map((date) => {
    for (const [acc, d] of closings) {
      let i = idx.get(acc) ?? 0;
      while (i < d.length && d[i].date <= date) { last.set(acc, d[i].balance); i++; }
      idx.set(acc, i);
    }
    return { date, balance: r2([...last.values()].reduce((a, b) => a + b, 0)) };
  });
}

// ---------- Months ----------

export const monthOf = (iso: string): string => iso.slice(0, 7);
const daysIn = (ym: string): number => { const [y, m] = ym.split("-").map(Number); return new Date(Date.UTC(y, m, 0)).getUTCDate(); };
export const addMonths = (ym: string, k: number): string => {
  const [y, m] = ym.split("-").map(Number);
  const t = y * 12 + (m - 1) + k;
  return `${Math.floor(t / 12)}-${String((t % 12) + 1).padStart(2, "0")}`;
};

export interface MonthCash {
  month: string; inflow: number; outflow: number; net: number;
  /** Taken by the owner (draws and his own pension), shown apart from the business outflow. */
  owner: number; moved: number; lines: number;
  /** The bank lines do not cover the whole month (the first statement starts inside it, or the last one ends inside it). */
  partial: boolean;
}

/** In, out and net per calendar month, oldest first, with every month between the first and the last line. */
export function monthlyCash(lines: Classified[], asOf: string | null): MonthCash[] {
  if (lines.length === 0) return [];
  const sorted = [...lines].sort((a, b) => a.value_date.localeCompare(b.value_date));
  const firstDay = sorted[0].value_date, lastMonth = monthOf(asOf && asOf > sorted[sorted.length - 1].value_date ? asOf : sorted[sorted.length - 1].value_date);
  const out: MonthCash[] = [];
  for (let m = monthOf(firstDay); m <= lastMonth; m = addMonths(m, 1)) {
    const ls = sorted.filter((l) => monthOf(l.value_date) === m);
    const sum = (f: Flow) => r2(ls.filter((l) => l.cat.flow === f).reduce((a, l) => a + l.amount, 0));
    const inflow = sum("IN"), outflow = r2(-sum("OUT"));
    const partial = (m === monthOf(firstDay) && Number(firstDay.slice(8)) > 3) || (asOf != null && m === monthOf(asOf) && Number(asOf.slice(8)) < daysIn(m));
    out.push({ month: m, inflow, outflow, net: r2(inflow - outflow), owner: r2(-sum("OWNER")), moved: r2(-sum("MOVE")), lines: ls.length, partial });
  }
  return out;
}

/** Change from the previous figure in percent, rounded to one decimal; null when there is nothing to compare with. */
export function changePct(cur: number, prev: number | null | undefined): number | null {
  if (prev == null || prev === 0) return null;
  return Math.round(((cur - prev) / Math.abs(prev)) * 1000) / 10;
}

export interface CatTotal { key: string; label: string; group: string; amount: number; count: number; share: number }

/** Totals by category for one month and one direction ("IN" or "OUT"), largest first; amounts are positive. */
export function categoryTotals(lines: Classified[], month: string, flow: "IN" | "OUT"): CatTotal[] {
  const m = new Map<string, CatTotal>();
  for (const l of lines) {
    if (monthOf(l.value_date) !== month || l.cat.flow !== flow) continue;
    const c = m.get(l.cat.key) ?? { key: l.cat.key, label: l.cat.label, group: l.cat.group, amount: 0, count: 0, share: 0 };
    c.amount += flow === "IN" ? l.amount : -l.amount; c.count++;
    m.set(l.cat.key, c);
  }
  const rows = [...m.values()].map((c) => ({ ...c, amount: r2(c.amount) })).filter((c) => c.amount !== 0);
  const total = rows.reduce((a, c) => a + Math.max(0, c.amount), 0);
  return rows.map((c) => ({ ...c, share: total > 0 ? Math.round((Math.max(0, c.amount) / total) * 100) : 0 })).sort((a, b) => b.amount - a.amount);
}

/** Business outflow per day of one month (1 to the month's last day). */
export function spendByDay(lines: Classified[], month: string): number[] {
  const days = Array.from({ length: daysIn(month) }, () => 0);
  for (const l of lines) if (monthOf(l.value_date) === month && l.cat.flow === "OUT") days[Number(l.value_date.slice(8)) - 1] -= l.amount;
  return days.map((v) => r2(v));
}

// ---------- Recurring ----------

export interface Recurring {
  key: string; label: string; cat: Cat; cadence: "MONTHLY" | "BIMONTHLY";
  /** Signed, like the bank line: negative is a charge. The latest month's total. */
  amount: number; prevAmount: number | null; changePct: number | null;
  last: string; next: string; months: number;
}

const median = (xs: number[]): number => { const s = [...xs].sort((a, b) => a - b); const h = s.length >> 1; return s.length % 2 ? s[h] : (s[h - 1] + s[h]) / 2; };
const dayDiff = (a: string, b: string): number => Math.round((Date.parse(b + "T00:00:00Z") - Date.parse(a + "T00:00:00Z")) / 86400000);
/** The same day of month, k months later, clamped to the month's length. */
export function sameDayLater(iso: string, k: number): string {
  const ym = addMonths(iso.slice(0, 7), k);
  return `${ym}-${String(Math.min(Number(iso.slice(8)), daysIn(ym))).padStart(2, "0")}`;
}

/** Bank texts that name a channel, not a counterparty ("digital transfer", "Bank Discount" for an incoming transfer). */
const GENERIC = /^(העברה|העברת|הע |הע$|הפקד|מימסרים|בנק |רשויות|שיק|החזרת שיק|משיכ|מזומן)/;
export const isGeneric = (desc: string | null | undefined): boolean => GENERIC.test(normDesc(desc));

/**
 * Charges and receipts that repeat: the same counterparty in the same direction in at least two calendar months, a
 * month or two months apart. Several lines of one counterparty in one month are one payment of that month. A text
 * that names only the channel repeats only when its monthly amount does too (within 5%), since different payers hide
 * behind it.
 */
export function recurring(lines: Classified[]): Recurring[] {
  const groups = new Map<string, Classified[]>();
  for (const l of lines) {
    if (l.cat.flow === "MOVE" || l.amount === 0) continue;
    const k = `${normDesc(l.description)}|${Math.sign(l.amount)}`;
    groups.set(k, [...(groups.get(k) ?? []), l]);
  }
  const out: Recurring[] = [];
  for (const [key, ls] of groups) {
    const months = new Map<string, { last: string; sum: number }>();
    for (const l of ls) {
      const m = monthOf(l.value_date), cur = months.get(m) ?? { last: l.value_date, sum: 0 };
      cur.sum += l.amount; if (l.value_date > cur.last) cur.last = l.value_date;
      months.set(m, cur);
    }
    const ms = [...months.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([, v]) => ({ ...v, sum: r2(v.sum) }));
    if (ms.length < 2) continue;
    const abs = ms.map((x) => Math.abs(x.sum));
    if (isGeneric(ls[0].description) && Math.max(...abs) > 1.05 * Math.min(...abs)) continue;
    const gaps = ms.slice(1).map((x, i) => dayDiff(ms[i].last, x.last));
    const g = median(gaps);
    const cadence = g >= 20 && g <= 40 ? "MONTHLY" : g >= 50 && g <= 72 ? "BIMONTHLY" : null;
    if (!cadence) continue;
    const lastM = ms[ms.length - 1], prevM = ms[ms.length - 2];
    const latest = [...ls].sort((a, b) => b.value_date.localeCompare(a.value_date))[0];
    out.push({
      key, label: (latest.description ?? "").trim() || latest.cat.label, cat: latest.cat, cadence,
      amount: lastM.sum, prevAmount: prevM.sum, changePct: changePct(Math.abs(lastM.sum), Math.abs(prevM.sum)),
      last: lastM.last, next: sameDayLater(lastM.last, cadence === "MONTHLY" ? 1 : 2), months: ms.length,
    });
  }
  return out.sort((a, b) => a.next.localeCompare(b.next) || a.amount - b.amount);
}

// ---------- Taxes from the ledger ----------

/** Year to date figures of the tax engine at the end of a month (taxPnl.buildPnl from 1 January to the month's last day). */
export interface YtdTax { profit: number; incomeTax: number; bl: number }
export interface MonthTax { month: string; profit: number; incomeTax: number; bl: number; afterTax: number }

/**
 * Each month's share of the year's tax: the year to date liability at its end less the one at the end of the month
 * before. Progressive brackets make the share of a month depend on the months before it, which this respects.
 */
export function monthTaxes(year: number, ytd: Array<YtdTax | null>): MonthTax[] {
  return ytd.map((cur, i) => {
    const prev = i > 0 ? ytd[i - 1] : { profit: 0, incomeTax: 0, bl: 0 };
    const month = `${year}-${String(i + 1).padStart(2, "0")}`;
    if (!cur || !prev) return { month, profit: 0, incomeTax: 0, bl: 0, afterTax: 0 };
    const profit = r2(cur.profit - prev.profit), incomeTax = r2(cur.incomeTax - prev.incomeTax), bl = r2(cur.bl - prev.bl);
    return { month, profit, incomeTax, bl, afterTax: r2(profit - incomeTax - bl) };
  });
}

/** Bimonthly VAT periods: January and February, March and April, and so on. Returns the period containing a date. */
export function vatPeriod(iso: string): { from: string; to: string; months: string[] } {
  const y = Number(iso.slice(0, 4)), m = Number(iso.slice(5, 7));
  const first = Math.floor((m - 1) / 2) * 2 + 1;
  const a = `${y}-${String(first).padStart(2, "0")}`, b = addMonths(a, 1);
  return { from: `${a}-01`, to: `${b}-${String(daysIn(b)).padStart(2, "0")}`, months: [a, b] };
}

// ---------- The next 30 days ----------

export const HORIZON_DAYS = 30;
export interface ForecastItem {
  date: string; label: string; amount: number; kind: "RECURRING" | "BL" | "VAT" | "INCOME_TAX";
  /** The date was taken from the previous payment, or the item was due before the statement ended and no payment was seen. */
  note?: string;
}
export interface ForecastRow extends ForecastItem { balance: number }
export interface Forecast {
  start: number; startOn: string; end: string; rows: ForecastRow[]; outflows: number; inflows: number;
  minBalance: number; minOn: string; excluded: Array<{ label: string; amount: number; why: string }>;
}
export const addDays = (iso: string, n: number): string => new Date(Date.parse(iso + "T00:00:00Z") + n * 86400000).toISOString().slice(0, 10);

export interface TaxDue {
  /** VAT payable per bimonthly period from the ledger, keyed by the period's first month ("2026-09"). */
  vatByPeriod: Record<string, number>;
  /** The engine's income tax for each month (MonthTax.incomeTax), keyed by month. */
  incomeTaxByMonth: Record<string, number>;
}

/**
 * The next 30 days after the statement date, as a running balance. Charges come from the recurring list (VAT and
 * income tax excluded there); VAT and the income tax advance come from the ledger and the engine, for every period not
 * yet paid, on the day of month of the previous payment (or the 15th). Expected receipts (a receipt that repeats at
 * the same amount, open pro formas) are listed apart and not counted: the money is not in until it is in.
 */
export function forecast30(classified: Classified[], rec: Recurring[], start: number, startOn: string, taxes: TaxDue,
  openReceivables = 0): Forecast {
  const end = addDays(startOn, HORIZON_DAYS);
  const items: ForecastItem[] = [];
  for (const r of rec) {
    // Owner draws are what this screen computes, not a commitment; VAT and income tax are added below from the ledger.
    if (r.amount >= 0 || r.cat.key === "OWNER_DRAW" || r.cat.key === "TAX_VAT" || r.cat.key === "TAX_IT") continue;
    let d = r.next;
    const step = r.cadence === "MONTHLY" ? 1 : 2;
    let late = false;
    while (d <= startOn) { if (addDays(d, 5) <= startOn) late = true; d = sameDayLater(d, step); }
    const kind = r.cat.key === "TAX_BL" ? "BL" as const : "RECURRING" as const;
    for (; d <= end; d = sameDayLater(d, step)) items.push({ date: d, label: r.label, amount: r.amount, kind, note: late ? "החיוב הקודם לא נראה בדף הבנק" : undefined });
  }
  // VAT and the income tax advance: what the last payment of each covered, and what is still open after it.
  const lastPaid = (key: string) => classified.filter((l) => l.cat.key === key && l.amount < 0).map((l) => l.value_date).sort().pop() ?? null;
  const vatLast = lastPaid("TAX_VAT"), itLast = lastPaid("TAX_IT");
  const paidThrough = (d: string | null) => (d ? vatPeriod(addMonths(d.slice(0, 7), -2) + "-01").to : null);
  const dueOn = (periodTo: string, payDay: string | null) => {
    const ym = addMonths(periodTo.slice(0, 7), 1);
    return `${ym}-${String(Math.min(payDay ? Number(payDay.slice(8)) : 15, daysIn(ym))).padStart(2, "0")}`;
  };
  const open = (paid: string | null): Array<{ from: string; to: string; months: string[] }> => {
    const cur = vatPeriod(startOn), list: Array<{ from: string; to: string; months: string[] }> = [];
    // Without a payment in the bank lines, assume the period before the current one is still owed only if not yet due.
    let p = paid ? vatPeriod(addDays(paid, 1)) : vatPeriod(addMonths(cur.from.slice(0, 7), -2) + "-01");
    for (; p.from <= cur.from; p = vatPeriod(addMonths(p.from.slice(0, 7), 2) + "-01")) list.push(p);
    return list;
  };
  for (const p of open(paidThrough(vatLast))) {
    const amt = r2(taxes.vatByPeriod[p.months[0]] ?? 0);
    const due = dueOn(p.to, vatLast);
    if (!vatLast && due < startOn) continue;
    if (amt > 0 && due <= end) items.push({ date: due < startOn ? addDays(startOn, 1) : due, label: `מע״מ ${p.months[0].slice(5)}/${p.months[1].slice(5)}`, amount: -amt, kind: "VAT", note: vatLast ? undefined : "מועד משוער, אין עדיין תשלום מע״מ בדפי הבנק" });
  }
  if (itLast) {
    for (const p of open(paidThrough(itLast))) {
      const amt = r2(p.months.reduce((a, m) => a + (taxes.incomeTaxByMonth[m] ?? 0), 0));
      const due = dueOn(p.to, itLast);
      if (amt > 0 && due <= end) items.push({ date: due < startOn ? addDays(startOn, 1) : due, label: `מקדמת מס הכנסה ${p.months[0].slice(5)}/${p.months[1].slice(5)} (הערכה לפי מנוע המס)`, amount: -amt, kind: "INCOME_TAX" });
    }
  }
  items.sort((a, b) => a.date.localeCompare(b.date) || a.amount - b.amount);
  let bal = start, minBalance = start, minOn = startOn;
  const rows = items.map((it) => {
    bal = r2(bal + it.amount);
    if (bal < minBalance) { minBalance = bal; minOn = it.date; }
    return { ...it, balance: bal };
  });
  const excluded: Forecast["excluded"] = [];
  for (const r of rec) {
    if (r.amount <= 0 || r.cat.flow !== "IN") continue;
    let d = r.next;
    while (d <= startOn) d = sameDayLater(d, r.cadence === "MONTHLY" ? 1 : 2);
    if (d <= end) excluded.push({ label: `${r.label} (${d.split("-").reverse().join(".")})`, amount: r.amount, why: "תקבול קבוע צפוי. לא נכלל עד שייכנס" });
  }
  if (openReceivables > 0) excluded.push({ label: "חשבונות עסקה פתוחים", amount: r2(openReceivables), why: "לא נכללו, כי מועד התשלום לא ידוע" });
  if (!itLast) excluded.push({ label: "מקדמות מס הכנסה", amount: 0, why: "אין עדיין תשלום מקדמה בדפי הבנק, ולכן אין מועד" });
  return {
    start, startOn, end, rows, minBalance, minOn, excluded,
    outflows: r2(-items.filter((i) => i.amount < 0).reduce((a, i) => a + i.amount, 0)),
    inflows: r2(items.filter((i) => i.amount > 0).reduce((a, i) => a + i.amount, 0)),
  };
}

// ---------- Drawable salary ----------

export interface Drawable {
  month: string;
  /** Profit of the month after income tax and National Insurance (the engine's share of the month). */
  earned: number; profit: number; incomeTax: number; bl: number;
  /** Taken by the owner in the month, from the bank lines. Positive. */
  taken: number; earnedLeft: number;
  /** Only for the month of the statement: what the cash allows now. */
  cash: null | { balance: number; asOf: string; vat: number; incomeTax: number; bl: number; reserve: number; left: number };
  drawable: number; binding: "EARNED" | "CASH";
}

/** The reserve when the partner set none: one month of the recurring business charges, taxes and the owner's own excluded. */
export function defaultReserve(rec: Recurring[]): number {
  return r2(rec.filter((r) => r.amount < 0 && r.cadence === "MONTHLY" && r.cat.flow === "OUT" && r.cat.group !== "מסים")
    .reduce((a, r) => a - r.amount, 0));
}

export function drawable(month: string, tax: MonthTax, classified: Classified[], fc: Forecast | null, reserve: number): Drawable {
  const taken = r2(-classified.filter((l) => monthOf(l.value_date) === month && l.cat.flow === "OWNER").reduce((a, l) => a + l.amount, 0));
  const earnedLeft = r2(tax.afterTax - taken);
  let cash: Drawable["cash"] = null;
  if (fc) {
    const sum = (k: ForecastItem["kind"]) => r2(-fc.rows.filter((r) => r.kind === k).reduce((a, r) => a + r.amount, 0));
    const vat = sum("VAT"), incomeTax = sum("INCOME_TAX"), bl = sum("BL");
    cash = { balance: fc.start, asOf: fc.startOn, vat, incomeTax, bl, reserve: r2(reserve), left: r2(fc.start - vat - incomeTax - bl - reserve) };
  }
  const left = cash ? Math.min(earnedLeft, cash.left) : earnedLeft;
  return {
    month, earned: tax.afterTax, profit: tax.profit, incomeTax: tax.incomeTax, bl: tax.bl, taken, earnedLeft, cash,
    drawable: r2(Math.max(0, left)), binding: cash && cash.left < earnedLeft ? "CASH" : "EARNED",
  };
}

// ---------- Insights ----------

export interface Insight { tone: "warn" | "info"; title: string; body: string }

export function insights(classified: Classified[], month: string, asOf: string | null, today: string, d: Drawable | null): Insight[] {
  const out: Insight[] = [];
  const nf = (n: number) => Math.abs(n).toLocaleString("he-IL", { maximumFractionDigits: 0 });
  if (asOf && dayDiff(asOf, today) > 35) out.push({ tone: "warn", title: "דף הבנק ישן", body: `הנתונים עד ${asOf.split("-").reverse().join(".")}. העלו את דף הבנק של החודש האחרון כדי שהיתרה והתחזית יהיו נכונות.` });
  const inMonth = classified.filter((l) => monthOf(l.value_date) === month);
  const noDoc = inMonth.filter((l) => l.amount > 0 && l.cat.key !== "REFUNDS" && l.how !== "MATCH" && l.cat.flow === "IN");
  if (noDoc.length > 0) out.push({ tone: "warn", title: "תקבולים בלי מסמך", body: `${noDoc.length} תקבולים בסך ${nf(noDoc.reduce((a, l) => a + l.amount, 0))} ₪ עוד לא שויכו לחשבונית או לקבלה. על כל תקבול צריך להפיק מסמך.` });
  const unassigned = inMonth.filter((l) => l.cat.key === "UNMATCHED_OUT");
  if (unassigned.length > 0) {
    const top = [...unassigned].sort((a, b) => a.amount - b.amount).slice(0, 3).map((l) => `${(l.description ?? "").trim()} ${nf(l.amount)} ₪`).join(", ");
    out.push({ tone: "info", title: "חיובים ללא קטגוריה", body: `${unassigned.length} חיובים עוד לא שויכו (${top}). שיוך בהתאמת הבנק משפר את הפילוח ואת זיהוי החיובים הקבועים.` });
  }
  // A charge three times its counterparty's usual size.
  const outs = classified.filter((l) => l.cat.flow === "OUT" && l.amount < 0);
  let unusual = 0;
  for (const l of inMonth.filter((x) => x.cat.flow === "OUT" && x.amount < 0)) {
    if (unusual >= 3) break;
    const peers = outs.filter((p) => p.id !== l.id && normDesc(p.description) === normDesc(l.description)).map((p) => -p.amount);
    if (peers.length >= 2 && -l.amount >= 3 * median(peers)) {
      unusual++;
      out.push({ tone: "warn", title: "הוצאה חריגה", body: `${(l.description ?? "").trim()}: ${nf(l.amount)} ₪ ב-${l.value_date.split("-").reverse().join(".")}, פי ${Math.round((-l.amount / median(peers)) * 10) / 10} מהרגיל אצל אותו גורם.` });
    }
  }
  if (inMonth.some((l) => /החזרת שיק/.test(l.description ?? ""))) out.push({ tone: "warn", title: "שיק חזר", body: "בחודש הזה חזר שיק. ודאו שהתקבל תשלום חלופי ושהמסמך שהופק עליו תוקן." });
  if (d && d.taken > 0 && d.earnedLeft < 0) out.push({ tone: "warn", title: "נמשך יותר מהרווח", body: `החודש נמשכו ${nf(d.taken)} ₪, ${nf(-d.earnedLeft)} ₪ יותר מהרווח אחרי מס הכנסה וביטוח לאומי. ההפרש יוצא מהרזרבה או מכספי המסים.` });
  return out;
}
