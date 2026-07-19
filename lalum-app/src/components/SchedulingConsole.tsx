import { useCallback, useEffect, useMemo, useState } from "react";
import { useLang } from "../context/LangContext";
import { supabase } from "../lib/supabase";
import { Icon } from "./Icon";
import { createEvent, findConflicts, freeSlots, loadEvents, type CalEvent, type EventKind, type Slot } from "../lib/scheduling";

type Task = { id: string; title: string; estimate_minutes: number; status: string; scheduled_event_id: string | null };

const HORIZON_DAYS = 14;

export function SchedulingConsole() {
  const { t, lang } = useLang();
  const S = t.ui.schedule;
  const locale = lang === "he" ? "he-IL" : "en-US";
  const TZ = "Asia/Jerusalem"; // the firm operates from Herzliya; show Israel time to any viewer

  const [events, setEvents] = useState<CalEvent[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [taskTitle, setTaskTitle] = useState("");
  const [taskEst, setTaskEst] = useState(60);
  const [placingTask, setPlacingTask] = useState<Task | null>(null);
  const [busy, setBusy] = useState(false);

  const rangeFrom = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  const reload = useCallback(async () => {
    if (!supabase) return;
    const from = new Date();
    from.setHours(0, 0, 0, 0);
    const to = new Date(from.getTime() + HORIZON_DAYS * 86400000);
    const [ev, tk] = await Promise.all([
      loadEvents(from.toISOString(), to.toISOString()),
      supabase.from("lalum_tasks").select("*").eq("status", "todo").order("created_at", { ascending: true }),
    ]);
    setEvents(ev);
    setTasks((tk.data as Task[]) ?? []);
  }, []);

  useEffect(() => {
    void reload();
    const onChange = () => void reload();
    window.addEventListener("lalum:events-changed", onChange);
    return () => window.removeEventListener("lalum:events-changed", onChange);
  }, [reload]);

  // Ids of real (non-travel) events that overlap another real event.
  const conflictIds = useMemo(() => {
    const real = events.filter((e) => e.kind !== "travel");
    const ids = new Set<string>();
    for (let i = 0; i < real.length; i++) {
      for (let j = i + 1; j < real.length; j++) {
        if (new Date(real[i].starts_at) < new Date(real[j].ends_at) && new Date(real[j].starts_at) < new Date(real[i].ends_at)) {
          ids.add(real[i].id);
          ids.add(real[j].id);
        }
      }
    }
    return ids;
  }, [events]);

  const byDay = useMemo(() => {
    const groups: { key: string; label: string; items: CalEvent[] }[] = [];
    for (const e of events) {
      const d = new Date(e.starts_at);
      const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
      let g = groups.find((x) => x.key === key);
      if (!g) {
        g = { key, label: d.toLocaleDateString(locale, { weekday: "long", day: "numeric", month: "long", timeZone: TZ }), items: [] };
        groups.push(g);
      }
      g.items.push(e);
    }
    return groups;
  }, [events, locale]);

  const fmtTime = (iso: string) => new Date(iso).toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit", timeZone: TZ });

  async function addTask() {
    if (!taskTitle.trim() || !supabase) return;
    await supabase.from("lalum_tasks").insert({ title: taskTitle.trim(), estimate_minutes: taskEst });
    setTaskTitle("");
    void reload();
  }

  const slotsForPlacing = useMemo<Slot[]>(() => {
    if (!placingTask) return [];
    return freeSlots(events, 7, placingTask.estimate_minutes, 9, 19, rangeFrom).slice(0, 24);
  }, [placingTask, events, rangeFrom]);

  async function placeTaskInSlot(slot: Slot) {
    if (!placingTask || !supabase) return;
    setBusy(true);
    try {
      const start = new Date(slot.start);
      const end = new Date(start.getTime() + placingTask.estimate_minutes * 60000);
      const res = await createEvent(
        { title: placingTask.title, kind: "block", location: null, starts_at: start.toISOString(), ends_at: end.toISOString(), reminders: [] },
        events,
      );
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

  async function deleteEvent(id: string) {
    if (!supabase) return;
    if (!window.confirm(S.deleteConfirm)) return;
    await supabase.from("lalum_events").delete().eq("id", id);
    void reload();
  }

  const kindLabel = (k: EventKind) => S.kinds[k] ?? k;

  return (
    <div className="card" style={{ padding: 34, marginBottom: 28, borderColor: "var(--clay)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 6 }}>
        <span className="icon-badge"><Icon name="calendar" size={20} /></span>
        <h2 className="h3" style={{ fontSize: 22 }}>{S.title}</h2>
      </div>
      <p className="muted" style={{ fontSize: 13, margin: "0 0 22px" }}>{S.hint}</p>

      <div className="sched-grid">
        {/* AGENDA */}
        <div>
          <div className="label">{S.agenda}</div>
          {byDay.length === 0 ? (
            <p className="muted" style={{ fontSize: 14 }}>{S.none}</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 18, marginTop: 8 }}>
              {byDay.map((g) => (
                <div key={g.key}>
                  <div style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".05em", color: "var(--slate)", marginBottom: 8 }}>{g.label}</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {g.items.map((e) =>
                      e.kind === "travel" ? (
                        <div key={e.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 12px", borderRadius: 10, background: "var(--ivory)", color: "var(--slate)", fontSize: 13 }}>
                          <Icon name="phone" size={14} />
                          <span dir="ltr">{fmtTime(e.starts_at)}</span>
                          <span>{S.travelTo} {e.location} · {e.travel_minutes} {S.estimate}</span>
                        </div>
                      ) : (
                        <div key={e.id} style={{ border: `1px solid ${conflictIds.has(e.id) ? "var(--clay)" : "var(--line)"}`, borderRadius: 12, padding: "12px 14px", background: "var(--card)" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                            <span dir="ltr" style={{ fontWeight: 700, fontSize: 14 }}>{`${fmtTime(e.starts_at)}-${fmtTime(e.ends_at)}`}</span>
                            <span style={{ fontSize: 11, fontWeight: 700, color: "var(--clay)", textTransform: "uppercase", letterSpacing: ".05em" }}>{kindLabel(e.kind)}</span>
                            {conflictIds.has(e.id) && <span style={{ fontSize: 11, fontWeight: 700, color: "var(--paper)", background: "var(--clay)", borderRadius: 9999, padding: "2px 9px" }}>{S.conflictBadge}</span>}
                            <button type="button" onClick={() => deleteEvent(e.id)} className="btn btn-ghost btn-sm" style={{ marginInlineStart: "auto", padding: "4px 10px" }} aria-label={S.delete}><Icon name="x" size={14} /></button>
                          </div>
                          <div style={{ fontWeight: 600, marginTop: 4 }}>{e.title}</div>
                          {e.location && <div className="muted" style={{ fontSize: 13 }}>{e.location}</div>}
                          {e.reminders?.length > 0 && (
                            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8 }}>
                              {e.reminders.map((r, i) => (
                                <span key={i} style={{ fontSize: 11, color: "var(--slate)", border: "1px solid var(--line)", borderRadius: 9999, padding: "2px 8px" }}>{r >= 60 ? `${Math.round(r / 60)}h` : `${r}m`} {S.remindersBefore}</span>
                              ))}
                            </div>
                          )}
                        </div>
                      ),
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* TASKS / TIME-BLOCKING */}
        <div>
          <div className="label">{S.tasks}</div>
          <div style={{ display: "flex", gap: 8, marginTop: 8, marginBottom: 12 }}>
            <input className="field" value={taskTitle} onChange={(e) => setTaskTitle(e.target.value)} placeholder={S.taskPlaceholder} style={{ flex: 1 }} onKeyDown={(e) => { if (e.key === "Enter") void addTask(); }} />
            <select className="field" value={taskEst} onChange={(e) => setTaskEst(Number(e.target.value))} style={{ width: 90 }} dir="ltr">
              {[30, 60, 90, 120].map((m) => <option key={m} value={m}>{m} {S.estimate}</option>)}
            </select>
            <button type="button" className="btn btn-ink btn-sm" onClick={() => void addTask()} disabled={!taskTitle.trim()}>{S.addTask}</button>
          </div>

          {tasks.length === 0 ? (
            <p className="muted" style={{ fontSize: 13 }}>{S.pickTask}</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {tasks.map((tk) => (
                <div key={tk.id} style={{ border: "1px solid var(--line)", borderRadius: 10, padding: "10px 12px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{ flex: 1, fontSize: 14, wordBreak: "break-word" }}>{tk.title}</span>
                    <span className="muted" style={{ fontSize: 12 }} dir="ltr">{tk.estimate_minutes} {S.estimate}</span>
                    <button type="button" className="btn btn-clay btn-sm" style={{ padding: "5px 12px" }} onClick={() => setPlacingTask(placingTask?.id === tk.id ? null : tk)}>{S.place}</button>
                  </div>
                  {placingTask?.id === tk.id && (
                    <div style={{ marginTop: 10 }}>
                      <div className="label" style={{ marginBottom: 6 }}>{S.free}</div>
                      {slotsForPlacing.length === 0 ? (
                        <p className="muted" style={{ fontSize: 12.5 }}>{S.noSlots}</p>
                      ) : (
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                          {slotsForPlacing.map((s, i) => (
                            <button key={i} type="button" disabled={busy} onClick={() => void placeTaskInSlot(s)} dir="ltr"
                              style={{ fontSize: 12, border: "1px solid var(--line-strong)", borderRadius: 9999, padding: "5px 11px", background: "var(--card)", cursor: "pointer" }}>
                              {new Date(s.start).toLocaleDateString(locale, { weekday: "short", day: "numeric", month: "short", timeZone: TZ })} {fmtTime(s.start)}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      <p className="muted" style={{ fontSize: 12, marginTop: 18 }}>{S.travelNote}</p>
    </div>
  );
}

// A leading travel buffer whose window overlaps a prior event is the classic
// double-book; findConflicts already prevents it at creation time.
export { findConflicts };
