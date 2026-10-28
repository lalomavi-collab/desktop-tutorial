// Control room (/workspace/control, and the strip on the left of every cockpit screen): turns the 15 minute snapshot that
// lalum_private.ops_snapshot writes to lalum_ops_snapshots (20261028123000) into eleven tiles, each with a status, a short line for
// the strip and the explanation that opens under it. Pure, so npm run control-room-check pins every rule.
//
// The rule behind every status: a tile is green only when its source is fresh and clean. A source that stopped says so, and its old
// number is not shown as if it were today's (a two month old bank balance or a receivable nobody reconciled misleads more than a gap).
// Bookkeeping figures come from the same engine the finance tabs use (dashboardFinance), never from separate SQL.

export type Status = "ok" | "watch" | "stale" | "bad" | "none";
export type Domain = "fin" | "mat" | "web" | "ops";
export type TileId = "pnl" | "ar" | "cash" | "issue" | "sec" | "mat" | "web" | "camp" | "cron" | "cal" | "bak";

export const STATUS_LABEL: Record<Status, string> = { ok: "תקין", watch: "לתשומת לב", stale: "מיושן", bad: "חסום", none: "לא מחובר" };
export const DOMAIN_LABEL: Record<Domain, string> = { fin: "כספים", mat: "תיקים", web: "תוכן ושיווק", ops: "תשתית ואבטחה" };
/** Problems first in the strip: blocked, stale, attention, not connected, fine. */
const RANK: Record<Status, number> = { bad: 0, stale: 1, watch: 2, none: 3, ok: 4 };
/** The wall's reading order: finance, then matters and the site, then the plumbing. */
export const WALL_ORDER: TileId[] = ["pnl", "ar", "cash", "issue", "sec", "mat", "web", "camp", "cron", "cal", "bak"];

/** A snapshot older than this is itself stale: nothing it says is shown as green. Three missed runs of the 15 minute job. */
export const SNAPSHOT_STALE_MIN = 45;
/** An archive import older than this, or failing, makes every bookkeeping figure stale. */
export const IMPORT_STALE_DAYS = 3;
/** A bank balance older than this is not shown. */
export const BANK_STALE_DAYS = 7;
/** A daily sync older than this missed a run. */
export const DAILY_STALE_HOURS = 26;
/** Google reports with a lag of two to three days; more than this means the sync stopped. */
export const GSC_STALE_DAYS = 5;
/** Pro formas open longer than this were almost always invoiced and not closed, so their sum is not a receivable. */
export const OLD_PROFORMA_DAYS = 180;

export interface Chart {
  kind: "dual" | "volume";
  labels: string[];
  a: number[]; aName: string;
  b: number[]; bName: string;
}
export interface Counts { items: Array<[string, string]>; risk: Array<{ label: string; value: number; tone: "bad" | "watch" | "none" | "ok" }> }
export interface Tile {
  id: TileId; domain: Domain; big: boolean; name: string; code: string;
  status: Status; value: string; sub: string; strip: string;
  /** What the tile says today, what completes it, where the data comes from, how often it refreshes, and the screen with the detail. */
  today: string; fix: string; src: string; fresh: string; where: { to: string; label: string } | null;
  /** Daily points, oldest first; only when there are at least two. */
  spark: number[] | null;
  chart: Chart | null;
  counts: Counts | null;
}

export interface CronJob { job: string; schedule: string; active: boolean; runs: number; failed: number; lastAt: string | null; lastStatus: string | null }
export interface SnapData {
  cron: CronJob[]; cronFailed7d: number;
  http: { total: number; bad: number; timedOut: number };
  outlook: { lastAt: string | null; status: string | null; lastOkAt: string | null; fetched: number | null; held: number };
  campaign: Record<string, { lastAt: string | null; status: string | null; lastOkAt: string | null }>;
  web: { gscLastDay: string | null; cfLastDay: string | null; paid90d: number };
  fin: {
    importLastAt: string | null; importOkAt: string | null; importLastError: string | null;
    expensesRows: number; expensesImportKey: boolean; archiveRows: number;
    proformasOpen: number; proformasOpenTotal: number; proformasOpenOld: number;
    bankLastDay: string | null; bankBalance: number | null;
  };
  sec: { definer: number; totp: number; users: number; usersNoFirm: number; partnersNoTotp: number };
  matters: { live: number; binned: number; high: number; caution: number; notAssessed: number; deadlines: number; deadlines14: number; overdue: number; feeTerms: number; timeEntries: number; inquiries: number };
  dbBytes: number;
}
export interface Snapshot { takenAt: string; data: SnapData }

/** The figures from the bookkeeping engine (dashboardFinance), oldest month first; the last month is the current, partial one. */
export interface FinanceFacts { months: string[]; revenue: number[]; expenses: number[] }
/** One day of the site's Search Console summary row and the page follower counts. */
export interface WebDay { day: string; impressions: number; clicks: number; fbFollowers: number | null; igFollowers: number | null }
/** One day's values from the snapshot history, for the sparklines. */
export interface HistoryPoint { takenAt: string; definer: number | null; live: number | null; cronFailed7d: number | null }
export interface IssueCheck { ok: boolean; text: string; at: string }

export interface Inputs {
  snapshot: Snapshot | null;
  history?: HistoryPoint[];
  web?: WebDay[];
  finance?: FinanceFacts | null;
  issueCheck?: IssueCheck | null;
  now: Date;
}

