import { useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabase";
import { Wordmark } from "./Logo";
import PublicMap from "./PublicMap";
import MembersStrip from "./MembersStrip";
import LanguageSwitcher from "./LanguageSwitcher";
import NotificationsBell from "./NotificationsBell";
import DownloadApp from "./DownloadApp";
import OfficeRentals from "./OfficeRentals";
import ServicesStrip from "./ServicesStrip";
import LandingExtras from "./LandingExtras";
import { useI18n } from "../i18n";

type Mode = "signin" | "signup" | "reset" | "reset_sent";

function CountUp({ value, suffix = "" }: { value: number; suffix?: string }) {
  const [n, setN] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const dur = 1100;
    const start = performance.now();
    let raf = 0;
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / dur);
      const eased = 1 - Math.pow(1 - p, 3);
      setN(Math.round(eased * value));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value]);
  return <span ref={ref}>{n}{suffix}</span>;
}

const FEATURES = [
  { icon: "🔄", key: "feat.knowledge" },
  { icon: "📩", key: "feat.network" },
  { icon: "🤝", key: "feat.leads" },
];

// Fail fast on a stalled network so auth buttons never hang on "busy" forever.
function withTimeout<T>(p: Promise<T>, ms = 12000): Promise<T> {
  return Promise.race([
    p,
    new Promise<never>((_, reject) => setTimeout(() => reject(new Error("network_timeout")), ms)),
  ]);
}

const TIMEOUT_MSG = "החיבור איטי כרגע ולא הצלחנו להשלים את הפעולה. בדקו את האינטרנט ונסו שוב.";

function GoogleSvg() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9 3.6l6.7-6.7C35.6 2.6 30.1 0 24 0 14.6 0 6.4 5.4 2.5 13.3l7.8 6.1C12.2 13.2 17.6 9.5 24 9.5z"/>
      <path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.5 3-2.2 5.5-4.7 7.2l7.3 5.7c4.3-4 6.8-9.9 6.8-17.4z"/>
      <path fill="#FBBC05" d="M10.3 28.6c-.5-1.5-.8-3-.8-4.6s.3-3.1.8-4.6l-7.8-6.1C.9 16.5 0 20.1 0 24s.9 7.5 2.5 10.7l7.8-6.1z"/>
      <path fill="#34A853" d="M24 48c6.1 0 11.3-2 15-5.5l-7.3-5.7c-2 1.4-4.7 2.3-7.7 2.3-6.4 0-11.8-3.7-13.7-9l-7.8 6.1C6.4 42.6 14.6 48 24 48z"/>
    </svg>
  );
}

