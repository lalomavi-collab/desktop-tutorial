// The tasks board (owner, 31.10.2026, from the competitor scan): counters that say what needs doing now (overdue, today,
// this week, no due date, done this week), each one a filter, and the open tasks in four columns by when they are due.
// Pure: no data access here, so scripts/task-board-check.mjs tests every rule. Days are Israel days.

export interface BoardTask { id: string; matter_id: string; title: string; due_at: string | null; assignee: string; status: string; created_at: string; closed_at: string | null }

export type Bucket = "overdue" | "today" | "week" | "later" | "nodue" | "closed";
export type Column = "overdue" | "today" | "week" | "later";
export const COLUMNS: Column[] = ["overdue", "today", "week", "later"];
export const COLUMN_LABEL: Record<Column, string> = { overdue: "באיחור", today: "היום", week: "בשבוע הקרוב", later: "בהמשך וללא מועד" };

export type Show = "open" | "overdue" | "today" | "week" | "nodue" | "doneWeek" | "closed";
export const SHOW_LABEL: Record<Show, string> = { open: "כל הפתוחות", overdue: "באיחור", today: "היום", week: "השבוע", nodue: "ללא מועד", doneWeek: "הושלמו השבוע", closed: "כל הסגורות" };
/** The counters on top of the board, in reading order. */
export const COUNTERS: Show[] = ["overdue", "today", "week", "nodue", "doneWeek"];

export type Who = "all" | "me" | string;

const IL = "Asia/Jerusalem";
export function ilDay(iso: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: IL, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(iso));
}
function dayDiff(a: string, b: string): number {
  return Math.round((Date.UTC(+b.slice(0, 4), +b.slice(5, 7) - 1, +b.slice(8, 10)) - Date.UTC(+a.slice(0, 4), +a.slice(5, 7) - 1, +a.slice(8, 10))) / 86400000);
}
function addDays(day: string, n: number): string {
  const d = new Date(Date.UTC(+day.slice(0, 4), +day.slice(5, 7) - 1, +day.slice(8, 10) + n));
  return d.toISOString().slice(0, 10);
}
/** The Sunday that opens the Israel week holding `now`, as YYYY-MM-DD. */
export function weekStart(now: Date): string {
  const today = ilDay(now.toISOString());
  const wd = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(new Intl.DateTimeFormat("en-US", { timeZone: IL, weekday: "short" }).format(now));
  return addDays(today, -Math.max(0, wd));
}

export function bucketOf(t: BoardTask, now: Date): Bucket {
  if (t.status !== "OPEN") return "closed";
  if (!t.due_at) return "nodue";
  if (new Date(t.due_at).getTime() < now.getTime()) return "overdue";
  const d = dayDiff(ilDay(now.toISOString()), ilDay(t.due_at));
  return d <= 0 ? "today" : d <= 7 ? "week" : "later";
}
export const columnOf = (b: Bucket): Column | null => (b === "closed" ? null : b === "nodue" ? "later" : b);

export function doneThisWeek(t: BoardTask, now: Date): boolean {
  return t.status === "DONE" && !!t.closed_at && ilDay(t.closed_at) >= weekStart(now) && new Date(t.closed_at).getTime() <= now.getTime();
}

function whoOk(t: BoardTask, who: Who, me: string | null): boolean {
  return who === "all" ? true : who === "me" ? !!me && t.assignee === me : t.assignee === who;
}

export function showOk(t: BoardTask, show: Show, now: Date): boolean {
  const b = bucketOf(t, now);
  switch (show) {
    case "open": return b !== "closed";
    case "closed": return b === "closed";
    case "doneWeek": return doneThisWeek(t, now);
    default: return b === show;
  }
}

export type Counts = Record<Show, number>;
export function counts(tasks: BoardTask[], who: Who, me: string | null, now: Date): Counts {
  const c: Counts = { open: 0, overdue: 0, today: 0, week: 0, nodue: 0, doneWeek: 0, closed: 0 };
  for (const t of tasks) {
    if (!whoOk(t, who, me)) continue;
    for (const s of Object.keys(c) as Show[]) if (showOk(t, s, now)) c[s]++;
  }
  return c;
}

const dueCmp = (a: BoardTask, b: BoardTask) => {
  if (!a.due_at || !b.due_at) return a.due_at ? -1 : b.due_at ? 1 : a.created_at < b.created_at ? -1 : 1;
  return a.due_at < b.due_at ? -1 : a.due_at > b.due_at ? 1 : 0;
};

/** The tasks to list: open ones by due date (no date last), closed ones by when they closed, newest first. */
export function select(tasks: BoardTask[], show: Show, who: Who, me: string | null, now: Date): BoardTask[] {
  const out = tasks.filter((t) => whoOk(t, who, me) && showOk(t, show, now));
  return show === "closed" || show === "doneWeek"
    ? out.sort((a, b) => ((a.closed_at ?? "") > (b.closed_at ?? "") ? -1 : (a.closed_at ?? "") < (b.closed_at ?? "") ? 1 : 0))
    : out.sort(dueCmp);
}

/** The open tasks in the four columns, each column by due date. */
export function board(tasks: BoardTask[], who: Who, me: string | null, now: Date): Record<Column, BoardTask[]> {
  const out: Record<Column, BoardTask[]> = { overdue: [], today: [], week: [], later: [] };
  for (const t of select(tasks, "open", who, me, now)) { const c = columnOf(bucketOf(t, now)); if (c) out[c].push(t); }
  return out;
}

/** "היום 14:00", "מחר 09:30", "ג׳ 5.11", "באיחור של 3 ימים": a due time in a few words. */
export function dueWords(iso: string | null, now: Date): string {
  if (!iso) return "ללא מועד";
  const t = new Date(iso);
  const time = new Intl.DateTimeFormat("he-IL", { timeZone: IL, hour: "2-digit", minute: "2-digit", hour12: false }).format(t);
  const d = dayDiff(ilDay(now.toISOString()), ilDay(iso));
  if (t.getTime() < now.getTime()) {
    if (d === 0) return `היום ${time}, באיחור`;
    return d === -1 ? "אתמול, באיחור" : `באיחור של ${-d} ימים`;
  }
  if (d === 0) return `היום ${time}`;
  if (d === 1) return `מחר ${time}`;
  const day = ilDay(iso);
  const wd = ["א׳", "ב׳", "ג׳", "ד׳", "ה׳", "ו׳", "ש׳"][["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(new Intl.DateTimeFormat("en-US", { timeZone: IL, weekday: "short" }).format(t))];
  const short = `${+day.slice(8, 10)}.${+day.slice(5, 7)}`;
  return d <= 7 ? `${wd} ${short}` : day.slice(0, 4) === ilDay(now.toISOString()).slice(0, 4) ? short : `${short}.${day.slice(0, 4)}`;
}

export type BoardView = "board" | "list";
export const parseBoardView = (raw: string | null | undefined): BoardView => (raw === "list" ? "list" : "board");
