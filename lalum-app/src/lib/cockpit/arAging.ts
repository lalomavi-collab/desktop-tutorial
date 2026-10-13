// Receivables aging, historical DSO and reminder rules. Pure functions, no I/O.
// Verified by: npm run ar-aging-check
//
// Aging is measured from the DUE DATE, not the issue date. An invoice with no due date is treated as due on its issue
// date, which is the conservative reading. Only issued, non test INVOICE documents carry a receivable; pro formas,
// drafts and test documents never do. Client trust money is not in this ledger and is never counted here.
import { ACCOUNTING_BASIS, closedBy, isLive, r2, receivable } from "./finance.ts";
import type { Basis, FinCustomer, FinDocument, FinPayment } from "./finance.ts";

export type Bucket = "CURRENT" | "D31_60" | "D61_90" | "D90_PLUS";
export const BUCKETS: Bucket[] = ["CURRENT", "D31_60", "D61_90", "D90_PLUS"];
export const BUCKET_LABEL: Record<Bucket, string> = {
  CURRENT: "שוטף עד 30 יום", D31_60: "31 עד 60 יום", D61_90: "61 עד 90 יום", D90_PLUS: "מעל 90 יום",
};

/** A customer with an open balance more than this many days past due is a billing lock candidate. */
export const LOCK_AFTER_DAYS = 60;
/** No automatic reminder to the same customer within this many days of the last one. Mirrors lalum_fin_log_reminder. */
export const COOLDOWN_DAYS = 7;
/** Settled invoices older than this are not used for DSO. */
export const DSO_WINDOW_DAYS = 365;
/** Below this many settled invoices a customer's own DSO is not trusted. */
export const DSO_MIN_SAMPLE = 3;

// ---- dates (ISO yyyy-mm-dd, UTC arithmetic so a daylight saving change never shifts a day) ----

const utc = (iso: string): number => { const [y, m, d] = iso.split("-").map(Number); return Date.UTC(y, m - 1, d); };
export const daysBetween = (fromIso: string, toIso: string): number => Math.round((utc(toIso) - utc(fromIso)) / 86400000);
export const addDays = (iso: string, n: number): string => new Date(utc(iso) + n * 86400000).toISOString().slice(0, 10);
/** An ISO date as dd.mm.yyyy for display. */
export const fmtDay = (iso: string): string => { const [y, m, d] = iso.split("-"); return `${d}.${m}.${y}`; };
/** Today's date in Israel as an ISO date. */
export const todayIL = (): string => new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Jerusalem" }).format(new Date());

// ---- aging ----

/** A partner override is in force through its last day, inclusive. Mirrors lalum_fin_collections_blocked. */
export const overrideActive = (until: string | null | undefined, today: string): boolean => !!until && until >= today;

export const dueDateOf = (d: Pick<FinDocument, "due_date" | "issue_date">): string => d.due_date ?? d.issue_date;

export function bucketOf(daysPastDue: number): Bucket {
  if (daysPastDue <= 30) return "CURRENT";
  if (daysPastDue <= 60) return "D31_60";
  if (daysPastDue <= 90) return "D61_90";
  return "D90_PLUS";
}

export interface AgingRow {
  documentId: string; docNumber: number | null; subject: string; issueDate: string; dueDate: string;
  balance: number; daysPastDue: number; bucket: Bucket;
}
export interface CustomerAging {
  customerId: string; name: string; total: number; buckets: Record<Bucket, number>;
  /** Most days past due among the customer's open invoices. Negative when nothing is due yet. */
  oldestDaysPastDue: number;
  /** Open balance past LOCK_AFTER_DAYS. */
  overdueOver60: number;
  shouldLock: boolean; locked: boolean; lockReason: string | null;
  /** Date until which a partner override lets new time through although the lock is on. Null when none, or already expired. */
  overrideUntil: string | null;
  rows: AgingRow[];
}
export interface AgingReport {
  asOf: string; customers: CustomerAging[]; totals: Record<Bucket, number>; total: number;
  /** Part of the total not yet due at all, shown so "current" is not mistaken for "overdue". */
  notYetDue: number;
}

const emptyBuckets = (): Record<Bucket, number> => ({ CURRENT: 0, D31_60: 0, D61_90: 0, D90_PLUS: 0 });

