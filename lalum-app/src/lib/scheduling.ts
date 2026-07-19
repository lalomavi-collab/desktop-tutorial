import { supabase } from "./supabase";

// The firm's internal calendar. Events include real events and their travel
// buffers (kind === "travel", linked by parent_event_id). All logic here is
// conflict-aware so nothing is ever double-booked.

export type EventKind = "lecture" | "meeting" | "zoom" | "phone" | "block" | "travel";

export type CalEvent = {
  id: string;
  title: string;
  kind: EventKind;
  location: string | null;
  starts_at: string;
  ends_at: string;
  travel_minutes: number;
  parent_event_id: string | null;
  reminders: number[];
  notes: string | null;
};

export type NewEvent = {
  title: string;
  kind: EventKind;
  location: string | null;
  starts_at: string;
  ends_at: string;
  reminders?: number[];
  notes?: string | null;
};

// In-person kinds need travel time from the office; virtual ones never do.
export function isInPerson(kind: EventKind, location: string | null): boolean {
  if (kind === "zoom" || kind === "phone") return false;
  return Boolean(location && location.trim());
}

export function overlaps(aStart: string, aEnd: string, bStart: string, bEnd: string): boolean {
  return new Date(aStart) < new Date(bEnd) && new Date(bStart) < new Date(aEnd);
}

// Events that clash with [start, end], ignoring the given ids (e.g. an event's
// own travel buffer) and travel buffers themselves are still counted as busy.
export function findConflicts(events: CalEvent[], start: string, end: string, ignoreIds: string[] = []): CalEvent[] {
  return events.filter((e) => !ignoreIds.includes(e.id) && overlaps(start, end, e.starts_at, e.ends_at));
}

export async function loadEvents(fromISO: string, toISO: string): Promise<CalEvent[]> {
  if (!supabase) return [];
  const { data } = await supabase
    .from("lalum_events")
    .select("*")
    .gte("starts_at", fromISO)
    .lte("starts_at", toISO)
    .order("starts_at", { ascending: true });
  return (data as CalEvent[]) ?? [];
}

async function travelMinutes(destination: string, arriveBy: string): Promise<number> {
  if (!supabase) return 0;
  try {
    const { data } = await supabase.functions.invoke("lalum-travel-time", { body: { destination, arrive_by: arriveBy } });
    const m = Number(data?.minutes);
    return Number.isFinite(m) ? m : 0;
  } catch {
    return 0;
  }
}

export type CreateResult = { ok: boolean; conflicts: CalEvent[]; travel: number };

// Creates an event, and, for in-person events, a linked travel buffer before
// it. Refuses to write if the event or its buffer clashes with anything.
export async function createEvent(ev: NewEvent, existing: CalEvent[]): Promise<CreateResult> {
  if (!supabase) return { ok: false, conflicts: [], travel: 0 };
  const reminders = ev.reminders ?? [1440, 120, 30];

  let travel = 0;
  let bufferStart = ev.starts_at;
  if (isInPerson(ev.kind, ev.location)) {
    travel = await travelMinutes(ev.location as string, ev.starts_at);
    if (travel > 0) bufferStart = new Date(new Date(ev.starts_at).getTime() - travel * 60000).toISOString();
  }

  // Conflict check covers the event window plus its leading travel buffer.
  const conflicts = findConflicts(existing, bufferStart, ev.ends_at);
  if (conflicts.length) return { ok: false, conflicts, travel };

  const { data: created, error } = await supabase
    .from("lalum_events")
    .insert({
      title: ev.title,
      kind: ev.kind,
      location: ev.location,
      starts_at: ev.starts_at,
      ends_at: ev.ends_at,
      travel_minutes: travel,
      reminders,
      notes: ev.notes ?? null,
    })
    .select("id")
    .single();
  if (error || !created) return { ok: false, conflicts: [], travel };

  if (travel > 0) {
    await supabase.from("lalum_events").insert({
      title: `Travel to ${ev.location}`,
      kind: "travel",
      location: ev.location,
      starts_at: bufferStart,
      ends_at: ev.starts_at,
      travel_minutes: travel,
      parent_event_id: created.id,
      reminders: [],
    });
  }
  return { ok: true, conflicts: [], travel };
}

// Free gaps of at least `durationMin` within working hours across the next
// `days` days, computed around all busy events (travel buffers included).
export type Slot = { start: string; end: string };

export function freeSlots(events: CalEvent[], days: number, durationMin: number, workStart = 9, workEnd = 19, from: Date): Slot[] {
  const slots: Slot[] = [];
  const busy = events
    .map((e) => [new Date(e.starts_at).getTime(), new Date(e.ends_at).getTime()] as [number, number])
    .sort((a, b) => a[0] - b[0]);
  const dayMs = 86400000;
  const base = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  for (let d = 0; d < days; d++) {
    const day = new Date(base.getTime() + d * dayMs);
    const wd = day.getDay();
    if (wd === 5 || wd === 6) continue; // skip Fri/Sat
    let cursor = new Date(day).setHours(workStart, 0, 0, 0);
    const dayEnd = new Date(day).setHours(workEnd, 0, 0, 0);
    if (d === 0) cursor = Math.max(cursor, Date.now());
    const dayBusy = busy.filter((b) => b[1] > cursor && b[0] < dayEnd).sort((a, b) => a[0] - b[0]);
    for (const [bs, be] of dayBusy) {
      if (bs - cursor >= durationMin * 60000) slots.push({ start: new Date(cursor).toISOString(), end: new Date(bs).toISOString() });
      cursor = Math.max(cursor, be);
    }
    if (dayEnd - cursor >= durationMin * 60000) slots.push({ start: new Date(cursor).toISOString(), end: new Date(dayEnd).toISOString() });
  }
  return slots;
}

export const KIND_MINUTES: Record<EventKind, number> = { lecture: 90, meeting: 60, zoom: 30, phone: 30, block: 60, travel: 0 };
