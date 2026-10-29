// The finance dashboard over the business bank account: where the money stands, what came in and went out each month,
// by category, what repeats, the next 30 days, and how much the owner can still draw this month. Pure functions, no I/O,
// inputs are never mutated. Checked by `npm run bank-dashboard-check`.
//
// Two layers, never mixed in one figure:
//  * Cash, from the bank lines (statement files, later a direct feed): balance, in, out, net, recurring charges, forecast.
//    Like Financy, moves between the owner's own accounts and currency conversions are left out of in and out. Unlike
//    Financy, the card bill counts as one outflow on the day the bank charges it; the card's own lines (read from Financy)
//    are shown merchant by merchant beside it and never counted a second time.
//  * What Financy shows beyond the statement (lalum_fin_ext_lines, lalum_fin_ext_facts): the account before the first
//    statement line, the card line by line, the card's open charge, the limits and the bank guarantee.
//  * Business, from the ledger and the tax engine (taxPnl.ts): profit, income tax and National Insurance for the month.
//
// Net in the bank is not money the owner can take: it holds VAT that belongs to the state, and nothing was set aside
// from it for income tax and National Insurance. So the drawable figure is the lower of two:
//  1. earned: the month's profit after income tax and National Insurance, less what the owner already took this month;
//  2. cash: the balance, less the VAT, income tax advance and National Insurance due in the next 30 days and the card's
//     open month, less an operating reserve (by default one month of the recurring business charges). The full 30 day running balance,
//     fixed charges included, is shown beside it and warns when it would fall below zero.
import { EXPENSE_CATEGORY, r2 } from "./finance.ts";

// ---------- Inputs ----------

export interface BankLine {
  id: string; bank_account_id: string; value_date: string; description: string | null; reference?: string | null;
  amount: number; balance_after: number | null; created_at?: string | null;
  /** Set on a line taken from Financy for a day before the first statement line (withHistory). */
  origin?: "FINANCY";
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
  [/^המרה/, CAT.MOVE],
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
  /** Payments due by asOf (five days' grace) that never came; at two or more the series has stopped and is left out of the forecast. */
  missed: number; stale: boolean;
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
 * behind it. Given the statement date, a series that missed two payments in a row counts as stopped (a lease that ended,
 * a subscription cancelled): it stays in the list, marked, and leaves the forecast and the reserve.
 */
export function recurring(lines: Classified[], asOf: string | null = null): Recurring[] {
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
    const step = cadence === "MONTHLY" ? 1 : 2, next = sameDayLater(lastM.last, step);
    let missed = 0;
    if (asOf) for (let d = next; addDays(d, 5) <= asOf; d = sameDayLater(d, step)) missed++;
    out.push({
      key, label: (latest.description ?? "").trim() || latest.cat.label, cat: latest.cat, cadence,
      amount: lastM.sum, prevAmount: prevM.sum, changePct: changePct(Math.abs(lastM.sum), Math.abs(prevM.sum)),
      last: lastM.last, next, months: ms.length, missed, stale: missed >= 2,
    });
  }
  return out.sort((a, b) => a.next.localeCompare(b.next) || a.amount - b.amount);
}

// ---------- What Financy shows beyond the statement ----------

/** A transaction Financy lists (lalum_fin_ext_lines): the card merchant by merchant, or the current account before the statement. */
export interface ExtLine {
  id: string; account_kind: "card" | "current"; account_ref: string; txn_date: string; description: string;
  source_category?: string | null; amount: number; currency: string;
}
/** A figure Financy states about an account on a day (lalum_fin_ext_facts). */
export interface ExtFact {
  kind: "CARD_ACCRUED" | "CARD_LIMIT" | "OVERDRAFT_LIMIT" | "GUARANTEE" | "FX_BALANCE";
  account_ref: string; label?: string | null; amount: number; currency: string; due_on?: string | null; as_of: string;
}

/**
 * The current account's days before its first statement line, from Financy, as bank lines. Their running balance is chained
 * back from the statement's opening balance (its first closing less the lines up to it), so the balance and the months reach
 * as far back as Financy does. A day the statement covers is never taken from Financy, so a statement imported later for
 * those days replaces them by itself.
 */
