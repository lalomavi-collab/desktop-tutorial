// The matters list as a table you work with (owner, 31.10.2026, from the competitor scan, after Clio's matters list):
// a search, a sort by six keys, filters by status, practice, "mine" and "needs attention", and a list or a cards view.
// Pure: no data access here, so scripts/matter-table-check.mjs tests every rule.
//
// Client names: the search goes through the caller's `match`, which matches a hidden matter on its code only, and the
// name sort goes through the caller's `label`, which is the code while names are hidden. So neither the order nor a hit
// can tell anything about a hidden name. The search text is never stored (not in the address, not in browser storage).

export interface TableMatter { matter_id: string; matter_code: string | null; title: string; practice_area: string; matter_status: string; conflict_status: string; risk_level: string | null; partner_response: string; dispatched_at: string; sla_breached: boolean }

export type DueKind = "HEARING" | "FILING" | "INTERNAL" | "TASK";
export const DUE_KIND: Record<DueKind, string> = { HEARING: "דיון", FILING: "הגשה", INTERNAL: "מועד פנימי", TASK: "משימה" };

/** What the list adds to a matter beyond the matters view. Every field may be missing: the row still renders. */
export interface MatterExtra {
  /** The latest of the matter's own update and its latest document, as an ISO time. */
  updated_at: string | null;
  owner_id: string | null;
  /** The responsible member's display name: the first member placed on the matter, else its creator. */
  owner: string | null;
  team: string[];
  /** The nearest open deadline or open task due date, as YYYY-MM-DD in Israel time, an overdue one included. */
  next_due: string | null;
  next_kind: DueKind | null;
}

export type SortKey = "updated" | "opened" | "name" | "number" | "owner" | "due";
export type SortDir = "asc" | "desc";
export const SORT_KEYS: SortKey[] = ["updated", "opened", "name", "number", "owner", "due"];
export const SORT_LABEL: Record<SortKey, string> = { updated: "עודכן לאחרונה", opened: "נפתח לאחרונה", name: "שם התיק", number: "מספר תיק", owner: "אחראי", due: "המועד הקרוב" };
const DEFAULT_DIR: Record<SortKey, SortDir> = { updated: "desc", opened: "desc", name: "asc", number: "asc", owner: "asc", due: "asc" };

export type StatusFilter = "open" | "all" | "INTAKE_PENDING" | "ACTIVE_REVIEW" | "APPROVED_BY_PARTNER" | "ARCHIVED";
export const STATUS_FILTERS: StatusFilter[] = ["open", "all", "INTAKE_PENDING", "ACTIVE_REVIEW", "APPROVED_BY_PARTNER", "ARCHIVED"];

export interface TableQuery { q: string; sort: SortKey; dir: SortDir; status: StatusFilter; practice: string; mine: boolean; attention: boolean }
export const DEFAULT_QUERY: TableQuery = { q: "", sort: "updated", dir: "desc", status: "open", practice: "all", mine: false, attention: false };

export interface TableCtx {
  me: string | null;
  label: (m: TableMatter) => string;
  match: (m: TableMatter, q: string) => boolean;
  extras: Map<string, MatterExtra>;
  /** Today in Israel, YYYY-MM-DD. */
  today: string;
}

export type ViewMode = "list" | "cards";

const IL = "Asia/Jerusalem";
/** An ISO time as its calendar day in Israel, YYYY-MM-DD. */
export function ilDay(iso: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: IL, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(iso));
}
export const ilToday = (now = new Date()): string => ilDay(now.toISOString());

/** The day difference b minus a for two YYYY-MM-DD days. */
function dayDiff(a: string, b: string): number {
  return Math.round((Date.UTC(+b.slice(0, 4), +b.slice(5, 7) - 1, +b.slice(8, 10)) - Date.UTC(+a.slice(0, 4), +a.slice(5, 7) - 1, +a.slice(8, 10))) / 86400000);
}

export type DueState = "overdue" | "today" | "week" | "later";
export function dueState(due: string | null | undefined, today: string): DueState | null {
  if (!due) return null;
  const d = dayDiff(today, due);
  return d < 0 ? "overdue" : d === 0 ? "today" : d <= 7 ? "week" : "later";
}

export function lastActivity(m: TableMatter, e: MatterExtra | undefined): string {
  const u = e?.updated_at;
  return u && u > m.dispatched_at ? u : m.dispatched_at;
}

