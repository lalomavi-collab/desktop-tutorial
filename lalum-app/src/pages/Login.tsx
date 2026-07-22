import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useLang } from "../context/LangContext";
import { REMEMBER_KEY } from "../lib/supabase";

export function Login() {
  const { signIn, signUp, demoMode } = useAuth();
  const { t } = useLang();
  const L = t.ui.login;
  const navigate = useNavigate();
  const [mode, setMode] = useState<"in" | "up">("in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setNotice(null);
    setBusy(true);
    // Record the choice before auth so the session lands in the right store.
    try { localStorage.setItem(REMEMBER_KEY, remember ? "1" : "0"); } catch { /* ignore */ }
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
    navigate("/portal");
  }

  return (
    <section className="wrap" style={{ maxWidth: 480, padding: "80px 32px 120px" }}>
      <div className="card" style={{ padding: 40 }}>
        <p className="eyebrow" style={{ textAlign: "center" }}>{L.eyebrow}</p>
        <h1 className="serif" style={{ fontSize: 30, textAlign: "center", margin: "0 0 8px" }}>
          {mode === "in" ? L.signIn : L.createAccount}
        </h1>
        <p className="muted" style={{ textAlign: "center", fontSize: 15, margin: "0 0 28px" }}>{L.subtitle}</p>

        {demoMode && <div className="notice notice-warn" style={{ marginBottom: 20 }}>{L.demo}</div>}
        {notice && <div className="notice notice-ok" style={{ marginBottom: 20 }}>{notice}</div>}
        {error && <div className="notice notice-err" style={{ marginBottom: 20 }}>{error}</div>}

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
          <label style={{ display: "flex", alignItems: "center", gap: 9, fontSize: 14, color: "var(--slate)", cursor: "pointer" }}>
            <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} style={{ width: 16, height: 16, accentColor: "var(--clay)" }} />
            {L.rememberMe}
          </label>
          <button className="btn btn-clay" style={{ justifyContent: "center", marginTop: 4 }} disabled={busy}>
            {busy ? L.pleaseWait : mode === "in" ? L.signIn : L.createAccount}
          </button>
        </form>

        <p className="muted" style={{ textAlign: "center", fontSize: 14, margin: "22px 0 0" }}>
          {mode === "in" ? L.newHere : L.haveAccount}
          <button
            onClick={() => { setMode(mode === "in" ? "up" : "in"); setError(null); setNotice(null); }}
            style={{ background: "none", border: 0, color: "var(--clay)", cursor: "pointer", fontWeight: 600, fontSize: 14 }}
          >
            {mode === "in" ? L.createAccount : L.signIn}
          </button>
        </p>
      </div>
    </section>
  );
}
