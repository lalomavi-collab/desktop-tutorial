// Parses lalum_hours_index() and derives the ratios the hours screen shows. The database counts; this file only
// divides. A ratio with no denominator is null and is shown as "no data", never as 0 percent. Presence is never spread over
// matters: attendance, logged and billable stay three separate numbers. Pure: covered by crm-check.

const n = (v: unknown): number => (v == null || v === "" ? 0 : Number(v));
const obj = (v: unknown): Record<string, unknown> | null => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null);
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const rows = (v: unknown): Record<string, unknown>[] => arr(v).map(obj).filter((x): x is Record<string, unknown> => !!x);

export interface PersonHours {
  name: string; role: string;
  attendance: number; attendanceDays: number; openSessions: number;
  logged: number; billable: number; billed: number; draft: number; writtenOff: number;
  value: number; entriesWithoutRate: number;
  /** Days on which logged time is more than the time present. */
  daysOver: number;
  /** Days with logged time and no attendance at all. */
  daysNoAttendance: number;
}
export interface MatterHours { matterId: string; matterCode: string | null; title: string | null; feeModel: string | null; people: number; logged: number; billable: number; billed: number; writtenOff: number; value: number }
export interface SplitRow { matterId: string; name: string; logged: number; billable: number }
export interface HoursIndex { from: string; to: string; people: PersonHours[]; matters: MatterHours[]; split: SplitRow[] }

/** lalum_hours_index(from, to) */
export function parseHoursIndex(j: unknown): HoursIndex | null {
  const o = obj(j);
  if (!o) return null;
  return {
    from: String(o.from ?? ""), to: String(o.to ?? ""),
    people: rows(o.people).map((x) => ({
      name: String(x.name ?? ""), role: String(x.role ?? ""),
      attendance: n(x.attendance_minutes), attendanceDays: n(x.attendance_days), openSessions: n(x.open_sessions),
      logged: n(x.logged_minutes), billable: n(x.billable_minutes), billed: n(x.billed_minutes), draft: n(x.draft_minutes), writtenOff: n(x.written_off_minutes),
      value: n(x.value), entriesWithoutRate: n(x.entries_without_rate), daysOver: n(x.days_over), daysNoAttendance: n(x.days_no_attendance),
    })),
    matters: rows(o.matters).map((x) => ({
      matterId: String(x.matter_id), matterCode: x.matter_code == null ? null : String(x.matter_code), title: x.title == null ? null : String(x.title),
      feeModel: x.fee_model == null ? null : String(x.fee_model), people: n(x.people), logged: n(x.logged_minutes), billable: n(x.billable_minutes),
      billed: n(x.billed_minutes), writtenOff: n(x.written_off_minutes), value: n(x.value),
    })),
    split: rows(o.split).map((x) => ({ matterId: String(x.matter_id), name: String(x.name ?? ""), logged: n(x.logged_minutes), billable: n(x.billable_minutes) })),
  };
}

const ratio = (num: number, den: number): number | null => (den > 0 ? num / den : null);

export interface Ratios {
  /** Minutes present that no entry accounts for. Never negative: logged above presence is a flag, not a negative gap. */
  unallocated: number;
  /** logged / attendance: how much of the time present was put on a matter. */
  utilization: number | null;
  /** billable / logged: how much of the time put on matters is billable. */
  billableShare: number | null;
  /** billable / attendance: billable hours out of the whole presence. */
  billableOfAttendance: number | null;
}
export function ratios(p: Pick<PersonHours, "attendance" | "logged" | "billable">): Ratios {
  return {
    unallocated: Math.max(0, p.attendance - p.logged),
    utilization: ratio(p.logged, p.attendance),
    billableShare: ratio(p.billable, p.logged),
    billableOfAttendance: ratio(p.billable, p.attendance),
  };
}

export type Totals = Pick<PersonHours, "attendance" | "logged" | "billable" | "billed" | "draft" | "writtenOff" | "value" | "entriesWithoutRate" | "daysOver" | "daysNoAttendance" | "openSessions">;
export function totals(people: PersonHours[]): Totals {
  const t: Totals = { attendance: 0, logged: 0, billable: 0, billed: 0, draft: 0, writtenOff: 0, value: 0, entriesWithoutRate: 0, daysOver: 0, daysNoAttendance: 0, openSessions: 0 };
  for (const p of people) {
    t.attendance += p.attendance; t.logged += p.logged; t.billable += p.billable; t.billed += p.billed; t.draft += p.draft; t.writtenOff += p.writtenOff;
    t.value += p.value; t.entriesWithoutRate += p.entriesWithoutRate; t.daysOver += p.daysOver; t.daysNoAttendance += p.daysNoAttendance; t.openSessions += p.openSessions;
  }
  t.value = Math.round(t.value * 100) / 100;
  return t;
}

