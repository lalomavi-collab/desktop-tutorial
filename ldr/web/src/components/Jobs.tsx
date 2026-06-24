import { useEffect, useState } from "react";
import { supabase, type Profile } from "../lib/supabase";

const EMP: Record<string, string> = { full: "משרה מלאה", part: "חלקית", contract: "פרילנס/חוזה", intern: "התמחות" };

interface Job {
  id: string; poster_id: string; title: string; description: string | null; requirements: string | null;
  location: string | null; employment_type: string; active: boolean;
  poster?: { display_name: string | null };
}
interface App {
  id: string; job_id: string; applicant_id: string; applicant_name: string | null; cv_text: string | null;
  match_score: number | null; ai_summary: string | null; status: string;
  applicant?: { display_name: string | null };
}

export default function Jobs({ profile, notify }: { profile: Profile; notify: (m: string) => void }) {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<"browse" | "mine" | "post">("browse");
  const [open, setOpen] = useState<Job | null>(null);

  async function load() {
    setLoading(true);
    const { data } = await supabase.from("ldr_jobs")
      .select("*, poster:ldr_profiles!poster_id(display_name)").order("created_at", { ascending: false }).limit(100);
    setJobs((data as any[]) ?? []);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  const mine = jobs.filter((j) => j.poster_id === profile.id);
  const browse = jobs.filter((j) => j.active && j.poster_id !== profile.id);

  return (
    <div className="container animate-in" style={{ paddingTop: 26, maxWidth: 900 }}>
      <div className="section-header">
        <h2>💼 דרושים</h2>
        <div style={{ display: "flex", gap: 8 }}>
          <button className={`btn ${view === "browse" ? "btn-gold" : "btn-ghost"}`} onClick={() => { setView("browse"); setOpen(null); }}>משרות פתוחות</button>
          <button className={`btn ${view === "mine" ? "btn-gold" : "btn-ghost"}`} onClick={() => { setView("mine"); setOpen(null); }}>המשרות שלי</button>
          <button className="btn btn-gold" onClick={() => setView("post")}>+ פרסום משרה</button>
        </div>
      </div>
      <p className="muted" style={{ marginTop: -10, marginBottom: 18 }}>
        עו״ד מפרסם משרה; מועמדים מגישים קו״ח ישירות — בלי עמלות כ״א. 🤖 מנוע AI מדרג את ההתאמה לדרישות.
      </p>

      {view === "post" ? (
        <PostJob profile={profile} notify={notify} onDone={() => { setView("mine"); load(); }} />
      ) : open ? (
        <JobDetail job={open} profile={profile} notify={notify} onBack={() => { setOpen(null); load(); }} />
      ) : loading ? (
        <div className="center" style={{ paddingTop: 40 }}><span className="spinner" /></div>
      ) : (view === "mine" ? mine : browse).length === 0 ? (
        <div className="card pad center" style={{ color: "var(--cream-dim)" }}>{view === "mine" ? "לא פרסמתם משרות." : "אין כרגע משרות פתוחות."}</div>
      ) : (
        <div className="grid cols-2">
          {(view === "mine" ? mine : browse).map((j) => (
            <div key={j.id} className="card pad card-interactive" style={{ cursor: "pointer" }} onClick={() => setOpen(j)}>
              <strong style={{ fontSize: 15 }}>{j.title}</strong>
              <div className="muted" style={{ fontSize: 12.5, margin: "6px 0" }}>{EMP[j.employment_type]} · {j.location || "—"} · {j.poster?.display_name || "עו״ד"}</div>
              {j.description && <p style={{ fontSize: 13, color: "var(--cream-dim)", margin: 0, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{j.description}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function PostJob({ profile, notify, onDone }: { profile: Profile; notify: (m: string) => void; onDone: () => void }) {
  const [title, setTitle] = useState(""); const [desc, setDesc] = useState(""); const [reqs, setReqs] = useState("");
  const [loc, setLoc] = useState(""); const [emp, setEmp] = useState("full"); const [busy, setBusy] = useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) { notify("יש להזין כותרת"); return; }
    setBusy(true);
    const { error } = await supabase.from("ldr_jobs").insert({ poster_id: profile.id, title: title.trim(), description: desc.trim() || null, requirements: reqs.trim() || null, location: loc.trim() || null, employment_type: emp });
    setBusy(false);
    if (error) { notify("שגיאה: " + error.message); return; }
    notify("המשרה פורסמה ✓"); onDone();
  }
  return (
    <form className="card pad" onSubmit={submit} style={{ maxWidth: 640 }}>
      <label>כותרת המשרה</label>
      <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="למשל: עו״ד נדל״ן 2-4 שנות ניסיון" />
      <div className="grid cols-2" style={{ marginTop: 12 }}>
        <div><label>סוג משרה</label><select value={emp} onChange={(e) => setEmp(e.target.value)}>{Object.entries(EMP).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></div>
        <div><label>מיקום</label><input value={loc} onChange={(e) => setLoc(e.target.value)} placeholder="תל אביב / היברידי" /></div>
      </div>
      <label style={{ marginTop: 12 }}>תיאור התפקיד</label>
      <textarea value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="תיאור התפקיד והמשרד..." />
      <label style={{ marginTop: 12 }}>דרישות / קריטריונים (ה-AI ידרג מולם)</label>
      <textarea value={reqs} onChange={(e) => setReqs(e.target.value)} placeholder="למשל: תואר במשפטים, 3 שנות ניסיון בנדל״ן, אנגלית ברמה גבוהה, שליטה ב-Office..." />
      <button className="btn btn-gold" style={{ width: "100%", marginTop: 14 }} disabled={busy}>{busy ? <span className="spinner" /> : "פרסום המשרה"}</button>
    </form>
  );
}

function JobDetail({ job, profile, notify, onBack }: { job: Job; profile: Profile; notify: (m: string) => void; onBack: () => void }) {
  const isPoster = job.poster_id === profile.id;
  const [apps, setApps] = useState<App[]>([]);
  const [cv, setCv] = useState(""); const [busy, setBusy] = useState(false); const [sent, setSent] = useState(false);

  async function load() {
    const { data } = await supabase.from("ldr_job_applications")
      .select("*, applicant:ldr_profiles!applicant_id(display_name)").eq("job_id", job.id)
      .order("match_score", { ascending: false, nullsFirst: false });
    const list = (data as any[]) ?? [];
    setApps(list); setSent(list.some((a) => a.applicant_id === profile.id));
  }
  useEffect(() => { load(); }, []);

  async function apply() {
    if (!cv.trim()) { notify("הדביקו קורות חיים"); return; }
    setBusy(true);
    const { data, error } = await supabase.from("ldr_job_applications")
      .insert({ job_id: job.id, applicant_id: profile.id, applicant_name: profile.display_name, cv_text: cv.trim() })
      .select("id").single();
    if (error) { setBusy(false); notify(error.message.includes("duplicate") ? "כבר הגשתם מועמדות" : "שגיאה: " + error.message); return; }
    // Trigger AI match scoring (best-effort).
    try { await supabase.functions.invoke("job-match-ai", { body: { application_id: data!.id } }); } catch { /* ignore */ }
    setBusy(false); notify("הקו״ח הוגשו ✓ ה-AI מדרג התאמה"); setCv(""); load();
  }

  const scoreColor = (s: number | null) => s == null ? "#8b8a86" : s >= 70 ? "#10b981" : s >= 45 ? "#C99A3F" : "#b3534a";

  return (
    <div className="card pad" style={{ maxWidth: 720 }}>
      <button className="btn btn-ghost" onClick={onBack} style={{ marginBottom: 12 }}>← חזרה</button>
      <h3 style={{ margin: 0 }}>{job.title}</h3>
      <div className="muted" style={{ fontSize: 13, margin: "6px 0 12px" }}>{EMP[job.employment_type]} · {job.location || "—"} · {job.poster?.display_name || "עו״ד"}</div>
      {job.description && <p style={{ lineHeight: 1.7 }}>{job.description}</p>}
      {job.requirements && <><h4 style={{ margin: "12px 0 4px" }}>דרישות</h4><p style={{ lineHeight: 1.7, whiteSpace: "pre-wrap", color: "var(--cream-dim)" }}>{job.requirements}</p></>}

      {isPoster ? (
        <>
          <h4 style={{ marginTop: 18 }}>מועמדים ({apps.length}) — מדורגים ע״י AI</h4>
          {apps.length === 0 ? <p className="muted">עדיין אין מועמדויות.</p> : apps.map((a) => (
            <div key={a.id} className="card pad" style={{ marginTop: 10 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <strong>{a.applicant?.display_name || a.applicant_name || "מועמד/ת"}</strong>
                <span className="tag" style={{ color: scoreColor(a.match_score), fontWeight: 800 }}>
                  {a.match_score == null ? "מדורג…" : `התאמה ${a.match_score}%`}
                </span>
              </div>
              {a.ai_summary && <p style={{ fontSize: 12.5, margin: "6px 0 0", color: "var(--gold)" }}>🤖 {a.ai_summary}</p>}
              {a.cv_text && <details style={{ marginTop: 8 }}><summary style={{ cursor: "pointer", fontSize: 13 }}>קורות חיים</summary><p style={{ whiteSpace: "pre-wrap", fontSize: 13, color: "var(--cream-dim)", marginTop: 6 }}>{a.cv_text}</p></details>}
            </div>
          ))}
        </>
      ) : sent ? (
        <p className="muted" style={{ marginTop: 16 }}>✓ הגשתם מועמדות. ה-AI מדרג את ההתאמה והמעסיק יראה אותה.</p>
      ) : (
        <div style={{ marginTop: 16 }}>
          <h4 style={{ marginTop: 0 }}>הגשת מועמדות (ללא עמלה)</h4>
          <label>קורות חיים</label>
          <textarea value={cv} onChange={(e) => setCv(e.target.value)} placeholder="הדביקו כאן את קורות החיים שלכם..." style={{ minHeight: 160 }} />
          <button className="btn btn-gold" style={{ width: "100%", marginTop: 12 }} disabled={busy} onClick={apply}>{busy ? <span className="spinner" /> : "הגשה + דירוג AI"}</button>
        </div>
      )}
    </div>
  );
}
