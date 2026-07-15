import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export function Login() {
  const { signIn, signUp, demoMode } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState<"in" | "up">("in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setNotice(null);
    setBusy(true);
    const res = mode === "in" ? await signIn(email, password) : await signUp(email, password);
    setBusy(false);
    if (res.error) {
      setError(res.error);
      return;
    }
    if (mode === "up" && !demoMode) {
      setNotice("Check your inbox to confirm your email, then sign in.");
      setMode("in");
      return;
    }
    navigate("/portal");
  }

  return (
    <section className="wrap" style={{ maxWidth: 480, padding: "80px 32px 120px" }}>
      <div className="card" style={{ padding: 40 }}>
        <p className="eyebrow" style={{ textAlign: "center" }}>Client area</p>
        <h1 className="serif" style={{ fontSize: 30, textAlign: "center", margin: "0 0 8px" }}>
          {mode === "in" ? "Sign in" : "Create an account"}
        </h1>
        <p className="muted" style={{ textAlign: "center", fontSize: 15, margin: "0 0 28px" }}>
          Access your Tech-Legal diagnostics, bookings, and attorney verification.
        </p>

        {demoMode && (
          <div className="notice notice-warn" style={{ marginBottom: 20 }}>
            Demo mode: no Supabase connection is configured, so any email and a 6+ character password will sign you in locally.
          </div>
        )}
        {notice && <div className="notice notice-ok" style={{ marginBottom: 20 }}>{notice}</div>}
        {error && <div className="notice notice-err" style={{ marginBottom: 20 }}>{error}</div>}

        <form onSubmit={onSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div>
            <div className="label">Email</div>
            <input className="field" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@company.com" />
          </div>
          <div>
            <div className="label">Password</div>
            <input className="field" type="password" autoComplete={mode === "in" ? "current-password" : "new-password"} required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="At least 6 characters" />
          </div>
          <button className="btn btn-clay" style={{ justifyContent: "center", marginTop: 4 }} disabled={busy}>
            {busy ? "Please wait…" : mode === "in" ? "Sign in" : "Create account"}
          </button>
        </form>

        <p className="muted" style={{ textAlign: "center", fontSize: 14, margin: "22px 0 0" }}>
          {mode === "in" ? "New to LALUM? " : "Already have an account? "}
          <button
            onClick={() => { setMode(mode === "in" ? "up" : "in"); setError(null); setNotice(null); }}
            style={{ background: "none", border: 0, color: "var(--clay)", cursor: "pointer", fontWeight: 600, fontSize: 14 }}
          >
            {mode === "in" ? "Create an account" : "Sign in"}
          </button>
        </p>
      </div>
    </section>
  );
}
