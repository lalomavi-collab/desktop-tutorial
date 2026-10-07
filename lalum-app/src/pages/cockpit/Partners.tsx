import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { PageMeta } from "../../components/PageMeta";
import { useAuth } from "../../context/AuthContext";
import { REMEMBER_KEY } from "../../lib/supabase";
import { useCockpitAccess } from "../../lib/cockpit/shared";
import "../../styles/cockpit.css";

/** Dedicated entry for law-firm partners and platform admins. Sign-in only: accounts are provisioned by LALUM. */
export function Partners() {
  const { user, loading, signIn, signOut } = useAuth();
  const access = useCockpitAccess();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (user && access.state === "ok") navigate("/workspace", { replace: true });
  }, [user, access.state, navigate]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try { localStorage.setItem(REMEMBER_KEY, "1"); } catch { /* ignore */ }
    const res = await signIn(email, password);
    setBusy(false);
    if (res.error) setError(res.error);
  }

  return (
    <div className="ck-root" dir="rtl" lang="he">
      <PageMeta title="כניסה לשותפים" description="כניסה למשרדים שותפים ולמנהלי LALUM." path="/partners" noindex />
      <div className="ck-shell" style={{ maxWidth: 560 }}>
        <header className="ck-top"><h1 className="serif">כניסה לשותפים</h1><nav className="ck-nav"><Link to="/">לאתר</Link><Link to="/workspace/guide">מה זה הקוקפיט?</Link></nav></header>
        <main className="ck-stack">
          <div className="ck-card">
            <div className="ck-title">אזור המשרדים השותפים</div>
            <div className="ck-meta">קליטה אוטומטית של תיקים, בדיקת ניגוד עניינים, סיכון לפי תחום ואישור שותף בארבעה שלבים. הגישה למשרדים ולמנהלי LALUM בלבד, ללא הרשמה עצמית.</div>
          </div>
          {loading || (user && access.state === "loading") ? <div className="ck-meta">טוען...</div>
            : user && access.state === "none" ? (
              <div className="ck-card"><div className="ck-title">החשבון אינו משויך למשרד</div>
                <div className="ck-meta">{user.email} מחובר, אך אינו חבר במשרד. פנו אל LALUM לצירוף החשבון.</div>
                <div className="ck-row"><button className="ck-btn" onClick={() => void signOut()}>התנתקות</button><Link className="ck-btn" to="/portal">לאזור האישי</Link></div></div>
            ) : !user ? (
              <form className="ck-card" onSubmit={onSubmit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {error && <div className="ck-err" aria-live="polite">{error}</div>}
                <label className="ck-label" htmlFor="p-email">דוא"ל</label>
                <input id="p-email" className="field" type="email" autoComplete="email" required dir="ltr" value={email} onChange={(e) => setEmail(e.target.value)} />
                <label className="ck-label" htmlFor="p-pass">סיסמה</label>
                <input id="p-pass" className="field" type="password" autoComplete="current-password" required dir="ltr" value={password} onChange={(e) => setPassword(e.target.value)} />
                <button className="ck-btn primary" disabled={busy}>{busy ? "נכנס..." : "כניסה"}</button>
                <div className="ck-meta">אין לכם גישה עדיין? <Link to="/book">תיאום שיחה עם LALUM</Link></div>
              </form>
            ) : null}
        </main>
      </div>
    </div>
  );
}