// ---- parsing (the snapshot is jsonb: every field is read defensively) ----
type Obj = Record<string, unknown>;
const obj = (x: unknown): Obj => (x && typeof x === "object" && !Array.isArray(x) ? (x as Obj) : {});
const num = (x: unknown): number => { const v = typeof x === "number" ? x : typeof x === "string" ? Number(x) : NaN; return Number.isFinite(v) ? v : 0; };
const numOrNull = (x: unknown): number | null => (x === null || x === undefined || x === "" ? null : Number.isFinite(Number(x)) ? Number(x) : null);
const str = (x: unknown): string | null => (typeof x === "string" && x !== "" ? x : null);

// The snapshot reads the run log while its own run is still open, and the log counts every status but "succeeded" as a failure, so the run
// in flight (its own every time, or any job running at that moment) came out as failed and turned the tile red. A run in flight is neither.
const IN_FLIGHT = new Set(["running", "starting"]);

export function parseSnapshot(row: unknown): Snapshot | null {
  const r = obj(row);
  const takenAt = str(r.taken_at);
  if (!takenAt || !r.data || typeof r.data !== "object") return null;
  const d = obj(r.data), h = obj(d.http), o = obj(d.outlook), w = obj(d.web), f = obj(d.fin), s = obj(d.sec), m = obj(d.matters);
  const cron: CronJob[] = (Array.isArray(d.cron) ? d.cron : []).map((x) => {
    const j = obj(x), lastStatus = str(j.last_status), live = lastStatus !== null && IN_FLIGHT.has(lastStatus);
    return { job: str(j.job) ?? "", schedule: str(j.schedule) ?? "", active: j.active !== false, runs: num(j.runs_24h), failed: Math.max(0, num(j.failed_24h) - (live ? 1 : 0)), lastAt: str(j.last_at), lastStatus };
  });
  const campaign: SnapData["campaign"] = {};
  for (const [k, v] of Object.entries(obj(d.campaign))) { const c = obj(v); campaign[k] = { lastAt: str(c.last_at), status: str(c.status), lastOkAt: str(c.last_ok_at) }; }
  return {
    takenAt,
    data: {
      cron,
      cronFailed7d: Math.max(0, num(d.cron_failed_7d) - cron.filter((j) => j.lastStatus !== null && IN_FLIGHT.has(j.lastStatus)).length),
      http: { total: num(h.total), bad: num(h.bad), timedOut: num(h.timed_out) },
      outlook: { lastAt: str(o.last_at), status: str(o.status), lastOkAt: str(o.last_ok_at), fetched: numOrNull(o.fetched), held: num(o.held) },
      campaign,
      web: { gscLastDay: str(w.gsc_last_day), cfLastDay: str(w.cf_last_day), paid90d: num(w.paid_90d) },
      fin: {
        importLastAt: str(f.import_last_at), importOkAt: str(f.import_ok_at), importLastError: str(f.import_last_error),
        expensesRows: num(f.expenses_rows), expensesImportKey: f.expenses_import_key === true, archiveRows: num(f.archive_rows),
        proformasOpen: num(f.proformas_open), proformasOpenTotal: num(f.proformas_open_total), proformasOpenOld: num(f.proformas_open_old),
        bankLastDay: str(f.bank_last_day), bankBalance: numOrNull(f.bank_balance),
      },
      sec: { definer: num(s.definer_callable), totp: num(s.totp_verified), users: num(s.users_total), usersNoFirm: num(s.users_no_firm), partnersNoTotp: num(s.partners_no_totp) },
      matters: {
        live: num(m.live), binned: num(m.binned), high: num(m.high), caution: num(m.caution), notAssessed: num(m.not_assessed),
        deadlines: num(m.deadlines_total), deadlines14: num(m.deadlines_14d), overdue: num(m.deadlines_overdue),
        feeTerms: num(m.fee_terms), timeEntries: num(m.time_entries), inquiries: num(m.inquiries),
      },
      dbBytes: num(obj(d.db).bytes),
    },
  };
}