export function isMine(e: MatterExtra | undefined, me: string | null): boolean {
  return !!me && !!e && (e.owner_id === me || e.team.includes(me));
}

/** A matter that asks for someone now: an unread intake past its two hours, a conflict to check, a high risk, or a date already missed. */
export function needsAttention(m: TableMatter, e: MatterExtra | undefined, today: string): boolean {
  return m.sla_breached || m.conflict_status !== "CLEAN" || m.risk_level === "HIGH_RISK" || dueState(e?.next_due, today) === "overdue";
}

function statusOk(m: TableMatter, s: StatusFilter): boolean {
  return s === "all" ? true : s === "open" ? m.matter_status !== "ARCHIVED" : m.matter_status === s;
}

const he = (a: string, b: string) => a.localeCompare(b, "he", { numeric: true, sensitivity: "base" });

/** Compares two values where a missing one always goes last, whatever the direction. */
function lastIfMissing<T>(a: T | null | undefined, b: T | null | undefined, cmp: (x: T, y: T) => number, dir: SortDir): number {
  const am = a == null || a === "", bm = b == null || b === "";
  if (am || bm) return am && bm ? 0 : am ? 1 : -1;
  const c = cmp(a as T, b as T);
  return dir === "asc" ? c : -c;
}

export function applyQuery(rows: TableMatter[], q: TableQuery, ctx: TableCtx): TableMatter[] {
  const text = q.q.trim();
  const out = rows.filter((m) => {
    const e = ctx.extras.get(m.matter_id);
    if (!statusOk(m, q.status)) return false;
    if (q.practice !== "all" && m.practice_area !== q.practice) return false;
    if (q.mine && !isMine(e, ctx.me)) return false;
    if (q.attention && !needsAttention(m, e, ctx.today)) return false;
    if (text && !ctx.match(m, text)) return false;
    return true;
  });
  const by = (m: TableMatter) => ctx.extras.get(m.matter_id);
  const cmp = (a: TableMatter, b: TableMatter): number => {
    switch (q.sort) {
      case "updated": { const x = lastActivity(a, by(a)), y = lastActivity(b, by(b)); return q.dir === "asc" ? (x < y ? -1 : x > y ? 1 : 0) : (x > y ? -1 : x < y ? 1 : 0); }
      case "opened": return q.dir === "asc" ? (a.dispatched_at < b.dispatched_at ? -1 : a.dispatched_at > b.dispatched_at ? 1 : 0) : (a.dispatched_at > b.dispatched_at ? -1 : a.dispatched_at < b.dispatched_at ? 1 : 0);
      case "name": { const c = he(ctx.label(a), ctx.label(b)); return q.dir === "asc" ? c : -c; }
      case "number": return lastIfMissing(a.matter_code?.trim(), b.matter_code?.trim(), he, q.dir);
      case "owner": return lastIfMissing(by(a)?.owner, by(b)?.owner, he, q.dir);
      case "due": return lastIfMissing(by(a)?.next_due, by(b)?.next_due, (x, y) => (x < y ? -1 : x > y ? 1 : 0), q.dir);
    }
  };
  // Ties keep the newest intake first, then a fixed order, so the list never shuffles between renders.
  return out.sort((a, b) => cmp(a, b) || (a.dispatched_at > b.dispatched_at ? -1 : a.dispatched_at < b.dispatched_at ? 1 : 0) || (a.matter_id < b.matter_id ? -1 : 1));
}

/** A click on a column: the same key flips the direction, another key starts at its natural one. */
export function toggleSort(q: TableQuery, key: SortKey): Pick<TableQuery, "sort" | "dir"> {
  return q.sort === key ? { sort: key, dir: q.dir === "asc" ? "desc" : "asc" } : { sort: key, dir: DEFAULT_DIR[key] };
}
export const sortWithDefault = (key: SortKey): Pick<TableQuery, "sort" | "dir"> => ({ sort: key, dir: DEFAULT_DIR[key] });

export const isFiltered = (q: TableQuery): boolean => q.q.trim() !== "" || q.status !== DEFAULT_QUERY.status || q.practice !== "all" || q.mine || q.attention;
/** How many filters beyond the search are set: the number on the phone's "filter and sort" button. */
export const activeFilters = (q: TableQuery): number => [q.status !== DEFAULT_QUERY.status, q.practice !== "all", q.mine, q.attention].filter(Boolean).length;