export function withHistory(lines: BankLine[], accounts: BankAccount[], ext: ExtLine[]): BankLine[] {
  const closings = dailyClosings(lines);
  const added: BankLine[] = [];
  for (const a of accounts) {
    const own = lines.filter((l) => l.bank_account_id === a.id);
    if (own.length === 0) continue;
    const first = own.reduce((m, l) => (l.value_date < m ? l.value_date : m), own[0].value_date);
    const hist = ext.filter((e) => e.account_kind === "current" && e.account_ref === a.account_last4 && e.currency === "ILS" && e.txn_date < first)
      .sort((x, y) => y.txn_date.localeCompare(x.txn_date) || y.id.localeCompare(x.id));
    const c = (closings.get(a.id) ?? [])[0];
    let bal: number | null = c ? r2(c.balance - own.filter((l) => l.value_date <= c.date).reduce((s, l) => s + l.amount, 0)) : null;
    const acc: BankLine[] = [];
    for (const e of hist) {
      acc.push({ id: `financy:${e.id}`, bank_account_id: a.id, value_date: e.txn_date, description: e.description, reference: null,
        amount: Number(e.amount), balance_after: bal, origin: "FINANCY" });
      if (bal != null) bal = r2(bal - Number(e.amount));
    }
    // Oldest first, and within a day in the order of the chain, so the line that closes a day is also stored last.
    acc.reverse().forEach((l, i) => added.push({ ...l, created_at: `financy:${String(i).padStart(6, "0")}` }));
  }
  return [...added, ...lines];
}

/** The newest fact of each kind and account. */
export function latestFacts(facts: ExtFact[]): ExtFact[] {
  const m = new Map<string, ExtFact>();
  for (const f of facts) {
    const k = `${f.kind}|${f.account_ref}`, cur = m.get(k);
    if (!cur || f.as_of > cur.as_of) m.set(k, f);
  }
  return [...m.values()];
}

export interface CardCharge { account_ref: string; amount: number; due: string | null; as_of: string }
/** Card charges already made and not yet taken from the bank: the open month of each card, due after the balance's day. */
export function openCardCharges(facts: ExtFact[], asOf: string): CardCharge[] {
  return latestFacts(facts)
    .filter((f) => f.kind === "CARD_ACCRUED" && Number(f.amount) > 0 && (f.due_on ? f.due_on > asOf : f.as_of >= asOf))
    .map((f) => ({ account_ref: f.account_ref, amount: r2(Number(f.amount)), due: f.due_on ?? null, as_of: f.as_of }));
}

export interface Liquidity {
  balance: number; asOf: string;
  /** The open card charges, already spent and due after asOf. liquid = balance less them, as Financy shows it. */
  cardDue: number; cardDueOn: string | null; liquid: number;
  overdraft: number | null; cardLimit: number | null; guarantees: ExtFact[]; fx: ExtFact[];
}
export function liquidity(balance: number, asOf: string, facts: ExtFact[]): Liquidity {
  const latest = latestFacts(facts), cards = openCardCharges(facts, asOf);
  const total = (k: ExtFact["kind"]) => {
    const fs = latest.filter((f) => f.kind === k);
    return fs.length ? r2(fs.reduce((s, f) => s + Number(f.amount), 0)) : null;
  };
  const cardDue = r2(cards.reduce((s, c) => s + c.amount, 0));
  return {
    balance, asOf, cardDue, cardDueOn: cards.map((c) => c.due).filter((d): d is string => !!d).sort()[0] ?? null,
    liquid: r2(balance - cardDue), overdraft: total("OVERDRAFT_LIMIT"), cardLimit: total("CARD_LIMIT"),
    guarantees: latest.filter((f) => f.kind === "GUARANTEE"), fx: latest.filter((f) => f.kind === "FX_BALANCE"),
  };
}

