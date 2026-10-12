import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";
import { Icon } from "./Icon";
import { createEvent, findConflicts, freeSlots, loadEvents, type CalEvent, type EventKind, type NewEvent, type Slot } from "../lib/scheduling";
import "../styles/cockpit-calendar.css";

// Month/week/day calendar, styled with the cockpit's own tokens (not the public
// site's .card/.btn classes the old agenda-list version used) so this screen
// reads like Finance, Billing and the rest of the cockpit. Replaces the plain
// day-grouped agenda list; the task time-blocking flow is unchanged, just
// restyled and moved into the sidebar.

type Task = { id: string; title: string; estimate_minutes: number; status: string; scheduled_event_id: string | null };
type View = "month" | "week" | "day";
type Panel =
  | { mode: "create"; start: Date; end: Date }
  | { mode: "view"; event: CalEvent }
  | null;

const DOW = ["א", "ב", "ג", "ד", "ה", "ו", "ש"]; // Sunday first, matches the work-week used in freeSlots
const MONTH_NAMES = ["ינואר", "פברואר", "מרץ", "אפריל", "מאי", "יוני", "יולי", "אוגוסט", "ספטמבר", "אוקטובר", "נובמבר", "דצמבר"];
const GRID_START_HOUR = 5;
const GRID_END_HOUR = 24;
const HOUR_PX = 48;
const KIND_LABEL: Record<EventKind, string> = { lecture: "הרצאה", meeting: "פגישה", zoom: "שיחת וידאו", phone: "טלפון", block: "חסימת זמן", travel: "נסיעה" };
const CREATABLE_KINDS: EventKind[] = ["meeting", "zoom", "phone", "lecture", "block"];

const startOfDay = (d: Date) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };
const addDays = (d: Date, n: number) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const startOfWeek = (d: Date) => addDays(startOfDay(d), -startOfDay(d).getDay());
const startOfMonth = (d: Date) => new Date(d.getFullYear(), d.getMonth(), 1);
const sameDay = (a: Date, b: Date) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
const fmtTime = (iso: string) => new Date(iso).toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" });
const fmtDayLabel = (d: Date) => d.toLocaleDateString("he-IL", { weekday: "long", day: "numeric", month: "long" });

// A trip, an out-of-office stretch, etc.: long enough, or spanning a midnight, that a hovered time
// slot in week/day view isn't the useful way to see it. Shown as a banner above the hour grid instead.
const isAllDayish = (e: CalEvent) => {
  const s = new Date(e.starts_at), en = new Date(e.ends_at);
  return en.getTime() - s.getTime() >= 20 * 3600000 || !sameDay(s, en);
};

// Events (not travel buffers) whose [start,end) interval touches this calendar day at all: a
// multi-day trip shows on every day it covers, not only the day it started.
function eventsOnDay(events: CalEvent[], day: Date): CalEvent[] {
  const dayStart = startOfDay(day).getTime();
  const dayEnd = dayStart + 86400000;
  return events.filter((e) => e.kind !== "travel" && new Date(e.starts_at).getTime() < dayEnd && new Date(e.ends_at).getTime() > dayStart);
}

