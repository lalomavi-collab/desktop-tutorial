import { useEffect, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { PageMeta } from "../components/PageMeta";
import { useLang } from "../context/LangContext";
import { supabase, passwordRecovery } from "../lib/supabase";
import { pwnedCount } from "../lib/pwnedCheck";
import { generateStrongPassword } from "../lib/strongPassword";
import { MfaGate } from "./cockpit/MfaGate";
import "../styles/cockpit.css";

// Reached only via the link Supabase's own reset email sends (see
// AuthContext.resetPassword's redirectTo). Clicking that link signs the
// visitor into a short-lived recovery session and fires a PASSWORD_RECOVERY
// auth event before this component ever renders a form; updateUser({password})
// then works like any other authenticated call. A visitor who lands here
// without that event (an expired or reused link) sees resetLinkInvalid
// instead of a form that would just fail.
//
// This page is a lazy route, so its own onAuthStateChange subscription below
// often attaches after the event already fired (lib/supabase.ts's
// module-scope listener catches it first and sets `passwordRecovery`); the
// effect stays only as a fallback for whatever edge case beats even that.
//
// A recovery link only ever grants an AAL1 session. If the account also has
// a TOTP factor enrolled, Supabase rejects updateUser({password}) with
// "AAL2 session is required" until that session is stepped up — so the form
// itself is wrapped in the same MfaGate the rest of the cockpit uses, which
// challenges for the 6-digit code first when (and only when) a factor
// exists, and otherwise renders the form straight through.
export function ResetPassword() {
  const { updatePassword, demoMode } = useAuth();
  const { t } = useLang();
  const L = t.ui.login;
  const navigate = useNavigate();
  const [ready, setReady] = useState(demoMode || passwordRecovery);
  const [password, setPassword] = useState("");
  const [revealed, setRevealed] = useState(false);
  const [copyLabel, setCopyLabel] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  function onGenerate() {
    setPassword(generateStrongPassword());
    setRevealed(true);
  }

  async function onCopy() {
    try {
      await navigator.clipboard.writeText(password);
      setCopyLabel(L.copiedPassword);
      setTimeout(() => setCopyLabel(null), 1500);
    } catch { /* clipboard unavailable; the field is still selectable */ }
  }

  useEffect(() => {
    if (!supabase) return;
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") setReady(true);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    if (!demoMode && (await pwnedCount(password)) > 0) {
      setBusy(false);
      setError(L.leakedPassword);
      return;
    }
    const res = await updatePassword(password);
    setBusy(false);
    if (res.error) {
      setError(res.error);
      return;
    }
    setDone(true);
  }

  return (
    <section className="wrap" style={{ maxWidth: 480, padding: "80px 32px 120px" }}>
      <PageMeta title="LALUM" path="/reset-password" noindex />
      <div className="card" style={{ padding: 40 }}>
        <h1 className="serif" style={{ fontSize: 30, textAlign: "center", margin: "0 0 8px" }}>{L.newPasswordTitle}</h1>

        {done ? (
          <>
            <div className="notice notice-ok" style={{ margin: "20px 0" }}>{L.passwordUpdated}</div>
            <button className="btn btn-clay" style={{ width: "100%", justifyContent: "center" }} onClick={() => navigate("/login")}>
              {L.signIn}
            </button>
          </>
        ) : !ready ? (
          <div className="notice notice-err" style={{ margin: "20px 0" }}>{L.resetLinkInvalid}</div>
        ) : (
          <MfaGate required={false}>
            <form onSubmit={onSubmit} style={{ display: "flex", flexDirection: "column", gap: 16, marginTop: 20 }}>
              {error && <div className="notice notice-err">{error}</div>}
              <div>
                <div className="label" style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
                  <span>{L.password}</span>
                  <button type="button" onClick={onGenerate} style={{ background: "none", border: 0, color: "var(--clay)", cursor: "pointer", fontSize: 13, fontWeight: 600, padding: 0 }}>
                    {L.generatePassword}
                  </button>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <input className="field" type={revealed ? "text" : "password"} autoComplete="new-password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} placeholder={L.passwordPlaceholder} dir="ltr" style={{ flex: 1 }} />
                  {revealed && password && (
                    <button type="button" className="btn" onClick={() => void onCopy()} style={{ flexShrink: 0 }}>
                      {copyLabel ?? L.copyPassword}
                    </button>
                  )}
                </div>
                <p className="muted" style={{ fontSize: 12.5, margin: "6px 0 0" }}>{revealed ? L.passwordGenerated : L.passwordHint}</p>
              </div>
              <button className="btn btn-clay" style={{ justifyContent: "center" }} disabled={busy}>
                {busy ? L.pleaseWait : L.newPasswordSubmit}
              </button>
            </form>
          </MfaGate>
        )}
      </div>
    </section>
  );
}
