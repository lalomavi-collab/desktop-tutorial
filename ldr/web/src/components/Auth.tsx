import { useState } from "react";
import { supabase } from "../lib/supabase";

type Mode = "signin" | "signup" | "reset" | "reset_sent";

const FEATURES = [
  {
    icon: "📚",
    title: "מקור ידע אחד",
    body: "פיד מקצועי, שו״ת עם עמיתים וחדר החלטות — כל הידע המשפטי שאתם צריכים מרוכז במקום אחד, נקי וממוקד.",
  },
  {
    icon: "🤝",
    title: "חיבורים ושיתופי פעולה",
    body: "רשת מאומתת של עו״ד לפי תחום עיסוק, ותק ומדינה. חיבור לעמיתים ושיתופי פעולה — בלי לחפש בעשרות מקומות.",
  },
  {
    icon: "🎯",
    title: "לידים והפניות — ללא עמלות",
    body: "לקוחות פרטיים מוצאים אתכם לפי התמחות ו-Authority Tier, והפניות בין עו״ד עוברות ב-Escrow מאובטח. הכול ללא עמלת תיווך.",
  },
];

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
    if (data.session) return;
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
    <div style={{ minHeight: "100vh", background: "var(--obsidian)" }}>

      {/* ── Top nav bar ── */}
      <nav style={{
        display: "flex", justifyContent: "space-between", alignItems: "center",
        padding: "0 32px", height: 56,
        borderBottom: "1px solid var(--line)",
        position: "sticky", top: 0, zIndex: 10,
        background: "rgba(27,27,27,0.92)", backdropFilter: "blur(10px)",
      }}>
        <span style={{ fontWeight: 900, fontSize: 20, letterSpacing: 1, color: "var(--gold)" }}>
          LAWDin
        </span>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn btn-ghost" style={{ padding: "7px 18px", fontSize: 13 }}
            onClick={() => switchMode("signin")}>כניסה</button>
          <button className="btn btn-gold" style={{ padding: "7px 18px", fontSize: 13 }}
            onClick={() => switchMode("signup")}>הרשמה חינם</button>
        </div>
      </nav>

      {inviteToken && (
        <div className="banner" style={{ borderRadius: 0, textAlign: "center" }}>
          🎟️ הוזמנת לחדר ההחלטות — הירשם/י כדי להצטרף מיד.
        </div>
      )}

      {/* ── Hero ── */}
      <div className="container" style={{ paddingTop: 64, paddingBottom: 48, maxWidth: 1100 }}>
        <div className="auth-wrap">

          {/* ── Left: marketing ── */}
          <div className="animate-in">
            <div className="tag" dir="ltr" style={{ marginBottom: 18, fontSize: 11 }}>
              🇮🇱 PILOT · ישראל · מתרחב לעוד מדינות
            </div>

            <h1 style={{ margin: "0 0 18px", fontSize: "clamp(28px, 4vw, 44px)", lineHeight: 1.2, fontWeight: 900 }}>
              כל מה שעו״ד צריך<br />
              <span className="gold">במקום אחד.</span><br />
              <span style={{ color: "var(--cream-dim)" }}>הבית המקצועי שלכם.</span>
            </h1>

            <p style={{ fontSize: 16, lineHeight: 1.75, color: "var(--cream-dim)", maxWidth: 480, margin: "0 0 32px" }}>
              LAWDin מרכזת במקום אחד את מה שהיום מפוזר בעשרות מקומות —
              <b style={{ color: "var(--cream)" }}> ידע, חיבורים, שיתופי פעולה ולידים</b>.
              רשת סגורה ומאומתת לעו״ד, עם הפניות ללא עמלת תיווך. פחות חיפוש, יותר עבודה.
            </p>

            {/* Feature cards */}
            <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 32 }}>
              {FEATURES.map((f) => (
                <div key={f.icon} className="card" style={{
                  display: "flex", gap: 14, padding: "14px 18px",
                  alignItems: "flex-start",
                  transition: "border-color .2s",
                }}>
                  <span style={{ fontSize: 26, lineHeight: 1, flexShrink: 0, marginTop: 2 }}>{f.icon}</span>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 3 }}>{f.title}</div>
                    <div style={{ fontSize: 13, color: "var(--cream-dim)", lineHeight: 1.55 }}>{f.body}</div>
                  </div>
                </div>
              ))}
            </div>

            {/* Stats row */}
            <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
              {[
                { n: "24", l: "תחומי עיסוק" },
                { n: "20+", l: "מדינות" },
                { n: "0%", l: "עמלת תיווך" },
                { n: "100%", l: "עו״ד מאומתים" },
              ].map((s) => (
                <div key={s.l} style={{ textAlign: "center" }}>
                  <div className="score-glow" style={{ fontSize: 22 }}>{s.n}</div>
                  <div className="muted" style={{ fontSize: 11, marginTop: 2 }}>{s.l}</div>
                </div>
              ))}
            </div>

            {/* Roadmap teaser */}
            <div style={{
              marginTop: 28, padding: "12px 16px", borderRadius: 10,
              background: "rgba(212,175,55,0.06)", border: "1px solid rgba(212,175,55,0.18)",
              fontSize: 13, color: "var(--cream-dim)", lineHeight: 1.6,
            }}>
              🚀 <b style={{ color: "var(--gold)" }}>פיילוט ישראל</b> — הצטרפו עכשיו ועצבו את הפלטפורמה.
              לאחר הפיילוט: הרחבה ל-EU, ארה״ב ומדינות נוספות עם רישוי משפטי.
            </div>
          </div>

          {/* ── Right: auth card ── */}
          <div className="card pad animate-in" style={{ animationDelay: "0.15s", alignSelf: "flex-start", position: "sticky", top: 72 }}>
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
                {mode !== "reset" && (
                  <>
                    <div style={{ textAlign: "center", marginBottom: 18 }}>
                      <div style={{ fontSize: 13, color: "var(--cream-dim)" }}>
                        {mode === "signin" ? "שמחים לראותכם חזרה 👋" : "הצטרפו לרשת העו״ד המאומתים"}
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
                      <button
                        className={`btn ${mode === "signin" ? "btn-gold" : "btn-ghost"}`}
                        style={{ flex: 1 }} onClick={() => switchMode("signin")}
                      >כניסה</button>
                      <button
                        className={`btn ${mode === "signup" ? "btn-gold" : "btn-ghost"}`}
                        style={{ flex: 1 }} onClick={() => switchMode("signup")}
                      >הרשמה חינם</button>
                    </div>
                  </>
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
                      {busy ? <span className="spinner" /> : "כניסה לרשת"}
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
                      {busy ? <span className="spinner" /> : "הרשמה — בחינם"}
                    </button>
                    <p className="muted center" style={{ fontSize: 11, marginTop: 12, lineHeight: 1.5 }}>
                      לאחר ההרשמה תתבקש/י לאמת רישיון עו״ד.<br />
                      כניסה מלאה לרשת נפתחת רק לאחר אימות.
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

      {/* ── Bottom value strip ── */}
      <div style={{
        borderTop: "1px solid var(--line)",
        padding: "28px 32px",
        display: "flex", justifyContent: "center", gap: "clamp(16px, 4vw, 48px)",
        flexWrap: "wrap",
      }}>
        {[
          { icon: "🔐", text: "רשת סגורה — רק עו״ד מאומתים" },
          { icon: "⚖️", text: "Authority Tier — מוניטין שנבנה בשימוש" },
          { icon: "🗺️", text: "מפת עמיתים — ישראל ובעתיד גם חו״ל" },
          { icon: "🤝", text: "Escrow מאובטח להפניות בינ״ל" },
        ].map((item) => (
          <div key={item.icon} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "var(--cream-dim)" }}>
            <span style={{ fontSize: 18 }}>{item.icon}</span>
            {item.text}
          </div>
        ))}
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