export function agingReport(customers: FinCustomer[], docs: FinDocument[], pays: FinPayment[], today: string, basis: Basis = ACCOUNTING_BASIS): AgingReport {
  const byId = new Map(customers.map((c) => [c.id, c]));
  const per = new Map<string, CustomerAging>();
  const totals = emptyBuckets();
  let notYetDue = 0;
  for (const inv of docs) {
    const balance = receivable(inv, docs, pays, basis);
    if (balance <= 0) continue;
    const dueDate = dueDateOf(inv);
    const daysPastDue = daysBetween(dueDate, today);
    const bucket = bucketOf(daysPastDue);
    const c = byId.get(inv.customer_id);
    let agg = per.get(inv.customer_id);
    if (!agg) {
      agg = {
        customerId: inv.customer_id, name: c?.name ?? "לקוח לא מזוהה", total: 0, buckets: emptyBuckets(),
        oldestDaysPastDue: -Infinity, overdueOver60: 0, shouldLock: false, locked: !!c?.is_collections_locked,
        lockReason: c?.collections_lock_reason ?? null,
        overrideUntil: overrideActive(c?.collections_override_until, today) ? c!.collections_override_until! : null, rows: [],
      };
      per.set(inv.customer_id, agg);
    }
    agg.total = r2(agg.total + balance);
    agg.buckets[bucket] = r2(agg.buckets[bucket] + balance);
    agg.oldestDaysPastDue = Math.max(agg.oldestDaysPastDue, daysPastDue);
    if (daysPastDue > LOCK_AFTER_DAYS) agg.overdueOver60 = r2(agg.overdueOver60 + balance);
    agg.rows.push({ documentId: inv.id, docNumber: inv.doc_number, subject: inv.subject, issueDate: inv.issue_date, dueDate, balance, daysPastDue, bucket });
    totals[bucket] = r2(totals[bucket] + balance);
    if (daysPastDue <= 0) notYetDue = r2(notYetDue + balance);
  }
  const list = [...per.values()];
  for (const a of list) { a.shouldLock = a.overdueOver60 > 0; a.rows.sort((x, y) => y.daysPastDue - x.daysPastDue); }
  list.sort((a, b) => b.overdueOver60 - a.overdueOver60 || b.total - a.total || a.name.localeCompare(b.name, "he"));
  return { asOf: today, customers: list, totals, total: r2(BUCKETS.reduce((a, k) => a + totals[k], 0)), notYetDue };
}

// ---- historical DSO ----

/**
 * The day a receivable was settled. Cash basis: the issue date of the tax document that closed the pro forma (it is issued when the
 * money arrives). Accrual basis: the first date on which payments and receipts linked to the invoice, together, reach what was owed
 * after credits. Null when it is not settled, or was credited away entirely.
 */
export function settlementDate(doc: FinDocument, docs: FinDocument[], pays: FinPayment[], basis: Basis = ACCOUNTING_BASIS): string | null {
  if (basis === "CASH") {
    if (doc.doc_type !== "PROFORMA" || doc.status !== "ISSUED" || doc.is_test) return null;
    return closedBy(doc, docs)?.issue_date ?? null;
  }
  const inv = doc;
  if (inv.doc_type !== "INVOICE" || !isLive(inv)) return null;
  const linked = docs.filter((d) => isLive(d) && d.related_doc_id === inv.id);
  const credited = linked.filter((d) => d.doc_type === "CREDIT").reduce((a, d) => a + d.total, 0);
  const target = r2(inv.total - credited);
  if (target <= 0) return null;
  const events = [
    ...pays.filter((p) => p.document_id === inv.id).map((p) => ({ on: p.paid_on, amount: p.amount })),
    ...linked.filter((d) => d.doc_type === "RECEIPT").map((d) => ({ on: d.issue_date, amount: d.total })),
  ].sort((a, b) => (a.on < b.on ? -1 : a.on > b.on ? 1 : 0));
  let sum = 0;
  for (const e of events) { sum = r2(sum + e.amount); if (sum >= target) return e.on; }
  return null;
}

export interface Dso { days: number | null; sample: number }

/**
 * Average days from issue to full settlement, weighted by invoice amount, over invoices settled in the last year.
 * Pass customerId to restrict to one customer; omit it for the firm as a whole.
 * On the accrual basis INVOICE_RECEIPT is paid on the spot and says nothing about how long a customer takes, so it is not counted.
 */
