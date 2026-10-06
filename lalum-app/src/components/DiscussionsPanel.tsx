import { useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabase";
import { Icon } from "./Icon";
import { useDialogA11y } from "../lib/useDialogA11y";

// "Discussions" (דיונים): a moderated public Q&A, not an open forum. A visitor
// picks one of the two areas the practice leads with, reads the questions
// Dr. Lalum has already answered, and may ask a new one. A submitted question
// is never shown to anyone, including its own asker, until it has been
// reviewed and answered from the LALUM portal (see Portal.tsx's "דיונים
// ציבוריים" section). That is the one requirement the feature exists to
// meet: nothing goes up without approval and a reply.
//
// Scoped to the two lead topics only (see lib/topics.ts): this is not a third
// place for the site's other subjects, and it is not a general chat.
export type DiscussionTopic = "real-estate" | "ai-governance";

const TOPIC_TABS: { key: DiscussionTopic; label: string }[] = [
  { key: "real-estate", label: "נדל\"ן והתחדשות עירונית" },
  { key: "ai-governance", label: "בינה מלאכותית" },
];

type Row = { id: string; question: string; reply: string; answered_at: string | null };

function fmtDate(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("he-IL", { day: "numeric", month: "short", year: "numeric" });
}

// The trigger: a plain inline button the pillar page renders. Nothing about
// this feature lives in the header, the footer nav, or the bottom tab bar:
// it opens a panel on click and closes back into the page, not a new route.
export function DiscussionsTrigger({ topic }: { topic: DiscussionTopic }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className="btn btn-ghost" onClick={() => setOpen(true)}>
        <Icon name="quote" size={17} /> דיונים בתחום זה
      </button>
      {open && <DiscussionsPanel initialTopic={topic} onClose={() => setOpen(false)} />}
    </>
  );
}

function DiscussionsPanel({ initialTopic, onClose }: { initialTopic: DiscussionTopic; onClose: () => void }) {
  const [topic, setTopic] = useState<DiscussionTopic>(initialTopic);
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [asking, setAsking] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [question, setQuestion] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [err, setErr] = useState("");
  const modalRef = useRef<HTMLDivElement>(null);
  useDialogA11y(true, onClose, modalRef);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    (async () => {
      if (!supabase) { setRows([]); setLoading(false); return; }
      const { data } = await supabase.from("lalum_discussions")
        .select("id,question,reply,answered_at")
        .eq("topic", topic).eq("status", "answered")
        .order("answered_at", { ascending: false }).limit(50);
      if (cancelled) return;
      setRows((data as Row[]) ?? []);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [topic]);

  async function submit() {
    const text = question.trim();
    if (!text || busy) return;
    setBusy(true);
    setErr("");
    try {
      if (supabase) {
        const { error } = await supabase.functions.invoke("lalum-discussion-submit", {
          body: { topic, question: text, name: name.trim() || undefined, email: email.trim() || undefined },
        });
        if (error) throw error;
      } else {
        await new Promise((r) => setTimeout(r, 400));
      }
      setSent(true);
      setQuestion("");
      setAsking(false);
    } catch {
      setErr("השליחה נכשלה, נסו שוב בעוד רגע.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="cookie-overlay" role="dialog" aria-modal="true" aria-label="דיונים" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div dir="rtl" className="cookie-modal discussions-modal" ref={modalRef} style={{ maxWidth: 560, width: "100%", maxHeight: "min(80vh, 640px)", display: "flex", flexDirection: "column" }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, marginBottom: 4 }}>
          <div>
            <h2 className="h3" style={{ fontSize: 22, margin: 0 }}>💬 דיונים</h2>
            <p className="muted" style={{ fontSize: 13, margin: "4px 0 0" }}>שאלות שנענו על ידי ד״ר עו״ד אברהם ללום. שאלה חדשה מתפרסמת רק לאחר מענה.</p>
          </div>
          <button type="button" className="btn btn-ghost btn-sm" onClick={onClose} aria-label="סגירה"><Icon name="x" size={16} /></button>
        </div>

        <div style={{ display: "flex", gap: 8, margin: "14px 0", flexWrap: "wrap" }}>
          {TOPIC_TABS.map((tb) => (
            <button
              key={tb.key} type="button"
              className={"btn btn-sm " + (topic === tb.key ? "btn-clay" : "btn-ghost")}
              onClick={() => { setTopic(tb.key); setAsking(false); setSent(false); }}
            >
              {tb.label}
            </button>
          ))}
        </div>

        <div style={{ overflowY: "auto", flex: 1, paddingInlineEnd: 4 }}>
          {loading ? (
            <p className="muted" style={{ fontSize: 14 }}>טוען…</p>
          ) : rows.length === 0 ? (
            <p className="muted" style={{ fontSize: 14 }}>עדיין אין דיונים פתוחים בתחום זה. היו הראשונים לשאול.</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {rows.map((r) => (
                <div key={r.id} style={{ border: "1px solid var(--line)", borderRadius: 12, padding: 16 }}>
                  <p style={{ margin: "0 0 10px", fontWeight: 600, fontSize: 14.5 }}>{r.question}</p>
                  <div style={{ borderInlineStart: "3px solid var(--clay)", paddingInlineStart: 12 }}>
                    <div className="label" style={{ color: "var(--clay)", fontSize: 11 }}>תשובת ד״ר ללום</div>
                    <p style={{ margin: "4px 0 0", whiteSpace: "pre-wrap", fontSize: 14 }}>{r.reply}</p>
                  </div>
                  {r.answered_at && <div className="muted" style={{ fontSize: 11, marginTop: 8 }}>{fmtDate(r.answered_at)}</div>}
                </div>
              ))}
            </div>
          )}
        </div>

        <div style={{ borderTop: "1px solid var(--line)", paddingTop: 14, marginTop: 14 }}>
          {sent ? (
            <div className="notice notice-ok">השאלה התקבלה. היא תפורסם כאן לאחר מענה.</div>
          ) : asking ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <textarea className="field" rows={3} value={question} onChange={(e) => setQuestion(e.target.value)}
                placeholder="מה השאלה שלכם?" style={{ resize: "vertical" }} maxLength={1500} />
              <div className="grid grid-2" style={{ gap: 10 }}>
                <input className="field" value={name} onChange={(e) => setName(e.target.value)} placeholder="שם (לא חובה)" />
                <input className="field" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="אימייל, לעדכון כשתיענה (לא חובה)" dir="ltr" />
              </div>
              {err && <div className="notice notice-err">{err}</div>}
              <div style={{ display: "flex", gap: 10 }}>
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => setAsking(false)}>ביטול</button>
                <button type="button" className="btn btn-clay" disabled={!question.trim() || busy} onClick={submit} style={{ flex: 1, justifyContent: "center" }}>
                  {busy ? "שולח…" : "שליחת השאלה"}
                </button>
              </div>
            </div>
          ) : (
            <button type="button" className="btn btn-clay" onClick={() => setAsking(true)} style={{ width: "100%", justifyContent: "center" }}>
              לשאול שאלה בתחום זה
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
