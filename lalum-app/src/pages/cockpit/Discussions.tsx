import { useCallback, useEffect, useState } from "react";
import { CockpitFrame } from "./CockpitFrame";
import { supabase } from "../../lib/supabase";
import { Icon } from "../../components/Icon";
import { topicBySlug } from "../../lib/topics";
import { bcp47For } from "../../lib/hreflang";
import { useLang } from "../../context/LangContext";

// Public-discussions review, moved out of the client portal into the cockpit.
// Questions asked from the real-estate and AI pillar pages sit here as
// 'pending', invisible on the site until answered, so this is the gate that
// public content passes through. It is firm management work, not a client
// surface. Data loading and the answer/reject handlers are unchanged from
// their former home in the portal; the screen now fetches its own rows.

type DiscussionRow = {
  id: string;
  topic: string;
  question: string;
  asker_name: string | null;
  asker_email: string | null;
  status: "pending" | "answered" | "rejected";
  reply: string | null;
  answered_at: string | null;
  created_at: string;
};

function DiscussionsInner({ canModerate }: { canModerate: boolean }) {
  const { lang } = useLang();
  const [discussions, setDiscussions] = useState<DiscussionRow[] | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<Record<string, "send" | "reject" | undefined>>({});

  const load = useCallback(async () => {
    if (!supabase) return;
    const { data } = await supabase.from("lalum_discussions").select("*").order("created_at", { ascending: false }).limit(150);
    setDiscussions((data as DiscussionRow[] | null) ?? []);
  }, []);
  useEffect(() => { void load(); }, [load]);

  async function replyDiscussion(id: string) {
    if (!supabase) return;
    const text = (drafts[id] ?? "").trim();
    if (!text) return;
    setBusy((b) => ({ ...b, [id]: "send" }));
    try {
      const { error } = await supabase.from("lalum_discussions")
        .update({ reply: text, status: "answered", answered_at: new Date().toISOString() }).eq("id", id);
      if (error) throw error;
      setDiscussions((rows) => (rows ?? []).map((r) => (r.id === id ? { ...r, reply: text, status: "answered", answered_at: new Date().toISOString() } : r)));
      setDrafts((d) => { const n = { ...d }; delete n[id]; return n; });
    } catch (err) {
      window.alert(err instanceof Error ? err.message : "הפרסום נכשל");
    } finally {
      setBusy((b) => ({ ...b, [id]: undefined }));
    }
  }

  async function rejectDiscussion(id: string) {
    if (!supabase) return;
    setBusy((b) => ({ ...b, [id]: "reject" }));
    try {
      const { error } = await supabase.from("lalum_discussions").update({ status: "rejected" }).eq("id", id);
      if (error) throw error;
      setDiscussions((rows) => (rows ?? []).map((r) => (r.id === id ? { ...r, status: "rejected" } : r)));
    } catch (err) {
      window.alert(err instanceof Error ? err.message : "הפעולה נכשלה");
    } finally {
      setBusy((b) => ({ ...b, [id]: undefined }));
    }
  }

  if (!canModerate) return <div className="ck-card"><div className="ck-title">אין הרשאה</div><div className="ck-meta">אישור דיונים ציבוריים פתוח למנהל המשרד.</div></div>;
  if (discussions === null) return <div className="ck-meta">טוען...</div>;

  const pending = discussions.filter((d) => d.status === "pending").length;
  const visible = discussions.filter((d) => d.status !== "rejected");

  return (
    <div className="card" style={{ padding: 34, marginBottom: 28, borderColor: "var(--clay)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10 }}>
        <span className="icon-badge"><Icon name="quote" size={20} /></span>
        <h2 className="h3" style={{ fontSize: 22 }}>דיונים ציבוריים</h2>
        {pending > 0 && (
          <span style={{ fontSize: 11, fontWeight: 700, color: "var(--paper)", background: "var(--clay)", borderRadius: 9999, padding: "2px 9px" }}>
            {pending} ממתינות
          </span>
        )}
      </div>
      <p className="muted" style={{ fontSize: 15, lineHeight: 1.6, margin: "0 0 20px" }}>
        שאלות מהפאנל הציבורי בעמודי הנדל״ן וה-AI. שאלה מתפרסמת רק אחרי שנענתה כאן.
      </p>
      {visible.length === 0 ? (
        <p className="muted" style={{ fontSize: 14 }}>אין שאלות עדיין.</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {visible.map((d) => {
            const b = busy[d.id];
            const isPending = d.status === "pending";
            return (
              <div key={d.id} style={{ border: "1px solid var(--line)", borderRadius: 12, padding: 16 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 8 }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: "var(--clay)", textTransform: "uppercase", letterSpacing: ".06em" }}>
                    {topicBySlug.get(d.topic)?.name ?? d.topic}
                  </span>
                  {isPending
                    ? <span style={{ fontSize: 11, fontWeight: 700, color: "var(--paper)", background: "var(--clay)", borderRadius: 9999, padding: "2px 9px" }}>ממתינה</span>
                    : <span style={{ fontSize: 11, fontWeight: 700, color: "#2c6444" }}>פורסמה ✓</span>}
                  {(d.asker_name || d.asker_email) && (
                    <span className="muted" style={{ fontSize: 12 }} dir="ltr">{d.asker_name}{d.asker_name && d.asker_email ? " · " : ""}{d.asker_email}</span>
                  )}
                  <span className="muted" style={{ fontSize: 12, marginInlineStart: "auto" }}>{new Date(d.created_at).toLocaleDateString(bcp47For(lang))}</span>
                </div>
                <p style={{ margin: "0 0 12px", whiteSpace: "pre-wrap", fontSize: 14.5 }}>{d.question}</p>
                {isPending ? (
                  <>
                    <textarea className="field" rows={3} value={drafts[d.id] ?? ""}
                      onChange={(e) => setDrafts((dr) => ({ ...dr, [d.id]: e.target.value }))}
                      placeholder="כתבו תשובה לפרסום…" style={{ resize: "vertical", marginBottom: 10 }} />
                    <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                      <button type="button" className="btn btn-clay btn-sm" disabled={!!b || !(drafts[d.id] ?? "").trim()} onClick={() => void replyDiscussion(d.id)}>
                        <Icon name="send" size={15} /> {b === "send" ? "מפרסם…" : "פרסום תשובה"}
                      </button>
                      <button type="button" className="btn btn-ghost btn-sm" disabled={!!b} onClick={() => void rejectDiscussion(d.id)} style={{ color: "var(--clay)" }}>
                        {b === "reject" ? "…" : "דחייה, ללא פרסום"}
                      </button>
                    </div>
                  </>
                ) : (
                  <div style={{ borderInlineStart: "3px solid var(--clay)", paddingInlineStart: 12 }}>
                    <div className="label" style={{ color: "var(--clay)", fontSize: 11 }}>התשובה שפורסמה</div>
                    <p style={{ margin: "4px 0 0", whiteSpace: "pre-wrap", fontSize: 14 }}>{d.reply}</p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/** Public-discussions review queue, framed for the cockpit. */
export function Discussions() {
  return (
    <CockpitFrame title="דיונים ציבוריים" description="אישור שאלות מהפאנל הציבורי בעמודי הנדל״ן וה-AI לפני שהן מתפרסמות באתר." path="/workspace/discussions">
      {({ member, platformAdmin }) => <DiscussionsInner canModerate={platformAdmin || member?.role === "ADMIN"} />}
    </CockpitFrame>
  );
}
