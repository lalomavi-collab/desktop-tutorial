import { useEffect, useRef, useState } from "react";
import {
  supabase, PRACTICE_AREAS, PRACTICE_AREA_LABELS, type Profile,
} from "../lib/supabase";
import Avatar from "./Avatar";
import type { RealtimeChannel } from "@supabase/supabase-js";

// "Discussions" — an open group chat, not a private DM: every signed-in user
// (attorney or client) reads and posts in every room. Rooms are the existing
// PRACTICE_AREAS taxonomy plus one general room, so this feature does not
// invent a second topic list alongside the one QA.tsx and Gigs.tsx already use.
const GENERAL_ROOM = "general";
const ROOMS: { key: string; label: string; icon: string }[] = [
  { key: GENERAL_ROOM, label: "כללי", icon: "💬" },
  ...PRACTICE_AREAS.map((a) => ({ key: a.key, label: a.label, icon: a.icon })),
];
function roomLabel(key: string): string {
  return key === GENERAL_ROOM ? "כללי" : (PRACTICE_AREA_LABELS[key] ?? key);
}

interface DiscussionAuthor {
  display_name: string | null;
  verification_status: string;
  avatar_url: string | null;
}
interface Message {
  id: string;
  room: string;
  author_id: string;
  body: string;
  created_at: string;
  author?: DiscussionAuthor | null;
}

const MSG_SELECT = "*, author:ldr_profiles!author_id(display_name,verification_status,avatar_url)";

