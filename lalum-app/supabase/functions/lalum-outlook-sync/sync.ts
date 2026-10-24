// Pure core of lalum-outlook-sync: maps Microsoft Graph calendarView events to lalum_events rows and decides what to write.
// No I/O here, so scripts/outlook-sync-check.mjs runs this exact code with fakes.

export type GraphEvent = {
  id?: string;
  subject?: string | null;
  location?: { displayName?: string | null } | null;
  start?: { dateTime: string; timeZone?: string } | null;
  end?: { dateTime: string; timeZone?: string } | null;
  isCancelled?: boolean;
  isOnlineMeeting?: boolean;
};

export type EventRow = {
  external_id: string;
  title: string;
  kind: "zoom" | "meeting" | "block";
  location: string | null;
  starts_at: string;
  ends_at: string;
};

export type ExistingRow = { id: string; external_id: string | null; title: string; starts_at: string };
export type Rekey = { id: string; external_id: string };

export type Plan =
  | { status: "refused"; reason: "too_few_events"; fetched: number }
  | {
    status: "ok" | "held";
    upserts: EventRow[];
    rekeys: Rekey[];
    deletes: string[];
    held: { inserts: number; deletes: number };
    fetched: number;
    skipped: number;
  };

// A healthy fetch of the owner's calendar holds dozens of events; fewer than this means Graph returned a partial or empty answer.
export const MIN_FETCHED = 5;
// More deletions than this in one run is never a normal day. lalum_outlook_apply enforces the same cap in SQL.
export const MAX_DELETES = 10;

const ONLINE = /zoom\.us|teams\.microsoft|meet\.google|^https?:\/\//i;

// The request carries Prefer: outlook.timezone="UTC", so Graph sends UTC wall clock with no offset and seven fraction digits.
// Anything else is refused rather than stored at a wrong hour.
export function toUtcIso(dateTime: string, timeZone = "UTC"): string {
  if (timeZone !== "UTC") throw new Error(`unexpected timeZone ${timeZone}`);
  const s = dateTime.replace(/(\.\d{3})\d+/, "$1");
  const ms = Date.parse(/[zZ]$|[+-]\d\d:\d\d$/.test(s) ? s : s + "Z");
  if (Number.isNaN(ms)) throw new Error("unreadable dateTime");
  return new Date(ms).toISOString();
}

// Same rules as the Claude routine this replaces, plus Graph's isOnlineMeeting flag: Teams invites carry it with a plain
// "Microsoft Teams Meeting" location, which the routine's location test alone would have called a meeting in person.
export function mapEvent(e: GraphEvent): EventRow | null {
  if (e.isCancelled || !e.id || !e.start || !e.end) return null;
  const location = e.location?.displayName?.trim() || null;
  const kind = e.isOnlineMeeting || (location && ONLINE.test(location)) ? "zoom" : location ? "meeting" : "block";
  return {
    external_id: e.id,
    title: e.subject?.trim() || "(ללא נושא)",
    kind,
    location,
    starts_at: toUtcIso(e.start.dateTime, e.start.timeZone),
    ends_at: toUtcIso(e.end.dateTime, e.end.timeZone),
  };
}

const sameMeeting = (title: string, startsAt: string) => `${title.trim()}\u0000${Date.parse(startsAt)}`;

// existing: every Outlook row that has not ended yet. Only rows starting inside (now, windowEnd) can be deleted, so a row past the
// fetch window or already under way is never touched.
export function planSync(fetched: GraphEvent[], existing: ExistingRow[], now: Date, windowEnd: Date): Plan {
  const byId = new Map<string, EventRow>();
  let skipped = 0;
  for (const e of fetched) {
    const row = mapEvent(e);
    if (row) byId.set(row.external_id, row);
    else skipped++;
  }
  const rows = [...byId.values()];
  if (rows.length < MIN_FETCHED) return { status: "refused", reason: "too_few_events", fetched: rows.length };

  const known = new Set(existing.map((x) => x.external_id).filter((id): id is string => !!id));
  const from = now.getTime(), to = windowEnd.getTime();
  const orphans = existing.filter((x) => {
    const t = Date.parse(x.starts_at);
    return t > from && t < to && !(x.external_id && byId.has(x.external_id));
  });

  // An orphan with the same title and start as a new id is the same meeting: Outlook re-issues the id when an invite is updated,
  // and the ids the old Claude routine stored are not Graph ids. Moving the id keeps the row's uuid, notes and links, where
  // insert plus delete would show the meeting twice until the delete ran.
  const pool = new Map<string, ExistingRow[]>();
  for (const o of orphans) {
    const k = sameMeeting(o.title, o.starts_at);
    pool.set(k, [...(pool.get(k) ?? []), o]);
  }
  const rekeys: Rekey[] = [];
  for (const r of rows) {
    if (known.has(r.external_id)) continue;
    const hit = pool.get(sameMeeting(r.title, r.starts_at))?.shift();
    if (hit) rekeys.push({ id: hit.id, external_id: r.external_id });
  }
  const moved = new Set(rekeys.map((k) => k.id));
  const newIds = new Set(rekeys.map((k) => k.external_id));
  const deletes = orphans.filter((o) => !moved.has(o.id)).map((o) => o.id);

  if (deletes.length > MAX_DELETES) {
    // Too much would disappear at once, which looks like a broken fetch or a change of id format. Write only what is safe:
    // updates to rows already matched. New rows wait too, or the cockpit would show them beside the rows that were not deleted.
    const safe = rows.filter((r) => known.has(r.external_id) || newIds.has(r.external_id));
    return {
      status: "held",
      upserts: safe,
      rekeys,
      deletes: [],
      held: { inserts: rows.length - safe.length, deletes: deletes.length },
      fetched: rows.length,
      skipped,
    };
  }
  return { status: "ok", upserts: rows, rekeys, deletes, held: { inserts: 0, deletes: 0 }, fetched: rows.length, skipped };
}
