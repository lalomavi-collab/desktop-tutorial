import { useState } from "react";
import { supabase } from "../lib/supabase";

export default function ResetPassword() {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 8) { setErr("הסיסמה חייבת להכיל לפחות 8 תווים"); return; }
    if (password !== confirm) { setErr("הסיסמאות אינן תואמות"); return; }
    setBusy(true); setErr(null);
    const { error } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (error) { setErr(error.message); return; }
    setDone(true);
    // Clear the hash so the recovery flow doesn't re-trigger
    window.history.replaceState({}, "", window.location.pathname);
  }

  return (
    <div className="container" style={{ paddingTop: 60, maxWidth: 480 }}>
      <div className="card pad">
        <h3 style={{ marginTop: 0 }}>הגדרת סיסמה חדשה</h3>
        {done ? (
          <div className="center">
            <div style={{ fontSize: 40 }}>✅</div>
            <p className="muted">הסיסמה עודכנה בהצלחה. כעת תוכל/י להתחבר עם הסיסמה החדשה.</p>
          </div>
        ) : (
          <form onSubmit={submit}>
            <label>סיסמה חדשה <span className="muted">(לפחות 8 תווים)</span></label>
            <input type="password" required autoComplete="new-password" dir="ltr"
              value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
            <label style={{ marginTop: 12 }}>אימות סיסמה</label>
            <input type="password" required autoComplete="new-password" dir="ltr"
              value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="••••••••" />
            {err && <p style={{ color: "var(--burgundy-soft)", fontSize: 13, marginTop: 10 }}>{err}</p>}
            <button className="btn btn-gold" style={{ width: "100%", marginTop: 18 }} disabled={busy}>
              {busy ? <span className="spinner" /> : "עדכון סיסמה"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
