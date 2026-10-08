import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { PageMeta } from "../components/PageMeta";
import { useLang } from "../context/LangContext";
import { REMEMBER_KEY, supabase } from "../lib/supabase";
import { pwnedCount } from "../lib/pwnedCheck";

const RESEND_COOLDOWN_SECONDS = 30;

export function Login() {
  const { signIn, signUp, resetPassword, verifyRecoveryCode, demoMode } = useAuth();
  const { t } = useLang();
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

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setNotice(null);
    setBusy(true);
    // Record the choice before auth so the session lands in the right store.
    try { localStorage.setItem(REMEMBER_KEY, remember ? "1" : "0"); } catch { /* ignore */ }
    // On account creation, reject passwords known from public breaches (the
    // free, in-app equivalent of Supabase's Pro leaked-password protection).
    // Skipped in demo mode, which has no real backend to protect.
    if (mode === "up" && !demoMode && (await pwnedCount(password)) > 0) {
      setBusy(false);
      setError(L.leakedPassword);
      return;
    }
    const res = mode === "in" ? await signIn(email, password) : await signUp(email, password);
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
    // Partners and admins land in the case cockpit; everyone else in the client portal.
    let dest = "/portal";
    if (supabase) {
      const { data: auth } = await supabase.auth.getUser();
      if (auth.user) {
        const [m, a] = await Promise.all([
          supabase.from("lalum_firm_members").select("firm_id").eq("user_id", auth.user.id).maybeSingle(),
          supabase.rpc("lalum_is_admin"),
        ]);
        if (m.data || a.data === true) dest = "/workspace";
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
                <input className="field" inputMode="numeric" autoComplete="one-time-code" required maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} placeholder={L.resetCodePlaceholder} dir="ltr" />
              </div>
              <button className="btn btn-clay" style={{ justifyContent: "center", marginTop: 4 }} disabled={busy || code.length !== 6}>
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
            <div>
              <div className="label">{L.password}</div>
              <input className="field" type="password" autoComplete={mode === "in" ? "current-password" : "new-password"} required minLength={mode === "up" ? 8 : undefined} value={password} onChange={(e) => setPassword(e.target.value)} placeholder={L.passwordPlaceholder} dir="ltr" />
              {mode === "up" && <p className="muted" style={{ fontSize: 12.5, margin: "6px 0 0" }}>{L.passwordHint}</p>}
            </div>
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
          <Link to="/partners" style={{ color: "var(--clay)" }}>כניסה ייעודית למשרדים שותפים</Link>
        </p>
      </div>
    </section>
  );
}
