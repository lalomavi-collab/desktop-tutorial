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
  { icon: "🔄", key: "feat.knowledge" },
  { icon: "📩", key: "feat.network" },
  { icon: "🤝", key: "feat.leads" },
];

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
  const [err, setErr] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [aboutOpen, setAboutOpen] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const [memberCount, setMemberCount] = useState(40);
  const { t } = useI18n();

  function openAuth(m: Mode, who?: "attorney" | "client") { if (who) setAcct(who); setMode(m); setErr(null); setInfo(null); setAuthOpen(true); }

  useEffect(() => {
    supabase.from("ldr_demo_attorneys").select("id", { count: "exact", head: true })
      .then(({ count }) => { if (count) setMemberCount(count); });
  }, []);

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
    if (error) {
      setBusy(false);
      setErr(/not enabled/i.test(error.message)
        ? "התחברות עם Google תופעל בקרוב. בינתיים אפשר להיכנס עם קישור למייל או עם סיסמה."
        : mapError(error.message));
    }
  }

  // Passwordless sign in: email the user a one-click magic link (no password to
  // remember). Limited to existing accounts; new users go through the structured
  // signup flow that collects the Bar licence.
  async function signInMagicLink() {
    if (!email.trim()) { setErr("הזינו כתובת מייל לקבלת קישור כניסה"); return; }
    setBusy(true); setErr(null); setInfo(null);
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { shouldCreateUser: false, emailRedirectTo: window.location.origin + window.location.pathname },
    });
    setBusy(false);
    if (error) {
      setErr(/not allowed|not found|signups/i.test(error.message)
        ? "המייל אינו רשום עדיין. עברו ללשונית הרשמה כדי ליצור חשבון."
        : mapError(error.message));
      return;
    }
    setInfo("שלחנו קישור כניסה למייל. פתחו אותו כדי להיכנס, ללא סיסמה.");
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
    // Persist role/country (+ license) and upload the Bar card (non-IL) when a session exists.
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
        background: "rgba(255,255,255,0.82)", backdropFilter: "blur(18px) saturate(160%)",
      }}>
        <button onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })} aria-label="LAWDin, חזרה לראש העמוד"
          style={{ background: "none", border: "none", padding: 0, cursor: "pointer" }}>
          <Wordmark size={36} tagline={false} tone="light" />
        </button>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <LanguageSwitcher light />
          <NotificationsBell tone="light" />
          <button className="btn btn-ghost" style={{ padding: "7px 18px", fontSize: 13 }}
            onClick={() => openAuth("signin")}>{t("nav.signin")}</button>
          <button className="btn btn-gold" style={{ padding: "7px 18px", fontSize: 13 }}
            onClick={() => openAuth("signup")}>{t("nav.signup")}</button>
        </div>
      </nav>

      {inviteToken && (
        <div className="banner" style={{ borderRadius: 0, textAlign: "center" }}>
          {t("invite.banner")}
        </div>
      )}

      {/* ── Live map hero (Gett-style: straight to the map, no slogan) ── */}
      <div className="container" style={{ position: "relative", zIndex: 2, paddingTop: 20, maxWidth: 1100 }}>
        <PublicMap />
        <MembersStrip />
      </div>

      {/* ── Hero ── */}
      <div className="container" style={{ position: "relative", zIndex: 2, paddingTop: 40, paddingBottom: 48, maxWidth: 1100 }}>
        <div style={{ maxWidth: 640 }}>

          {/* ── Marketing ── */}
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

            <div style={{ marginBottom: 30 }}>
              <button className="btn btn-gold" style={{ padding: "13px 30px", fontSize: 15.5 }}
                onClick={() => openAuth("signup", "attorney")}>
                הצטרפו כעורך דין, בחינם →
              </button>
              <div style={{ marginTop: 12, fontSize: 13.5 }}>
                <span className="muted">מחפשים עורך דין? </span>
                <button className="link" onClick={() => openAuth("signup", "client")}>כניסת לקוחות פרטיים</button>
              </div>
            </div>

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
          </div>

        </div>
      </div>

      {/* ── Auth modal (popup) — keeps the page clean ── */}
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

                {/* ── Sign Up ── */}
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

                {/* ── Reset password ── */}
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

      {/* ── Service rubrics (incl. jobs) ── */}
      <ServicesStrip />
      <LandingExtras onJoin={() => openAuth("signup")} />

      {/* ── Office room rental (extra service) ── */}
      <OfficeRentals />

      {/* ── App download (Waze-style) ── */}
      <DownloadApp />

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

      {/* Always-visible quick join (easy connect) */}
      {!authOpen && (
        <button onClick={() => openAuth("signup", "attorney")} aria-label="הצטרפו כעורך דין, חינם"
          style={{ position: "fixed", insetInlineStart: 16, bottom: 16, zIndex: 50, border: "none", cursor: "pointer", fontFamily: "inherit", fontWeight: 800, fontSize: 15, color: "#fff", padding: "13px 24px", borderRadius: 999, background: "linear-gradient(145deg, #4dd2ff, #1ba3e0)", boxShadow: "0 12px 30px rgba(27,163,224,.45)" }}>
          הצטרפו כעו״ד, חינם →
        </button>
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
