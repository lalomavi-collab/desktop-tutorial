import { useEffect, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { PageMeta } from "../components/PageMeta";
import { useLang } from "../context/LangContext";
import { supabase } from "../lib/supabase";
import { pwnedCount } from "../lib/pwnedCheck";

// Reached only via the link Supabase's own reset email sends (see
// AuthContext.resetPassword's redirectTo). Clicking that link signs the
// visitor into a short-lived recovery session and fires a PASSWORD_RECOVERY
// auth event before this component ever renders a form; updateUser({password})
// then works like any other authenticated call. A visitor who lands here
// without that event (an expired or reused link) sees resetLinkInvalid
// instead of a form that would just fail.
export function ResetPassword() {
  const { updatePassword, demoMode } = useAuth();
  const { t } = useLang();
  const L = t.ui.login;
  const navigate = useNavigate();
  const [ready, setReady] = useState(demoMode);
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
          <form onSubmit={onSubmit} style={{ display: "flex", flexDirection: "column", gap: 16, marginTop: 20 }}>
            {error && <div className="notice notice-err">{error}</div>}
            <div>
              <div className="label">{L.password}</div>
              <input className="field" type="password" autoComplete="new-password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} placeholder={L.passwordPlaceholder} dir="ltr" />
              <p className="muted" style={{ fontSize: 12.5, margin: "6px 0 0" }}>{L.passwordHint}</p>
            </div>
            <button className="btn btn-clay" style={{ justifyContent: "center" }} disabled={busy}>
              {busy ? L.pleaseWait : L.newPasswordSubmit}
            </button>
          </form>
        )}
      </div>
    </section>
  );
}
