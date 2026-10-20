import { Link, NavLink, useNavigate } from "react-router-dom";
import { ClientNamesProvider, ClientNamesToggle } from "../../components/cockpit/ClientNames";
import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { PageMeta } from "../../components/PageMeta";
import { RailDefs, RailIcon } from "../../components/cockpit/RailIcons";
import { Wordmark } from "../../components/Wordmark";
import { useAuth } from "../../context/AuthContext";
import { useCockpitAccess } from "../../lib/cockpit/shared";
import type { Membership } from "../../lib/cockpit/shared";
import { MfaGate } from "./MfaGate";
import { supabase } from "../../lib/supabase";
import { BookArt, CardArt2, ChartArt, CheckArt, FolderArt, GavelArt, HeadsetArt, ImportArt, InboxArt, ScalesArt, SearchArt, ShieldArt, TasksArt, TrashArt } from "../../components/cockpit/CockpitIllustrations";
import "../../styles/cockpit.css";
import "../../styles/cockpit-mint.css";
import "../../styles/cockpit-dashboard.css";

// The sidebar is grouped into labelled sections so the growing list of screens
// stays scannable. A null heading is the top group, shown without a label. In
// the narrow row layout the headings are hidden and every item flows inline.
type NavItem = [string, string, boolean, string];
const NAV_SECTIONS: Array<{ heading: string | null; items: NavItem[] }> = [
  { heading: null, items: [
    ["/workspace/dashboard", "לוח בקרה", false, "home"],
    ["/workspace", "תיקים", false, "folder"],
  ] },
  { heading: "לקוחות ופניות", items: [
    ["/workspace/inquiries", "פניות לקוחות", false, "phone"],
    ["/workspace/calls", "שיחות נכנסות", false, "headset"],
    ["/workspace/inbox", "תיבת הודעות", false, "gavel"],
    ["/workspace/client-docs", "מסמכי לקוחות", false, "file"],
    ["/workspace/kyc", "הכר את הלקוח", false, "search"],
  ] },
  { heading: "עבודת המשרד", items: [
    ["/workspace/tasks", "משימות", false, "check"],
    ["/workspace/scheduling", "יומן ופגישות", false, "calendar"],
    ["/workspace/hours", "שעות עבודה", false, "calendar"],
    ["/workspace/scorecard", "מדדי שירות", false, "scale"],
    ["/workspace/import", "ייבוא תיקים", false, "plus"],
    ["/admin/matters", "ניהול תיקים", false, "gavel"],
  ] },
  { heading: "גבייה ותוכן", items: [
    ["/workspace/payments", "גביית לקוחות", false, "scale"],
    ["/workspace/discussions", "דיונים ציבוריים", false, "quote"],
  ] },
  { heading: "שותפים", items: [
    ["/workspace/partner", "תמונת מצב לשותף", false, "scale"],
    ["/workspace/portal-preview", "תצוגת פורטל", false, "user"],
  ] },
  { heading: "הגדרות", items: [
    ["/settings/members", "חברי המשרד", false, "user"],
    ["/settings/billing", "חיוב והגדרות", false, "card"],
    ["/settings/security", "אבטחה", false, "shield"],
    ["/workspace/export", "ייצוא נתוני המשרד", false, "file"],
  ] },
  { heading: "כללי", items: [
    ["/workspace/bin", "סל מיחזור", true, "trash"],
    ["/workspace/guide", "מדריך", true, "book"],
  ] },
];

// Every framed screen opens with a band: an illustration beside its own description. The dashboard and the matter list carry their own hero.
const BAND: Record<string, (p: { size?: number }) => ReactNode> = {
  "/workspace/inquiries": InboxArt, "/workspace/tasks": TasksArt, "/workspace/scorecard": ChartArt, "/workspace/import": ImportArt,
  "/workspace/kyc": SearchArt, "/admin/matters": GavelArt, "/workspace/bin": TrashArt, "/settings/billing": CardArt2,
  "/settings/security": ShieldArt, "/workspace/guide": BookArt,
  // The screens separated out of the client portal, and the roster screen.
  "/workspace/calls": HeadsetArt, "/workspace/inbox": InboxArt, "/workspace/client-docs": FolderArt,
  "/workspace/payments": ScalesArt, "/workspace/discussions": CheckArt, "/workspace/scheduling": TasksArt, "/workspace/hours": ChartArt,
  "/settings/members": GavelArt,
};