export function computeDso(docs: FinDocument[], pays: FinPayment[], today: string, customerId?: string, basis: Basis = ACCOUNTING_BASIS): Dso {
  const from = addDays(today, -DSO_WINDOW_DAYS);
  let weighted = 0, weight = 0, sample = 0;
  for (const inv of docs) {
    if (customerId && inv.customer_id !== customerId) continue;
    const settled = settlementDate(inv, docs, pays, basis);
    if (!settled || settled < from || settled > today) continue;
    const lag = Math.max(0, daysBetween(inv.issue_date, settled));
    weighted += lag * inv.total; weight += inv.total; sample += 1;
  }
  return { days: sample > 0 && weight > 0 ? Math.round(weighted / weight) : null, sample };
}

export function dsoByCustomer(customers: FinCustomer[], docs: FinDocument[], pays: FinPayment[], today: string, basis: Basis = ACCOUNTING_BASIS): Map<string, Dso> {
  return new Map(customers.map((c) => [c.id, computeDso(docs, pays, today, c.id, basis)]));
}

// ---- reminders ----

export type Tier = 1 | 2 | 3;
export const TIER_LABEL: Record<Tier, string> = { 1: "תזכורת ידידותית", 2: "תזכורת רשמית", 3: "התראת גבייה דחופה" };

/** Tier by the customer's oldest open invoice: 31 to 60, 61 to 90, over 90 days past due. Under 31 gets none. */
export function tierFor(oldestDaysPastDue: number): Tier | null {
  if (oldestDaysPastDue > 90) return 3;
  if (oldestDaysPastDue > 60) return 2;
  if (oldestDaysPastDue > 30) return 1;
  return null;
}

export interface Cooldown { active: boolean; daysLeft: number }
/** Cooldown after the last logged reminder. A reminder N days ago blocks until N reaches COOLDOWN_DAYS. */
export function cooldownState(lastSentOn: string | null, today: string): Cooldown {
  if (!lastSentOn) return { active: false, daysLeft: 0 };
  const passed = daysBetween(lastSentOn, today);
  return passed < COOLDOWN_DAYS ? { active: true, daysLeft: COOLDOWN_DAYS - Math.max(0, passed) } : { active: false, daysLeft: 0 };
}

export function reminderBlock(oldestDaysPastDue: number, lastSentOn: string | null, today: string): "NOT_DUE_YET" | "COOLDOWN" | null {
  if (tierFor(oldestDaysPastDue) === null) return "NOT_DUE_YET";
  return cooldownState(lastSentOn, today).active ? "COOLDOWN" : null;
}

/** Draft text for a reminder. The partner reads and sends it; nothing here is sent automatically. */
export function reminderText(tier: Tier, name: string, total: number, oldestDaysPastDue: number): string {
  const sum = total.toLocaleString("he-IL", { style: "currency", currency: "ILS" });
  if (tier === 1) return `שלום ${name}, ביקורת שגרתית של החשבון מעלה יתרה פתוחה בסך ${sum}, שמועד תשלומה עבר לפני ${oldestDaysPastDue} ימים. אם התשלום כבר בוצע, נא להתעלם מהודעה זו ולשלוח אלינו אישור. תודה.`;
  if (tier === 2) return `${name} שלום, יתרת החוב בסך ${sum} נותרה פתוחה ${oldestDaysPastDue} ימים לאחר מועד התשלום. נבקש להסדיר אותה בימים הקרובים. בהיעדר הסדרה נהיה נאלצים להשהות את הטיפול בתיקים בהם הלקוח מיוצג, עד להסדרת החוב.`;
  return `${name}, יתרת החוב בסך ${sum} פתוחה ${oldestDaysPastDue} ימים מעבר למועד התשלום. זו התראה אחרונה לפני נקיטת הליכי גבייה. נדרש תשלום מיידי או יצירת קשר עימנו להסדר.`;
}

/** A row of lalum_fin_dunning_log, as the screens read it. */
export interface DunningEntry { id: string; customer_id: string; tier: number; channel: string; sent_on: string; note: string | null }
export const lastReminderOn = (log: DunningEntry[], customerId: string): string | null =>
  log.filter((e) => e.customer_id === customerId).reduce<string | null>((m, e) => (m === null || e.sent_on > m ? e.sent_on : m), null);
