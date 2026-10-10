// Deadline calculator MECHANICS only. It encodes no statute: no period length, no recess dates, no holiday list.
// Every legal input arrives from the caller. The rule catalogue below is empty on purpose: an entry may be added only
// after the operative text was read from two independent primary sources (see CLAUDE.md, "Sources: Full Double Verification").
import { addDays, iso, parseDay } from "./crm.ts";

export interface Period { from: string; to: string; label: string }
export interface VerifiedSource { citation: string; quotedText: string; sources: [string, string]; versionDate: string }
export interface DeadlineRule { id: string; label: string; days: number; verified: VerifiedSource }

/** Intentionally empty until verification is complete. The UI says so rather than offering unverified defaults. */
export const VERIFIED_RULES: DeadlineRule[] = [];

export interface CalcInput {
  eventDate: string;
  days: number;
  /** Periods whose days are not counted (the counting is frozen). Supplied by the caller. */
  frozen: Period[];
  /** When the last day falls on a day in `closedDays` or on a weekday in `closedWeekdays`, move to the next open day. */
  rollForward: boolean;
  closedWeekdays: number[];
  closedDays: string[];
  /** Whether the event day itself is counted. A legal choice, supplied by the caller. */
  countEventDay: boolean;
}
export interface CalcStep { on: string; note: string }
export interface CalcResult { due: string; steps: CalcStep[] }

export function calculateDeadline(c: CalcInput): CalcResult {
  const steps: CalcStep[] = [];
  const frozenOn = (d: Date): Period | undefined => c.frozen.find((p) => iso(d) >= p.from && iso(d) <= p.to);
  let cur = parseDay(c.eventDate), counted = 0;
  steps.push({ on: c.eventDate, note: c.countEventDay ? "יום האירוע נספר" : "יום האירוע אינו נספר" });
  if (c.countEventDay) counted = 1;
  let lastFrozen: string | null = null;
  while (counted < c.days) {
    cur = addDays(cur, 1);
    const f = frozenOn(cur);
    if (f) { if (lastFrozen !== f.label) { steps.push({ on: iso(cur), note: `תחילת הקפאה: ${f.label}` }); lastFrozen = f.label; } continue; }
    if (lastFrozen) { steps.push({ on: iso(cur), note: "סיום הקפאה, המניין ממשיך" }); lastFrozen = null; }
    counted++;
  }
  steps.push({ on: iso(cur), note: `היום ה-${c.days} במניין` });
  if (c.rollForward) {
    const closed = (d: Date) => c.closedWeekdays.includes(d.getDay()) || c.closedDays.includes(iso(d)) || !!frozenOn(d);
    let moved = false;
    while (closed(cur)) { cur = addDays(cur, 1); moved = true; }
    if (moved) steps.push({ on: iso(cur), note: "המועד האחרון נפל ביום סגור, נדחה ליום הפתוח הבא" });
  }
  return { due: iso(cur), steps };
}
