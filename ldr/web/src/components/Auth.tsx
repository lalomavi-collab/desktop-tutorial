import { useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabase";
import { LogoMark, Wordmark } from "./Logo";
import PublicMap from "./PublicMap";
import MembersStrip from "./MembersStrip";
import LanguageSwitcher from "./LanguageSwitcher";
import { useI18n } from "../i18n";

type Mode = "signin" | "signup" | "reset" | "reset_sent";

// Count-up animation for a numeric stat (animates the leading number, keeps
// any suffix like "+" or "%"). Gives the entry a live, dynamic feel.
function CountUp({ value, suffix = "" }: { value: number; suffix?: string }) {
  const [n, setN] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const dur = 1100;
    const start = performance.now();
    let raf = 0;
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / dur);
      const eased = 1 - Math.pow(1 - p, 3); // easeOutCubic
      setN(Math.round(eased * value));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value]);
  return <span ref={ref}>{n}{suffix}</span>;
}

const FEATURES = [
  { icon: "📚", key: "feat.knowledge" },
  { icon: "🤝", key: "feat.network" },
  { icon: "🎯", key: "feat.leads" },
];

export default function Auth({ inviteToken }: { inviteToken: string | null }) {
  const [mode, setMode] = useState<Mode>("signup");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [name, setName] = useState("");
  const [licNo, setLicNo] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [aboutOpen, setAboutOpen] = useState(false);
  const { t } = useI18n();

  function switchMode(m: Mode) { setMode(m); setErr(null); setInfo(null); }

  async function signIn(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setErr(null);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) setErr(mapError(error.message));
  }

  async function signInGoogle() {
    setBusy(true); setErr(null);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: window.location.origin + window.location.pathname },
    });
    if (error) { setBusy(false); setErr(mapError(error.message)); }
  }

  async function signUp(e: React.FormEvent) {
    e.preventDefault();
    if (!licNo.trim()) { setErr("יש להזין מספר רישיון עו״ד"); return; }
    if (password.length < 8) { setErr("הסיסמה חייבת להכיל לפחות 8 תווים"); return; }
    if (password !== confirm) { setErr("הסיסמאות אינן תואמות"); return; }
    setBusy(true); setErr(null);
    const { data, error } = await supabase.auth.signUp({
      email, password,
      options: { data: { display_name: name.trim() || undefined, license_no: licNo.trim() } },
    });
    if (error) { setBusy(false); setErr(mapError(error.message)); return; }
    // Persist the license number captured at entry onto the profile.
    if (data.session && data.user) {
      await supabase.from("ldr_profiles")
        .update({ license_no: licNo.trim() }).eq("id", data.user.id);
    }
    setBusy(false);
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
    <div className="landing" style={{ minHeight: "100vh", position: "relative", overflow: "hidden" }}>

      {/* ── Animated premium backdrop ── */}
      <div className="aurora" aria-hidden="true" />
      <div className="grid-overlay" aria-hidden="true" />

      {/* ── Top nav bar ── */}
      <nav style={{
        position: "sticky", top: 0, zIndex: 3,
        display: "flex", justifyContent: "space-between", alignItems: "center",
        padding: "10px 32px", minHeight: 56,
        borderBottom: "1px solid var(--line)",
        background: "rgba(20,20,20,0.78)", backdropFilter: "blur(18px) saturate(160%)",
      }}>
        <Wordmark size={36} tagline={false} />
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <LanguageSwitcher />
          <button className="btn btn-ghost" style={{ padding: "7px 18px", fontSize: 13 }}
            onClick={() => switchMode("signin")}>{t("nav.signin")}</button>
          <button className="btn btn-gold" style={{ padding: "7px 18px", fontSize: 13 }}
            onClick={() => switchMode("signup")}>{t("nav.signup")}</button>
        </div>
      </nav>

      {inviteToken && (
        <div className="banner" style={{ borderRadius: 0, textAlign: "center" }}>
          🎟️ הוזמנת לחדר ההחלטות — הירשם/י כדי להצטרף מיד.
        </div>
      )}

      {/* ── Live map hero (Gett-style: straight to the map, no slogan) ── */}
      <div className="container" style={{ position: "relative", zIndex: 2, paddingTop: 20, maxWidth: 1100 }}>
        <PublicMap />
        <MembersStrip />
      </div>

      {/* ── Hero ── */}
      <div className="container" style={{ position: "relative", zIndex: 2, paddingTop: 40, paddingBottom: 48, maxWidth: 1100 }}>
        <div className="auth-wrap">

          {/* ── Left: marketing ── */}
          <div className="animate-in">
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 18, flexWrap: "wrap" }}>
              <div className="tag" dir="ltr" style={{ fontSize: 11 }}>
                {t("hero.badge")}
              </div>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--ok)", fontWeight: 600 }}>
                <span className="conn-dot connected" /> {t("hero.live")}
              </span>
            </div>

            <h1 style={{ margin: "0 0 18px", fontSize: "clamp(28px, 4vw, 44px)", lineHeight: 1.2, fontWeight: 900 }}>
              {t("hero.title1")}<br />
              <span className="gold">{t("hero.title2")}</span><br />
              <span style={{ color: "var(--cream-dim)" }}>{t("hero.title3")}</span>
            </h1>

            <p style={{ fontSize: 16, lineHeight: 1.8, color: "var(--cream-dim)", maxWidth: 470, margin: "0 0 22px" }}>
              {t("hero.lead")}
            </p>

            {/* Enticing trust line — quick reasons to join now */}
            <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginBottom: 26, fontSize: 13.5, fontWeight: 600 }}>
              <span style={{ color: "var(--ok)" }}>{t("hero.trust1")}</span>
              <span style={{ color: "var(--ok)" }}>{t("hero.trust2")}</span>
              <span style={{ color: "var(--ok)" }}>{t("hero.trust3")}</span>
            </div>

            <button className="btn btn-gold" style={{ padding: "12px 28px", fontSize: 15, marginBottom: 30 }}
              onClick={() => switchMode("signup")}>
              {t("hero.cta")}
            </button>

            {/* Concise value props — clean, professional */}
            <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 30 }}>
              {FEATURES.map((f) => (
                <div key={f.icon} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <span style={{ fontSize: 20, width: 28, textAlign: "center", flexShrink: 0 }}>{f.icon}</span>
                  <span style={{ fontWeight: 600, fontSize: 15 }}>{t(f.key)}</span>
                </div>
              ))}
            </div>

            {/* Stats row — live count-up on entry */}
            <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
              {[
                { v: 24, suffix: "", l: "תחומי עיסוק" },
                { v: 20, suffix: "+", l: "מדינות" },
                { v: 0, suffix: "%", l: "עמלת הפניית תיקים" },
                { v: 100, suffix: "%", l: "עו״ד מאומתים" },
              ].map((s) => (
                <div key={s.l} style={{ textAlign: "center" }}>
                  <div className="score-glow" style={{ fontSize: 22 }}>
                    <CountUp value={s.v} suffix={s.suffix} />
                  </div>
                  <div className="muted" style={{ fontSize: 11, marginTop: 2 }}>{s.l}</div>
                </div>
              ))}
            </div>

            {/* Roadmap teaser — concise */}
            <div style={{
              marginTop: 26, padding: "10px 14px", borderRadius: 10,
              background: "rgba(51,204,255,0.06)", border: "1px solid rgba(51,204,255,0.18)",
              fontSize: 13, color: "var(--cream-dim)",
            }}>
              🚀 <b style={{ color: "var(--gold)" }}>פיילוט ישראל</b> — בקרוב גם EU וארה״ב.
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
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, marginBottom: 16 }}>
                      <LogoMark size={46} />
                      <div style={{ fontSize: 14, fontWeight: 700 }}>
                        {mode === "signin" ? t("auth.signinTitle") : t("auth.signupTitle")}
                      </div>
                      {mode === "signup" && (
                        <div style={{ fontSize: 13, color: "var(--cream-dim)", textAlign: "center", lineHeight: 1.6 }}>
                          {t("auth.signupSub")}
                        </div>
                      )}
                    </div>
                    <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
                      <button
                        className={`btn ${mode === "signin" ? "btn-gold" : "btn-ghost"}`}
                        style={{ flex: 1 }} onClick={() => switchMode("signin")}
                      >{t("nav.signin")}</button>
                      <button
                        className={`btn ${mode === "signup" ? "btn-gold" : "btn-ghost"}`}
                        style={{ flex: 1 }} onClick={() => switchMode("signup")}
                      >{t("nav.signup")}</button>
                    </div>

                    {/* Google sign-in (works once Google provider is enabled in Supabase Auth) */}
                    <button type="button" onClick={signInGoogle} disabled={busy}
                      style={{
                        width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
                        padding: "11px", borderRadius: 12, border: "1px solid var(--line)",
                        background: "#fff", color: "#1f1e1d", fontWeight: 600, fontSize: 14, cursor: "pointer",
                      }}>
                      <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
                        <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9 3.6l6.7-6.7C35.6 2.6 30.1 0 24 0 14.6 0 6.4 5.4 2.5 13.3l7.8 6.1C12.2 13.2 17.6 9.5 24 9.5z"/>
                        <path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.5 3-2.2 5.5-4.7 7.2l7.3 5.7c4.3-4 6.8-9.9 6.8-17.4z"/>
                        <path fill="#FBBC05" d="M10.3 28.6c-.5-1.5-.8-3-.8-4.6s.3-3.1.8-4.6l-7.8-6.1C.9 16.5 0 20.1 0 24s.9 7.5 2.5 10.7l7.8-6.1z"/>
                        <path fill="#34A853" d="M24 48c6.1 0 11.3-2 15-5.5l-7.3-5.7c-2 1.4-4.7 2.3-7.7 2.3-6.4 0-11.8-3.7-13.7-9l-7.8 6.1C6.4 42.6 14.6 48 24 48z"/>
                      </svg>
                      {t("auth.google")}
                    </button>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "14px 0 16px", color: "var(--cream-dim)", fontSize: 12 }}>
                      <span style={{ flex: 1, height: 1, background: "var(--line)" }} /> {t("auth.or")} <span style={{ flex: 1, height: 1, background: "var(--line)" }} />
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
                    <label style={{ marginTop: 12 }}>מספר רישיון עו״ד</label>
                    <input required dir="ltr" inputMode="numeric"
                      value={licNo} onChange={(e) => setLicNo(e.target.value.replace(/[^\d]/g, ""))}
                      placeholder="12345" />
                    <label style={{ marginTop: 12 }}>אימייל</label>
                    <input type="email" required autoComplete="username" dir="ltr"
                      value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@law.co.il" />
                    <label style={{ marginTop: 12 }}>סיסמה <span className="muted">(8+ תווים)</span></label>
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
                      {t("auth.licenseNote")}
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

      {/* ── Minimal footer with About ── */}
      <footer style={{
        position: "relative", zIndex: 2, textAlign: "center",
        padding: "22px 16px", borderTop: "1px solid var(--line)",
        fontSize: 13, color: "var(--cream-dim)",
      }}>
        <button onClick={() => setAboutOpen(true)} style={{
          background: "none", border: "none", color: "var(--gold)", cursor: "pointer",
          font: "inherit", textDecoration: "underline", textUnderlineOffset: 3,
        }}>{t("about")}</button>
        <span> · © {new Date().getFullYear()} LAWDin</span>
      </footer>

      {aboutOpen && (
        <div className="modal-backdrop" onClick={() => setAboutOpen(false)}>
          <div className="modal-box" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 420 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h3 style={{ margin: 0 }}>אודות</h3>
              <button className="btn btn-ghost" onClick={() => setAboutOpen(false)}>✕</button>
            </div>
            <p style={{ lineHeight: 1.7, marginTop: 12 }}>
              LAWDin היא מערכת ההפעלה המקצועית לעורכי דין — ידע, חיבורים והפניות
              ברשת סגורה ומאומתת.
            </p>
            <p className="muted" style={{ fontSize: 13, lineHeight: 1.7 }}>
              נוסד ומובל על ידי <b style={{ color: "var(--cream)" }}>ד״ר אברהם ללום</b>.
            </p>
          </div>
        </div>
      )}
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
