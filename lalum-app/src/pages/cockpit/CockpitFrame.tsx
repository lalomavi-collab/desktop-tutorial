import { Link, NavLink, useNavigate } from "react-router-dom";
import { ClientNamesProvider, ClientNamesToggle } from "../../components/cockpit/ClientNames";
import { lazy, Suspense, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { useCardTables } from "../../lib/cockpit/useCardTables";
import { PageMeta } from "../../components/PageMeta";
import { RailDefs, RailIcon } from "../../components/cockpit/RailIcons";
import { Wordmark } from "../../components/Wordmark";
import { useAuth } from "../../context/AuthContext";
import { useCockpitAccess } from "../../lib/cockpit/shared";
import { LOOKS, lookAttrs, useCkLook } from "../../lib/cockpit/useCkLook";
import type { Membership } from "../../lib/cockpit/shared";
import { MfaGate } from "./MfaGate";
import { supabase } from "../../lib/supabase";
import { BookArt, CardArt2, ChartArt, CheckArt, FolderArt, GavelArt, HeadsetArt, ImportArt, InboxArt, ScalesArt, SearchArt, ShieldArt, TasksArt, TrashArt } from "../../components/cockpit/CockpitIllustrations";
import "../../styles/cockpit.css";
import "../../styles/cockpit-mint.css";
import "../../styles/cockpit-dashboard.css";
import "../../styles/cockpit-type.css";
import "../../styles/cockpit-navy.css";

// The control room strip loads after the screen itself, in its own chunk, and only for the platform admin.
const ControlStrip = lazy(() => import("../../components/cockpit/ControlStrip").then((m) => ({ default: m.ControlStrip })));

// The sidebar is grouped into labelled sections so the growing list of screens
// stays scannable. A null heading is the top group, shown without a label. In
// the narrow row layout the headings are hidden and every item flows inline.
type NavItem = [string, string, boolean, string];
const NAV_SECTIONS: Array<{ heading: string | null; items: NavItem[] }> = [
  { heading: null, items: [
    ["/workspace/dashboard", "לוח בקרה", false, "home"],
    ["/workspace/control", "חדר בקרה", false, "chart"],
    ["/workspace", "תיקים", false, "folder"],
  ] },
  { heading: "לקוחות ופניות", items: [
    ["/workspace/inquiries", "פניות לקוחות", false, "phone"],
    ["/workspace/calls", "שיחות נכנסות", false, "headset"],
    ["/workspace/inbox", "תיבת הודעות", false, "gavel"],
    ["/workspace/client-docs", "מסמכי לקוחות", false, "file"],
    ["/workspace/kyc", "הכר את הלקוח", false, "search"],
  ] },
  { heading: "עבודת הפירמה", items: [
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
    ["/workspace/campaigns", "קמפיינים", false, "share"],
  ] },
  { heading: "שותפים", items: [
    ["/workspace/partner", "תמונת שותף", false, "scale"],
    ["/workspace/portal-preview", "תצוגת פורטל", false, "user"],
  ] },
  { heading: "הגדרות", items: [
    ["/settings/members", "חברי הפירמה", false, "user"],
    ["/settings/billing", "חיוב והגדרות", false, "card"],
    ["/settings/security", "אבטחה", false, "shield"],
    ["/workspace/export", "ייצוא נתונים", false, "file"],
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
  "/workspace/payments": ScalesArt, "/workspace/discussions": CheckArt, "/workspace/campaigns": ChartArt, "/workspace/scheduling": TasksArt, "/workspace/hours": ChartArt,
  "/settings/members": GavelArt,
};

// The rail opens on the six screens used every day; "עוד" reveals the rest in their groups. The choice is remembered per browser.
const PRIMARY = new Set(["/workspace/dashboard", "/workspace/control", "/workspace", "/workspace/inquiries", "/workspace/tasks", "/workspace/scheduling", "/settings/billing"]);
function useRailOpen(): [boolean, () => void] {
  const [open, setOpen] = useState(false);
  useEffect(() => { try { if (localStorage.getItem("ck-rail-open") === "1") setOpen(true); } catch { /* storage blocked */ } }, []);
  const flip = () => setOpen((o) => { try { localStorage.setItem("ck-rail-open", o ? "0" : "1"); } catch { /* storage blocked */ } return !o; });
  return [open, flip];
}

// The external bookkeeper sees the bookkeeping system and nothing else; the database refuses the rest (0073), this keeps the interface honest.
const BOOKKEEPER_NAV: NavItem[] = [["/settings/billing", "הנהלת חשבונות", false, "card"]];
const BOOKKEEPER_PATHS = ["/settings/billing", "/workspace/guide"];

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
  const [look, setLook] = useCkLook();
  const [railOpen, flipRail] = useRailOpen();
  const mainRef = useRef<HTMLElement>(null);
  useCardTables(mainRef);
  // Number of unanswered inquiries, shown on the nav item (counts only; the rows themselves load on the inquiries screen).
  const [newInq, setNewInq] = useState(0);
  const hasMember = access.state !== "loading" && access.state !== "none" && !!access.member;
  const bookkeeper = hasMember && !access.platformAdmin && access.member?.role === "BOOKKEEPER";
  // The control room reads data only the platform admin may see, so its rail item and the strip are shown to that role only. The strip stays
  // on every screen, the wall included, and waits a beat so the screen the user came for paints first.
  const controlRoom = !!user && access.state === "ok" && access.platformAdmin;
  const [stripReady, setStripReady] = useState(false);
  useEffect(() => { if (!controlRoom) return; const t = window.setTimeout(() => setStripReady(true), 300); return () => window.clearTimeout(t); }, [controlRoom]);
  useEffect(() => {
    if (!hasMember || bookkeeper || !supabase) return;
    let live = true;
    const load = () => { void supabase!.from("lalum_matter_inquiries").select("id", { count: "exact", head: true }).eq("status", "NEW").then((r) => { if (live && r.count != null) setNewInq(r.count); }); };
    load();
    const t = setInterval(load, 60000);
    return () => { live = false; clearInterval(t); };
  }, [hasMember, bookkeeper]);
  let body: ReactNode;
  if (loading || access.state === "loading") body = <div className="ck-meta">טוען...</div>;
  else if (!user) body = <div className="ck-card" style={{ maxWidth: 480, margin: "40px auto" }}><div className="ck-title">נדרשת התחברות</div><div className="ck-meta">הכניסה לשותפים ולאדמין.</div><Link className="ck-btn primary" to="/login" style={{ alignSelf: "flex-start" }}>להתחברות</Link></div>;
  else if (access.state === "none") body = <div className="ck-card" style={{ maxWidth: 520, margin: "40px auto" }}><div className="ck-title">החשבון אינו משויך לפירמה</div><div className="ck-meta">כדי להשתמש בקוקפיט יש לצרף את החשבון לפירמה. פנו למנהל המערכת של LALUM.</div></div>;
  else if (needsFirm && !access.member) body = <div className="ck-card" style={{ maxWidth: 520, margin: "40px auto" }}><div className="ck-title">אין פירמה משויכת לחשבון זה</div><div className="ck-meta">מסך זה פועל בתוך פירמה. מסך הניהול זמין למנהל הפלטפורמה.</div></div>;
  else {
    const inner = bookkeeper && !BOOKKEEPER_PATHS.includes(path)
      ? <div className="ck-card" style={{ maxWidth: 520, margin: "40px auto" }}><div className="ck-title">מסך זה אינו חלק מהנהלת החשבונות</div><div className="ck-meta">לתפקיד הנהלת חשבונות יש גישה למערכת הנהלת החשבונות בלבד.</div><Link className="ck-btn primary" to="/settings/billing" style={{ alignSelf: "flex-start" }}>להנהלת חשבונות</Link></div>
      : children({ member: access.member, platformAdmin: access.platformAdmin });
    // The external bookkeeper signs in with a password only (owner's decision, 0079), so she gets no second factor screen.
    const partnerLike = access.platformAdmin || ["FIRM_PARTNER", "ADMIN"].includes(access.member?.role ?? "");
    body = mfa && partnerLike ? <MfaGate required={access.platformAdmin || access.member?.lalum_firms.require_mfa === true}>{inner}</MfaGate> : inner;
  }

  // Collapsed: the primary screens, plus the current screen when it is not one of them so the rail never hides where you are.
  const navSections = controlRoom ? NAV_SECTIONS : NAV_SECTIONS.map((x) => ({ ...x, items: x.items.filter(([to]) => to !== "/workspace/control") }));
  const allItems = navSections.flatMap((x) => x.items);
  const shown = allItems.filter(([to]) => PRIMARY.has(to) || to === path);
  const moreCount = allItems.length - shown.length;
  const sections: Array<{ heading: string | null; items: NavItem[] }> = bookkeeper ? [{ heading: null, items: BOOKKEEPER_NAV }] : railOpen ? navSections : [{ heading: null, items: shown }];
  return (
    <ClientNamesProvider>
    <div className="ck-root ck-with-sidebar" {...lookAttrs(look)} dir="rtl" lang="he">
      <PageMeta title={title} description={description} path={path} noindex />
      <aside className="ck-sidebar">
        <RailDefs />
        <div className="ck-sidebar-brand">
          {/* The logo leads back to the entry gate, the app's home screen (owner, 31.10.2026). */}
          <Link to={bookkeeper ? "/settings/billing" : "/workspace/start"} className="ck-brand-home" aria-label="LALUM, למסך הפתיחה">
            <Wordmark height={26} style={{ color: "var(--ck-brand-ink, var(--ink))" }} />
          </Link>
          <div className="ck-looks" role="group" aria-label="מראה הקוקפיט">{LOOKS.map(([k, label]) => <button key={k} type="button" className={`ck-look ck-look-${k}`} aria-pressed={look === k} aria-label={`מראה ${label}`} title={label} onClick={() => setLook(k)} />)}</div>
        </div>
        <nav className="ck-sidebar-nav" id="ck-rail-nav" aria-label="ניווט הקוקפיט">
          {sections.map((sec) => (
            <div key={sec.heading ?? "__top"} className="ck-nav-group" role="group" aria-label={sec.heading ?? undefined}>
              {sec.heading && railOpen && <div className="ck-nav-heading" aria-hidden="true">{sec.heading}</div>}
              {sec.items.map(([to, label, end]) => (
                <NavLink key={to} to={to} end={end || to === "/workspace"} className={to === "/workspace/dashboard" ? "ck-nav-sm" : undefined}>
                  <RailIcon id={to} size={to === "/workspace/dashboard" ? 28 : 38} /><span>{label}</span>{to === "/workspace/inquiries" && newInq > 0 && <b className="ck-navbadge" aria-label={`${newInq} פניות חדשות`}>{newInq}</b>}
                </NavLink>
              ))}
            </div>
          ))}
          {!bookkeeper && <button type="button" className="ck-railmore" aria-expanded={railOpen} aria-controls="ck-rail-nav" onClick={flipRail}><RailIcon id={railOpen ? "less" : "more"} size={30} /><span>{railOpen ? "פחות" : `עוד ${moreCount}`}</span></button>}
        </nav>
        <div className="ck-sidebar-foot">
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
        <main ref={mainRef}>{body}</main>
      </div>
      {controlRoom && stripReady && <Suspense fallback={null}><ControlStrip onWall={path === "/workspace/control"} /></Suspense>}
    </div>
    </ClientNamesProvider>
  );
}