export default function Auth({ inviteToken }: { inviteToken: string | null }) {
  const [mode, setMode] = useState<Mode>("signup");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [name, setName] = useState("");
  const [licNo, setLicNo] = useState("");
  const [acct, setAcct] = useState<"attorney" | "client">("attorney");
  const [licCountry, setLicCountry] = useState("IL");
  const [barCard, setBarCard] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [showPw, setShowPw] = useState(false);
  const [needsConfirm, setNeedsConfirm] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [aboutOpen, setAboutOpen] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const [memberCount, setMemberCount] = useState(40);
  const moreRef = useRef<HTMLDivElement>(null);
  const { t } = useI18n();

  function openAuth(m: Mode, who?: "attorney" | "client") { if (who) setAcct(who); setMode(m); setErr(null); setInfo(null); setAuthOpen(true); }
  function scrollToMore() { moreRef.current?.scrollIntoView({ behavior: "smooth" }); }

  useEffect(() => {
    supabase.from("ldr_demo_attorneys").select("id", { count: "exact", head: true })
      .then(({ count }) => { if (count) setMemberCount(count); });
  }, []);

  function switchMode(m: Mode) { setMode(m); setErr(null); setInfo(null); }

  async function signIn(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setErr(null); setNeedsConfirm(false);
    try {
      const { error } = await withTimeout(supabase.auth.signInWithPassword({ email, password }));
      if (error) {
        if (/not confirmed/i.test(error.message)) {
          setNeedsConfirm(true);
          setErr("המייל לא אומת עדיין. לחצו למטה לשליחה חוזרת של מייל האימות.");
        } else {
          setErr(mapError(error.message));
        }
      }
    } catch {
      setErr(TIMEOUT_MSG);
    } finally {
      setBusy(false);
    }
  }

  async function resendConfirmation() {
    if (!email.trim()) { setErr("הזינו כתובת מייל"); return; }
    setBusy(true); setErr(null);
    const { error } = await supabase.auth.resend({ type: "signup", email: email.trim() });
    setBusy(false);
    if (error) { setErr(mapError(error.message)); return; }
    setNeedsConfirm(false);
    setInfo("מייל אימות חדש נשלח. בדקו את תיבת הדואר (וגם תיקיית הספאם).");
  }

  async function signInGoogle() {
    setBusy(true); setErr(null);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: window.location.origin + window.location.pathname },
    });
    if (error) {
      setBusy(false);
      setErr(/not enabled/i.test(error.message)
        ? "התחברות עם Google תופעל בקרוב. בינתיים אפשר להיכנס עם קישור למייל או עם סיסמה."
        : mapError(error.message));
      // Open sign-in modal so the error is visible (splash screen has no error area).
      if (!authOpen) { setAuthOpen(true); setMode("signin"); }
    }
  }

  async function signInMagicLink() {
    if (!email.trim()) { setErr("הזינו כתובת מייל לקבלת קישור כניסה"); return; }
    setBusy(true); setErr(null); setInfo(null);
    try {
      const { error } = await withTimeout(supabase.auth.signInWithOtp({
        email: email.trim(),
        options: { shouldCreateUser: false, emailRedirectTo: window.location.origin + window.location.pathname },
      }));
      if (error) {
        setErr(/not allowed|not found|signups/i.test(error.message)
          ? "המייל אינו רשום עדיין. עברו ללשונית הרשמה כדי ליצור חשבון."
          : mapError(error.message));
        return;
      }
      setInfo("שלחנו קישור כניסה למייל. פתחו אותו כדי להיכנס, ללא סיסמה.");
    } catch {
      setErr(TIMEOUT_MSG);
    } finally {
      setBusy(false);
    }
  }

  async function signUp(e: React.FormEvent) {
    e.preventDefault();
    if (acct === "attorney" && licCountry === "IL" && !/^\d{4,7}$/.test(licNo.trim())) { setErr(t("err.licenseRequired")); return; }
    if (acct === "attorney" && licCountry !== "IL" && !barCard) { setErr(t("err.barCardRequired")); return; }
    if (password.length < 8) { setErr(t("err.passwordLen")); return; }
    if (password !== confirm) { setErr(t("err.passwordMatch")); return; }
    setBusy(true); setErr(null);
    const { data, error } = await supabase.auth.signUp({
      email, password,
      options: { data: { display_name: name.trim() || undefined, role: acct, license_no: acct === "attorney" && licCountry === "IL" ? licNo.trim() : undefined, license_country: acct === "attorney" ? licCountry : undefined } },
    });
    if (error) { setBusy(false); setErr(mapError(error.message)); return; }
    if (data.session && data.user) {
      if (acct === "attorney" && barCard) {
        const ext = barCard.name.split(".").pop() || "jpg";
        await supabase.storage.from("licenses").upload(`${data.user.id}/bar-card.${ext}`, barCard, { upsert: true });
      }
      await supabase.from("ldr_profiles")
        .update({ role: acct, ...(acct === "attorney" ? { license_country: licCountry, ...(licCountry === "IL" ? { license_no: licNo.trim() } : {}) } : {}) })
        .eq("id", data.user.id);
    }
    setBusy(false);
    if (data.session) return;
    setInfo(t("auth.emailSent"));
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
    <div className="landing" style={{ minHeight: "100dvh", position: "relative", overflow: "hidden" }}>

      {/* Animated premium backdrop */}
      <div className="aurora" aria-hidden="true" />
      <div className="grid-overlay" aria-hidden="true" />

      {/* Minimal top nav: logo + utils only, no redundant sign-in/up buttons */}
      <nav style={{
        position: "sticky", top: 0, zIndex: 3,
        display: "flex", justifyContent: "space-between", alignItems: "center",
        padding: "0 24px", minHeight: 52,
        borderBottom: "1px solid var(--line)",
        background: "rgba(250,249,245,0.90)", backdropFilter: "blur(18px) saturate(160%)",
      }}>
        <button onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })} aria-label="LAWDin, חזרה לראש העמוד"
          style={{ background: "none", border: "none", padding: 0, cursor: "pointer" }}>
          <Wordmark size={30} tagline={false} tone="light" />
        </button>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <LanguageSwitcher light />
          <NotificationsBell tone="light" />
        </div>
      </nav>

      {inviteToken && (
        <div className="banner" style={{ borderRadius: 0, textAlign: "center", position: "relative", zIndex: 4 }}>
          {t("invite.banner")}
        </div>
      )}

      {/* === SPLASH SECTION: fills one viewport, centered like an app launcher === */}
      <section style={{
        minHeight: "calc(100dvh - 52px)",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center",
        padding: "32px 24px 40px",
        position: "relative",
        zIndex: 2,
      }}>
        <div style={{ width: "100%", maxWidth: 400, display: "flex", flexDirection: "column", alignItems: "center" }}>

          {/* Logo: prominent, app-icon sized */}
          <Wordmark size={56} tagline={false} tone="light" />

          {/* Single value proposition */}
          <p style={{
            fontSize: 16.5, fontWeight: 600, color: "var(--cream-dim)",
            textAlign: "center", margin: "18px 0 24px", lineHeight: 1.55,
          }}>
            הרשת המשפטית הסגורה לעורכי הדין
          </p>

          {/* Quick stats: most compelling numbers above the fold */}
          <div style={{ display: "flex", gap: 28, marginBottom: 30, flexWrap: "wrap", justifyContent: "center" }}>
            {[
              { v: memberCount, suffix: "+", l: t("stats.members") },
              { v: 0, suffix: "%", l: t("stats.fee") },
              { v: 24, suffix: "", l: t("stats.areas") },
            ].map((s) => (
              <div key={s.l} style={{ textAlign: "center" }}>
                <div className="score-glow" style={{ fontSize: 22, fontWeight: 800 }}>
                  <CountUp value={s.v} suffix={s.suffix} />
                </div>
                <div className="muted" style={{ fontSize: 11, marginTop: 2 }}>{s.l}</div>
              </div>
            ))}
          </div>

          {/* Primary CTA */}
          <button className="btn btn-gold" onClick={() => openAuth("signup", "attorney")}
            style={{ width: "100%", padding: "15px 20px", fontSize: 16.5, fontWeight: 800, borderRadius: 16, marginBottom: 10 }}>
            הצטרפו כעו״ד, חינם →
          </button>

          {/* Secondary CTA */}
          <button className="btn btn-ghost" onClick={() => openAuth("signin")}
            style={{ width: "100%", padding: "14px 20px", fontSize: 16, fontWeight: 700, borderRadius: 16, marginBottom: 16 }}>
            כניסה לחשבון קיים
          </button>

          {/* Divider */}
          <div style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", marginBottom: 14, color: "var(--cream-dim)", fontSize: 12 }}>
            <span style={{ flex: 1, height: 1, background: "var(--line)" }} />
            {t("auth.or")}
            <span style={{ flex: 1, height: 1, background: "var(--line)" }} />
          </div>

          {/* Google sign-in */}
          <button type="button" onClick={signInGoogle} disabled={busy}
            style={{
              width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
              padding: "13px 20px", borderRadius: 16, border: "1px solid var(--line)",
              background: "#fff", color: "#1f1e1d", fontWeight: 600, fontSize: 15, cursor: busy ? "wait" : "pointer", marginBottom: 20,
              opacity: busy ? 0.7 : 1,
            }}>
            {busy ? <span className="spinner" style={{ borderColor: "#ccc", borderTopColor: "#333" }} /> : <GoogleSvg />}
            {t("auth.google")}
          </button>

          {/* Client join */}
          <div style={{ fontSize: 13, marginBottom: 28, textAlign: "center" }}>
            <span className="muted">מחפשים עורך דין? </span>
            <button className="link" onClick={() => openAuth("signup", "client")}>כניסת לקוחות</button>
          </div>

          {/* Scroll-down cue */}
          <button onClick={scrollToMore}
            style={{ background: "none", border: "none", cursor: "pointer", color: "var(--cream-dim)", fontSize: 13, display: "flex", flexDirection: "column", alignItems: "center", gap: 5, padding: "6px 16px", fontFamily: "inherit" }}>
            <span>גלו עוד על LAWDin</span>
            <span className="bounce-arrow" style={{ fontSize: 17 }}>▼</span>
          </button>
        </div>
      </section>

      {/* === AUTH MODAL (popup, unchanged) === */}
      {authOpen && (
        <div className="modal-backdrop" onClick={() => setAuthOpen(false)}>
          <div className="card pad animate-in" onClick={(e) => e.stopPropagation()}
            style={{ width: "min(440px, 94vw)", maxHeight: "92vh", overflowY: "auto", position: "relative" }}>
            <button onClick={() => setAuthOpen(false)} aria-label="close"
              style={{ position: "absolute", top: 12, insetInlineEnd: 12, width: 30, height: 30, borderRadius: "50%", border: "1px solid var(--line)", background: "transparent", color: "var(--cream)", cursor: "pointer", zIndex: 2 }}>✕</button>
            {mode === "reset_sent" ? (
              <div className="center">
                <div style={{ fontSize: 44 }}>✉️</div>
                <h3>{t("auth.resetSentTitle")}</h3>
                <p className="muted">{t("auth.checkInbox")} <b dir="ltr">{email}</b><br />{t("auth.resetSentTail")}</p>
                <button className="btn btn-ghost" style={{ marginTop: 10 }} onClick={() => switchMode("signin")}>
                  {t("auth.backToSignin")}
                </button>
              </div>
            ) : (
              <>
                {mode !== "reset" && (
                  <>
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10, marginBottom: 16 }}>
                      <Wordmark size={34} tone="light" />
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

                    <button type="button" onClick={signInGoogle} disabled={busy}
                      style={{
                        width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
                        padding: "11px", borderRadius: 12, border: "1px solid var(--line)",
                        background: "#fff", color: "#1f1e1d", fontWeight: 600, fontSize: 14, cursor: "pointer",
                      }}>
                      <GoogleSvg />
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

                {/* Sign In */}
                {mode === "signin" && (
                  <form onSubmit={signIn}>
                    <label>{t("auth.email")}</label>
                    <input type="email" required autoComplete="username" dir="ltr"
                      value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@law.co.il" />
                    <label style={{ marginTop: 12 }}>{t("auth.password")}</label>
                    <div style={{ position: "relative" }}>
                      <input type={showPw ? "text" : "password"} required autoComplete="current-password" dir="ltr"
                        value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••"
                        style={{ paddingInlineEnd: 42 }} />
                      <button type="button" onClick={() => setShowPw((v) => !v)}
                        aria-label={showPw ? "הסתר סיסמה" : "הצג סיסמה"}
                        style={{ position: "absolute", insetInlineEnd: 8, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "var(--cream-dim)", display: "grid", placeItems: "center", padding: 4 }}>
                        <span className="ms" style={{ fontSize: 20 }}>{showPw ? "visibility_off" : "visibility"}</span>
                      </button>
                    </div>
                    {err && <p style={{ color: "var(--burgundy-soft)", fontSize: 13, margin: "10px 0 0" }}>{err}</p>}
                    {needsConfirm && (
                      <button type="button" className="btn btn-ghost"
                        style={{ width: "100%", marginTop: 10, fontSize: 13 }}
                        onClick={resendConfirmation} disabled={busy}>
                        ✉️ שלח שוב מייל אימות
                      </button>
                    )}
                    <button className="btn btn-gold" style={{ width: "100%", marginTop: 18 }} disabled={busy}>
                      {busy ? <span className="spinner" /> : t("auth.enterNetwork")}
                    </button>
                    <button type="button" className="btn btn-ghost"
                      style={{ width: "100%", marginTop: 8, fontSize: 13 }}
                      onClick={signInMagicLink} disabled={busy}>
                      ✉️ כניסה עם קישור למייל, ללא סיסמה
                    </button>
                    <button type="button" className="btn btn-ghost"
                      style={{ width: "100%", marginTop: 8, fontSize: 13 }}
                      onClick={() => switchMode("reset")}>
                      {t("auth.forgot")}
                    </button>
                  </form>
                )}

                {/* Sign Up */}
                {mode === "signup" && (
                  <form onSubmit={signUp}>
                    <label>{t("auth.accountType")}</label>
                    <div style={{ display: "flex", gap: 8, marginBottom: 4 }}>
                      {(["attorney", "client"] as const).map((a) => (
                        <button key={a} type="button" onClick={() => setAcct(a)}
                          className={`btn ${acct === a ? "btn-gold" : "btn-ghost"}`}
                          style={{ flex: 1, fontSize: 13, padding: "10px 8px" }}>
                          {t(a === "attorney" ? "auth.attorney" : "auth.client")}
                        </button>
                      ))}
                    </div>
                    <label style={{ marginTop: 12 }}>{t("auth.fullName")}</label>
                    <input autoComplete="name"
                      value={name} onChange={(e) => setName(e.target.value)} placeholder={t("auth.namePlaceholder")} />
                    {acct === "attorney" && (
                      <>
                        <label style={{ marginTop: 12 }}>{t("auth.licCountry")}</label>
                        <select value={licCountry} onChange={(e) => setLicCountry(e.target.value)} dir="ltr">
                          {["IL", "US", "UK", "DE", "FR", "CA"].map((c) => <option key={c} value={c}>{t("c." + c)}</option>)}
                        </select>
                        {licCountry === "IL" ? (
                          <>
                            <label style={{ marginTop: 12 }}>{t("auth.licenseNo")}</label>
                            <input required dir="ltr" inputMode="numeric" maxLength={7}
                              value={licNo} onChange={(e) => setLicNo(e.target.value.replace(/[^\d]/g, ""))}
                              placeholder="43481" />
                            <p className="muted" style={{ fontSize: 11, marginTop: 6, lineHeight: 1.5 }}>
                              כל עורכי הדין בישראל חברי לשכת עורכי הדין. הזינו את מספר רישיון הלשכה (בדרך כלל 5 ספרות).
                            </p>
                          </>
                        ) : (
                          <>
                            <label style={{ marginTop: 12 }}>{t("auth.barCard")} <span style={{ color: "var(--burgundy-soft)" }}>*</span></label>
                            <input type="file" accept="image/*,application/pdf"
                              onChange={(e) => setBarCard(e.target.files?.[0] ?? null)} />
                            <p className="muted" style={{ fontSize: 11, marginTop: 6, lineHeight: 1.5 }}>{t("auth.barCardNote")}</p>
                          </>
                        )}
                      </>
                    )}
                    <label style={{ marginTop: 12 }}>{t("auth.email")}</label>
                    <input type="email" required autoComplete="username" dir="ltr"
                      value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@law.co.il" />
                    <label style={{ marginTop: 12 }}>{t("auth.password")} <span className="muted">{t("auth.passwordHint")}</span></label>
                    <input type="password" required autoComplete="new-password" dir="ltr"
                      value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
                    <label style={{ marginTop: 12 }}>{t("auth.confirmPassword")}</label>
                    <input type="password" required autoComplete="new-password" dir="ltr"
                      value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="••••••••" />
                    {err && <p style={{ color: "var(--burgundy-soft)", fontSize: 13, margin: "10px 0 0" }}>{err}</p>}
                    <button className="btn btn-gold" style={{ width: "100%", marginTop: 18 }} disabled={busy}>
                      {busy ? <span className="spinner" /> : t("auth.signupBtn")}
                    </button>
                    {acct === "attorney" && (
                      <p className="muted center" style={{ fontSize: 11, marginTop: 12, lineHeight: 1.5 }}>
                        {t("auth.licenseNote")}
                      </p>
                    )}
                  </form>
                )}

                {/* Reset password */}
                {mode === "reset" && (
                  <form onSubmit={resetPassword}>
                    <h4 style={{ marginTop: 0 }}>{t("auth.resetTitle")}</h4>
                    <p className="muted" style={{ marginTop: -8 }}>{t("auth.resetDesc")}</p>
                    <label>{t("auth.email")}</label>
                    <input type="email" required dir="ltr"
                      value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@law.co.il" />
                    {err && <p style={{ color: "var(--burgundy-soft)", fontSize: 13, margin: "10px 0 0" }}>{err}</p>}
                    <button className="btn btn-gold" style={{ width: "100%", marginTop: 18 }} disabled={busy}>
                      {busy ? <span className="spinner" /> : t("auth.resetSend")}
                    </button>
                    <button type="button" className="btn btn-ghost"
                      style={{ width: "100%", marginTop: 8 }}
                      onClick={() => switchMode("signin")}>{t("auth.back")}</button>
                  </form>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* === MARKETING / BELOW FOLD === */}
      <div ref={moreRef} style={{ position: "relative", zIndex: 2 }}>
        <div className="container" style={{ paddingTop: 20, paddingBottom: 20, maxWidth: 1100 }}>
          <PublicMap />
          <MembersStrip />
        </div>

        {/* Features section */}
        <div className="container" style={{ paddingTop: 36, paddingBottom: 44, maxWidth: 700 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20, flexWrap: "wrap" }}>
            <div className="tag" dir="ltr" style={{ fontSize: 11 }}>{t("hero.badge")}</div>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--ok)", fontWeight: 600 }}>
              <span className="conn-dot connected" /> {t("hero.live")}
            </span>
          </div>
          <h2 style={{ margin: "0 0 10px", fontSize: "clamp(22px, 4vw, 34px)", fontWeight: 900 }}>
            {t("hero.title1")} <span className="gold">{t("hero.title2")}</span>
          </h2>
          <p style={{ fontSize: 15.5, lineHeight: 1.8, color: "var(--cream-dim)", margin: "0 0 26px", maxWidth: 500 }}>
            {t("hero.lead")}
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 26 }}>
            {FEATURES.map((f) => (
              <div key={f.icon} style={{ display: "flex", alignItems: "center", gap: 14 }}>
                <span style={{ fontSize: 22, width: 30, flexShrink: 0, textAlign: "center" }}>{f.icon}</span>
                <span style={{ fontWeight: 600, fontSize: 15.5 }}>{t(f.key)}</span>
              </div>
            ))}
          </div>
          <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginBottom: 28, fontSize: 13, fontWeight: 600 }}>
            <span style={{ color: "var(--ok)" }}>{t("hero.trust1")}</span>
            <span style={{ color: "var(--ok)" }}>{t("hero.trust2")}</span>
            <span style={{ color: "var(--ok)" }}>{t("hero.trust3")}</span>
          </div>
          <div style={{ display: "flex", gap: 24, flexWrap: "wrap", marginBottom: 32 }}>
            {[
              { v: memberCount, suffix: "+", l: t("stats.members") },
              { v: 24, suffix: "", l: t("stats.areas") },
              { v: 6, suffix: "", l: t("stats.countries") },
              { v: 0, suffix: "%", l: t("stats.fee") },
            ].map((s) => (
              <div key={s.l} style={{ textAlign: "center" }}>
                <div className="score-glow" style={{ fontSize: 22 }}>
                  <CountUp value={s.v} suffix={s.suffix} />
                </div>
                <div className="muted" style={{ fontSize: 11, marginTop: 2 }}>{s.l}</div>
              </div>
            ))}
          </div>
          <button className="btn btn-gold" style={{ padding: "13px 30px", fontSize: 15.5 }}
            onClick={() => openAuth("signup", "attorney")}>
            הצטרפו כעורך דין, בחינם →
          </button>
          <div style={{ marginTop: 12, fontSize: 13.5 }}>
            <span className="muted">מחפשים עורך דין? </span>
            <button className="link" onClick={() => openAuth("signup", "client")}>כניסת לקוחות פרטיים</button>
          </div>
        </div>

        <ServicesStrip />
        <LandingExtras onJoin={() => openAuth("signup")} />
        <OfficeRentals />
        <DownloadApp />
      </div>

      {/* Minimal footer */}
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
              <h3 style={{ margin: 0 }}>{t("about")}</h3>
              <button className="btn btn-ghost" onClick={() => setAboutOpen(false)}>✕</button>
            </div>
            <p style={{ lineHeight: 1.7, marginTop: 12 }}>{t("about.body")}</p>
            <h4 style={{ margin: "16px 0 6px", color: "var(--gold)" }}>{t("about.storyTitle")}</h4>
            <p style={{ fontSize: 14, lineHeight: 1.8, color: "var(--cream-dim)" }}>{t("about.story")}</p>
            <p className="muted" style={{ fontSize: 13, lineHeight: 1.7, marginTop: 14, borderTop: "1px solid var(--line)", paddingTop: 12 }}>{t("about.founder")}</p>
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
