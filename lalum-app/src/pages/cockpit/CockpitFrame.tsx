import { Link, NavLink } from "react-router-dom";
import type { ReactNode } from "react";
import { PageMeta } from "../../components/PageMeta";
import { useAuth } from "../../context/AuthContext";
import { useCockpitAccess } from "../../lib/cockpit/shared";
import type { Membership } from "../../lib/cockpit/shared";
import "../../styles/cockpit.css";

const NAV: Array<[string, string, boolean]> = [
  ["/workspace", "תיקים", false],
  ["/admin/matters", "ניהול", false],
  ["/settings/billing", "חיוב והגדרות", false],
  ["/workspace/guide", "מדריך", true],
];

/** Standalone frame for the partner and admin area: Hebrew, RTL, gated by firm membership. */
export function CockpitFrame({
  title,
  description,
  path,
  children,
  needsFirm = true,
}: {
  title: string;
  description: string;
  path: string;
  children: (a: { member: Membership | null; platformAdmin: boolean }) => ReactNode;
  needsFirm?: boolean;
}) {
  const { user, loading } = useAuth();
  const access = useCockpitAccess();
  let body: ReactNode;
  if (loading || access.state === "loading") body = <div className="ck-meta">טוען...</div>;
  else if (!user) body = <div className="ck-card" style={{ maxWidth: 480, margin: "40px auto" }}><div className="ck-title">נדרשת התחברות</div><div className="ck-meta">הכניסה לשותפים ולאדמין.</div><Link className="ck-btn primary" to="/login" style={{ alignSelf: "flex-start" }}>להתחברות</Link></div>;
  else if (access.state === "none") body = <div className="ck-card" style={{ maxWidth: 520, margin: "40px auto" }}><div className="ck-title">החשבון אינו משויך למשרד</div><div className="ck-meta">כדי להשתמש בקוקפיט יש לצרף את החשבון למשרד. פנו למנהל המערכת של LALUM.</div></div>;
  else if (needsFirm && !access.member) body = <div className="ck-card" style={{ maxWidth: 520, margin: "40px auto" }}><div className="ck-title">אין משרד משויך לחשבון זה</div><div className="ck-meta">מסך זה פועל בתוך משרד. מסך הניהול זמין למנהל הפלטפורמה.</div></div>;
  else body = children({ member: access.member, platformAdmin: access.platformAdmin });

  return (
    <div className="ck-root" dir="rtl" lang="he">
      <PageMeta title={title} description={description} path={path} noindex />
      <div className="ck-shell">
        <header className="ck-top">
          <h1 className="serif">{title}</h1>
          <nav className="ck-nav" aria-label="ניווט הקוקפיט">
            {NAV.map(([to, label, end]) => (
              <NavLink key={to} to={to} end={end || to === "/workspace"}>{label}</NavLink>
            ))}
            <Link to="/portal">אזור אישי</Link>
            <Link to="/">לאתר</Link>
          </nav>
        </header>
        <main>{body}</main>
      </div>
    </div>
  );
}
