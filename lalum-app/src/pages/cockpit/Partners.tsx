import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { PageMeta } from "../../components/PageMeta";
import { Wordmark } from "../../components/Wordmark";
import { useAuth } from "../../context/AuthContext";
import { REMEMBER_KEY } from "../../lib/supabase";
import { useCockpitAccess } from "../../lib/cockpit/shared";
import "../../styles/cockpit.css";

// Abstract line-art for the partners entry: a skyline suggesting real estate
// on the left, a node graph suggesting AI/governance on the right, resolving
// into the same horizon line. Decorative only, never a stand-in for the
// Wordmark (see that component's own note on why a typeface substitute is a
// different mark).
function PartnersArt() {
  return (
    <svg viewBox="0 0 320 320" width="100%" height="100%" role="presentation" aria-hidden="true">
      <circle cx="120" cy="190" r="150" fill="var(--clay-tint)" opacity="0.5" />
      <circle cx="245" cy="175" r="95" fill="var(--clay-soft)" opacity="0.4" />
      <g fill="var(--paper)" stroke="var(--clay)" strokeWidth="1.4" opacity="0.85">
        <rect x="34" y="150" width="26" height="110" />
        <rect x="66" y="110" width="26" height="150" />
        <rect x="98" y="170" width="26" height="90" />
        <rect x="130" y="90" width="26" height="170" />
        <line x1="34" y1="150" x2="60" y2="150" />
        <line x1="34" y1="175" x2="60" y2="175" />
        <line x1="34" y1="200" x2="60" y2="200" />
        <line x1="34" y1="225" x2="60" y2="225" />
        <line x1="66" y1="130" x2="92" y2="130" />
        <line x1="66" y1="155" x2="92" y2="155" />
        <line x1="66" y1="180" x2="92" y2="180" />
        <line x1="66" y1="205" x2="92" y2="205" />
        <line x1="66" y1="230" x2="92" y2="230" />
        <line x1="130" y1="110" x2="156" y2="110" />
        <line x1="130" y1="135" x2="156" y2="135" />
        <line x1="130" y1="160" x2="156" y2="160" />
        <line x1="130" y1="185" x2="156" y2="185" />
        <line x1="130" y1="210" x2="156" y2="210" />
        <line x1="130" y1="235" x2="156" y2="235" />
      </g>
      <g stroke="var(--clay)" strokeWidth="1.2" opacity="0.55">
        <line x1="190" y1="200" x2="226" y2="150" />
        <line x1="190" y1="200" x2="236" y2="210" />
        <line x1="190" y1="200" x2="214" y2="240" />
        <line x1="226" y1="150" x2="262" y2="130" />
        <line x1="226" y1="150" x2="236" y2="210" />
        <line x1="236" y1="210" x2="214" y2="240" />
        <line x1="236" y1="210" x2="262" y2="130" />
        <line x1="262" y1="130" x2="284" y2="168" />
        <line x1="236" y1="210" x2="284" y2="168" />
      </g>
      <g fill="var(--clay)">
        <circle cx="190" cy="200" r="3.2" />
        <circle cx="226" cy="150" r="3.2" />
        <circle cx="236" cy="210" r="3.2" />
        <circle cx="214" cy="240" r="3.2" />
        <circle cx="262" cy="130" r="3.2" />
        <circle cx="284" cy="168" r="3.2" />
      </g>
      <line x1="20" y1="260" x2="300" y2="260" stroke="var(--line-strong)" strokeWidth="1" />
    </svg>
  );
}

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
    <div className="ck-root partners-root" dir="rtl" lang="he">
      <PageMeta title="כניסה לשותפים" description="כניסה למשרדים שותפים ולמנהלי LALUM." path="/partners" noindex />
      <div className="ck-shell partners-shell" style={{ maxWidth: 1040 }}>
        <header className="ck-top"><h1 className="serif">כניסה לשותפים</h1><nav className="ck-nav"><Link to="/">לאתר</Link><Link to="/workspace/guide">מה זה הקוקפיט?</Link></nav></header>
        <div className="partners-layout">
          <main className="ck-stack">
            <div className="ck-card partners-intro-card">
              <div className="ck-title partners-intro-title">אזור המשרדים השותפים</div>
              <div className="ck-meta partners-intro-meta">קליטה אוטומטית של תיקים, בדיקת ניגוד עניינים, סיכון לפי תחום ואישור שותף בארבעה שלבים. הגישה למשרדים ולמנהלי LALUM בלבד, ללא הרשמה עצמית.</div>
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
          <aside className="partners-aside" aria-hidden="true">
            <Wordmark height={40} style={{ color: "var(--ink)" }} />
            <p className="partners-tagline">נדל״ן והתחדשות עירונית, ובינה מלאכותית. שני תחומים, קו הכרעה אחד.</p>
            <div className="partners-art"><PartnersArt /></div>
          </aside>
        </div>
      </div>
    </div>
  );
}
