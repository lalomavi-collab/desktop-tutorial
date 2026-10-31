import { useEffect, useState, type FormEvent } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { PageMeta } from "../components/PageMeta";
import { useLang } from "../context/LangContext";
import { REMEMBER_KEY, supabase } from "../lib/supabase";
import { pwnedCount } from "../lib/pwnedCheck";
import { evaluatePassword } from "../lib/passwordPolicy";
import { PasswordField } from "../components/PasswordField";

const RESEND_COOLDOWN_SECONDS = 30;

// Social sign-in shows only when it is switched on for the environment, so it
// never appears before the Google and Microsoft providers are configured in
// Supabase (a button that cannot complete is worse than no button).
const SSO_ENABLED = import.meta.env.VITE_ENABLE_SSO === "true";

// Provider marks for the quick sign-in buttons. These are Google's and
// Microsoft's own brand marks, used only to label their sign-in button, which
// is their intended use. They are not the LALUM logo and never stand in for it.
function GoogleMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </svg>
  );
}
function MicrosoftMark() {
  return (
    <svg width="17" height="17" viewBox="0 0 23 23" aria-hidden="true">
      <path fill="#F25022" d="M1 1h10v10H1z" />
      <path fill="#7FBA00" d="M12 1h10v10H12z" />
      <path fill="#00A4EF" d="M1 12h10v10H1z" />
      <path fill="#FFB900" d="M12 12h10v10H12z" />
    </svg>
  );
}