type CkTheme = "mint" | "dark";
// The cockpit opens in the light mint look; the choice is remembered per browser (storage may be blocked, so every access is guarded).
function useCkTheme(): [CkTheme, () => void] {
  const [theme, setTheme] = useState<CkTheme>("mint");
  useEffect(() => { try { const t = localStorage.getItem("ck-theme"); if (t === "dark" || t === "mint") setTheme(t); } catch { /* storage blocked */ } }, []);
  const flip = () => setTheme((t) => { const n = t === "mint" ? "dark" : "mint"; try { localStorage.setItem("ck-theme", n); } catch { /* storage blocked */ } return n; });
  return [theme, flip];
}

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
  const [theme, flipTheme] = useCkTheme();
  // Number of unanswered inquiries, shown on the nav item (counts only; the rows themselves load on the inquiries screen).
  const [newInq, setNewInq] = useState(0);
  const hasMember = access.state !== "loading" && access.state !== "none" && !!access.member;
  useEffect(() => {
    if (!hasMember || !supabase) return;
    let live = true;
    const load = () => { void supabase!.from("lalum_matter_inquiries").select("id", { count: "exact", head: true }).eq("status", "NEW").then((r) => { if (live && r.count != null) setNewInq(r.count); }); };
    load();
    const t = setInterval(load, 60000);
    return () => { live = false; clearInterval(t); };
  }, [hasMember]);
  let body: ReactNode;
  if (loading || access.state === "loading") body = <div className="ck-meta">טוען...</div>;
  else if (!user) body = <div className="ck-card" style={{ maxWidth: 480, margin: "40px auto" }}><div className="ck-title">נדרשת התחברות</div><div className="ck-meta">הכניסה לשותפים ולאדמין.</div><Link className="ck-btn primary" to="/login" style={{ alignSelf: "flex-start" }}>להתחברות</Link></div>;
  else if (access.state === "none") body = <div className="ck-card" style={{ maxWidth: 520, margin: "40px auto" }}><div className="ck-title">החשבון אינו משויך למשרד</div><div className="ck-meta">כדי להשתמש בקוקפיט יש לצרף את החשבון למשרד. פנו למנהל המערכת של LALUM.</div></div>;
  else if (needsFirm && !access.member) body = <div className="ck-card" style={{ maxWidth: 520, margin: "40px auto" }}><div className="ck-title">אין משרד משויך לחשבון זה</div><div className="ck-meta">מסך זה פועל בתוך משרד. מסך הניהול זמין למנהל הפלטפורמה.</div></div>;
  else {
    const inner = children({ member: access.member, platformAdmin: access.platformAdmin });
    const partnerLike = access.platformAdmin || ["FIRM_PARTNER", "ADMIN"].includes(access.member?.role ?? "");
    body = mfa && partnerLike ? <MfaGate required={access.platformAdmin || access.member?.lalum_firms.require_mfa === true}>{inner}</MfaGate> : inner;
  }

  return (
    <ClientNamesProvider>
    <div className="ck-root ck-with-sidebar" data-ck-theme={theme} dir="rtl" lang="he">
      <PageMeta title={title} description={description} path={path} noindex />
      <aside className="ck-sidebar">
        <RailDefs />
        <div className="ck-sidebar-brand"><Wordmark height={26} style={{ color: "var(--ink)" }} /></div>
        <nav className="ck-sidebar-nav" aria-label="ניווט הקוקפיט">
          {NAV_SECTIONS.map((sec) => (
            <div key={sec.heading ?? "__top"} className="ck-nav-group" role="group" aria-label={sec.heading ?? undefined}>
              {sec.heading && <div className="ck-nav-heading" aria-hidden="true">{sec.heading}</div>}
              {sec.items.map(([to, label, end]) => (
                <NavLink key={to} to={to} end={end || to === "/workspace"}>
                  <RailIcon id={to} size={32} /><span>{label}</span>{to === "/workspace/inquiries" && newInq > 0 && <b className="ck-navbadge" aria-label={`${newInq} פניות חדשות`}>{newInq}</b>}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>
        <div className="ck-sidebar-foot">
          <button type="button" className="ck-theme" onClick={flipTheme}><RailIcon id="theme" size={26} /><span>{theme === "mint" ? "מצב כהה" : "מצב בהיר"}</span></button>
          <Link to="/portal"><RailIcon id="user" size={26} /><span>אזור אישי</span></Link>
          <Link to="/"><RailIcon id="site" size={26} /><span>לאתר</span></Link>
          {user && (
            <button type="button" className="ck-logout" onClick={() => void leave()}>
              <RailIcon id="logout" size={26} /><span>התנתקות</span>
            </button>
          )}
        </div>
      </aside>
      <div className="ck-shell">
        <header className="ck-top">
          <h1 className="serif">{title}</h1>
          {hasMember && <ClientNamesToggle />}
        </header>
        {(() => { const Art = BAND[path]; return Art ? <div className="ck-band"><div className="ck-band-art"><Art size={92} /></div><p>{description}</p></div> : null; })()}
        <main>{body}</main>
      </div>
    </div>
    </ClientNamesProvider>
  );
}
