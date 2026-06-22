import { useEffect, useState } from "react";
import {
  supabase, PRACTICE_AREAS, JURISDICTIONS, PRACTICE_AREA_LABELS, JURISDICTION_LABELS,
  type Profile,
} from "../lib/supabase";
import Avatar from "./Avatar";

interface Question {
  id: string; author_id: string; title: string; body: string;
  practice_area: string | null; jurisdiction: string | null; created_at: string;
  author?: { display_name: string | null; verification_status: string } | null;
  answers?: { count: number }[];
}
interface Answer {
  id: string; author_id: string; body: string; created_at: string;
  author?: { display_name: string | null; verification_status: string } | null;
}

const Q_SELECT = "*, author:ldr_profiles!author_id(display_name,verification_status), answers:ldr_answers(count)";

export default function QA({
  profile, notify,
}: { profile: Profile; notify: (m: string) => void }) {
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
  useEffect(() => { load(); }, []);

  return (
    <div className="container" style={{ paddingTop: 26, maxWidth: 760 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h2 style={{ margin: 0 }}>סיוע משפטי הדדי — שו״ת</h2>
        <button className="btn btn-gold" onClick={() => setView(view === "ask" ? "list" : "ask")}>
          {view === "ask" ? "← לרשימה" : "+ שאלה חדשה"}
        </button>
      </div>
      <p className="muted">שאלו את הקהילה — וענו לעמיתים. ידע משפטי משותף, חוצה תחומים ומדינות.</p>

      {view === "ask" ? (
        <AskForm profile={profile} notify={notify} onDone={() => { setView("list"); load(); }} />
      ) : loading ? (
        <div className="center" style={{ padding: 50 }}><span className="spinner" /></div>
      ) : qs.length === 0 ? (
        <div className="card pad center">
          <p className="muted">אין עדיין שאלות — היו הראשונים לשאול את הקהילה.</p>
          <button className="btn btn-gold" onClick={() => setView("ask")}>שאלה ראשונה</button>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {qs.map((q) => (
            <div key={q.id} className="card pad" style={{ cursor: "pointer" }} onClick={() => setOpen(q)}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                <b style={{ fontSize: 16 }}>{q.title}</b>
                <span className="tag" style={{ fontSize: 11, whiteSpace: "nowrap" }}>{q.answers?.[0]?.count ?? 0} תשובות</span>
              </div>
              {q.body && <p className="muted" style={{ fontSize: 13, margin: "6px 0 0", maxHeight: 44, overflow: "hidden" }}>{q.body}</p>}
              <div className="chip-select" style={{ marginTop: 8 }}>
                {q.practice_area && <span className="chip">{PRACTICE_AREA_LABELS[q.practice_area] ?? q.practice_area}</span>}
                {q.jurisdiction && <span className="chip">{JURISDICTION_LABELS[q.jurisdiction] ?? q.jurisdiction}</span>}
                <span className="muted" style={{ fontSize: 12, alignSelf: "center" }}>· {q.author?.display_name || "עו״ד"}</span>
              </div>
            </div>
          ))}
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
    <div className="card pad" style={{ marginTop: 16 }}>
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
    <div onClick={onClose} style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,.6)", zIndex: 40,
      display: "grid", placeItems: "center", padding: 16,
    }}>
      <div className="card pad" onClick={(e) => e.stopPropagation()}
        style={{ width: "min(640px, 96vw)", maxHeight: "90vh", overflow: "auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", gap: 10 }}>
          <h3 style={{ margin: 0 }}>{q.title}</h3>
          <button className="btn btn-ghost" onClick={onClose}>✕</button>
        </div>
        {q.body && <p style={{ lineHeight: 1.7 }}>{q.body}</p>}
        <div className="chip-select">
          {q.practice_area && <span className="chip">{PRACTICE_AREA_LABELS[q.practice_area] ?? q.practice_area}</span>}
          {q.jurisdiction && <span className="chip">{JURISDICTION_LABELS[q.jurisdiction] ?? q.jurisdiction}</span>}
        </div>

        <div className="divider" />
        <h4 style={{ margin: "0 0 8px" }}>{answers.length} תשובות</h4>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {answers.map((a) => (
            <div key={a.id} className="card pad" style={{ background: "var(--obsidian-3)" }}>
              <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 6 }}>
                <Avatar name={a.author?.display_name ?? null} size={32} verified={a.author?.verification_status === "verified"} />
                <b style={{ fontSize: 13 }}>{a.author?.display_name || "עו״ד"}</b>
              </div>
              <div style={{ lineHeight: 1.7, whiteSpace: "pre-wrap" }}>{a.body}</div>
            </div>
          ))}
        </div>

        <div className="divider" />
        <textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder="כתבו תשובה לעמית…" style={{ minHeight: 80 }} />
        <button className="btn btn-gold" style={{ width: "100%", marginTop: 10 }} disabled={busy || !body.trim()} onClick={answer}>
          {busy ? <span className="spinner" /> : "פרסום תשובה"}
        </button>
      </div>
    </div>
  );
}