export function SchedulingConsole() {
  const [events, setEvents] = useState<CalEvent[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [taskTitle, setTaskTitle] = useState("");
  const [taskEst, setTaskEst] = useState(60);
  const [placingTask, setPlacingTask] = useState<Task | null>(null);
  const [busy, setBusy] = useState(false);
  const [view, setView] = useState<View>("week");
  const [cursor, setCursor] = useState(() => new Date());
  const [panel, setPanel] = useState<Panel>(null);
  const [form, setForm] = useState<{ title: string; kind: EventKind; location: string }>({ title: "", kind: "meeting", location: "" });
  const [error, setError] = useState("");

  const monthAnchor = useMemo(() => startOfMonth(cursor), [cursor]);
  const reload = useCallback(async () => {
    if (!supabase) return;
    const from = addDays(monthAnchor, -7);
    const to = addDays(monthAnchor, 45);
    const [ev, tk] = await Promise.all([
      loadEvents(from.toISOString(), to.toISOString()),
      supabase.from("lalum_tasks").select("*").eq("status", "todo").order("created_at", { ascending: true }),
    ]);
    setEvents(ev as CalEvent[]);
    setTasks((tk.data as Task[]) ?? []);
  }, [monthAnchor]);

  useEffect(() => {
    void reload();
    const onChange = () => void reload();
    window.addEventListener("lalum:events-changed", onChange);
    return () => window.removeEventListener("lalum:events-changed", onChange);
  }, [reload]);

  const conflictIds = useMemo(() => {
    const real = events.filter((e) => e.kind !== "travel");
    const ids = new Set<string>();
    for (let i = 0; i < real.length; i++) {
      for (let j = i + 1; j < real.length; j++) {
        if (new Date(real[i].starts_at) < new Date(real[j].ends_at) && new Date(real[j].starts_at) < new Date(real[i].ends_at)) {
          ids.add(real[i].id); ids.add(real[j].id);
        }
      }
    }
    return ids;
  }, [events]);

  const monthDays = useMemo(() => {
    const first = startOfWeek(monthAnchor);
    return Array.from({ length: 42 }, (_, i) => addDays(first, i));
  }, [monthAnchor]);

  const weekDays = useMemo(() => {
    const first = startOfWeek(cursor);
    return Array.from({ length: 7 }, (_, i) => addDays(first, i));
  }, [cursor]);

  const gridDays = view === "day" ? [startOfDay(cursor)] : weekDays;
  const hours = useMemo(() => Array.from({ length: GRID_END_HOUR - GRID_START_HOUR }, (_, i) => GRID_START_HOUR + i), []);

  const rangeLabel = view === "month"
    ? `${MONTH_NAMES[monthAnchor.getMonth()]} ${monthAnchor.getFullYear()}`
    : view === "day"
    ? fmtDayLabel(cursor)
    : `${weekDays[0].getDate()} ${MONTH_NAMES[weekDays[0].getMonth()]} עד ${weekDays[6].getDate()} ${MONTH_NAMES[weekDays[6].getMonth()]}`;

  function navigate(dir: -1 | 1) {
    if (view === "month") setCursor(startOfMonth(addDays(monthAnchor, dir > 0 ? 32 : -2)));
    else if (view === "week") setCursor(addDays(cursor, dir * 7));
    else setCursor(addDays(cursor, dir));
  }

  function openCreateAt(day: Date, minutesFromStart: number) {
    const start = new Date(day); start.setHours(GRID_START_HOUR, 0, 0, 0); start.setMinutes(start.getMinutes() + minutesFromStart);
    const end = new Date(start.getTime() + 60 * 60000);
    setForm({ title: "", kind: "meeting", location: "" });
    setError("");
    setPanel({ mode: "create", start, end });
  }

  function onColClick(e: React.MouseEvent<HTMLDivElement>, day: Date) {
    const rect = e.currentTarget.getBoundingClientRect();
    const px = e.clientY - rect.top;
    const rawMinutes = (px / HOUR_PX) * 60;
    const snapped = Math.round(rawMinutes / 30) * 30;
    openCreateAt(day, Math.max(0, snapped));
  }

  async function submitCreate() {
    if (panel?.mode !== "create" || !form.title.trim()) return;
    setBusy(true); setError("");
    try {
      const ev: NewEvent = { title: form.title.trim(), kind: form.kind, location: form.location.trim() || null, starts_at: panel.start.toISOString(), ends_at: panel.end.toISOString() };
      const res = await createEvent(ev, events);
      if (!res.ok) { setError(res.conflicts.length ? "יש חפיפה עם אירוע אחר בטווח הזה (כולל זמן נסיעה)." : "היצירה נכשלה."); return; }
      setPanel(null);
      void reload();
    } finally {
      setBusy(false);
    }
  }

  async function deleteEvent(ev: CalEvent) {
    if (!supabase || ev.source) return;
    if (!window.confirm("למחוק את האירוע?")) return;
    await supabase.from("lalum_events").delete().eq("id", ev.id);
    setPanel(null);
    void reload();
  }

  const slotsForPlacing = useMemo<Slot[]>(() => {
    if (!placingTask) return [];
    return freeSlots(events, 7, placingTask.estimate_minutes, 9, 19, startOfDay(new Date())).slice(0, 18);
  }, [placingTask, events]);

  async function addTask() {
    if (!taskTitle.trim() || !supabase) return;
    await supabase.from("lalum_tasks").insert({ title: taskTitle.trim(), estimate_minutes: taskEst });
    setTaskTitle("");
    void reload();
  }

  async function placeTaskInSlot(slot: Slot) {
    if (!placingTask || !supabase) return;
    setBusy(true);
    try {
      const start = new Date(slot.start);
      const end = new Date(start.getTime() + placingTask.estimate_minutes * 60000);
      const res = await createEvent({ title: placingTask.title, kind: "block", location: null, starts_at: start.toISOString(), ends_at: end.toISOString(), reminders: [] }, events);
      if (res.ok) {
        const { data: created } = await supabase.from("lalum_events").select("id").eq("kind", "block").eq("starts_at", start.toISOString()).order("created_at", { ascending: false }).limit(1).maybeSingle();
        await supabase.from("lalum_tasks").update({ status: "scheduled", scheduled_event_id: created?.id ?? null }).eq("id", placingTask.id);
        setPlacingTask(null);
        void reload();
      }
    } finally {
      setBusy(false);
    }
  }

  const now = new Date();
  const nowTop = ((now.getHours() - GRID_START_HOUR) * 60 + now.getMinutes()) / 60 * HOUR_PX;

  return (
    <div className="ck-cal">
      <aside className="ck-cal-side">
        <div className="ck-card">
          <div className="ck-cal-mini-head">
            <button type="button" className="ck-btn sm" onClick={() => setCursor(addDays(monthAnchor, -2))} aria-label="חודש קודם"><Icon name="chevron-r" size={14} /></button>
            <b>{MONTH_NAMES[monthAnchor.getMonth()]} {monthAnchor.getFullYear()}</b>
            <button type="button" className="ck-btn sm" onClick={() => setCursor(addDays(monthAnchor, 32))} aria-label="חודש הבא"><Icon name="chevron-l" size={14} /></button>
          </div>
          <div className="ck-cal-mini-grid">
            {DOW.map((d) => <div key={d} className="ck-cal-mini-dow">{d}</div>)}
            {monthDays.map((d) => {
              const has = eventsOnDay(events, d).length > 0;
              return (
                <button key={d.toISOString()} type="button"
                  className={`ck-cal-mini-day${d.getMonth() !== monthAnchor.getMonth() ? " other-month" : ""}${sameDay(d, now) ? " today" : ""}${sameDay(d, cursor) ? " selected" : ""}${has ? " has-events" : ""}`}
                  onClick={() => { setCursor(d); setView("day"); }}>
                  {d.getDate()}
                </button>
              );
            })}
          </div>
        </div>

        {panel && (
          <div className="ck-card ck-stack">
            <div className="ck-row">
              <div className="ck-title">{panel.mode === "create" ? "אירוע חדש" : panel.event.title}</div>
              <button type="button" className="ck-btn sm ck-cal-panel-close" onClick={() => setPanel(null)} aria-label="סגירה"><Icon name="x" size={14} /></button>
            </div>
            {panel.mode === "create" ? (
              <>
                <label className="ck-field">כותרת<input className="ck-input" value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} /></label>
                <label className="ck-field">סוג<select className="ck-select" value={form.kind} onChange={(e) => setForm((f) => ({ ...f, kind: e.target.value as EventKind }))}>
                  {CREATABLE_KINDS.map((k) => <option key={k} value={k}>{KIND_LABEL[k]}</option>)}
                </select></label>
                <label className="ck-field">מיקום (כתובת, או לינק זום/מיט שכבר יש לך)<input className="ck-input" value={form.location} onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))} /></label>
                <div className="ck-meta">{fmtDayLabel(panel.start)}, {fmtTime(panel.start.toISOString())} עד {fmtTime(panel.end.toISOString())}</div>
                {error && <div className="ck-err">{error}</div>}
                <button type="button" className="ck-btn primary" disabled={busy || !form.title.trim()} onClick={() => void submitCreate()}>יצירה</button>
              </>
            ) : (
              <>
                <div className="ck-meta">{fmtDayLabel(new Date(panel.event.starts_at))}, {fmtTime(panel.event.starts_at)} עד {fmtTime(panel.event.ends_at)}</div>
                <div className="ck-badge">{KIND_LABEL[panel.event.kind]}</div>
                {panel.event.location && <div className="ck-meta">{panel.event.location}</div>}
                {panel.event.notes && <div className="ck-meta" style={{ whiteSpace: "pre-wrap" }}>{panel.event.notes}</div>}
                {panel.event.source === "outlook" ? (
                  <div className="ck-meta">מסונכרן מ-Outlook. לעריכה או מחיקה, בצעו זאת ב-Outlook; הסנכרון היומי יעדכן כאן בהתאם.</div>
                ) : (
                  <button type="button" className="ck-btn danger" onClick={() => void deleteEvent(panel.event)}>מחיקה</button>
                )}
              </>
            )}
          </div>
        )}

        <div className="ck-card ck-stack">
          <div className="ck-label">משימות לחסימת זמן</div>
          <div className="ck-row">
            <input className="ck-input" value={taskTitle} onChange={(e) => setTaskTitle(e.target.value)} placeholder="משימה לחסימת זמן" onKeyDown={(e) => { if (e.key === "Enter") void addTask(); }} style={{ flex: 1 }} />
          </div>
          <div className="ck-row">
            <select className="ck-select" value={taskEst} onChange={(e) => setTaskEst(Number(e.target.value))} dir="ltr" style={{ width: 100 }}>
              {[30, 60, 90, 120].map((m) => <option key={m} value={m}>{m} דק׳</option>)}
            </select>
            <button type="button" className="ck-btn primary sm" onClick={() => void addTask()} disabled={!taskTitle.trim()}>הוספה</button>
          </div>
          {tasks.length === 0 ? <div className="ck-meta">אין משימות ממתינות לשיבוץ.</div> : tasks.map((tk) => (
            <div key={tk.id} className="ck-stack" style={{ borderTop: "1px solid var(--line)", paddingTop: 8 }}>
              <div className="ck-row">
                <span style={{ flex: 1, fontSize: 13.5 }}>{tk.title}</span>
                <span className="ck-meta" dir="ltr">{tk.estimate_minutes} דק׳</span>
                <button type="button" className="ck-btn sm" onClick={() => setPlacingTask(placingTask?.id === tk.id ? null : tk)}>שיבוץ</button>
              </div>
              {placingTask?.id === tk.id && (
                slotsForPlacing.length === 0 ? <div className="ck-meta">אין חלונות פנויים בימים הקרובים.</div> : (
                  <div className="ck-row">
                    {slotsForPlacing.map((s, i) => (
                      <button key={i} type="button" className="ck-btn sm" disabled={busy} onClick={() => void placeTaskInSlot(s)} dir="ltr">
                        {new Date(s.start).toLocaleDateString("he-IL", { weekday: "short", day: "numeric", month: "short" })} {fmtTime(s.start)}
                      </button>
                    ))}
                  </div>
                )
              )}
            </div>
          ))}
        </div>
      </aside>

      <section className="ck-cal-main">
        <div className="ck-cal-toolbar">
          <button type="button" className="ck-btn sm" onClick={() => navigate(-1)} aria-label="קודם"><Icon name="chevron-r" size={16} /></button>
          <button type="button" className="ck-btn sm" onClick={() => { setCursor(new Date()); }}>היום</button>
          <button type="button" className="ck-btn sm" onClick={() => navigate(1)} aria-label="הבא"><Icon name="chevron-l" size={16} /></button>
          <div className="ck-cal-range">{rangeLabel}</div>
          <div className="ck-cal-views">
            {(["day", "week", "month"] as View[]).map((v) => (
              <button key={v} type="button" className={view === v ? "active" : ""} onClick={() => setView(v)}>{v === "day" ? "יום" : v === "week" ? "שבוע" : "חודש"}</button>
            ))}
          </div>
        </div>

        {view === "month" ? (
          <div className="ck-cal-month">
            {DOW.map((d) => <div key={d} className="ck-cal-month-dow">{d}</div>)}
            {monthDays.map((d) => {
              const items = eventsOnDay(events, d).filter((e) => e.kind !== "travel");
              const shown = items.slice(0, 3);
              return (
                <div key={d.toISOString()} className={`ck-cal-month-cell${d.getMonth() !== monthAnchor.getMonth() ? " other-month" : ""}`}
                  onClick={() => { setCursor(d); setView("day"); }}>
                  <span className={`ck-cal-month-daynum${sameDay(d, now) ? " today" : ""}`}>{d.getDate()}</span>
                  {shown.map((e) => <div key={e.id} className={`ck-cal-month-chip${e.source ? " outlook" : ""}`}>{e.title}</div>)}
                  {items.length > shown.length && <div className="ck-cal-month-more">+{items.length - shown.length} נוספים</div>}
                </div>
              );
            })}
          </div>
        ) : (
          <>
            {(() => {
              const allDay = gridDays.map((d) => eventsOnDay(events, d).filter((e) => isAllDayish(e) && e.kind !== "travel"));
              const hasAllDay = allDay.some((l) => l.length > 0);
              return hasAllDay ? (
                <div className="ck-cal-month" style={{ gridTemplateColumns: `repeat(${gridDays.length}, 1fr)` }}>
                  {gridDays.map((d, i) => (
                    <div key={d.toISOString()} className="ck-cal-month-cell" style={{ minHeight: "unset" }} onClick={() => setPanel({ mode: "view", event: allDay[i][0] })}>
                      {allDay[i].map((e) => <div key={e.id} className={`ck-cal-month-chip${e.source ? " outlook" : ""}`}>{e.title}</div>)}
                    </div>
                  ))}
                </div>
              ) : null;
            })()}
            <div className="ck-cal-grid-wrap">
              <div className="ck-cal-grid-head" style={{ ["--cal-cols" as string]: gridDays.length }}>
                <div />
                {gridDays.map((d) => (
                  <div key={d.toISOString()} className={`ck-cal-grid-head-day${sameDay(d, now) ? " today" : ""}`}>
                    {DOW[d.getDay()]}<b>{d.getDate()}</b>
                  </div>
                ))}
              </div>
              <div className="ck-cal-grid" style={{ ["--cal-cols" as string]: gridDays.length, ["--cal-hour-px" as string]: `${HOUR_PX}px` }}>
                <div className="ck-cal-hours">
                  {hours.map((h) => <div key={h} className="ck-cal-hour">{String(h).padStart(2, "0")}:00</div>)}
                </div>
                {gridDays.map((d) => {
                  const dayStart = new Date(d); dayStart.setHours(GRID_START_HOUR, 0, 0, 0);
                  const dayEnd = new Date(d); dayEnd.setHours(GRID_END_HOUR, 0, 0, 0);
                  const items = eventsOnDay(events, d).filter((e) => !isAllDayish(e));
                  return (
                    <div key={d.toISOString()} className="ck-cal-day-col" style={{ height: hours.length * HOUR_PX }} onClick={(e) => onColClick(e, d)}>
                      {sameDay(d, now) && now.getHours() >= GRID_START_HOUR && now.getHours() < GRID_END_HOUR && (
                        <div className="ck-cal-now-line" style={{ top: nowTop }} />
                      )}
                      {items.map((e) => {
                        const s = new Date(e.starts_at), en = new Date(e.ends_at);
                        const clipStart = s < dayStart ? dayStart : s;
                        const clipEnd = en > dayEnd ? dayEnd : en;
                        if (clipEnd <= clipStart) return null;
                        const top = (clipStart.getTime() - dayStart.getTime()) / 60000 / 60 * HOUR_PX;
                        const height = Math.max(18, (clipEnd.getTime() - clipStart.getTime()) / 60000 / 60 * HOUR_PX);
                        const cls = ["ck-cal-event", `kind-${e.kind}`, conflictIds.has(e.id) ? "conflict" : "", e.source ? "outlook" : ""].filter(Boolean).join(" ");
                        return (
                          <div key={e.id} className={cls} style={{ top, height }} onClick={(ev) => { ev.stopPropagation(); setPanel({ mode: "view", event: e }); }}>
                            <b>{e.title}</b>
                            <span dir="ltr">{fmtTime(e.starts_at)}</span>
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        )}
      </section>
    </div>
  );
}

// A leading travel buffer whose window overlaps a prior event is the classic
// double-book; findConflicts already prevents it at creation time.
export { findConflicts };
