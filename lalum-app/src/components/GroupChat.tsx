import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { useAuth } from "../context/AuthContext";
import { useLang } from "../context/LangContext";
import { supabase } from "../lib/supabase";
import { Icon } from "./Icon";
import { bcp47For } from "../lib/hreflang";

// A single, shared, open chat room for everyone signed in to the portal
// (clients and the firm alike). This exists so the firm's WhatsApp group can
// move in here instead: every message is saved to lalum_group_chat_messages,
// so it can later be searched, exported, or analysed, which a WhatsApp
// thread cannot be. Polls rather than subscribing to Realtime, matching the
// rest of the portal's fetch-on-demand pattern.

type Row = { id: string; user_id: string; author_name: string; body: string; created_at: string };

const POLL_MS = 4000;
const MAX_LEN = 2000;

// Demo mode (no Supabase configured) keeps messages in memory only, for the
// same session/tab, so the room is still usable to try out, it just cannot
// save or share anything, unlike the real, persisted room.
let demoMessages: Row[] = [];

export function GroupChat() {
  const { user, demoMode } = useAuth();
  const { t, lang } = useLang();
  const G = t.ui.groupChat;
  const [rows, setRows] = useState<Row[]>(demoMode ? demoMessages : []);
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const lastIdRef = useRef<string | null>(null);

  const authorName = user?.email ?? G.someone;

  const load = useCallback(async () => {
    if (!supabase) return;
    const { data, error: err } = await supabase
      .from("lalum_group_chat_messages")
      .select("id,user_id,author_name,body,created_at")
      .order("created_at", { ascending: true })
      .limit(200);
    if (err) return; // Transient network hiccups should not spam the room with errors.
    setRows(data ?? []);
  }, []);

  useEffect(() => {
    if (demoMode) return;
    void load();
    const id = window.setInterval(load, POLL_MS);
    return () => window.clearInterval(id);
  }, [demoMode, load]);

  // Auto-scroll to the newest message, but only when a new one actually
  // arrived, so typing a reply does not get yanked to the bottom mid-keystroke.
  useEffect(() => {
    const last = rows[rows.length - 1]?.id ?? null;
    if (last && last !== lastIdRef.current) {
      lastIdRef.current = last;
      listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
    }
  }, [rows]);

  async function send(e: FormEvent) {
    e.preventDefault();
    const text = body.trim();
    if (!text || busy) return;
    setBusy(true);
    setError(null);
    if (!supabase) {
      const row: Row = { id: crypto.randomUUID(), user_id: "demo", author_name: authorName, body: text, created_at: new Date().toISOString() };
      demoMessages = [...demoMessages, row];
      setRows(demoMessages);
      setBody("");
      setBusy(false);
      return;
    }
    const { error: err } = await supabase.from("lalum_group_chat_messages").insert({
      user_id: user?.id,
      author_name: authorName,
      body: text,
    });
    if (err) {
      setError(G.sendErr);
    } else {
      setBody("");
      await load();
    }
    setBusy(false);
  }

  return (
    <div className="card" style={{ padding: 34, marginBottom: 28 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 6 }}>
        <span className="icon-badge"><Icon name="send" size={20} /></span>
        <h2 className="h3" style={{ fontSize: 22 }}>{G.title}</h2>
      </div>
      <p className="muted" style={{ fontSize: 14, lineHeight: 1.6, margin: "0 0 16px" }}>{G.intro}</p>

      {demoMode && <div className="notice notice-warn" style={{ marginBottom: 16 }}>{G.demo}</div>}

      <div
        ref={listRef}
        style={{ display: "flex", flexDirection: "column", gap: 10, maxHeight: 360, overflowY: "auto", border: "1px solid var(--line)", borderRadius: 12, padding: 14, marginBottom: 14, background: "var(--paper)" }}
      >
        {rows.length === 0 ? (
          <p className="muted" style={{ margin: 0, fontSize: 13.5 }}>{G.empty}</p>
        ) : (
          rows.map((m) => (
            <div key={m.id} style={{ border: "1px solid var(--line)", borderRadius: 10, padding: "8px 12px", background: "var(--card)" }}>
              <div style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap", marginBottom: 3 }}>
                <span style={{ fontWeight: 700, fontSize: 13 }} dir="ltr">{m.author_name}</span>
                <span className="muted" style={{ fontSize: 11 }} dir="ltr">
                  {new Date(m.created_at).toLocaleString(bcp47For(lang), { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit" })}
                </span>
              </div>
              <p style={{ margin: 0, whiteSpace: "pre-wrap", fontSize: 14.5 }}>{m.body}</p>
            </div>
          ))
        )}
      </div>

      <form onSubmit={(e) => void send(e)} style={{ display: "flex", gap: 10, alignItems: "flex-end" }}>
        <textarea
          className="field"
          rows={2}
          value={body}
          maxLength={MAX_LEN}
          onChange={(e) => setBody(e.target.value)}
          placeholder={G.placeholder}
          style={{ flex: 1, resize: "vertical" }}
        />
        <button type="submit" className="btn btn-clay" disabled={!body.trim() || busy} style={{ justifyContent: "center" }}>
          <Icon name="send" size={16} /> {busy ? G.sending : G.send}
        </button>
      </form>
      {error && <div className="notice notice-err" style={{ marginTop: 12 }}>{error}</div>}
    </div>
  );
}