// The card's merchants, by names that cannot mean anything else; the rest stays unassigned and still counts.
const CARD_RULES: Array<[RegExp, string]> = [
  [/מע["״]?מ/, "TAX_VAT"],
  [/מס הכנסה/, "TAX_IT"],
  [/דמי כרטיס|עמלת|^עמל/, "CARD_FEES"],
  [/לשכת עורכי הדין|אגרת/, "FEES"],
  [/פלאפון|סלקום|בזק|פרטנר|הוט מובייל|גולן טלקום|לינק ניהול תקשורת|zadarma/i, "COMMUNICATION"],
  [/facebk|fb\.me|google ads/i, "MARKETING"],
  [/microsoft|msbill|anthropic|openai|genspark|cloudflare|google workspace|wix\.com|godaddy|apple\.com\/bill|depositphotos|linkedin|github|vercel|supabase|adobe|canva|dropbox|notion/i, "SOFTWARE"],
  [/fiverr/i, "PROFESSIONAL"],
  [/כביש 6|מנהרות הכרמל|טעינ|ev-edge|yellow|כלמוביל|אוטו בנצ|פנגו|סונול|חניון/i, "VEHICLE"],
  [/^gett\b|priority pass|tfl travel|busfor|skybus|e-travels/i, "TRAVEL"],
];
const CARD_LABEL: Record<string, string> = { ...EXPENSE_CATEGORY, TAX_VAT: "מע״מ", TAX_IT: "מס הכנסה", CARD_FEES: "עמלות ודמי כרטיס" };

export interface CardLine extends ExtLine { cat: Cat; how: "RULE" | "NONE" }
export function classifyCard(ext: ExtLine[]): CardLine[] {
  return ext.filter((e) => e.account_kind === "card").map((e) => {
    const k = CARD_RULES.find(([re]) => re.test(e.description))?.[1];
    if (!k) return { ...e, amount: Number(e.amount), cat: C("CARD:NONE", "לא מסווג", "כרטיס", "OUT"), how: "NONE" as const };
    return { ...e, amount: Number(e.amount), cat: C(`CARD:${k}`, CARD_LABEL[k], k.startsWith("TAX_") ? "מסים" : "כרטיס", "OUT"), how: "RULE" as const };
  });
}
/** Card lines in the shape of bank lines, for the month and category functions above. */
const asBank = (cl: CardLine[]): Classified[] => cl.map((l) => ({
  id: l.id, bank_account_id: `card:${l.account_ref}`, value_date: l.txn_date, description: l.description, amount: l.amount,
  balance_after: null, cat: l.cat, how: l.how,
}));

export interface CardMonth { month: string; ils: number; fx: Record<string, number>; count: number }
/** Spending on the card per month of purchase (positive; a refund nets), shekels apart from each foreign currency. */
export function cardMonths(cl: CardLine[]): CardMonth[] {
  if (cl.length === 0) return [];
  const ms = cl.map((l) => monthOf(l.txn_date)).sort();
  const out: CardMonth[] = [];
  for (let m = ms[0]; m <= ms[ms.length - 1]; m = addMonths(m, 1)) {
    const ls = cl.filter((l) => monthOf(l.txn_date) === m);
    const fx: Record<string, number> = {};
    for (const l of ls) if (l.currency !== "ILS") fx[l.currency] = r2((fx[l.currency] ?? 0) - l.amount);
    out.push({ month: m, ils: r2(-ls.filter((l) => l.currency === "ILS").reduce((s, l) => s + l.amount, 0)), fx, count: ls.length });
  }
  return out;
}
/** The card's spending in shekels for one month by category, largest first. */
export const cardCategories = (cl: CardLine[], month: string): CatTotal[] => categoryTotals(asBank(cl.filter((l) => l.currency === "ILS")), month, "OUT");

/**
 * Charges that repeat on the card (subscriptions), each currency on its own, taxes left out. Stopped series are dropped,
 * judged by the newest card line rather than today, since the card is read once a month.
 */
export function cardRecurring(cl: CardLine[]): Array<Recurring & { currency: string }> {
  const asOf = cl.reduce<string | null>((m, l) => (m == null || l.txn_date > m ? l.txn_date : m), null);
  return [...new Set(cl.map((l) => l.currency))].flatMap((cur) =>
    recurring(asBank(cl.filter((l) => l.currency === cur && l.cat.group !== "מסים")), asOf).filter((r) => r.amount < 0 && !r.stale).map((r) => ({ ...r, currency: cur })))
    .sort((a, b) => a.next.localeCompare(b.next));
}
/** VAT and income tax paid with the card: the bank shows them only inside the card bill. */
export const cardTaxPaid = (cl: CardLine[]): Array<{ key: "TAX_VAT" | "TAX_IT"; date: string }> =>
  cl.filter((l) => l.amount < 0 && (l.cat.key === "CARD:TAX_VAT" || l.cat.key === "CARD:TAX_IT"))
    .map((l) => ({ key: l.cat.key === "CARD:TAX_VAT" ? "TAX_VAT" as const : "TAX_IT" as const, date: l.txn_date }));

/** Two identical charges on one day: a purchase in installments, or a charge taken twice. */
export function cardPairs(cl: CardLine[], month: string): Array<{ date: string; description: string; amount: number; count: number }> {
  const m = new Map<string, { date: string; description: string; amount: number; count: number }>();
  for (const l of cl) {
    if (monthOf(l.txn_date) !== month || l.amount === 0) continue;
    const k = `${l.txn_date}|${l.description}|${l.amount}|${l.currency}`;
    const c = m.get(k) ?? { date: l.txn_date, description: l.description, amount: l.amount, count: 0 };
    c.count++; m.set(k, c);
  }
  return [...m.values()].filter((c) => c.count > 1);
}

/** What the card's month calls for: a large charge with no category, identical charges on one day, a tax paid with the card. */
export function cardInsights(cl: CardLine[], month: string): Insight[] {
  const out: Insight[] = [];
  const nf = (n: number) => Math.abs(n).toLocaleString("he-IL", { maximumFractionDigits: 2 });
  const dm = (iso: string) => iso.split("-").reverse().join(".");
  const cur = (c: string) => (c === "ILS" ? "₪" : c);
  const inMonth = cl.filter((l) => monthOf(l.txn_date) === month);
  const big = inMonth.filter((l) => l.how === "NONE" && l.currency === "ILS" && l.amount <= -1000).sort((a, b) => a.amount - b.amount).slice(0, 3);
  if (big.length > 0) out.push({ tone: "info", title: "חיוב גדול בכרטיס בלי קטגוריה", body: `${big.map((l) => `${l.description.trim()} ${nf(l.amount)} ₪ ב־${dm(l.txn_date)}`).join(", ")}. אם זו הוצאה של העסק, ודאו שיש עליה חשבונית ברשימת ההוצאות.` });
  for (const p of cardPairs(cl, month).slice(0, 2)) {
    const l = inMonth.find((x) => x.txn_date === p.date && x.description === p.description && x.amount === p.amount);
    out.push({ tone: "info", title: "חיובים זהים באותו יום", body: `${p.description.trim()}: ${p.count} חיובים של ${nf(p.amount)} ${cur(l?.currency ?? "ILS")} ב־${dm(p.date)}. כך נראית עסקה בתשלומים. אם לא היו תשלומים, כדאי לברר מול חברת האשראי.` });
  }
  const tax = inMonth.filter((l) => l.cat.group === "מסים" && l.amount < 0);
  if (tax.length > 0) out.push({ tone: "info", title: "מס ששולם בכרטיס", body: `${tax.map((l) => `${l.cat.label} ${nf(l.amount)} ₪ ב־${dm(l.txn_date)}`).join(", ")}. בבנק הוא מופיע רק בתוך חיוב הכרטיס, והתחזית רואה בתקופה שלו תקופה ששולמה.` });
  return out;
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
  date: string; label: string; amount: number; kind: "RECURRING" | "BL" | "VAT" | "INCOME_TAX" | "CARD" | "RECEIPT";
  /** The date was taken from the previous payment, or the item was due before the statement ended and no payment was seen. */
  note?: string;
}
export interface ForecastRow extends ForecastItem { balance: number }
/** One line of the combined view: charges and expected receipts by date, with the balance without and with the receipts. */
export interface TimelineRow extends ForecastItem { balance: number; withReceipts: number; expected: boolean }
export interface Forecast {
  start: number; startOn: string; end: string; rows: ForecastRow[]; outflows: number; inflows: number;
  minBalance: number; minOn: string; excluded: Array<{ label: string; amount: number; why: string }>;
  /** Receipts that repeat at the same amount, due in the period: shown beside the charges, never in rows or minBalance. */
  expected: ForecastItem[]; timeline: TimelineRow[];
  /** The first day the balance falls below zero: without any receipt, and with the expected ones. Null when it never does. */
  shortOn: string | null; shortOnWithReceipts: string | null;
}
export interface ForecastExtra {
  /** Card charges already made and due in the bank later (openCardCharges): they replace the card bill estimated from the past. */
  cards?: Array<{ amount: number; due: string; label: string }>;
  /** Tax payments made outside the bank lines (cardTaxPaid), so a period paid with the card is not counted as open. */
  paidElsewhere?: Array<{ key: "TAX_VAT" | "TAX_IT"; date: string }>;
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
 * yet paid, on the day of month of the previous payment (or the 15th); a tax paid with the card counts as paid. The
 * card's open month, when Financy states it, replaces the card bill estimated from the past. Expected receipts (a receipt
 * that repeats at the same amount) get a second running balance beside the first, never in it; open pro formas are listed
 * apart: the money is not in until it is in.
 */
export function forecast30(classified: Classified[], rec: Recurring[], start: number, startOn: string, taxes: TaxDue,
  openReceivables = 0, extra: ForecastExtra = {}): Forecast {
  const end = addDays(startOn, HORIZON_DAYS);
  const items: ForecastItem[] = [];
  const cards = extra.cards ?? [];
  // A card bill within ten days of a known open charge is that charge.
  const knownCard = (d: string) => cards.some((c) => Math.abs(dayDiff(d, c.due)) <= 10);
  const stopped: Forecast["excluded"] = [];
  for (const r of rec) {
    // Owner draws are what this screen computes, not a commitment; VAT and income tax are added below from the ledger.
    if (r.amount >= 0 || r.cat.key === "OWNER_DRAW" || r.cat.key === "TAX_VAT" || r.cat.key === "TAX_IT") continue;
    if (r.stale) { stopped.push({ label: r.label, amount: r.amount, why: `לא נראה מאז ${r.last.split("-").reverse().join(".")}. אם החיוב עדיין קיים, הוא יחזור לתחזית כשיופיע שוב` }); continue; }
    let d = r.next;
    const step = r.cadence === "MONTHLY" ? 1 : 2;
    let late = false;
    while (d <= startOn) { if (addDays(d, 5) <= startOn) late = true; d = sameDayLater(d, step); }
    const kind = r.cat.key === "TAX_BL" ? "BL" as const : "RECURRING" as const;
    for (; d <= end; d = sameDayLater(d, step)) {
      if (r.cat.key === "CARD" && knownCard(d)) continue;
      items.push({ date: d, label: r.label, amount: r.amount, kind, note: late ? "החיוב הקודם לא נראה בדף הבנק" : undefined });
    }
  }
  for (const c of cards) {
    if (c.due > startOn && c.due <= end && c.amount > 0) items.push({ date: c.due, label: c.label, amount: -r2(c.amount), kind: "CARD", note: "החיוב שנצבר עד עכשיו, לפי Financy. הסכום עשוי להשתנות" });
  }
  // VAT and the income tax advance: what the last payment of each covered, and what is still open after it.
  const lastPaid = (key: "TAX_VAT" | "TAX_IT") => [...classified.filter((l) => l.cat.key === key && l.amount < 0).map((l) => l.value_date),
    ...(extra.paidElsewhere ?? []).filter((p) => p.key === key && p.date <= startOn).map((p) => p.date)].sort().pop() ?? null;
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
  const excluded: Forecast["excluded"] = [...stopped], expected: ForecastItem[] = [];
  for (const r of rec) {
    if (r.amount <= 0 || r.cat.flow !== "IN" || r.stale) continue;
    let d = r.next;
    while (d <= startOn) d = sameDayLater(d, r.cadence === "MONTHLY" ? 1 : 2);
    if (d <= end) expected.push({ date: d, label: r.label, amount: r.amount, kind: "RECEIPT", note: "תקבול שחוזר באותו סכום. לא נספר עד שייכנס" });
  }
  // Both views by date; on a day with both, the charge goes first.
  const timeline: TimelineRow[] = [];
  let a = start, b = start, shortOn: string | null = null, shortOnWithReceipts: string | null = null;
  for (const it of [...items.map((x) => ({ ...x, expected: false })), ...expected.map((x) => ({ ...x, expected: true }))]
    .sort((x, y) => x.date.localeCompare(y.date) || Number(x.expected) - Number(y.expected) || x.amount - y.amount)) {
    if (!it.expected) a = r2(a + it.amount);
    b = r2(b + it.amount);
    if (a < 0 && !shortOn) shortOn = it.date;
    if (b < 0 && !shortOnWithReceipts) shortOnWithReceipts = it.date;
    timeline.push({ ...it, balance: a, withReceipts: b });
  }
  if (openReceivables > 0) excluded.push({ label: "חשבונות עסקה פתוחים", amount: r2(openReceivables), why: "לא נכללו, כי מועד התשלום לא ידוע" });
  if (!itLast) excluded.push({ label: "מקדמות מס הכנסה", amount: 0, why: "אין עדיין תשלום מקדמה בדפי הבנק, ולכן אין מועד" });
  return {
    start, startOn, end, rows, minBalance, minOn, excluded, expected, timeline, shortOn, shortOnWithReceipts,
    outflows: r2(-items.filter((i) => i.amount < 0).reduce((a, i) => a + i.amount, 0)),
    inflows: r2(items.filter((i) => i.amount > 0).reduce((a, i) => a + i.amount, 0)),
  };
}

/**
 * How many months of business outflow the money covers if nothing comes in: the liquid balance over the average outflow
 * (taxes included, the owner's draws not) of the last three months the bank lines cover in full.
 */
export function runway(months: MonthCash[], liquid: number): { months: number; avgOut: number; basis: string[] } | null {
  const full = months.filter((m) => !m.partial && m.outflow > 0).slice(-3);
  if (full.length === 0) return null;
  const avgOut = r2(full.reduce((s, m) => s + m.outflow, 0) / full.length);
  return { months: Math.round((Math.max(0, liquid) / avgOut) * 10) / 10, avgOut, basis: full.map((m) => m.month) };
}

// ---------- Drawable salary ----------

export interface Drawable {
  month: string;
  /** Profit of the month after income tax and National Insurance (the engine's share of the month). */
  earned: number; profit: number; incomeTax: number; bl: number;
  /** Taken by the owner in the month, from the bank lines. Positive. */
  taken: number; earnedLeft: number;
  /** Only for the month of the statement: what the cash allows now. */
  cash: null | { balance: number; asOf: string; vat: number; incomeTax: number; bl: number; card: number; reserve: number; left: number };
  drawable: number; binding: "EARNED" | "CASH";
}

/** The reserve when the partner set none: one month of the recurring business charges, taxes and the owner's own excluded. */
export function defaultReserve(rec: Recurring[]): number {
  return r2(rec.filter((r) => r.amount < 0 && r.cadence === "MONTHLY" && r.cat.flow === "OUT" && r.cat.group !== "מסים" && !r.stale)
    .reduce((a, r) => a - r.amount, 0));
}

export function drawable(month: string, tax: MonthTax, classified: Classified[], fc: Forecast | null, reserve: number): Drawable {
  const taken = r2(-classified.filter((l) => monthOf(l.value_date) === month && l.cat.flow === "OWNER").reduce((a, l) => a + l.amount, 0));
  const earnedLeft = r2(tax.afterTax - taken);
  let cash: Drawable["cash"] = null;
  if (fc) {
    const sum = (k: ForecastItem["kind"]) => r2(-fc.rows.filter((r) => r.kind === k).reduce((a, r) => a + r.amount, 0));
    // The card's open month is already spent; the reserve stands for the month after it.
    const vat = sum("VAT"), incomeTax = sum("INCOME_TAX"), bl = sum("BL"), card = sum("CARD");
    cash = { balance: fc.start, asOf: fc.startOn, vat, incomeTax, bl, card, reserve: r2(reserve), left: r2(fc.start - vat - incomeTax - bl - card - reserve) };
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
  const noDoc = inMonth.filter((l) => l.amount > 0 && l.cat.key !== "REFUNDS" && l.how !== "MATCH" && l.cat.flow === "IN" && l.origin !== "FINANCY");
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
