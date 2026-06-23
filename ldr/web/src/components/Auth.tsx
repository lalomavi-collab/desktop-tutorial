import { useState } from "react";
import { supabase } from "../lib/supabase";

type Mode = "signin" | "signup" | "reset" | "reset_sent";

export default function Auth({ inviteToken }: { inviteToken: string | null }) {
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  function switchMode(m: Mode) { setMode(m); setErr(null); setInfo(null); }

  async function signIn(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setErr(null);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) setErr(mapError(error.message));
  }

  async function signUp(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 8) { setErr("הסיסמה חייבת להכיל לפחות 8 תווים"); return; }
    if (password !== confirm) { setErr("הסיסמאות אינן תואמות"); return; }
    setBusy(true); setErr(null);
    const { data, error } = await supabase.auth.signUp({
      email, password,
      options: { data: { display_name: name.trim() || undefined } },
    });
    setBusy(false);
    if (error) { setErr(mapError(error.message)); return; }
    // If session is immediately returned, the user is auto-confirmed
    if (data.session) return; // App.tsx will pick up the session automatically
    setInfo("נשלח אליך אימייל אימות — לחץ על הקישור ותחזור לכאן להתחברות.");
    switchMode("signin");
  }

  async function resetPassword(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setErr(null);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin + window.location.pathname,
    });
    setBusy(false);
    if (error) { setErr(mapError(error.message)); return; }
    setMode("reset_sent");
  }

  return (
    <div className="container hero">
      {inviteToken && (
        <div className="banner" style={{ marginBottom: 24 }}>
          🎟️ הוזמנת לחדר ההחלטות — הירשם/י כדי להצטרף מיד.
        </div>
      )}

      <div className="auth-wrap">
        {/* ── Left: marketing ── */}
        <div>
          <div className="tag" dir="ltr" style={{ marginBottom: 16 }}>⬛ LAWDin · Attorneys Only</div>
          <h1 style={{ marginTop: 0 }}>
            הרשת המקצועית<br />
            <span className="gold">לעורכי דין בלבד.</span>
          </h1>
          <p className="lead">
            פיד, Legal Gigs, הפניות, שו״ת ולוח Authority Tier —
            רשת סגורה ומאומתת לעורכי דין ומתמחים מורשים.
            חיסיון עו״ד–לקוח נשמר מוחלט.
          </p>
          <div className="pill-row">
            <span className="tag">🔐 כניסה לעו״ד מאומתים בלבד</span>
            <span className="tag">🤝 Legal Gigs &amp; הפניות</span>
            <span className="tag">⚖️ Authority Tier</span>
            <span className="tag">🌍 20 מדינות</span>
          </div>
          <div className="grid cols-3" style={{ marginTop: 34 }}>
            <div className="stat"><div className="n">24</div><div className="l">תחומי עיסוק</div></div>
            <div className="stat"><div className="n">∞</div><div className="l">חינם בהשקה</div></div>
            <div className="stat"><div className="n">100%</div><div className="l">מאומתים בלבד</div></div>
          </div>
        </div>

        {/* ── Right: auth card ── */}
        <div className="card pad">
          {mode === "reset_sent" ? (
            <div className="center">
              <div style={{ fontSize: 44 }}>✉️</div>
              <h3>קישור שחזור נשלח</h3>
              <p className="muted">בדקו את תיבת הדואר של <b>{email}</b><br />ולחצו על הקישור לאיפוס הסיסמה.</p>
              <button className="btn btn-ghost" style={{ marginTop: 10 }} onClick={() => switchMode("signin")}>
                חזרה לכניסה
              </button>
            </div>
          ) : (
            <>
              {/* Tab row */}
              {mode !== "reset" && (
                <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
                  <button
                    className={`btn ${mode === "signin" ? "btn-gold" : "btn-ghost"}`}
                    style={{ flex: 1 }} onClick={() => switchMode("signin")}
                  >כניסה</button>
                  <button
                    className={`btn ${mode === "signup" ? "btn-gold" : "btn-ghost"}`}
                    style={{ flex: 1 }} onClick={() => switchMode("signup")}
                  >הרשמה</button>
                </div>
              )}

              {info && (
                <div className="banner" style={{ marginBottom: 14, borderColor: "var(--gold)" }}>
                  {info}
                </div>
              )}

              {/* ── Sign In ── */}
              {mode === "signin" && (
                <form onSubmit={signIn}>
                  <label>אימייל</label>
                  <input type="email" required autoComplete="username" dir="ltr"
                    value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@law.co.il" />
                  <label style={{ marginTop: 12 }}>סיסמה</label>
                  <input type="password" required autoComplete="current-password" dir="ltr"
                    value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
                  {err && <p style={{ color: "var(--burgundy-soft)", fontSize: 13, margin: "10px 0 0" }}>{err}</p>}
                  <button className="btn btn-gold" style={{ width: "100%", marginTop: 18 }} disabled={busy}>
                    {busy ? <span className="spinner" /> : "כניסה"}
                  </button>
                  <button type="button" className="btn btn-ghost"
                    style={{ width: "100%", marginTop: 8, fontSize: 13 }}
                    onClick={() => switchMode("reset")}>
                    שכחתי סיסמה
                  </button>
                </form>
              )}

              {/* ── Sign Up ── */}
              {mode === "signup" && (
                <form onSubmit={signUp}>
                  <label>שם מלא</label>
                  <input autoComplete="name"
                    value={name} onChange={(e) => setName(e.target.value)} placeholder="עו״ד ישראל ישראלי" />
                  <label style={{ marginTop: 12 }}>אימייל</label>
                  <input type="email" required autoComplete="username" dir="ltr"
                    value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@law.co.il" />
                  <label style={{ marginTop: 12 }}>סיסמה <span className="muted">(לפחות 8 תווים)</span></label>
                  <input type="password" required autoComplete="new-password" dir="ltr"
                    value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
                  <label style={{ marginTop: 12 }}>אימות סיסמה</label>
                  <input type="password" required autoComplete="new-password" dir="ltr"
                    value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="••••••••" />
                  {err && <p style={{ color: "var(--burgundy-soft)", fontSize: 13, margin: "10px 0 0" }}>{err}</p>}
                  <button className="btn btn-gold" style={{ width: "100%", marginTop: 18 }} disabled={busy}>
                    {busy ? <span className="spinner" /> : "הרשמה"}
                  </button>
                  <p className="muted center" style={{ fontSize: 12, marginTop: 12 }}>
                    לאחר ההרשמה תתבקש לאמת רישיון עו״ד — הכניסה לרשת נפתחת רק לאחר אימות.
                  </p>
                </form>
              )}

              {/* ── Reset password ── */}
              {mode === "reset" && (
                <form onSubmit={resetPassword}>
                  <h4 style={{ marginTop: 0 }}>שחזור סיסמה</h4>
                  <p className="muted" style={{ marginTop: -8 }}>הזינו את כתובת האימייל שלכם ונשלח קישור לאיפוס.</p>
                  <label>אימייל</label>
                  <input type="email" required dir="ltr"
                    value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@law.co.il" />
                  {err && <p style={{ color: "var(--burgundy-soft)", fontSize: 13, margin: "10px 0 0" }}>{err}</p>}
                  <button className="btn btn-gold" style={{ width: "100%", marginTop: 18 }} disabled={busy}>
                    {busy ? <span className="spinner" /> : "שלחו קישור שחזור"}
                  </button>
                  <button type="button" className="btn btn-ghost"
                    style={{ width: "100%", marginTop: 8 }}
                    onClick={() => switchMode("signin")}>חזרה</button>
                </form>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function mapError(msg: string): string {
  if (msg.includes("Invalid login credentials")) return "אימייל או סיסמה שגויים";
  if (msg.includes("Email not confirmed")) return "יש לאשר את האימייל לפני הכניסה — בדקו את תיבת הדואר";
  if (msg.includes("User already registered")) return "כתובת האימייל כבר רשומה — נסו להיכנס";
  if (msg.includes("Password should be")) return "הסיסמה חייבת להכיל לפחות 6 תווים";
  if (msg.includes("rate limit")) return "יותר מדי ניסיונות — נסו שוב בעוד מספר דקות";
  return msg;
}
