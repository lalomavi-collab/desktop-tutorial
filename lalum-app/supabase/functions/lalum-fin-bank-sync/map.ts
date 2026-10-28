// Pure parts of lalum-fin-bank-sync: which Financy paths may be called, which Financy account is the firm's account, and how a
// Financy account and its transactions become rows of lalum_fin_bank_balances and lalum_fin_bank_lines. No I/O, so
// npm run bank-sync-check runs this file as shipped.

export const API = "https://api.open-finance.ai";

// The Financy credentials can also start a payment (there is no read only key). The function therefore calls exactly two kinds of
// URL: the token endpoint, and a GET on one of these three lists. No refresh (it costs credits), no payment, no write of any kind.
const READ_PATH = /^\/v2\/(connections|data\/accounts|data\/transactions)(\?[^#]*)?$/;
export function readUrl(path: string): string {
  if (!READ_PATH.test(path) || path.includes("..")) throw new Error("refused path");
  return API + path;
}
export const TOKEN_URL = `${API}/oauth/token`;

const DAY_MS = 86_400_000;
const isoDay = (d: Date) => d.toISOString().slice(0, 10);
export const addDays = (day: string, n: number) => isoDay(new Date(Date.parse(day + "T00:00:00Z") + n * DAY_MS));
/** Today in Israel, the day the bank books on. */
export const israelDay = (d: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jerusalem" }).format(d);
/** YYYY-MM-DD from a date or a timestamp, or null when it is not a real day. */
export function dayOf(x: unknown): string | null {
  if (typeof x !== "string") return null;
  const d = x.slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(d) && isoDay(new Date(d + "T00:00:00Z")) === d ? d : null;
}

export interface FxMoney { amount?: unknown; currency?: string }
export interface FxBalance { balanceType?: string; balanceAmount?: FxMoney; creditLimitIncluded?: boolean; referenceDate?: string; amount?: unknown; currency?: string }
export interface FxAccount {
  id?: string; connectionId?: string; providerId?: string; accountType?: string; accountName?: string; currency?: string;
  accountNumber?: unknown; parsedAccount?: { bank?: unknown; branch?: unknown; number?: unknown } | null;
  balances?: FxBalance[];
}
export interface FxConnection { id?: string; status?: string; lastFetchedAt?: string; expiryDate?: string }
export interface FxTransaction {
  id?: string; SK?: string; accountId?: string; type?: string; merchantName?: string;
  amount?: { chargedAmount?: FxMoney; originalAmount?: FxMoney };
  description?: { description?: string; additionalInfo?: string } | string;
  date?: { transactionDate?: string; bookingDate?: string; valueDate?: string };
}
export interface FirmAccount {
  id: string; bank_code: string; account_last4: string | null; currency: string; is_active: boolean;
  provider: string | null; provider_account_id: string | null; sync_from: string | null;
}
export interface Line { import_hash: string; value_date: string; posted_date: string | null; description: string | null; reference: string | null; amount: number }
export interface BalanceRow { as_of: string; balance: number; type: string; currency: string }

const toNumber = (x: unknown) => (typeof x === "number" ? x : typeof x === "string" && x.trim() !== "" ? Number(x) : Number.NaN);
const digits = (x: unknown) => (typeof x === "string" || typeof x === "number" ? String(x).replace(/\D/g, "") : "");
const bankCode = (x: unknown) => digits(x).replace(/^0+(?=\d)/, "");

/** The last four digits of the account number, from the parsed number when Financy gives one. */
export function accountLast4(a: FxAccount): string | null {
  const n = digits(a.parsedAccount?.number) || digits(a.accountNumber);
  return n.length >= 4 ? n.slice(-4) : null;
}
/** The bank's code (10 is Leumi), from the parsed number or else from the provider. */
export function accountBank(a: FxAccount): string | null {
  const b = bankCode(a.parsedAccount?.bank);
  if (b) return b;
  return /leumi/i.test(a.providerId ?? "") ? "10" : null;
}

export interface LinkPlan {
  /** Firm accounts already linked, with their Financy account. */
  linked: Array<{ firm: FirmAccount; fx: FxAccount }>;
  /** New links: a firm account and the one Financy account that matches it. */
  link: Array<{ firm: FirmAccount; fx: FxAccount }>;
  /** Linked firm accounts whose Financy account is gone. */
  missing: string[];
  /** Financy accounts that are not the firm's: type, provider and last four digits only, for the run log. */
  other: Array<{ type: string | null; provider: string | null; last4: string | null }>;
}

/**
 * A firm account is linked by itself only when the match cannot be wrong: a checking account at the same bank whose number ends in
 * the firm account's last four digits, and no other account on either side that matches as well. Everything else in the owner's
 * Financy profile stays out (private accounts, cards, a second business).
 */
export function planLinks(fx: FxAccount[], firm: FirmAccount[]): LinkPlan {
  const plan: LinkPlan = { linked: [], link: [], missing: [], other: [] };
  const byId = new Map(fx.filter((a) => a.id).map((a) => [a.id as string, a]));
  const taken = new Set<string>();
  for (const f of firm) {
    if (f.provider !== "financy" || !f.is_active) continue;
    const a = byId.get(f.provider_account_id ?? "");
    if (a) { plan.linked.push({ firm: f, fx: a }); taken.add(a.id as string); } else plan.missing.push(f.id);
  }
  const open = firm.filter((f) => f.is_active && f.provider === null && /^\d{4}$/.test(f.account_last4 ?? ""));
  const fits = (f: FirmAccount, a: FxAccount) =>
    !!a.id && !taken.has(a.id) && a.accountType === "CHECKING" && accountBank(a) === bankCode(f.bank_code) && accountLast4(a) === f.account_last4;
  for (const f of open) {
    const cands = fx.filter((a) => fits(f, a));
    if (cands.length !== 1) continue;
    if (open.filter((g) => fits(g, cands[0])).length !== 1) continue;
    plan.link.push({ firm: f, fx: cands[0] });
    taken.add(cands[0].id as string);
  }
  for (const a of fx) {
    if (a.id && taken.has(a.id)) continue;
    plan.other.push({ type: a.accountType ?? null, provider: a.providerId ?? null, last4: accountLast4(a) });
  }
  return plan;
}

// closingBooked is always there on a checking account; the others stand in when it is not. A balance that counts the credit line is
// not money in the bank, so it is never taken.
const BALANCE_ORDER = ["closingBooked", "interimBooked", "expected", "interimAvailable"];

/** The account's booked balance and the day it refers to (today when Financy gives no date, never a day after today). */
export function pickBalance(a: FxAccount, today: string): BalanceRow | null {
  const currency = a.currency || "ILS";
  const rows = (Array.isArray(a.balances) ? a.balances : []).map((b) => {
    const m = b.balanceAmount ?? { amount: b.amount, currency: b.currency };
    const amount = toNumber(m.amount);
    return { type: b.balanceType ?? "unknown", amount, currency: m.currency || currency, credit: b.creditLimitIncluded === true, day: dayOf(b.referenceDate) };
  }).filter((r) => Number.isFinite(r.amount) && r.currency === currency && !r.credit);
  const rank = (t: string) => { const i = BALANCE_ORDER.indexOf(t); return i < 0 ? BALANCE_ORDER.length : i; };
  const best = rows.sort((x, y) => rank(x.type) - rank(y.type))[0];
  if (!best) return null;
  const asOf = best.day && best.day <= today ? best.day : today;
  return { as_of: asOf, balance: Math.round(best.amount * 100) / 100, type: best.type, currency };
}

const clean = (s: unknown) => (typeof s === "string" ? s.replace(/\s+/g, " ").trim() : "");

/** Financy transactions as bank lines: + money in, - money out, as the file. A line without an id, a date or an amount is skipped. */
export function mapTransactions(items: FxTransaction[], currency: string): { lines: Line[]; skipped: number } {
  const lines: Line[] = [];
  const seen = new Set<string>();
  let skipped = 0;
  for (const t of items) {
    const id = clean(t.id) || clean(t.SK).replace(/^TX#/, "");
    const charged = t.amount?.chargedAmount;
    const amount = toNumber(charged?.amount);
    const valueDay = dayOf(t.date?.valueDate) ?? dayOf(t.date?.bookingDate) ?? dayOf(t.date?.transactionDate);
    if (!id || !Number.isFinite(amount) || !valueDay || (charged?.currency && charged.currency !== currency) || seen.has(id)) { skipped++; continue; }
    seen.add(id);
    const d = t.description;
    const text = typeof d === "string" ? clean(d) : clean(d?.description) || clean(t.merchantName);
    const extra = typeof d === "string" ? "" : clean(d?.additionalInfo);
    lines.push({
      import_hash: `financy:${id}`,
      value_date: valueDay,
      posted_date: dayOf(t.date?.bookingDate),
      description: text ? text.slice(0, 500) : null,
      reference: extra ? extra.slice(0, 200) : null,
      amount: Math.round(amount * 100) / 100,
    });
  }
  return { lines, skipped };
}

/** How far back a run reads: ten days before the last line already synced (late bookings), never before sync_from. */
export const REREAD_DAYS = 10;
export function windowFrom(syncFrom: string, lastSynced: string | null): string {
  if (!lastSynced) return syncFrom;
  const back = addDays(lastSynced, -REREAD_DAYS);
  return back > syncFrom ? back : syncFrom;
}

// Connection states that mean the bank stopped answering for this consent, and those that mean Financy failed to read it.
const CONSENT_GONE = new Set(["EXPIRED", "REVOKED", "TERMINATED_BY_USER", "SUSPENDED_BY_PROVIDER", "REJECTED", "INACTIVE", "REPLACED"]);
const READ_FAILED = new Set(["CREDENTIALS_ERROR", "FETCHING_ERROR", "ERROR"]);
export function connectionState(c: FxConnection | undefined): "ok" | "consent_expired" | "provider_error" | "connection_missing" {
  if (!c) return "connection_missing";
  const s = (c.status ?? "").toUpperCase();
  return CONSENT_GONE.has(s) ? "consent_expired" : READ_FAILED.has(s) ? "provider_error" : "ok";
}

/** When Financy last read the bank for the linked accounts: the oldest of their connections, so one stalled consent shows. */
export function dataAt(conns: FxConnection[], accounts: FxAccount[]): string | null {
  const byId = new Map(conns.map((c) => [c.id, c]));
  let oldest: string | null = null;
  for (const a of accounts) {
    const at = byId.get(a.connectionId)?.lastFetchedAt;
    if (typeof at !== "string" || !Number.isFinite(Date.parse(at))) return null;
    if (oldest === null || Date.parse(at) < Date.parse(oldest)) oldest = at;
  }
  return oldest;
}

/** The run's status: the worst of the account states, in this order. */
const SEVERITY = ["connection_missing", "account_missing", "consent_expired", "provider_error", "not_linked", "ok"];
export function worst(states: string[]): string {
  return states.reduce((w, s) => (SEVERITY.indexOf(s) < SEVERITY.indexOf(w) ? s : w), "ok");
}