export function Login() {
  const { signIn, signInWithProvider, signUp, resetPassword, verifyRecoveryCode, demoMode } = useAuth();
  const { t, lang } = useLang();
  const L = t.ui.login;
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [mode, setMode] = useState<"in" | "up" | "reset">(params.get("mode") === "reset" ? "reset" : "in");
  // The reset email carries both a code and a link (#661-#664 cover the
  // link); "code" lets a visitor type the one-time code instead of
  // switching to their inbox and back.
  const [resetStep, setResetStep] = useState<"request" | "code">("request");
  const [code, setCode] = useState("");
  const [resendCooldown, setResendCooldown] = useState(0);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true);
  const [leadConsent, setLeadConsent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setTimeout(() => setResendCooldown((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendCooldown]);

  async function onResetSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setNotice(null);
    setBusy(true);
    const res = await resetPassword(email);
    setBusy(false);
    // Never reveal whether the address exists: same notice either way.
    if (res.error) { setError(res.error); return; }
    setNotice(L.resetSent);
    setResetStep("code");
    setResendCooldown(RESEND_COOLDOWN_SECONDS);
  }

  async function onResend() {
    if (resendCooldown > 0) return;
    setError(null);
    const res = await resetPassword(email);
    if (res.error) { setError(res.error); return; }
    setNotice(L.resetSent);
    setResendCooldown(RESEND_COOLDOWN_SECONDS);
  }

  async function onCodeSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const res = await verifyRecoveryCode(email, code);
    setBusy(false);
    if (res.error) { setError(res.error); return; }
    navigate("/reset-password");
  }

  async function onProvider(provider: "google" | "azure") {
    setError(null);
    setNotice(null);
    setBusy(true);
    // Keep the same "remember me" choice the email flow records, so the
    // session that returns from the provider lands in the right store.
    try { localStorage.setItem(REMEMBER_KEY, remember ? "1" : "0"); } catch { /* ignore */ }
    const res = await signInWithProvider(provider);
    // On success the browser redirects to the provider, so there is nothing
    // more to do here; only an immediate failure returns with a message.
    if (res.error) { setBusy(false); setError(res.error); }
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setNotice(null);
    setBusy(true);
    // Record the choice before auth so the session lands in the right store.
    try { localStorage.setItem(REMEMBER_KEY, remember ? "1" : "0"); } catch { /* ignore */ }
    // A new password must meet the policy (length, not common, not built from the email).
    if (mode === "up" && !evaluatePassword(password, { email }).ok) {
      setBusy(false);
      setError(t.ui.pw.policyFailed);
      return;
    }
    // On account creation, reject passwords known from public breaches (the
    // free, in-app equivalent of Supabase's Pro leaked-password protection).
    // Skipped in demo mode, which has no real backend to protect.
    if (mode === "up" && !demoMode && (await pwnedCount(password)) > 0) {
      setBusy(false);
      setError(L.leakedPassword);
      return;
    }
    const res = mode === "in" ? await signIn(email, password) : await signUp(email, password, lang);
    setBusy(false);
    if (res.error) {
      setError(res.error);
      return;
    }
    if (mode === "up" && res.needsConfirmation) {
      setNotice(L.confirmEmail);
      setMode("in");
      return;
    }
    // Partners and admins land on the entry gate (the app's home screen, owner 31.10.2026); everyone else in the client portal.
    let dest = "/portal";
    if (supabase) {
      const { data: auth } = await supabase.auth.getUser();
      if (auth.user) {
        const [m, a] = await Promise.all([
          supabase.from("lalum_firm_members").select("firm_id").eq("user_id", auth.user.id).maybeSingle(),
          supabase.rpc("lalum_is_admin"),
        ]);
        if (m.data || a.data === true) dest = "/workspace/start";
      }
    }
    navigate(dest);
  }

  return (
    <section className="wrap" style={{ maxWidth: 480, padding: "80px 32px 120px" }}>
      <PageMeta title="LALUM" path="/login" noindex />
      <div className="card" style={{ padding: 40 }}>
        <p className="eyebrow" style={{ textAlign: "center" }}>{L.eyebrow}</p>
        <h1 className="serif" style={{ fontSize: 30, textAlign: "center", margin: "0 0 8px" }}>
          {mode === "reset" ? L.resetTitle : mode === "in" ? L.signIn : L.createAccount}
        </h1>
        <p className="muted" style={{ textAlign: "center", fontSize: 15, margin: "0 0 28px" }}>
          {mode === "reset" ? L.resetSubtitle : L.subtitle}
        </p>

        {demoMode && <div className="notice notice-warn" style={{ marginBottom: 20 }}>{L.demo}</div>}
        {notice && <div className="notice notice-ok" style={{ marginBottom: 20 }}>{notice}</div>}
        {error && <div className="notice notice-err" style={{ marginBottom: 20 }}>{error}</div>}

        {/* Quick sign-in with a social provider. Shown for sign-in and sign-up,
            not on the reset screen, and only when a real backend is configured
            (demo mode has no provider to redirect to). */}
        {!demoMode && SSO_ENABLED && mode !== "reset" && (
          <>
            <div className="oauth-buttons">
              <button type="button" className="btn-oauth" onClick={() => void onProvider("google")} disabled={busy}>
                <GoogleMark /> {L.googleSignIn}
              </button>
              <button type="button" className="btn-oauth" onClick={() => void onProvider("azure")} disabled={busy}>
                <MicrosoftMark /> {L.microsoftSignIn}
              </button>
            </div>
            <div className="oauth-divider"><span>{L.ssoOr}</span></div>
          </>
        )}

        {mode === "reset" ? (
          resetStep === "request" ? (
            <form onSubmit={onResetSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div>
                <div className="label">{L.email}</div>
                <input className="field" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder={L.emailPlaceholder} dir="ltr" />
              </div>
              <button className="btn btn-clay" style={{ justifyContent: "center", marginTop: 4 }} disabled={busy}>
                {busy ? L.pleaseWait : L.resetSend}
              </button>
            </form>
          ) : (
            <form onSubmit={onCodeSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div>
                <div className="label">{L.resetCodeLabel}</div>
                <input className="field" inputMode="numeric" autoComplete="one-time-code" required maxLength={10} minLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} placeholder={L.resetCodePlaceholder} dir="ltr" />
              </div>
              <button className="btn btn-clay" style={{ justifyContent: "center", marginTop: 4 }} disabled={busy || code.length < 6}>
                {busy ? L.pleaseWait : L.resetCodeSubmit}
              </button>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                <button type="button" onClick={() => void onResend()} disabled={resendCooldown > 0} style={{ background: "none", border: 0, color: "var(--clay)", cursor: resendCooldown > 0 ? "default" : "pointer", opacity: resendCooldown > 0 ? 0.6 : 1, padding: 0 }}>
                  {resendCooldown > 0 ? `${L.resendCode} (${resendCooldown})` : L.resendCode}
                </button>
                <button type="button" onClick={() => { setResetStep("request"); setCode(""); setError(null); setNotice(null); }} style={{ background: "none", border: 0, color: "var(--clay)", cursor: "pointer", padding: 0 }}>
                  {L.changeEmail}
                </button>
              </div>
            </form>
          )
        ) : (
          <form onSubmit={onSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div>
              <div className="label">{L.email}</div>
              <input className="field" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder={L.emailPlaceholder} dir="ltr" />
            </div>
            <PasswordField
              id="login-password"
              label={L.password}
              value={password}
              onChange={setPassword}
              autoComplete={mode === "in" ? "current-password" : "new-password"}
              required
              showStrength={mode === "up"}
              generate={mode === "up"}
              context={{ email }}
              placeholder={mode === "up" ? L.passwordPlaceholder : undefined}
              hint={L.passwordHint}
            />
            {mode === "in" && (
              <button
                type="button"
                onClick={() => { setMode("reset"); setResetStep("request"); setError(null); setNotice(null); }}
                style={{ background: "none", border: 0, color: "var(--clay)", cursor: "pointer", fontSize: 13, textAlign: "start", padding: 0 }}
              >
                {L.forgotPassword}
              </button>
            )}
            <label style={{ display: "flex", alignItems: "center", gap: 9, fontSize: 14, color: "var(--slate)", cursor: "pointer" }}>
              <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} style={{ width: 16, height: 16, accentColor: "var(--clay)" }} />
              {L.rememberMe}
            </label>
            {mode === "up" && (
              <label style={{ display: "flex", alignItems: "flex-start", gap: 9, fontSize: 13, color: "var(--slate)", cursor: "pointer" }}>
                <input type="checkbox" required checked={leadConsent} onChange={(e) => setLeadConsent(e.target.checked)} style={{ width: 16, height: 16, marginTop: 2, accentColor: "var(--clay)" }} />
                {L.leadConsent}
              </label>
            )}
            <button className="btn btn-clay" style={{ justifyContent: "center", marginTop: 4 }} disabled={busy}>
              {busy ? L.pleaseWait : mode === "in" ? L.signIn : L.createAccount}
            </button>
          </form>
        )}

        <p className="muted" style={{ textAlign: "center", fontSize: 14, margin: "22px 0 0" }}>
          {mode === "reset" ? (
            <button
              onClick={() => { setMode("in"); setResetStep("request"); setError(null); setNotice(null); }}
              style={{ background: "none", border: 0, color: "var(--clay)", cursor: "pointer", fontWeight: 600, fontSize: 14 }}
            >
              {L.backToSignIn}
            </button>
          ) : (
            <>
              {mode === "in" ? L.newHere : L.haveAccount}
              <button
                onClick={() => { setMode(mode === "in" ? "up" : "in"); setError(null); setNotice(null); }}
                style={{ background: "none", border: 0, color: "var(--clay)", cursor: "pointer", fontWeight: 600, fontSize: 14 }}
              >
                {mode === "in" ? L.createAccount : L.signIn}
              </button>
            </>
          )}
        </p>
        <p className="muted" style={{ textAlign: "center", fontSize: 13, margin: "12px 0 0" }}>
          {/* Plain anchor, not <Link>: /partners is Hebrew-only and has no
              file under a language prefix for <Link>'s basename-prefixed
              href to resolve to (same fix as the header's partner-login
              link). */}
          <a href="/partners/" style={{ color: "var(--clay)" }}>כניסה ייעודית למשרדים שותפים</a>
        </p>
      </div>
    </section>
  );
}