// ---- dates and numbers, in Israel time ----
const IL = "Asia/Jerusalem";
/** YYYY-MM-DD of an instant in Israel. */
export const dayIL = (at: Date): string => new Intl.DateTimeFormat("sv-SE", { timeZone: IL }).format(at);
/** "21.10" from an instant or a YYYY-MM-DD date. */
export function fmtDay(x: string | null): string {
  if (!x) return "";
  const d = /^\d{4}-\d{2}-\d{2}$/.test(x) ? x : dayIL(new Date(x));
  return `${Number(d.slice(8, 10))}.${Number(d.slice(5, 7))}`;
}
/** "14:05" in Israel. */
export const fmtTime = (iso: string | null): string => (iso ? new Intl.DateTimeFormat("he-IL", { timeZone: IL, hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(iso)) : "");
const DAY_MS = 86400000;
/** Whole days from a YYYY-MM-DD date (or an instant's Israel date) to today in Israel. */
export function daysSince(x: string | null, now: Date): number | null {
  if (!x) return null;
  const d = /^\d{4}-\d{2}-\d{2}$/.test(x) ? x : dayIL(new Date(x));
  return Math.round((Date.parse(dayIL(now)) - Date.parse(d)) / DAY_MS);
}
export const hoursSince = (iso: string | null, now: Date): number | null => (iso ? (now.getTime() - Date.parse(iso)) / 3600000 : null);
const nf = (v: number) => Math.round(v).toLocaleString("he-IL");
/** ₪1.19M, ₪55.2K, ₪820. */
export function money(v: number): string {
  const a = Math.abs(v), t = (x: number) => String(+x.toFixed(x >= 100 ? 0 : x >= 10 ? 1 : 2));
  const s = v < 0 ? "-" : "";
  if (a >= 1e6) return `₪${s}${t(a / 1e6)}M`;
  if (a >= 1e4) return `₪${s}${t(a / 1e3)}K`;
  return `₪${s}${nf(a)}`;
}
const pct = (cur: number, prev: number): number | null => (prev >= 3 ? Math.round(((cur - prev) / prev) * 100) : null);

/** Last value per Israel day, oldest first, at most `days` days. */
export function daily<T>(points: T[], at: (p: T) => string, value: (p: T) => number | null, days = 30): number[] {
  const by = new Map<string, number>();
  for (const p of [...points].sort((x, y) => at(x).localeCompare(at(y)))) { const v = value(p); if (v !== null) by.set(dayIL(new Date(at(p))), v); }
  return [...by.entries()].sort((x, y) => x[0].localeCompare(y[0])).slice(-days).map((e) => e[1]);
}
const spark = (v: number[]): number[] | null => (v.length >= 2 ? v : null);

export interface MetricRow { day: string; source: string; scope: string; key: string; metric: string; value: number }
/** Search Console impressions and clicks, and the page follower counts, per day, from lalum_campaign_metrics_daily. Only the summary row
 *  (scope site, key '') counts: on 24.10 the same day also held 568 breakdown rows by page and query, and adding them up gave 4,998
 *  clicks instead of 85. */
export function webDays(rows: MetricRow[]): WebDay[] {
  const by = new Map<string, WebDay>();
  for (const r of rows) {
    if (r.scope !== "site" || r.key !== "") continue;
    const d = by.get(r.day) ?? { day: r.day, impressions: 0, clicks: 0, fbFollowers: null, igFollowers: null };
    const v = Number(r.value) || 0;
    if (r.source === "gsc" && r.metric === "impressions") d.impressions = v;
    else if (r.source === "gsc" && r.metric === "clicks") d.clicks = v;
    else if (r.source === "facebook" && r.metric === "followers") d.fbFollowers = v;
    else if (r.source === "instagram" && r.metric === "followers") d.igFollowers = v;
    else continue;
    by.set(r.day, d);
  }
  return [...by.values()].sort((a, b) => a.day.localeCompare(b.day));
}

// ---- the tiles ----
const base = (id: TileId, domain: Domain, big: boolean, name: string, code: string, src: string, fresh: string, where: Tile["where"]): Tile => ({
  id, domain, big, name, code, src, fresh, where, status: "none", value: "", sub: "", strip: "", today: "", fix: "", spark: null, chart: null, counts: null,
});

const UNAUTHORIZED = /UnauthorizedUser|invoice4u_unauthorized/i;

function importState(f: SnapData["fin"], now: Date): { failed: boolean; staleDays: number | null; stale: boolean; unauthorized: boolean } {
  const failed = !!f.importLastError;
  const staleDays = daysSince(f.importOkAt, now);
  return { failed, staleDays, stale: failed || staleDays === null || staleDays > IMPORT_STALE_DAYS, unauthorized: UNAUTHORIZED.test(f.importLastError ?? "") };
}

function pnlTile(d: SnapData, fin: FinanceFacts | null | undefined, now: Date): Tile {
  const t = base("pnl", "fin", true, "הכנסות מול הוצאות", "FIN · P&L", "ארכיון Invoice4U וההוצאות, דרך מנוע הרווח וההפסד של הנהלת החשבונות (אותו חישוב כמו בלשונית הדוחות)", "בכל ייבוא מ-Invoice4U", { to: "/settings/billing", label: "הנהלת חשבונות" });
  const im = importState(d.fin, now);
  t.status = im.stale ? "stale" : !d.fin.expensesImportKey ? "watch" : "ok";
  const parts: string[] = [];
  if (im.failed) parts.push(`הייבוא מ-Invoice4U נכשל מאז ${fmtDay(d.fin.importLastAt)}${im.unauthorized ? " (המפתח נדחה)" : ""}, ולכן מסמכים חדשים לא נכנסים. הייבוא האחרון שהצליח: ${fmtDay(d.fin.importOkAt) || "אין"}.`);
  else if (im.stale) parts.push(d.fin.importOkAt ? `הייבוא האחרון שהצליח היה לפני ${im.staleDays} ימים, ב-${fmtDay(d.fin.importOkAt)}.` : "עוד לא היה ייבוא שהצליח.");
  else parts.push(`הייבוא האחרון הצליח ב-${fmtDay(d.fin.importOkAt)}.`);
  if (!d.fin.expensesImportKey) parts.push(`ההוצאות (${nf(d.fin.expensesRows)} שורות) עדיין כוללות את 14 הכפולות מהייבוא של 21.10.`);
  t.today = `${STATUS_LABEL[t.status]}. ${parts.join(" ")}`;
  const fix: string[] = [];
  if (im.failed && im.unauthorized) fix.push("המפתח הנכון ל-Invoice4U (רשימת הכספים שלך), ואחריו ייבוא אחד.");
  else if (im.stale) fix.push("ייבוא מהארכיון בהנהלת החשבונות.");
  if (!d.fin.expensesImportKey) fix.push("A1: הדבקת ניקוי הכפולות ביום הכספים. התווית יורדת לבד כשהניקוי במסד.");
  t.fix = fix.join(" ") || "אין פעולה.";
  if (fin && fin.months.length >= 2) {
    const i = fin.months.length - 2, cur = fin.revenue[i] ?? 0, prev = fin.revenue[i - 1] ?? 0, ch = pct(cur, prev);
    t.value = money(cur);
    t.sub = `הכנסה ב${fin.months[i]}, החודש המלא האחרון${ch === null ? "" : `. ${ch >= 0 ? "עלייה" : "ירידה"} של ${Math.abs(ch)}% מהחודש שלפניו`}`;
    t.chart = { kind: "dual", labels: fin.months, a: fin.revenue, aName: "הכנסות", b: fin.expenses, bName: "הוצאות" };
  } else {
    // No chart here: the strip never loads the bookkeeping engine, and on the wall it has fewer than two months or did not load.
    t.value = im.failed ? "הייבוא נכשל" : `ייבוא ${fmtDay(d.fin.importOkAt)}`;
    t.sub = im.failed ? `מאז ${fmtDay(d.fin.importLastAt)}. הייבוא האחרון שהצליח: ${fmtDay(d.fin.importOkAt) || "אין"}` : "אין עדיין שני חודשים מלאים לגרף";
  }
  t.strip = im.failed ? `הייבוא נכשל מאז ${fmtDay(d.fin.importLastAt)}` : !d.fin.expensesImportKey ? "כולל 14 כפולות" : `ייבוא אחרון ${fmtDay(d.fin.importOkAt)}`;
  return t;
}

function arTile(d: SnapData, now: Date): Tile {
  const t = base("ar", "fin", false, "גבייה פתוחה", "FIN · AR", "חשבונות עסקה פתוחים בארכיון Invoice4U, כפי שהגיעו בייבוא האחרון", "בכל ייבוא", { to: "/workspace/partner", label: "תמונת שותף" });
  const f = d.fin, im = importState(f, now);
  const raw = `${money(f.proformasOpenTotal)} ב-${nf(f.proformasOpen)} חשבונות עסקה`;
  if (im.stale) {
    t.status = "bad"; t.value = "לא מאומת"; t.sub = `לפי הייבוא של ${fmtDay(f.importOkAt) || "אין"}`; t.strip = "לא מאומת עד ייבוא";
    t.today = `חסום. הסכום (${raw}) לא מוצג: סגירה של חשבון עסקה נעשית ב-Invoice4U ומגיעה לכאן רק בייבוא, והייבוא לא הצליח מאז ${fmtDay(f.importOkAt) || "אף פעם"}.${f.proformasOpenOld ? ` ${nf(f.proformasOpenOld)} מהם פתוחים יותר מחצי שנה.` : ""}`;
    t.fix = "קודם ייבוא שמצליח (המפתח ל-Invoice4U), ואז C1 ביום הכספים: סגירת חשבונות העסקה שכבר חויבו.";
  } else if (f.proformasOpenOld > 0) {
    t.status = "watch"; t.value = "לא מוצג"; t.sub = `${nf(f.proformasOpenOld)} חשבונות עסקה פתוחים מעל חצי שנה`; t.strip = `${nf(f.proformasOpenOld)} ישנים פתוחים`;
    t.today = `לתשומת לב. ${raw} נראים כחוב פתוח, אבל ${nf(f.proformasOpenOld)} מהם פתוחים יותר מחצי שנה, כלומר רובם חויבו ולא נסגרו. הסכום לא מוצג עד הניקוי.`;
    t.fix = "C1 ביום הכספים: סגירה ב-Invoice4U של חשבונות העסקה שכבר חויבו, ואחריה ייבוא. הסכום חוזר לאריח כשאין חשבון עסקה פתוח מעל חצי שנה.";
  } else {
    t.status = "ok"; t.value = money(f.proformasOpenTotal); t.sub = f.proformasOpen ? `${nf(f.proformasOpen)} חשבונות עסקה פתוחים` : "אין חשבונות עסקה פתוחים"; t.strip = f.proformasOpen ? `${money(f.proformasOpenTotal)} פתוח` : "אין פתוחים";
    t.today = `תקין. ${f.proformasOpen ? raw : "אין חשבון עסקה פתוח"} לפי הייבוא של ${fmtDay(f.importOkAt)}.`;
    t.fix = "אין פעולה. הגיול המלא בתמונת השותף.";
  }
  return t;
}

function cashTile(d: SnapData, now: Date): Tile {
  const t = base("cash", "fin", false, "מזומן בבנק", "FIN · BANK", "שורות הבנק שיובאו לחשבון בלאומי", "ידני, בכל ייבוא קובץ", { to: "/settings/billing", label: "הנהלת חשבונות" });
  const f = d.fin, age = daysSince(f.bankLastDay, now);
  if (!f.bankLastDay || age === null) {
    t.status = "none"; t.value = "אין נתוני בנק"; t.sub = "לא יובא קובץ"; t.strip = "אין נתוני בנק";
    t.today = "לא מחובר. לא יובאה אף שורת בנק."; t.fix = "ייבוא קובץ ייצוא מלאומי.";
  } else if (age > BANK_STALE_DAYS || f.bankBalance === null) {
    t.status = "stale"; t.value = "יתרה לא מוצגת"; t.sub = `תנועה אחרונה ב-${fmtDay(f.bankLastDay)}, לפני ${age} ימים`; t.strip = `נתון אחרון ${fmtDay(f.bankLastDay)}`;
    t.today = `מיושן. התנועה האחרונה מ-${fmtDay(f.bankLastDay)}. היתרה לא מוצגת בכוונה: יתרה מלפני יותר משבוע מטעה יותר מחוסר נתון.`;
    t.fix = "קובץ ייצוא מלאומי לחודשים החסרים. ההחלטה על חיבור ישיר (Financy) פתוחה בשרשור דשבורד הבנק.";
  } else {
    t.status = "ok"; t.value = money(f.bankBalance); t.sub = `יתרה ב-${fmtDay(f.bankLastDay)}`; t.strip = `${money(f.bankBalance)} ב-${fmtDay(f.bankLastDay)}`;
    t.today = `תקין. היתרה אחרי התנועה של ${fmtDay(f.bankLastDay)}.`; t.fix = "אין פעולה.";
  }
  return t;
}

function issueTile(d: SnapData, check: IssueCheck | null | undefined): Tile {
  const t = base("issue", "fin", false, "מערכת ההנפקה", "INVOICE4U", "יומן הייבוא, ובדיקת החיבור שבאריח הזה (קריאה בלבד, לא מפיקה ולא שומרת דבר)", "בכל ייבוא, ובכל לחיצה על בדיקת חיבור", { to: "/settings/billing", label: "הנהלת חשבונות" });
  const unauthorized = UNAUTHORIZED.test(d.fin.importLastError ?? "");
  if (check?.ok) {
    t.status = "ok"; t.value = "המפתח מתקבל"; t.sub = `נבדק ב-${fmtTime(check.at)}`; t.strip = `נבדק ${fmtTime(check.at)}`;
    t.today = `תקין. ${check.text}`; t.fix = unauthorized ? "ייבוא אחד מהארכיון, כדי שהאריחים של הכספים יתעדכנו." : "אין פעולה.";
  } else if (check) {
    t.status = "bad"; t.value = "הבדיקה נכשלה"; t.sub = `נבדק ב-${fmtTime(check.at)}`; t.strip = "הבדיקה נכשלה";
    t.today = `חסום. ${check.text}`;
    t.fix = "רשימת הכספים שלך: משפט הפריסה של lalum-fin-issue, ואז הדבקת המפתח. אחר כך בדיקת חיבור נוספת כאן.";
  } else if (unauthorized) {
    t.status = "bad"; t.value = "המפתח נדחה"; t.sub = `מאז ${fmtDay(d.fin.importLastAt)}`; t.strip = "המפתח נדחה";
    t.today = `חסום. Invoice4U דוחה את המפתח שבשרת (UnauthorizedUser) מאז ${fmtDay(d.fin.importLastAt)}: הפקה, ייבוא ו-PDF מהארכיון נכשלים. הקריאה התקינה האחרונה: ${fmtDay(d.fin.importOkAt) || "אין"}.`;
    t.fix = "רשימת הכספים שלך: משפט הפריסה של lalum-fin-issue, ואז הדבקת המפתח. אחר כך לחיצה על בדיקת חיבור כאן.";
  } else {
    t.status = "watch"; t.value = "לא נבדק"; t.sub = "ירוק רק אחרי בדיקת חיבור"; t.strip = "לא נבדק";
    t.today = "לתשומת לב. הייבוא האחרון לא נדחה, אבל רק בדיקת חיבור אומרת שהמפתח מתקבל עכשיו.";
    t.fix = "לחיצה על בדיקת חיבור באריח. הבדיקה זמינה בשרת אחרי הפריסה של lalum-fin-issue מ-PR 1258.";
  }
  return t;
}

function secTile(d: SnapData, hist: HistoryPoint[]): Tile {
  const t = base("sec", "ops", false, "אבטחה", "SEC", "תמונת המצב: הרשאות הפונקציות, הגורמים השניים ומשתמשים בלי פירמה", "כל 15 דקות", { to: "/settings/security", label: "אבטחה" });
  const s = d.sec, series = daily(hist, (p) => p.takenAt, (p) => p.definer);
  const rose = series.length >= 2 && series[series.length - 1] > series[series.length - 2];
  t.status = s.partnersNoTotp > 0 ? "bad" : s.usersNoFirm > 0 || rose ? "watch" : "ok";
  t.value = nf(s.definer); t.sub = "פונקציות DEFINER שמשתמש מחובר יכול להפעיל"; t.strip = `${nf(s.definer)} DEFINER, ${nf(s.usersNoFirm)} בלי פירמה`;
  const parts = [`${nf(s.definer)} פונקציות${rose ? `, יותר מאתמול (${nf(series[series.length - 2])})` : ""}.`, `${nf(s.totp)} גורמי TOTP מאומתים.`];
  if (s.partnersNoTotp) parts.push(`${nf(s.partnersNoTotp)} שותפים או מנהלים בלי גורם שני מאומת.`);
  parts.push(`${nf(s.usersNoFirm)} מתוך ${nf(s.users)} משתמשים בלי חברות בפירמה${s.usersNoFirm ? ", כדאי לוודא שההרשמה לאתר סגורה" : ""}.`);
  t.today = `${STATUS_LABEL[t.status]}. ${parts.join(" ")}`;
  t.fix = s.partnersNoTotp ? "רישום גורם שני לכל שותף ומנהל, במסך האבטחה." : t.status === "ok" ? "אין פעולה." : "יום האבטחה. האריח רק קורא ולא משנה דבר.";
  t.spark = spark(series);
  return t;
}

function matTile(d: SnapData, hist: HistoryPoint[]): Tile {
  const t = base("mat", "mat", true, "תיקים ומועדים", "MATTERS", "התיקים החיים (בלי סל המיחזור), המועדים, תנאי שכ״ט, השעות והפניות, מהטבלאות שלהם", "כל 15 דקות", { to: "/workspace", label: "תיקים" });
  const m = d.matters;
  t.status = m.overdue > 0 ? "bad" : m.live > 0 && m.deadlines === 0 ? "watch" : "ok";
  t.value = nf(m.live); t.sub = `תיקים חיים, ${nf(m.high)} בסיכון גבוה`; t.strip = `${nf(m.live)} חיים, ${nf(m.deadlines14)} מועדים ב-14 יום`;
  const lead = m.overdue > 0 ? `${nf(m.overdue)} מועדים עברו ולא סומנו כבוצעו.` : m.live > 0 && m.deadlines === 0 ? "אין אף מועד שמור במערכת, אז אין ממה להתריע." : `${nf(m.deadlines14)} מועדים ב-14 הימים הקרובים.`;
  t.today = `${STATUS_LABEL[t.status]}. ${lead} ${nf(m.high)} מתוך ${nf(m.live)} התיקים בסיכון גבוה, ${nf(m.notAssessed)} לא נבדקו. בסל המיחזור ${nf(m.binned)}, והם לא נספרים.`;
  t.fix = m.overdue > 0 ? "לסמן את המועדים שבוצעו, או לטפל בהם." : t.status === "watch" ? "יום התיקים: 4.4 שמירת מועדים ו-4.5 תנאי שכ״ט. כשיהיו מועדים, האריח סופר את 14 הימים הקרובים." : "אין פעולה.";
  t.counts = {
    items: [[nf(m.deadlines14), "מועדים ב-14 יום"], [nf(m.deadlines), "מועדים שמורים"], [nf(m.feeTerms), "תנאי שכ״ט"], [nf(m.timeEntries), "רישומי שעות"], [nf(m.inquiries), "פניות, מאז ומעולם"]],
    risk: [
      { label: "סיכון גבוה", value: m.high, tone: "bad" }, { label: "זהירות", value: m.caution, tone: "watch" },
      { label: "לא נבדק", value: m.notAssessed, tone: "none" }, { label: "תקין", value: Math.max(0, m.live - m.high - m.caution - m.notAssessed), tone: "ok" },
    ].filter((x) => x.value > 0) as Counts["risk"],
  };
  t.spark = spark(daily(hist, (p) => p.takenAt, (p) => p.live));
  return t;
}

function syncState(runs: Array<{ status: string | null; lastAt: string | null } | undefined>, now: Date): "bad" | "stale" | "ok" | "none" {
  const seen = runs.filter((r): r is { status: string | null; lastAt: string | null } => !!r && !!r.lastAt);
  if (!seen.length) return "none";
  if (seen.some((r) => r.status !== "ok")) return "bad";
  if (seen.some((r) => (hoursSince(r.lastAt, now) ?? 99) > DAILY_STALE_HOURS)) return "stale";
  return "ok";
}

function webTile(d: SnapData, web: WebDay[] | undefined, now: Date): Tile {
  const t = base("web", "web", true, "תנועה באתר ו-Google", "WEB · GSC", "Search Console (שורת הסיכום היומית בלבד) דרך סנכרון הקמפיינים", "פעמיים ביום. Google מאחר ב-2 עד 3 ימים", { to: "/workspace/campaigns", label: "קמפיינים" });
  const sync = syncState([d.campaign.gsc], now), lag = daysSince(d.web.gscLastDay, now);
  t.status = sync === "none" ? "none" : sync === "bad" ? "bad" : sync === "stale" || lag === null || lag > GSC_STALE_DAYS ? "stale" : "ok";
  const days = (web ?? []).filter((x) => x.impressions > 0 || x.clicks > 0).sort((a, b) => a.day.localeCompare(b.day)).slice(-28);
  const sum = (xs: WebDay[], k: "impressions" | "clicks") => xs.reduce((s, x) => s + x[k], 0);
  const last7 = days.slice(-7), prev7 = days.slice(-14, -7), ch = pct(sum(last7, "impressions"), sum(prev7, "impressions"));
  if (days.length) {
    t.value = nf(sum(last7, "impressions"));
    t.sub = `הופעות ב-Google בשבוע עד ${fmtDay(days[days.length - 1].day)}, ${nf(sum(last7, "clicks"))} קליקים${ch === null ? "" : `. ${ch >= 0 ? "עלייה" : "ירידה"} של ${Math.abs(ch)}% מהשבוע שלפניו`}`;
    t.strip = `${nf(sum(last7, "impressions"))} הופעות בשבוע, ${nf(sum(last7, "clicks"))} קליקים`;
    t.chart = { kind: "volume", labels: days.map((x) => fmtDay(x.day)), a: days.map((x) => x.impressions), aName: "הופעות", b: days.map((x) => x.clicks), bName: "קליקים" };
    t.spark = spark(days.map((x) => x.impressions));
  } else {
    t.value = fmtDay(d.web.gscLastDay) || "אין נתונים"; t.sub = "היום האחרון שיש בו נתון"; t.strip = d.web.gscLastDay ? `נתון אחרון ${fmtDay(d.web.gscLastDay)}` : "אין נתונים";
  }
  const lead = t.status === "bad" ? "הסנכרון האחרון של Search Console נכשל." : t.status === "stale" ? `היום האחרון עם נתון הוא ${fmtDay(d.web.gscLastDay) || "אין"}, יותר ממה ש-Google מאחר בדרך כלל.` : t.status === "none" ? "Search Console עוד לא סונכרן." : `היום האחרון עם נתון: ${fmtDay(d.web.gscLastDay)}.`;
  t.today = `${STATUS_LABEL[t.status]}. ${lead} ${days.length ? `${nf(sum(days, "clicks"))} קליקים ו-${nf(sum(days, "impressions"))} הופעות ב-${days.length} הימים האחרונים שיש בהם נתון. ` : ""}האריח קורא רק את שורת הסיכום היומית; שורות הפירוט לפי עמוד ושאילתה נשארות במסך הקמפיינים.`;
  t.fix = t.status === "ok" ? "יום התוכן, סעיף 32: קו הבסיס של עמוד ה-Legal AI ובדיקות ב-13.11 וב-27.11." : "לבדוק את הסנכרון במסך הקמפיינים (כפתור הרענון).";
  return t;
}

function campTile(d: SnapData, web: WebDay[] | undefined, now: Date): Tile {
  const t = base("camp", "web", false, "קמפיינים", "META", "Meta Graph דרך אפליקציית קריאה בלבד; LinkedIn נכנס ידנית", "08:30 ו-13:30", { to: "/workspace/campaigns", label: "קמפיינים" });
  const c = d.campaign, sync = syncState([c.facebook, c.instagram, c.meta_ads], now);
  t.status = sync;
  const last = [...(web ?? [])].sort((a, b) => a.day.localeCompare(b.day));
  const fb = [...last].reverse().find((x) => x.fbFollowers !== null)?.fbFollowers ?? null, ig = [...last].reverse().find((x) => x.igFollowers !== null)?.igFollowers ?? null;
  t.value = fb !== null && ig !== null ? `${nf(fb)} · ${nf(ig)}` : fb !== null ? nf(fb) : ig !== null ? nf(ig) : "";
  const who = fb !== null && ig !== null ? "עוקבים בפייסבוק ובאינסטגרם" : fb !== null ? "עוקבים בפייסבוק (לאינסטגרם עוד אין נתון)" : ig !== null ? "עוקבים באינסטגרם (לפייסבוק עוד אין נתון)" : "אין עדיין נתון עוקבים";
  t.sub = `${who}. ${d.web.paid90d > 0 ? `ממומן: ${money(d.web.paid90d)} ב-90 יום` : "אין קמפיין ממומן ב-90 יום"}`;
  t.strip = `${d.web.paid90d > 0 ? `${money(d.web.paid90d)} ממומן` : "₪0 ממומן"}${fb === null ? "" : `, ${nf(fb)} עוקבים`}`;
  const lastRun = [c.facebook, c.instagram, c.meta_ads].map((x) => x?.lastAt ?? "").sort().pop() || null;
  t.today = `${STATUS_LABEL[t.status]}. ${sync === "none" ? "עוד לא היה סנכרון." : sync === "bad" ? "אחד הסנכרונים של Meta נכשל בריצה האחרונה." : sync === "stale" ? "סנכרון של Meta לא רץ ביממה האחרונה." : `Facebook, Instagram וחשבון המודעות סונכרנו ב-${fmtTime(lastRun)}.`} ${d.web.paid90d > 0 ? "" : "אין קמפיין ממומן פעיל, ולכן אין הוצאה. "}חידוש הטוקן: 10.1.2027.`;
  t.fix = sync === "ok" ? "אין פעולה." : "לבדוק את הסנכרון במסך הקמפיינים.";
  t.spark = spark(last.filter((x) => x.fbFollowers !== null).map((x) => x.fbFollowers as number));
  return t;
}

function cronTile(d: SnapData, hist: HistoryPoint[]): Tile {
  const t = base("cron", "ops", false, "משימות מתוזמנות", "PG_CRON", "יומן הריצות של pg_cron ותשובות ה-HTTP של pg_net, בלי תוכן הפקודות", "כל 15 דקות", null);
  const jobs = d.cron, runs = jobs.reduce((s, j) => s + j.runs, 0), failed = jobs.reduce((s, j) => s + j.failed, 0);
  const lastBad = jobs.filter((j) => j.active && j.lastStatus !== null && j.lastStatus !== "succeeded" && !IN_FLIGHT.has(j.lastStatus));
  const inactive = jobs.filter((j) => !j.active);
  t.status = lastBad.length ? "bad" : failed > 0 || d.http.bad > 0 ? "watch" : "ok";
  t.value = `${nf(failed)} כשלים`; t.sub = `${nf(jobs.length)} משימות, ${nf(runs)} ריצות ב-24 שעות`; t.strip = `${nf(failed)} כשלים, ${nf(d.http.bad)} HTTP`;
  const parts = [`${nf(failed)} ריצות נכשלו ב-24 שעות (${nf(d.cronFailed7d)} ב-7 ימים).`, `${nf(d.http.bad)} מתוך ${nf(d.http.total)} קריאות HTTP לא החזירו 200${d.http.timedOut ? `, ${nf(d.http.timedOut)} מהן בגלל זמן` : ""}.`];
  if (lastBad.length) parts.unshift(`הריצה האחרונה נכשלה ב: ${lastBad.map((j) => j.job).join(", ")}.`);
  if (inactive.length) parts.push(`מושבתות: ${inactive.map((j) => j.job).join(", ")}.`);
  t.today = `${STATUS_LABEL[t.status]}. ${parts.join(" ")}`;
  t.fix = t.status === "ok" ? "אין פעולה." : "יומן הריצות ב-Supabase (Integrations, Cron), לפי שם המשימה.";
  t.spark = spark(daily(hist, (p) => p.takenAt, (p) => p.cronFailed7d));
  return t;
}

function calTile(d: SnapData, now: Date): Tile {
  const t = base("cal", "ops", false, "יומן Outlook", "GRAPH", "יומן הריצות של סנכרון Outlook (נקרא בתמונת המצב בלבד)", "כל יום ב-06:15", { to: "/workspace/scheduling", label: "יומן ופגישות" });
  const o = d.outlook, age = hoursSince(o.lastOkAt, now);
  if (!o.lastAt) { t.status = "none"; t.value = "לא רץ"; t.sub = "אין ריצה ב-30 יום"; t.strip = "לא רץ"; t.today = "לא מחובר. אין ריצה של הסנכרון ב-30 הימים האחרונים."; t.fix = "שלב 8.1 ביום התיקים."; return t; }
  if (o.status !== "ok") {
    t.status = "bad"; t.value = o.held ? `${nf(o.held)} הוחזקו` : "נכשל"; t.sub = `בריצה של ${fmtDay(o.lastAt)} ${fmtTime(o.lastAt)}`; t.strip = o.held ? "מגבלת המחיקות עצרה" : "הסנכרון נכשל";
    t.today = o.held ? `חסום. בריצה האחרונה ${nf(o.held)} שינויים הוחזקו, כי עברו את מגבלת 10 המחיקות. היומן במערכת לא עודכן, ובדיקת ההתנגשות בפגישות עלולה לאשר שעה תפוסה.` : "חסום. הריצה האחרונה של הסנכרון נכשלה. בדיקת ההתנגשות בפגישות עלולה לאשר שעה תפוסה.";
    t.fix = "לבדוק ב-Outlook מה נמחק, ואז ריצה ידנית של הסנכרון."; return t;
  }
  t.status = age !== null && age > DAILY_STALE_HOURS ? "stale" : "ok";
  t.value = o.fetched === null ? "" : nf(o.fetched); t.sub = `אירועים סונכרנו ב-${fmtDay(o.lastOkAt)} ${fmtTime(o.lastOkAt)}`; t.strip = `${o.fetched === null ? "" : `${nf(o.fetched)} אירועים, `}${fmtTime(o.lastOkAt)}`;
  t.today = t.status === "stale" ? `מיושן. הריצה התקינה האחרונה הייתה ב-${fmtDay(o.lastOkAt)}, לפני יותר מיממה.` : `תקין. ${o.fetched === null ? "" : `${nf(o.fetched)} אירועים, `}אף שינוי לא הוחזק. אם שינויים יוחזקו (מעל 10 מחיקות), האריח ייצבע אדום.`;
  t.fix = t.status === "ok" ? "אין פעולה." : "לבדוק את משימת lalum-outlook-sync באריח המשימות המתוזמנות.";
  return t;
}

function bakTile(d: SnapData): Tile {
  const t = base("bak", "ops", false, "גיבויים ותשתית", "BACKUP", "הגיבוי השבועי רץ במחשב שלך ולא מדווח למערכת. Supabase מגבה את המסד כל יום", "שבועי, ראשון 10:00", null);
  t.status = "none"; t.value = "לא מדווח"; t.sub = `המסד: ${Math.round(d.dbBytes / 1e6)}MB`; t.strip = "גיבוי חיצוני לא מדווח";
  t.today = `לא מחובר. Supabase מגבה את המסד כל יום, 7 ימים לאחור. המסד שוקל ${Math.round(d.dbBytes / 1e6)}MB. הגיבוי החיצוני השבועי לא מדווח לכאן, ולכן האריח לא יודע מתי רץ לאחרונה ואם הצליח.`;
  t.fix = "9.ו ביום התיקים: הסקריפט שולח דיווח קצר בסוף כל ריצה, לפני הגיבוי של ראשון 1.11.";
  return t;
}

/** Every tile, in the wall's order. Without a snapshot every tile says so and nothing is green. */
export function buildTiles(i: Inputs): Tile[] {
  if (!i.snapshot) return WALL_ORDER.map((id) => emptyTile(id));
  const d = i.snapshot.data, hist = i.history ?? [], now = i.now;
  const tiles = [
    pnlTile(d, i.finance, now), arTile(d, now), cashTile(d, now), issueTile(d, i.issueCheck), secTile(d, hist),
    matTile(d, hist), webTile(d, i.web, now), campTile(d, i.web, now), cronTile(d, hist), calTile(d, now), bakTile(d),
  ];
  const ageMin = (now.getTime() - Date.parse(i.snapshot.takenAt)) / 60000;
  if (ageMin > SNAPSHOT_STALE_MIN) {
    const note = ` תמונת המצב האחרונה מ-${fmtDay(i.snapshot.takenAt)} ${fmtTime(i.snapshot.takenAt)}, לפני ${Math.round(ageMin)} דקות, ולכן שום דבר כאן לא מוצג כתקין.`;
    for (const t of tiles) {
      if (t.id === "issue" && i.issueCheck) continue;
      if (t.status === "ok" || t.status === "watch") t.status = "stale";
      t.today += note;
    }
  }
  return tiles;
}

const NAMES: Record<TileId, [Domain, boolean, string, string]> = {
  pnl: ["fin", true, "הכנסות מול הוצאות", "FIN · P&L"], ar: ["fin", false, "גבייה פתוחה", "FIN · AR"], cash: ["fin", false, "מזומן בבנק", "FIN · BANK"],
  issue: ["fin", false, "מערכת ההנפקה", "INVOICE4U"], sec: ["ops", false, "אבטחה", "SEC"], mat: ["mat", true, "תיקים ומועדים", "MATTERS"],
  web: ["web", true, "תנועה באתר ו-Google", "WEB · GSC"], camp: ["web", false, "קמפיינים", "META"], cron: ["ops", false, "משימות מתוזמנות", "PG_CRON"],
  cal: ["ops", false, "יומן Outlook", "GRAPH"], bak: ["ops", false, "גיבויים ותשתית", "BACKUP"],
};
function emptyTile(id: TileId): Tile {
  const [domain, big, name, code] = NAMES[id];
  const t = base(id, domain, big, name, code, "תמונת המצב שנאספת כל 15 דקות", "כל 15 דקות", null);
  t.value = "אין נתונים"; t.strip = "אין נתונים";
  t.today = "לא מחובר. תמונת המצב עוד לא נאספה, או שאין הרשאה לקרוא אותה (מנהל המערכת עם אימות דו-שלבי בלבד).";
  t.fix = "שלב 9.ב ביום התיקים: הדבקת המיגרציה. תמונת המצב הראשונה נאספת מיד.";
  return t;
}

export interface Summary { ok: number; watch: number; bad: number; none: number }
/** Stale counts with attention: both mean "do not rely on this yet". */
export function summarize(tiles: Tile[]): Summary {
  const s: Summary = { ok: 0, watch: 0, bad: 0, none: 0 };
  for (const t of tiles) s[t.status === "stale" ? "watch" : t.status]++;
  return s;
}
/** Problems first, then the wall's order. */
export const stripOrder = (tiles: Tile[]): Tile[] =>
  [...tiles].sort((a, b) => RANK[a.status] - RANK[b.status] || WALL_ORDER.indexOf(a.id) - WALL_ORDER.indexOf(b.id));
