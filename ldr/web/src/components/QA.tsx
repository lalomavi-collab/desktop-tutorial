import { useEffect, useState } from "react";
import {
  supabase, PRACTICE_AREAS, JURISDICTIONS, PRACTICE_AREA_LABELS, JURISDICTION_LABELS,
  type Profile,
} from "../lib/supabase";
import Avatar from "./Avatar";
import { useI18n } from "../i18n";

interface Question {
  id: string; author_id: string; title: string; body: string;
  practice_area: string | null; jurisdiction: string | null; created_at: string;
  author?: { display_name: string | null; verification_status: string } | null;
  answers?: { count: number }[];
}
interface Answer {
  id: string; author_id: string | null; body: string; created_at: string; is_ai?: boolean;
  author?: { display_name: string | null; verification_status: string } | null;
}

const Q_SELECT = "*, author:ldr_profiles!author_id(display_name,verification_status), answers:ldr_answers(count)";

export default function QA({
  profile, notify,
}: { profile: Profile; notify: (m: string) => void }) {
  const { t } = useI18n();
  const [qs, setQs] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<"list" | "ask">("list");
  const [open, setOpen] = useState<Question | null>(null);

  async function load() {
    setLoading(true);
    const { data } = await supabase.from("ldr_questions").select(Q_SELECT)
      .order("created_at", { ascending: false }).limit(80);
    setQs((data as Question[]) ?? []);
    setLoading(false);
  }
  useEffect(() => {
    load();
    // Let the AI answer any question left unanswered for 3+ hours, then refresh.
    supabase.functions.invoke("qa-ai-fallback").then(({ data }) => {
      if (data?.answered) load();
    }).catch(() => { /* best-effort */ });
  }, []);

  return (
    <div className="container animate-in" style={{ paddingTop: 26, maxWidth: 760 }}>
      <div className="section-header">
        <h2>❓ סיוע משפטי הדדי — שו״ת</h2>
        <button className="btn btn-gold" onClick={() => setView(view === "ask" ? "list" : "ask")}>
          {view === "ask" ? "← לרשימה" : "+ שאלה חדשה"}
        </button>
      </div>
      <p className="muted" style={{ marginTop: -10, marginBottom: 12 }}>שאלו את הקהילה — עו״ד בתחום עונים. 🤖 אם לא התקבל מענה תוך 3 שעות, עוזר ה-AI מציע פתרון ראשוני.</p>
      <div style={{ marginBottom: 18, padding: "10px 14px", borderRadius: 12, background: "rgba(192,57,43,0.08)", border: "1px solid rgba(224,122,111,0.35)", fontSize: 12, lineHeight: 1.6, color: "var(--cream-dim)" }}>
        {t("qa.disclaimer")}
      </div>

      {view === "ask" ? (
        <AskForm profile={profile} notify={notify} onDone={() => { setView("list"); load(); }} />
      ) : loading ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {[1,2,3,4].map((i) => (
            <div key={i} className="card pad">
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10, marginBottom: 8 }}>
                <div className="skeleton skeleton-line short" style={{ flex: 1 }} />
                <div className="skeleton" style={{ width: 60, height: 22, borderRadius: 6, flexShrink: 0 }} />
              </div>
              <div className="skeleton skeleton-line" />
              <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
                <div className="skeleton" style={{ width: 70, height: 22, borderRadius: 6 }} />
                <div className="skeleton" style={{ width: 55, height: 22, borderRadius: 6 }} />
              </div>
            </div>
          ))}
        </div>
      ) : qs.length === 0 ? (
        <div className="card pad center" style={{ padding: "40px 22px" }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>❓</div>
          <p className="muted">אין עדיין שאלות — היו הראשונים לשאול את הקהילה.</p>
          <button className="btn btn-gold" onClick={() => setView("ask")} style={{ marginTop: 12 }}>שאלה ראשונה</button>
        </div>
      ) : (
        <div className="stagger-children" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {qs.map((q) => {
            const ansCount = q.answers?.[0]?.count ?? 0;
            return (
              <div key={q.id} className="card pad card-interactive" style={{ cursor: "pointer" }} onClick={() => setOpen(q)}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "flex-start" }}>
                  <b style={{ fontSize: 15, lineHeight: 1.4 }}>{q.title}</b>
                  <span className={ansCount > 0 ? "tag tag-gold" : "tag"} style={{ fontSize: 11, whiteSpace: "nowrap", flexShrink: 0 }}>
                    {ansCount > 0 ? `✓ ${ansCount} תשובות` : "ללא תשובה"}
                  </span>
                </div>
                {q.body && <p className="muted" style={{ fontSize: 13, margin: "6px 0 0", maxHeight: 44, overflow: "hidden", lineHeight: 1.5 }}>{q.body}</p>}
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
                  {q.practice_area && <span className="chip" style={{ fontSize: 11 }}>{PRACTICE_AREA_LABELS[q.practice_area] ?? q.practice_area}</span>}
                  {q.jurisdiction && <span className="chip" style={{ fontSize: 11 }}>{JURISDICTION_LABELS[q.jurisdiction] ?? q.jurisdiction}</span>}
                  <span className="muted" style={{ fontSize: 12 }}>· {q.author?.display_name || "עו״ד"}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {open && <QuestionDetail q={open} profile={profile} notify={notify} onClose={() => { setOpen(null); load(); }} />}
    </div>
  );
}

function AskForm({
  profile, notify, onDone,
}: { profile: Profile; notify: (m: string) => void; onDone: () => void }) {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [area, setArea] = useState(profile.practice_areas?.[0] ?? "");
  const [juris, setJuris] = useState(profile.jurisdiction ?? "IL");
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!title.trim()) { notify("הוסיפו כותרת לשאלה"); return; }
    setBusy(true);
    const { error } = await supabase.from("ldr_questions").insert({
      author_id: profile.id, title: title.trim(), body: body.trim(),
      practice_area: area || null, jurisdiction: juris || null,
    });
    setBusy(false);
    if (error) { notify("שגיאה: " + error.message); return; }
    notify("השאלה פורסמה ❓"); onDone();
  }

  return (
    <div className="card pad animate-in" style={{ marginTop: 16 }}>
      <h3 style={{ marginTop: 0 }}>שאלה חדשה לקהילה</h3>
      <label>כותרת השאלה</label>
      <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="מה תרצו לשאול את הקהילה?" />
      <label>פירוט (אופציונלי)</label>
      <textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder="רקע, הקשר, מה ניסיתם…" />
      <div className="grid cols-2">
        <div>
          <label>תחום</label>
          <select value={area} onChange={(e) => setArea(e.target.value)}>
            <option value="">— ללא —</option>
            {PRACTICE_AREAS.map((a) => <option key={a.key} value={a.key}>{a.label}</option>)}
          </select>
        </div>
        <div>
          <label>מדינה</label>
          <select value={juris} onChange={(e) => setJuris(e.target.value)}>
            <option value="">— ללא —</option>
            {JURISDICTIONS.map((j) => <option key={j.key} value={j.key}>{j.flag} {j.label}</option>)}
          </select>
        </div>
      </div>
      <button className="btn btn-gold" style={{ width: "100%", marginTop: 16 }} disabled={busy || !title.trim()} onClick={submit}>
        {busy ? <span className="spinner" /> : "פרסום השאלה"}
      </button>
    </div>
  );
}

