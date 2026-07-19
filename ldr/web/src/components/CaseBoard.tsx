import { useEffect, useState } from "react";
import { supabase, PRACTICE_AREAS, PRACTICE_AREA_LABELS, JURISDICTIONS, JURISDICTION_LABELS, type Profile } from "../lib/supabase";

// ── Direct client→attorney case requests (no middleman, no fee). ──
// Clients post a case; attorneys browse open cases and respond. The poster sees
// the responses; an attorney sees only their own response (enforced by RLS).

interface CaseRow {
  id: string; created_at: string; poster_id: string;
  title: string; description: string | null; practice_area: string | null;
  jurisdiction: string | null; city: string | null; budget_note: string | null;
  urgency: string; status: string;
  poster?: { display_name: string | null };
  responses?: { count: number }[];
}
interface Resp { id: string; attorney_id: string; message: string | null; quoted_rate: number | null; created_at: string; attorney?: { display_name: string | null }; }

export default function CaseBoard({ profile, notify }: { profile: Profile; notify: (m: string) => void }) {
  const isClient = profile.role === "client";
  const [rows, setRows] = useState<CaseRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<"browse" | "new" | "mine">(isClient ? "mine" : "browse");
  const [open, setOpen] = useState<CaseRow | null>(null);

  async function load() {
    setLoading(true);
    const { data } = await supabase.from("ldr_case_requests")
      .select("*, poster:ldr_profiles!poster_id(display_name), responses:ldr_case_responses(count)")
      .order("created_at", { ascending: false }).limit(100);
    setRows((data as any[]) ?? []);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  const mine = rows.filter((r) => r.poster_id === profile.id);
  const browse = rows.filter((r) => r.status === "open" && r.poster_id !== profile.id);
  const shown = view === "mine" ? mine : browse;

  return (
    <div className="container animate-in" style={{ paddingTop: 26 }}>
      <div className="section-header">
        <h2>📩 תיקים ישירות מלקוחות</h2>
        <div style={{ display: "flex", gap: 8 }}>
          {!isClient && <button className={`btn ${view === "browse" ? "btn-gold" : "btn-ghost"}`} onClick={() => { setView("browse"); setOpen(null); }}>תיקים פתוחים</button>}
          <button className={`btn ${view === "mine" ? "btn-gold" : "btn-ghost"}`} onClick={() => { setView("mine"); setOpen(null); }}>הבקשות שלי</button>
          <button className="btn btn-gold" onClick={() => setView("new")}>+ פרסום תיק</button>
        </div>
      </div>
      <p className="muted" style={{ marginTop: -10, marginBottom: 18 }}>
        לקוחות מפרסמים תיק; עורכי דין מגיבים ישירות. בלי מתווכים, בלי עמלות.
      </p>

      {view === "new" ? (
        <NewCaseRequest profile={profile} notify={notify} onDone={() => { setView("mine"); load(); }} />
      ) : open ? (
        <CaseDetail row={open} profile={profile} notify={notify} onBack={() => { setOpen(null); load(); }} />
      ) : loading ? (
        <div className="center" style={{ paddingTop: 40 }}><span className="spinner" /></div>
      ) : shown.length === 0 ? (
        <div className="card pad center" style={{ color: "var(--cream-dim)" }}>
          {view === "mine" ? "עוד לא פרסמתם תיק. לחצו על \"פרסום תיק\"." : "אין כרגע תיקים פתוחים בתחומכם."}
        </div>
      ) : (
        <div className="grid cols-2">
          {shown.map((r) => (
            <div key={r.id} className="card pad card-interactive" style={{ cursor: "pointer" }} onClick={() => setOpen(r)}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                <strong style={{ fontSize: 15 }}>{r.title}</strong>
                {r.urgency === "urgent" && <span className="tag" style={{ color: "var(--burgundy-soft)" }}>דחוף</span>}
              </div>
              <div className="muted" style={{ fontSize: 12, margin: "6px 0" }}>
                {PRACTICE_AREA_LABELS[r.practice_area ?? ""] ?? ""} · {JURISDICTION_LABELS[r.jurisdiction ?? "IL"] ?? r.jurisdiction}{r.city ? ` · ${r.city}` : ""}
              </div>
              {r.description && <p style={{ fontSize: 13, color: "var(--cream-dim)", margin: "6px 0", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{r.description}</p>}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 8, borderTop: "1px solid var(--line)", paddingTop: 8 }}>
                <span className="muted" style={{ fontSize: 12 }}>{r.budget_note || "תקציב בתיאום"}</span>
                <span className="muted" style={{ fontSize: 12 }}>{(r.responses?.[0]?.count ?? 0)} הצעות</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function NewCaseRequest({ profile, notify, onDone }: { profile: Profile; notify: (m: string) => void; onDone: () => void }) {
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [area, setArea] = useState(PRACTICE_AREAS[0].key);
  const [jur, setJur] = useState("IL");
  const [city, setCity] = useState("");
  const [budget, setBudget] = useState("");
  const [urgent, setUrgent] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) { notify("יש להזין כותרת"); return; }
    setBusy(true);
    const { error } = await supabase.from("ldr_case_requests").insert({
      poster_id: profile.id, title: title.trim(), description: desc.trim() || null,
      practice_area: area, jurisdiction: jur, city: city.trim() || null,
      budget_note: budget.trim() || null, urgency: urgent ? "urgent" : "normal",
    });
    setBusy(false);
    if (error) { notify("שגיאה: " + error.message); return; }
    notify("התיק פורסם ✓ עורכי דין יוכלו להגיב");
    onDone();
  }

  return (
    <form className="card pad" onSubmit={submit} style={{ maxWidth: 620 }}>
      <label>כותרת התיק</label>
      <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="למשל: ליווי בעסקת מכר דירה בתל אביב" />
      <label style={{ marginTop: 12 }}>תחום</label>
      <select value={area} onChange={(e) => setArea(e.target.value)}>
        {PRACTICE_AREAS.map((a) => <option key={a.key} value={a.key}>{a.icon} {a.label}</option>)}
      </select>
      <div className="grid cols-2" style={{ marginTop: 12 }}>
        <div>
          <label>תחום שיפוט</label>
          <select value={jur} onChange={(e) => setJur(e.target.value)}>
            {JURISDICTIONS.map((j) => <option key={j.key} value={j.key}>{j.flag} {j.label}</option>)}
          </select>
        </div>
        <div>
          <label>עיר</label>
          <input value={city} onChange={(e) => setCity(e.target.value)} placeholder="תל אביב" />
        </div>
      </div>
      <label style={{ marginTop: 12 }}>תיאור</label>
      <textarea value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="תארו את התיק והצורך המשפטי..." />
      <label style={{ marginTop: 12 }}>תקציב (אופציונלי)</label>
      <input value={budget} onChange={(e) => setBudget(e.target.value)} placeholder="למשל: עד ₪5,000 / בתיאום" />
      <label style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 14, cursor: "pointer" }}>
        <input type="checkbox" checked={urgent} onChange={(e) => setUrgent(e.target.checked)} style={{ width: 16, height: 16, accentColor: "var(--gold)" }} /> דחוף
      </label>
      <button className="btn btn-gold" style={{ width: "100%", marginTop: 16 }} disabled={busy}>
        {busy ? <span className="spinner" /> : "פרסום התיק"}
      </button>
    </form>
  );
}

function CaseDetail({ row, profile, notify, onBack }: { row: CaseRow; profile: Profile; notify: (m: string) => void; onBack: () => void }) {
  const isPoster = row.poster_id === profile.id;
  const [resps, setResps] = useState<Resp[]>([]);
  const [msg, setMsg] = useState("");
  const [rate, setRate] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  async function load() {
    const { data } = await supabase.from("ldr_case_responses")
      .select("*, attorney:ldr_profiles!attorney_id(display_name)")
      .eq("case_id", row.id).order("created_at", { ascending: false });
    const list = (data as any[]) ?? [];
    setResps(list);
    setSent(list.some((r) => r.attorney_id === profile.id));
  }
  useEffect(() => { load(); }, []);

  async function respond(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.from("ldr_case_responses").insert({
      case_id: row.id, attorney_id: profile.id, message: msg.trim() || null,
      quoted_rate: rate ? parseInt(rate, 10) : null,
    });
    setBusy(false);
    if (error) { notify(error.message.includes("duplicate") ? "כבר הגבת לתיק זה" : "שגיאה: " + error.message); return; }
    notify("ההצעה נשלחה ללקוח ✓"); setMsg(""); setRate(""); load();
  }

  return (
    <div className="card pad" style={{ maxWidth: 680 }}>
      <button className="btn btn-ghost" onClick={onBack} style={{ marginBottom: 12 }}>← חזרה</button>
      <h3 style={{ margin: 0 }}>{row.title}</h3>
      <div className="muted" style={{ fontSize: 13, margin: "6px 0 12px" }}>
        {PRACTICE_AREA_LABELS[row.practice_area ?? ""] ?? ""} · {JURISDICTION_LABELS[row.jurisdiction ?? "IL"] ?? row.jurisdiction}{row.city ? ` · ${row.city}` : ""} · {row.budget_note || "תקציב בתיאום"}
      </div>
      {row.description && <p style={{ lineHeight: 1.7 }}>{row.description}</p>}

      {isPoster ? (
        <>
          <h4 style={{ marginTop: 18 }}>הצעות שהתקבלו ({resps.length})</h4>
          {resps.length === 0 ? <p className="muted">עדיין אין הצעות. עורכי דין יוכלו להגיב.</p> : resps.map((r) => (
            <div key={r.id} className="card pad" style={{ marginTop: 10 }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <strong>{r.attorney?.display_name ?? "עו״ד"}</strong>
                {r.quoted_rate != null && <span className="tag">₪{r.quoted_rate}/שעה</span>}
              </div>
              {r.message && <p style={{ fontSize: 13, margin: "6px 0 0", color: "var(--cream-dim)" }}>{r.message}</p>}
            </div>
          ))}
        </>
      ) : sent ? (
        <p className="muted" style={{ marginTop: 16 }}>✓ הגשת הצעה לתיק זה. הלקוח יראה אותה.</p>
      ) : (
        <form onSubmit={respond} style={{ marginTop: 16 }}>
          <h4 style={{ marginTop: 0 }}>הגשת הצעה ללקוח</h4>
          <label>הודעה</label>
          <textarea value={msg} onChange={(e) => setMsg(e.target.value)} placeholder="הציגו את עצמכם ואת הגישה לתיק..." />
          <label style={{ marginTop: 12 }}>תעריף מוצע לשעה (₪, אופציונלי)</label>
          <input inputMode="numeric" value={rate} onChange={(e) => setRate(e.target.value.replace(/[^\d]/g, ""))} placeholder="450" />
          <button className="btn btn-gold" style={{ width: "100%", marginTop: 14 }} disabled={busy}>
            {busy ? <span className="spinner" /> : "שליחת הצעה"}
          </button>
        </form>
      )}
    </div>
  );
}