function ago(iso: string): string {
  const s = Math.max(1, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return "עכשיו";
  const m = Math.floor(s / 60); if (m < 60) return `לפני ${m} ד׳`;
  const h = Math.floor(m / 60); if (h < 24) return `לפני ${h} ש׳`;
  const d = Math.floor(h / 24); return `לפני ${d} ימים`;
}

export default function Discussions({
  profile, notify,
}: { profile: Profile; notify: (m: string) => void }) {
  const [room, setRoom] = useState<string>(GENERAL_ROOM);
  const [messages, setMessages] = useState<Message[]>([]);
  const [authors, setAuthors] = useState<Record<string, DiscussionAuthor>>({});
  const [loading, setLoading] = useState(true);
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const channelRef = useRef<RealtimeChannel | null>(null);

  // Fetch missing author profiles (needed for messages that arrive over the
  // realtime channel, which delivers only the bare row, no embedded join).
  async function ensureAuthor(authorId: string) {
    if (authors[authorId] || authorId === profile.id) return;
    const { data } = await supabase.from("ldr_profiles")
      .select("display_name,verification_status,avatar_url").eq("id", authorId).maybeSingle();
    if (data) setAuthors((prev) => ({ ...prev, [authorId]: data as DiscussionAuthor }));
  }

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    (async () => {
      const { data, error } = await supabase.from("ldr_discussion_messages").select(MSG_SELECT)
        .eq("room", room).order("created_at", { ascending: true }).limit(150);
      if (cancelled) return;
      if (error) { notify("שגיאה בטעינת הדיון: " + error.message); setLoading(false); return; }
      const list = (data as Message[]) ?? [];
      setMessages(list);
      setAuthors((prev) => {
        const next = { ...prev };
        for (const m of list) if (m.author) next[m.author_id] = m.author;
        return next;
      });
      setLoading(false);
    })();

    // One realtime channel per room; switching rooms tears down the old one.
    const channel = supabase.channel(`discussion:${room}`)
      .on("postgres_changes", {
        event: "INSERT", schema: "public", table: "ldr_discussion_messages", filter: `room=eq.${room}`,
      }, (payload) => {
        const row = payload.new as Message;
        setMessages((prev) => (prev.some((m) => m.id === row.id) ? prev : [...prev, row]));
        void ensureAuthor(row.author_id);
      })
      .on("postgres_changes", {
        event: "DELETE", schema: "public", table: "ldr_discussion_messages", filter: `room=eq.${room}`,
      }, (payload) => {
        const old = payload.old as { id: string };
        setMessages((prev) => prev.filter((m) => m.id !== old.id));
      })
      .subscribe();
    channelRef.current = channel;

    return () => {
      cancelled = true;
      void supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages]);

  async function send() {
    const text = body.trim();
    if (!text || sending) return;
    setSending(true);
    const { data, error } = await supabase.from("ldr_discussion_messages")
      .insert({ room, author_id: profile.id, body: text }).select(MSG_SELECT).single();
    setSending(false);
    if (error) { notify("שגיאה בשליחה: " + error.message); return; }
    setBody("");
    const row = data as Message;
    setMessages((prev) => (prev.some((m) => m.id === row.id) ? prev : [...prev, row]));
  }

  async function remove(id: string) {
    const { error } = await supabase.from("ldr_discussion_messages").delete().eq("id", id);
    if (error) { notify("שגיאה במחיקה: " + error.message); return; }
    setMessages((prev) => prev.filter((m) => m.id !== id));
  }

  return (
    <div className="container animate-in" style={{ paddingTop: 26, maxWidth: 760 }}>
      <div className="section-header">
        <h2>💬 דיונים</h2>
      </div>
      <p className="muted" style={{ marginTop: -10, marginBottom: 14 }}>
        צ׳אט קבוצתי ופתוח, לפי נושא. כל מי שמחובר לרשת רואה וכותב כאן, בלי הודעות פרטיות.
      </p>

      <div className="chip-select" style={{ marginBottom: 14, overflowX: "auto", flexWrap: "nowrap", paddingBottom: 4 }}>
        {ROOMS.map((r) => (
          <button key={r.key} className={`chip${room === r.key ? " on" : ""}`}
            style={{ whiteSpace: "nowrap", flexShrink: 0 }}
            onClick={() => setRoom(r.key)}>
            {r.icon} {r.label}
          </button>
        ))}
      </div>

      <div className="card" style={{ display: "flex", flexDirection: "column", height: "56vh", minHeight: 360 }}>
        <div ref={scrollRef} style={{ flex: 1, overflowY: "auto", padding: 16 }}>
          {loading ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {[1, 2, 3].map((i) => (
                <div key={i} style={{ display: "flex", gap: 10 }}>
                  <div className="skeleton" style={{ width: 32, height: 32, borderRadius: "50%", flexShrink: 0 }} />
                  <div style={{ flex: 1 }}>
                    <div className="skeleton skeleton-line short" />
                    <div className="skeleton skeleton-line shorter" style={{ marginTop: 6 }} />
                  </div>
                </div>
              ))}
            </div>
          ) : messages.length === 0 ? (
            <div className="center" style={{ padding: "40px 10px" }}>
              <div style={{ fontSize: 36, marginBottom: 10 }}>{ROOMS.find((r) => r.key === room)?.icon ?? "💬"}</div>
              <p className="muted">אין עדיין הודעות בחדר {roomLabel(room)}. פתחו את הדיון.</p>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {messages.map((m) => {
                const isMine = m.author_id === profile.id;
                const author = isMine ? { display_name: profile.display_name, verification_status: profile.verification_status, avatar_url: profile.avatar_url } : (m.author ?? authors[m.author_id]);
                return (
                  <div key={m.id} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                    <Avatar name={author?.display_name ?? null} size={32}
                      verified={author?.verification_status === "verified"} url={author?.avatar_url ?? null} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
                        <b style={{ fontSize: 13 }}>{isMine ? "אתם" : (author?.display_name || "עו״ד")}</b>
                        {author?.verification_status === "verified" && (
                          <span className="tag tag-gold" style={{ fontSize: 9, padding: "1px 6px" }}>✓</span>
                        )}
                        <span className="muted" style={{ fontSize: 11 }}>{ago(m.created_at)}</span>
                        {isMine && (
                          <button className="link" style={{ fontSize: 11, marginInlineStart: "auto" }}
                            onClick={() => remove(m.id)} title="מחיקת ההודעה">מחיקה</button>
                        )}
                      </div>
                      <div style={{ lineHeight: 1.6, whiteSpace: "pre-wrap", fontSize: 14, marginTop: 2 }}>{m.body}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div style={{ display: "flex", gap: 8, padding: 12, borderTop: "1px solid var(--line)" }}>
          <textarea
            value={body} onChange={(e) => setBody(e.target.value)}
            placeholder={`כתבו לחדר ${roomLabel(room)}…`}
            style={{ flex: 1, minHeight: 40, maxHeight: 120, resize: "none" }}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
          />
          <button className="btn btn-gold" disabled={sending || !body.trim()} onClick={send} style={{ alignSelf: "flex-end" }}>
            {sending ? <span className="spinner" /> : "שליחה"}
          </button>
        </div>
      </div>
    </div>
  );
}