function QuestionDetail({
  q, profile, notify, onClose,
}: { q: Question; profile: Profile; notify: (m: string) => void; onClose: () => void }) {
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);

  async function load() {
    const { data } = await supabase.from("ldr_answers")
      .select("*, author:ldr_profiles!author_id(display_name,verification_status)")
      .eq("question_id", q.id).order("created_at", { ascending: true });
    setAnswers((data as Answer[]) ?? []);
  }
  useEffect(() => { load(); }, []);

  async function answer() {
    if (!body.trim()) return;
    setBusy(true);
    const { error } = await supabase.from("ldr_answers")
      .insert({ question_id: q.id, author_id: profile.id, body: body.trim() });
    setBusy(false);
    if (error) { notify("שגיאה: " + error.message); return; }
    setBody(""); notify("התשובה נוספה 🙏"); load();
  }

  return (
    <div onClick={onClose} className="modal-backdrop">
      <div className="modal-box" onClick={(e) => e.stopPropagation()}
        style={{ maxHeight: "90vh", overflow: "auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", gap: 10 }}>
          <h3 style={{ margin: 0, lineHeight: 1.4 }}>{q.title}</h3>
          <button className="btn btn-ghost" onClick={onClose}>✕</button>
        </div>
        {q.body && <p style={{ lineHeight: 1.7, marginTop: 10 }}>{q.body}</p>}
        <div className="chip-select" style={{ marginTop: 8 }}>
          {q.practice_area && <span className="chip">{PRACTICE_AREA_LABELS[q.practice_area] ?? q.practice_area}</span>}
          {q.jurisdiction && <span className="chip">{JURISDICTION_LABELS[q.jurisdiction] ?? q.jurisdiction}</span>}
        </div>

        <div className="divider" />
        <h4 style={{ margin: "0 0 10px" }}>{answers.length} תשובות</h4>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {answers.map((a) => (
            a.is_ai ? (
              <div key={a.id} className="card pad" style={{ background: "rgba(217,119,87,0.10)", border: "1px solid rgba(217,119,87,0.35)", borderRadius: 12 }}>
                <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 8 }}>
                  <span style={{ fontSize: 18 }}>🤖</span>
                  <b style={{ fontSize: 13, color: "var(--gold)" }}>עוזר ה-AI של LAWdin</b>
                  <span className="tag" style={{ fontSize: 10 }}>מענה אוטומטי</span>
                </div>
                <div style={{ lineHeight: 1.75, whiteSpace: "pre-wrap", fontSize: 14 }}>{a.body}</div>
              </div>
            ) : (
              <div key={a.id} className="card pad" style={{ background: "var(--obsidian-3)", borderRadius: 12 }}>
                <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 8 }}>
                  <Avatar name={a.author?.display_name ?? null} size={32} verified={a.author?.verification_status === "verified"} />
                  <b style={{ fontSize: 13 }}>{a.author?.display_name || "עו״ד"}</b>
                </div>
                <div style={{ lineHeight: 1.75, whiteSpace: "pre-wrap", fontSize: 14 }}>{a.body}</div>
              </div>
            )
          ))}
          {answers.length === 0 && (
            <p className="muted" style={{ fontSize: 13, textAlign: "center" }}>היו הראשונים לענות לשאלה זו.</p>
          )}
        </div>

        <div className="divider" />
        <textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder="כתבו תשובה לעמית…" style={{ minHeight: 80 }} />
        <button className="btn btn-gold" style={{ width: "100%", marginTop: 10 }} disabled={busy || !body.trim()} onClick={answer}>
          {busy ? <span className="spinner" /> : "🙏 פרסום תשובה"}
        </button>
      </div>
    </div>
  );
}