/** Why a row needs the partner's eye. Empty means nothing to flag. */
export function flags(p: PersonHours): string[] {
  const f: string[] = [];
  if (p.openSessions > 0) f.push(`החתמה פתוחה (${p.openSessions})`);
  if (p.daysOver > 0) f.push(`${p.daysOver} ימים עם רישום מעל הנוכחות`);
  if (p.daysNoAttendance > 0) f.push(`${p.daysNoAttendance} ימי רישום בלי נוכחות`);
  if (p.draft > 0) f.push(`${fmtHM(p.draft)} שעות בטיוטה`);
  if (p.entriesWithoutRate > 0) f.push(`${p.entriesWithoutRate} רישומים בלי תעריף`);
  return f;
}

/** Minutes as H:MM. */
export function fmtHM(minutes: number): string {
  const m = Math.max(0, Math.round(minutes));
  return `${Math.floor(m / 60)}:${String(m % 60).padStart(2, "0")}`;
}
export const fmtPct = (r: number | null): string => (r == null ? "אין נתון" : `${Math.round(r * 100)}%`);

const pad = (x: number): string => String(x).padStart(2, "0");
export const isoDay = (d: Date): string => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
/** First and last day of the month `offset` months from `now` (0 this month, -1 the previous one). */
export function monthRange(now: Date, offset = 0): { from: string; to: string } {
  const first = new Date(now.getFullYear(), now.getMonth() + offset, 1);
  const last = new Date(first.getFullYear(), first.getMonth() + 1, 0);
  return { from: isoDay(first), to: isoDay(last) };
}

/** Billable minutes for a worked block, in the 6 minute units the entry table bills in: nearest unit, floor of 6, never above the worked time. Same rule as lalum_timer_stop. */
export function billableFor(worked: number): number {
  const w = Math.max(1, Math.min(1440, Math.floor(worked)));
  const nearest = Math.max(6, Math.round(w / 6) * 6);
  return Math.min(nearest, w - (w % 6));
}

const CLOCK_ERRORS: Record<string, string> = {
  ALREADY_CLOCKED_IN: "כבר יש החתמת כניסה פתוחה. אם היא ישנה, שותף יכול לתקן אותה.",
  NOT_CLOCKED_IN: "אין החתמת כניסה פתוחה.",
  SESSION_TOO_LONG_NEEDS_CORRECTION: "ההחתמה פתוחה מעל 24 שעות. שותף צריך לתקן אותה לפני שאפשר להמשיך.",
  FORBIDDEN: "אין הרשאה לפעולה, או שנדרש אימות דו שלבי.",
  REASON_REQUIRED: "יש לציין סיבה של 10 תווים לפחות.",
  OVERLAP: "ההחתמה חופפת החתמה אחרת של אותו אדם.",
  BAD_TIMES: "שעת היציאה חייבת להיות אחרי שעת הכניסה.",
  SESSION_TOO_LONG: "החתמה אחת לא יכולה לעבור 24 שעות.",
  FUTURE_TIME: "אי אפשר להחתים זמן עתידי.",
  NOT_A_MEMBER: "האדם אינו חבר בפירמה.",
  TIMER_ALREADY_RUNNING: "טיימר כבר רץ. עצרו אותו קודם.",
  NO_RUNNING_TIMER: "אין טיימר רץ.",
  BACKDATE_NEEDS_PARTNER: "רישום מעבר ל-7 ימים אחורה דורש שותף.",
};
/** A readable Hebrew line for a database error, falling back to a neutral sentence rather than the raw text. */
export function clockError(message: unknown): string {
  const raw = message && typeof message === "object" && "message" in message ? (message as { message: unknown }).message : message;
  const m = String(raw ?? "");
  for (const k of Object.keys(CLOCK_ERRORS)) if (m.includes(k)) return CLOCK_ERRORS[k];
  return "הפעולה נכשלה.";
}

