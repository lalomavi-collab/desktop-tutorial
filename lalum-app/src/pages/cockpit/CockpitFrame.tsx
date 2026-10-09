import { Link, NavLink, useNavigate } from "react-router-dom";
import type { ReactNode } from "react";
import { PageMeta } from "../../components/PageMeta";
import { Icon } from "../../components/Icon";
import { Wordmark } from "../../components/Wordmark";
import { useAuth } from "../../context/AuthContext";
import { useCockpitAccess } from "../../lib/cockpit/shared";
import type { Membership } from "../../lib/cockpit/shared";
import { MfaGate } from "./MfaGate";
import "../../styles/cockpit.css";

const NAV: Array<[string, string, boolean, string]> = [
  ["/workspace", "תיקים", false, "folder"],
  ["/workspace/kyc", "הכר את הלקוח", false, "search"],
  ["/admin/matters", "ניהול", false, "gavel"],
  ["/workspace/bin", "סל מיחזור", true, "trash"],
  ["/settings/billing", "חיוב והגדרות", false, "card"],
  ["/settings/security", "אבטחה", false, "shield"],
  ["/workspace/guide", "מדריך", true, "book"],
];

/** Standalone frame for the partner and admin area: Hebrew, RTL, gated by firm membership. */
export function CockpitFrame({
  title,
  description,
  path,
  children,
  needsFirm = true,
  mfa = true,
}: {
  title: string;
  description: string;
  path: string;
  children: (a: { member: Membership | null; platformAdmin: boolean }) => ReactNode;
  needsFirm?: boolean;
  mfa?: boolean;
}) {
  const { user, loading, signOut } = useAuth();
  const nav = useNavigate();
  async function leave() { await signOut(); nav("/", { replace: true }); }
  const access = useCockpitAccess();
  let body: ReactNode;
  if (loading || access.state === "loading") body = <div className="ck-meta">טוען...</div>;
  else if (!user) body = <div className="ck-card" style={{ maxWidth: 480, margin: "40px auto" }}><div className="ck-title">נדרשת התחברות</div><div className="ck-meta">הכניסה לשותפים ולאדמין.</div><Link className="ck-btn primary" to="/login" style={{ alignSelf: "flex-start" }}>להתחברות</Link></div>;
  else if (access.state === "none") body = <div className="ck-card" style={{ maxWidth: 520, margin: "40px auto" }}><div className="ck-title">החשבון אינו משויך למשרד</div><div className="ck-meta">כדי להשתמש בקוקפיט יש לצרף את החשבון למשרד. פנו למנהל המערכת של LALUM.</div></div>;
  else if (needsFirm && !access.member) body = <div className="ck-card" style={{ maxWidth: 520, margin: "40px auto" }}><div className="ck-title">אין משרד משויך לחשבון זה</div><div className="ck-meta">מסך זה פועל בתוך משרד. מסך הניהול זמין למנהל הפלטפורמה.</div></div>;
  else {
    const inner = children({ member: access.member, platformAdmin: access.platformAdmin });
    const partnerLike = access.platformAdmin || ["FIRM_PARTNER", "ADMIN"].includes(access.member?.role ?? "");
    body = mfa && partnerLike ? <MfaGate required={access.member?.lalum_firms.require_mfa === true}>{inner}</MfaGate> : inner;
  }

  return (
    <div className="ck-root ck-with-sidebar" dir="rtl" lang="he">
      <PageMeta title={title} description={description} path={path} noindex />
      <aside className="ck-sidebar">
        <div className="ck-sidebar-brand"><Wordmark height={26} style={{ color: "var(--ink)" }} /></div>
        <nav className="ck-sidebar-nav" aria-label="ניווט הקוקפיט">
          {NAV.map(([to, label, end, icon]) => (
            <NavLink key={to} to={to} end={end || to === "/workspace"}>
              <Icon name={icon} size={18} /><span>{label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="ck-sidebar-foot">
          <Link to="/portal"><Icon name="user" size={16} /><span>אזור אישי</span></Link>
          <Link to="/"><Icon name="home" size={16} /><span>לאתר</span></Link>
          {user && (
            <button type="button" className="ck-logout" onClick={() => void leave()}>
              <Icon name="logout" size={16} /><span>התנתקות</span>
            </button>
          )}
        </div>
      </aside>
      <div className="ck-shell">
        <header className="ck-top">
          <h1 className="serif">{title}</h1>
        </header>
        <main>{body}</main>
      </div>
    </div>
  );
}
