import { useEffect, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { PageMeta } from "../components/PageMeta";
import { useLang } from "../context/LangContext";
import { supabase, passwordRecovery } from "../lib/supabase";
import { pwnedCount } from "../lib/pwnedCheck";
import { evaluatePassword } from "../lib/passwordPolicy";
import { PasswordField } from "../components/PasswordField";
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
  const { user, updatePassword, demoMode } = useAuth();
  const { t } = useLang();
  const L = t.ui.login;
  const navigate = useNavigate();
  const [ready, setReady] = useState(demoMode || passwordRecovery);
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

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
    if (!evaluatePassword(password, { email: user?.email ?? undefined }).ok) {
      setError(t.ui.pw.policyFailed);
      return;
    }
    setBusy(true);
    if (!demoMode && (await pwnedCount(password)) > 0) {
      setBusy(false);
      setError(L.leakedPassword);
      return;
    }
    const res = await updatePassword(password);
    if (res.error) {
      setBusy(false);
      setError(res.error);
      return;
    }
    // A reset is often done because the account may be compromised: cut off every other session.
    // Best effort; the new password is already saved either way.
    if (supabase) await supabase.auth.signOut({ scope: "others" }).catch(() => undefined);
    setBusy(false);
    setPassword("");
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
              <PasswordField
                id="reset-password"
                label={L.password}
                value={password}
                onChange={setPassword}
                autoComplete="new-password"
                required
                showStrength
                generate
                context={{ email: user?.email ?? undefined }}
                placeholder={L.passwordPlaceholder}
                hint={L.passwordHint}
              />
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