export const HOURS_DEMO_NOTE = "נתוני הדגמה בדויים. כל השמות, הדקות והסכומים כאן מומצאים ואינם נתוני הפירמה. שום דבר לא נשמר במסד הנתונים.";

/**
 * SYNTHETIC data for the partner report preview. Every name, code, minute and rate is invented. Nothing here touches the database.
 * People and matters are built from one matrix of minutes, so the matter totals and the per person totals agree by construction,
 * which is what the real report guarantees.
 */
export function buildHoursDemo(today: Date): HoursIndex {
  const { from, to } = monthRange(today);
  const matters = [
    { id: "d1", code: "דמו-101", title: "תיק לדוגמה 1", fee: "hourly" },
    { id: "d2", code: "דמו-102", title: "תיק לדוגמה 2", fee: "capped" },
    { id: "d3", code: "דמו-103", title: "תיק לדוגמה 3", fee: "fixed" },
    { id: "d4", code: "דמו-104", title: "תיק לדוגמה 4", fee: "retainer" },
    { id: "d5", code: "דמו-105", title: "תיק לדוגמה 5", fee: "hourly" },
  ];
  // logged and billable minutes per matter (same order as `matters`), billable always in 6 minute units and under logged.
  const staff = [
    { name: "עורך דין לדוגמה א", role: "ATTORNEY", rate: 600, attendance: 9600, days: 20, logged: [3000, 2400, 1200, 600, 600], billable: [2880, 2280, 1020, 480, 540], draft: 300, off: 0, open: 0, over: 0, none: 0, noRate: 0 },
    { name: "עורך דין לדוגמה ב", role: "ATTORNEY", rate: 450, attendance: 9000, days: 19, logged: [1800, 1200, 1200, 600, 600], billable: [1680, 1080, 960, 540, 540], draft: 0, off: 120, open: 0, over: 2, none: 1, noRate: 0 },
    { name: "עורכת דין לדוגמה ג", role: "ATTORNEY", rate: 350, attendance: 9900, days: 21, logged: [3000, 2400, 1800, 900, 600], billable: [2100, 1800, 1200, 600, 300], draft: 600, off: 0, open: 1, over: 0, none: 0, noRate: 3 },
    { name: "שותף לדוגמה", role: "FIRM_PARTNER", rate: 900, attendance: 7200, days: 15, logged: [600, 600, 600, 600, 600], billable: [600, 480, 480, 420, 420], draft: 0, off: 0, open: 0, over: 0, none: 0, noRate: 0 },
  ];
  const priced = (fee: string): boolean => fee === "hourly" || fee === "capped" || fee === "hybrid";
  const sum = (a: number[]): number => a.reduce((x, y) => x + y, 0);
  const billedOf = (b: number): number => Math.floor((b * 0.6) / 6) * 6;
  const value = (rate: number, minutes: number): number => Math.round((minutes / 60) * rate * 100) / 100;

  const people: PersonHours[] = staff.map((s) => ({
    name: s.name, role: s.role, attendance: s.attendance, attendanceDays: s.days, openSessions: s.open,
    logged: sum(s.logged), billable: sum(s.billable), billed: sum(s.billable.map(billedOf)), draft: s.draft, writtenOff: s.off,
    value: Math.round(sum(s.billable.map((b, i) => (priced(matters[i].fee) ? value(s.rate, b) : 0))) * 100) / 100,
    entriesWithoutRate: s.noRate, daysOver: s.over, daysNoAttendance: s.none,
  }));
  const matterRows: MatterHours[] = matters.map((m, i) => ({
    matterId: m.id, matterCode: m.code, title: m.title, feeModel: m.fee, people: staff.length,
    logged: sum(staff.map((s) => s.logged[i])), billable: sum(staff.map((s) => s.billable[i])), billed: sum(staff.map((s) => billedOf(s.billable[i]))),
    writtenOff: 0, value: priced(m.fee) ? Math.round(sum(staff.map((s) => value(s.rate, s.billable[i]))) * 100) / 100 : 0,
  }));
  const split: SplitRow[] = matters.flatMap((m, i) => staff.map((s) => ({ matterId: m.id, name: s.name, logged: s.logged[i], billable: s.billable[i] })));
  return { from, to, people, matters: matterRows, split };
}