/** The remembered view and sort, read back safely: anything unexpected falls back to the default. */
export function parseView(raw: string | null | undefined): ViewMode {
  return raw === "cards" ? "cards" : "list";
}
export function parseSort(raw: string | null | undefined): Pick<TableQuery, "sort" | "dir"> {
  const [k, d] = (raw ?? "").split(":");
  if (!(SORT_KEYS as string[]).includes(k)) return { sort: DEFAULT_QUERY.sort, dir: DEFAULT_QUERY.dir };
  return { sort: k as SortKey, dir: d === "asc" || d === "desc" ? d : DEFAULT_DIR[k as SortKey] };
}

export interface ExtraSources {
  matters: Array<{ id: string; updated_at: string | null; created_by: string | null }>;
  team: Array<{ matter_id: string; user_id: string; created_at: string }>;
  deadlines: Array<{ matter_id: string; due_date: string; kind: string }>;
  tasks: Array<{ matter_id: string; due_at: string | null }>;
  docs: Array<{ matter_id: string; created_at: string }>;
  people: Array<{ user_id: string; display_name: string | null }>;
}

/** Joins the raw rows into one extra per matter. Rows arrive in any order; a source that failed arrives empty. */
export function buildExtras(src: ExtraSources): Map<string, MatterExtra> {
  const out = new Map<string, MatterExtra>();
  const get = (id: string): MatterExtra => {
    let e = out.get(id);
    if (!e) { e = { updated_at: null, owner_id: null, owner: null, team: [], next_due: null, next_kind: null }; out.set(id, e); }
    return e;
  };
  const later = (a: string | null, b: string | null) => (!a ? b : !b ? a : a > b ? a : b);
  const creator = new Map<string, string>();
  for (const m of src.matters) {
    const e = get(m.id);
    e.updated_at = later(e.updated_at, m.updated_at);
    if (m.created_by) creator.set(m.id, m.created_by);
  }
  for (const d of src.docs) { const e = get(d.matter_id); e.updated_at = later(e.updated_at, d.created_at); }
  const seats = [...src.team].sort((a, b) => (a.created_at < b.created_at ? -1 : a.created_at > b.created_at ? 1 : 0));
  for (const t of seats) { const e = get(t.matter_id); if (!e.team.includes(t.user_id)) e.team.push(t.user_id); }
  const names = new Map(src.people.map((p) => [p.user_id, (p.display_name ?? "").trim()]));
  for (const [id, e] of out) {
    e.owner_id = e.team[0] ?? creator.get(id) ?? null;
    e.owner = e.owner_id ? names.get(e.owner_id) || "חבר צוות" : null;
  }
  const offer = (id: string, day: string, kind: DueKind) => {
    const e = get(id);
    if (!e.next_due || day < e.next_due) { e.next_due = day; e.next_kind = kind; }
  };
  for (const d of src.deadlines) offer(d.matter_id, d.due_date.slice(0, 10), (["HEARING", "FILING", "INTERNAL"] as const).find((k) => k === d.kind) ?? "INTERNAL");
  for (const t of src.tasks) if (t.due_at) offer(t.matter_id, ilDay(t.due_at), "TASK");
  return out;
}

/** "3.11", "היום", "מחר", "באיחור של 2 ימים": short words for a due day. */
export function dueText(due: string, today: string): string {
  const d = dayDiff(today, due);
  if (d === 0) return "היום";
  if (d === 1) return "מחר";
  if (d === -1) return "אתמול, באיחור";
  if (d < 0) return `באיחור של ${-d} ימים`;
  const [y, m, day] = due.split("-");
  return y === today.slice(0, 4) ? `${+day}.${+m}` : `${+day}.${+m}.${y}`;
}

/** "לפני 5 דקות", "היום 14:20", "אתמול", "28.10": a relative time that stays short. */
export function agoText(iso: string, now = new Date()): string {
  const ms = now.getTime() - new Date(iso).getTime();
  const min = Math.floor(ms / 60000);
  if (min < 1) return "עכשיו";
  if (min < 60) return `לפני ${min} דקות`;
  const today = ilToday(now), day = ilDay(iso), diff = dayDiff(day, today);
  if (diff === 0) return `היום ${new Intl.DateTimeFormat("he-IL", { timeZone: IL, hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(iso))}`;
  if (diff === 1) return "אתמול";
  const [y, m, d] = day.split("-");
  return y === today.slice(0, 4) ? `${+d}.${+m}` : `${+d}.${+m}.${y}`;
}
