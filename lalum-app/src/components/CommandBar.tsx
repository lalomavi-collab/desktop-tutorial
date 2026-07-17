import { useEffect, useState, useCallback } from "react";
import { useAuth } from "../context/AuthContext";
import { useLang } from "../context/LangContext";
import { supabase } from "../lib/supabase";
import { createEvent, loadEvents, KIND_MINUTES, type EventKind, type NewEvent } from "../lib/scheduling";
import { Icon } from "./Icon";

function tzOffsetLabel(): string {
  const off = -new Date().getTimezoneOffset();
  const sign = off >= 0 ? "+" : "-";
  const abs = Math.abs(off);
  const hh = String(Math.floor(abs / 60)).padStart(2, "0");
  const mm = String(abs % 60).padStart(2, "0");
  return `${sign}${hh}:${mm}`;
}

// A global Cmd/Ctrl+K palette for the firm to schedule by typing a sentence.
// Only active for admins; for everyone else the shortcut is a no-op.
export function CommandBar() {
  const { user } = useAuth();
  const { t, dir } = useLang();
  const C = t.ui.cmd;
  const [admin, setAdmin] = useState(false);
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ tone: "ok" | "err"; text: string } | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      if (!supabase || !user) return setAdmin(false);
      if ((user.email ?? "").toLowerCase() === "avraham@lalum.co") return setAdmin(true);
      const { data } = await supabase.from("lalum_profiles").select("is_admin").eq("id", user.id).maybeSingle();
      if (alive) setAdmin(Boolean(data?.is_admin));
    })();
    return () => {
      alive = false;
    };
  }, [user]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && (e.key === "k" || e.key === "K")) {
        if (!admin) return;
        e.preventDefault();
        setOpen((o) => !o);
        setResult(null);
      } else if (e.key === "Escape") {
        setOpen(false);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [admin]);

  const submit = useCallback(async () => {
    if (!text.trim() || !supabase) return;
    setBusy(true);
    setResult(null);
    try {
      const { data, error } = await supabase.functions.invoke("lalum-parse-event", {
        body: { text, now: new Date().toISOString(), offset: tzOffsetLabel() },
      });
      if (error) throw error;
      const ev = data?.event as Partial<NewEvent> & { starts_at?: string; ends_at?: string; kind?: EventKind };
      if (!ev?.starts_at) throw new Error("no_start");
      const kind = (ev.kind ?? "meeting") as EventKind;
      const starts = new Date(ev.starts_at);
      const ends = ev.ends_at ? new Date(ev.ends_at) : new Date(starts.getTime() + (KIND_MINUTES[kind] ?? 60) * 60000);
      const dayFrom = new Date(starts);
      dayFrom.setHours(0, 0, 0, 0);
      const dayTo = new Date(starts);
      dayTo.setHours(23, 59, 59, 0);
      const existing = await loadEvents(dayFrom.toISOString(), dayTo.toISOString());
      const res = await createEvent(
        { title: ev.title ?? text.slice(0, 80), kind, location: ev.location ?? null, starts_at: starts.toISOString(), ends_at: ends.toISOString(), reminders: (ev as { reminders?: number[] }).reminders },
        existing,
      );
      if (!res.ok) {
        setResult({ tone: "err", text: C.conflict });
      } else {
        const when = starts.toLocaleString(dir === "rtl" ? "he-IL" : "en-US", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jerusalem" });
        const travelPart = res.travel > 0 ? ` · ${res.travel} ${C.min} ${C.withTravel}` : "";
        setResult({ tone: "ok", text: `${C.created}: ${ev.title ?? ""} · ${when}${travelPart}` });
        setText("");
        window.dispatchEvent(new CustomEvent("lalum:events-changed"));
      }
    } catch {
      setResult({ tone: "err", text: C.error });
    } finally {
      setBusy(false);
    }
  }, [text, C, dir]);

  if (!admin || !open) return null;

  return (
    <div
      role="dialog"
      aria-label={C.title}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) setOpen(false);
      }}
      style={{ position: "fixed", inset: 0, zIndex: 200, background: "rgba(20,15,10,.45)", display: "flex", alignItems: "flex-start", justifyContent: "center", paddingTop: "14vh" }}
    >
      <div dir={dir} style={{ width: "min(620px, 92vw)", background: "var(--card)", borderRadius: 18, boxShadow: "0 30px 80px -20px rgba(0,0,0,.5)", overflow: "hidden" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "16px 18px", borderBottom: "1px solid var(--line)" }}>
          <span style={{ color: "var(--clay)", display: "inline-flex" }}><Icon name="spark" size={20} /></span>
          <input
            autoFocus
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void submit();
            }}
            placeholder={C.placeholder}
            style={{ flex: 1, border: 0, outline: "none", background: "transparent", fontSize: 16, color: "var(--ink)" }}
          />
        </div>
        <div style={{ padding: "12px 18px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
          <span className="muted" style={{ fontSize: 12.5 }}>{busy ? C.scheduling : C.hint}</span>
          <button type="button" className="btn btn-clay btn-sm" onClick={() => void submit()} disabled={busy || !text.trim()}>
            <Icon name="calendar" size={15} /> {t.ui.schedule.title}
          </button>
        </div>
        {result && (
          <div className={`notice ${result.tone === "ok" ? "notice-ok" : "notice-err"}`} style={{ margin: "0 18px 18px" }}>{result.text}</div>
        )}
      </div>
    </div>
  );
}
