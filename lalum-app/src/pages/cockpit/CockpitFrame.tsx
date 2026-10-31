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
import { bootCkPrefs } from "../../lib/cockpit/ckPrefs";
import type { Membership } from "../../lib/cockpit/shared";
import { MfaGate } from "./MfaGate";
import { QuickAdd } from "../../components/cockpit/QuickAdd";
import { Icon } from "../../components/Icon";
import { CkLangSwitch } from "../../components/cockpit/CkLangSwitch";
import { LOOK_EN, NAV_EN, NAV_HEADING_EN, SCREEN_EN, TRANSLATED_SCREENS, useCkLang } from "../../lib/cockpit/ckLang";
import { supabase } from "../../lib/supabase";
import { BookArt, CardArt2, ChartArt, CheckArt, FolderArt, GavelArt, HeadsetArt, ImportArt, InboxArt, ScalesArt, SearchArt, ShieldArt, SlidersArt, TasksArt, TrashArt } from "../../components/cockpit/CockpitIllustrations";
import "../../styles/cockpit.css";
import "../../styles/cockpit-mint.css";
import "../../styles/cockpit-dashboard.css";
import "../../styles/cockpit-type.css";
import "../../styles/cockpit-navy.css";
import "../../styles/cockpit-rail-more.css";

// The personal display preferences (text size, contrast, motion) apply as soon as the frame's code loads, before it paints.
bootCkPrefs();

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
    ["/settings/preferences", "העדפות תצוגה", false, "sliders"],
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
  "/settings/security": ShieldArt, "/workspace/guide": BookArt, "/settings/preferences": SlidersArt,
  // The screens separated out of the client portal, and the roster screen.
  "/workspace/calls": HeadsetArt, "/workspace/inbox": InboxArt, "/workspace/client-docs": FolderArt,
  "/workspace/payments": ScalesArt, "/workspace/discussions": CheckArt, "/workspace/campaigns": ChartArt, "/workspace/scheduling": TasksArt, "/workspace/hours": ChartArt,
  "/settings/members": GavelArt,
};

// A short rail (owner, 31.10.2026, from the competitor scan): the four screens used every day, plus the screen you are on when it is
// not one of them, so the rail never hides where you are. "עוד כלים" opens every other screen in its group, in a panel beside the rail.
const PRIMARY = new Set(["/workspace/dashboard", "/workspace", "/workspace/inquiries", "/settings/billing"]);

// The external bookkeeper sees the bookkeeping system and nothing else; the database refuses the rest (0073), this keeps the interface honest.
// Display preferences are personal and touch no data, so the bookkeeper has them too.
const BOOKKEEPER_NAV: NavItem[] = [["/settings/billing", "הנהלת חשבונות", false, "card"], ["/settings/preferences", "העדפות תצוגה", false, "sliders"]];
const BOOKKEEPER_PATHS = ["/settings/billing", "/workspace/guide", "/settings/preferences"];

/** Standalone frame for the partner and admin area: Hebrew (RTL) or English (LTR), gated by firm membership. */
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
  const { lang, dir, tx } = useCkLang();
  const en = lang === "en";
  const [moreOpen, setMoreOpen] = useState(false);
  const moreBtn = useRef<HTMLButtonElement>(null);
  const morePanel = useRef<HTMLDivElement>(null);
  const closeMore = () => setMoreOpen(false);
  useEffect(() => {
    if (!moreOpen) return;
    morePanel.current?.querySelector<HTMLElement>("a")?.focus();
    const away = (e: PointerEvent) => { const t = e.target as Node; if (!morePanel.current?.contains(t) && !moreBtn.current?.contains(t)) setMoreOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") { setMoreOpen(false); moreBtn.current?.focus(); } };
    document.addEventListener("pointerdown", away);
    document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("pointerdown", away); document.removeEventListener("keydown", esc); };
  }, [moreOpen]);
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
  // True once the body is the screen itself rather than one of the frame's own notices (loading, sign in, no firm).
  let screen = false;
  if (loading || access.state === "loading") body = <div className="ck-meta">{tx("טוען...", "Loading...")}</div>;
  else if (!user) body = <div className="ck-card" style={{ maxWidth: 480, margin: "40px auto" }}><div className="ck-title">{tx("נדרשת התחברות", "Sign in required")}</div><div className="ck-meta">{tx("הכניסה לשותפים ולאדמין.", "For partners and administrators.")}</div><Link className="ck-btn primary" to="/login" style={{ alignSelf: "flex-start" }}>{tx("להתחברות", "Sign in")}</Link></div>;
  else if (access.state === "none") body = <div className="ck-card" style={{ maxWidth: 520, margin: "40px auto" }}><div className="ck-title">{tx("החשבון אינו משויך לפירמה", "This account is not linked to a firm")}</div><div className="ck-meta">{tx("כדי להשתמש בקוקפיט יש לצרף את החשבון לפירמה. פנו למנהל המערכת של LALUM.", "To use the system the account has to join a firm. Contact the LALUM system administrator.")}</div></div>;
  else if (needsFirm && !access.member) body = <div className="ck-card" style={{ maxWidth: 520, margin: "40px auto" }}><div className="ck-title">{tx("אין פירמה משויכת לחשבון זה", "No firm is linked to this account")}</div><div className="ck-meta">{tx("מסך זה פועל בתוך פירמה. מסך הניהול זמין למנהל הפלטפורמה.", "This screen works inside a firm. The administration screen is available to the platform administrator.")}</div></div>;
  else {
    const blocked = bookkeeper && !BOOKKEEPER_PATHS.includes(path);
    screen = !blocked;
    const inner = blocked
      ? <div className="ck-card" style={{ maxWidth: 520, margin: "40px auto" }}><div className="ck-title">{tx("מסך זה אינו חלק מהנהלת החשבונות", "This screen is not part of bookkeeping")}</div><div className="ck-meta">{tx("לתפקיד הנהלת חשבונות יש גישה למערכת הנהלת החשבונות בלבד.", "The bookkeeper role has access to the bookkeeping system only.")}</div><Link className="ck-btn primary" to="/settings/billing" style={{ alignSelf: "flex-start" }}>{tx("להנהלת חשבונות", "To bookkeeping")}</Link></div>
      : children({ member: access.member, platformAdmin: access.platformAdmin });
    // The external bookkeeper signs in with a password only (owner's decision, 0079), so she gets no second factor screen.
    const partnerLike = access.platformAdmin || ["FIRM_PARTNER", "ADMIN"].includes(access.member?.role ?? "");
    body = mfa && partnerLike ? <MfaGate required={access.platformAdmin || access.member?.lalum_firms.require_mfa === true}>{inner}</MfaGate> : inner;
  }

  // Collapsed: the primary screens, plus the current screen when it is not one of them so the rail never hides where you are.
  const navSections = controlRoom ? NAV_SECTIONS : NAV_SECTIONS.map((x) => ({ ...x, items: x.items.filter(([to]) => to !== "/workspace/control") }));
  const allItems = navSections.flatMap((x) => x.items);
  const shown = allItems.filter(([to]) => PRIMARY.has(to) || to === path);
  const sections: Array<{ heading: string | null; items: NavItem[] }> = bookkeeper ? [{ heading: null, items: BOOKKEEPER_NAV }] : [{ heading: null, items: shown }];
  // The panel: every screen outside the four, in its group; the top group is named there, since the rail no longer shows it as one.
  const moreGroups = navSections.map((x) => ({ heading: x.heading ?? "סקירה", items: x.items.filter(([to]) => !PRIMARY.has(to)) })).filter((x) => x.items.length > 0);
  // In English the frame speaks English; a screen whose content is not translated yet keeps reading in Hebrew, right to left, inside it.
  const [shownTitle, shownDesc] = en && SCREEN_EN[path] ? SCREEN_EN[path] : [title, description];
  const navLabel = (to: string, he: string) => (en ? (bookkeeper && to === "/settings/billing" ? "Bookkeeping" : NAV_EN[to] ?? he) : he);
  const heading = (h: string | null) => (h && en ? NAV_HEADING_EN[h] ?? (h === "סקירה" ? "Overview" : h) : h);
  const bodyLang = en && screen && !TRANSLATED_SCREENS.has(path) ? { dir: "rtl" as const, lang: "he" } : {};
  return (
    <ClientNamesProvider>
    <div className="ck-root ck-with-sidebar" {...lookAttrs(look)} dir={dir} lang={lang}>
      <PageMeta title={shownTitle} description={shownDesc} path={path} noindex />
      <aside className="ck-sidebar">
        <RailDefs />
        <div className="ck-sidebar-brand">
          {/* The logo leads back to the entry gate, the app's home screen (owner, 31.10.2026). */}
          <Link to={bookkeeper ? "/settings/billing" : "/workspace/start"} className="ck-brand-home" aria-label={tx("LALUM, למסך הפתיחה", "LALUM, to the start screen")}>
            <Wordmark height={26} style={{ color: "var(--ck-brand-ink, var(--ink))" }} />
          </Link>
          <div className="ck-looks" role="group" aria-label={tx("מראה הקוקפיט", "System look")}>{LOOKS.map(([k, label]) => { const l = en ? LOOK_EN[k] : label; return <button key={k} type="button" className={`ck-look ck-look-${k}`} aria-pressed={look === k} aria-label={en ? `${l} look` : `מראה ${l}`} title={l} onClick={() => setLook(k)} />; })}</div>
        </div>
        <nav className="ck-sidebar-nav" id="ck-rail-nav" aria-label={tx("ניווט הקוקפיט", "System navigation")}>
          {sections.map((sec) => (
            <div key={sec.heading ?? "__top"} className="ck-nav-group" role="group" aria-label={heading(sec.heading) ?? undefined}>
              {sec.items.map(([to, label, end]) => (
                <NavLink key={to} to={to} end={end || to === "/workspace"} className={to === "/workspace/dashboard" ? "ck-nav-sm" : undefined}>
                  <RailIcon id={to} size={to === "/workspace/dashboard" ? 28 : 38} /><span>{navLabel(to, label)}</span>{to === "/workspace/inquiries" && newInq > 0 && <b className="ck-navbadge" aria-label={tx(`${newInq} פניות חדשות`, `${newInq} new inquiries`)}>{newInq}</b>}
                </NavLink>
              ))}
            </div>
          ))}
          {!bookkeeper && <button ref={moreBtn} type="button" className="ck-railmore" aria-haspopup="dialog" aria-expanded={moreOpen} aria-controls="ck-more-menu" onClick={() => setMoreOpen((o) => !o)}><RailIcon id={moreOpen ? "less" : "more"} size={30} /><span>{tx("עוד כלים", "More tools")}</span></button>}
        </nav>
        <div className="ck-sidebar-foot">
          <Link to="/portal"><RailIcon id="user" size={26} /><span>{tx("אזור אישי", "Personal area")}</span></Link>
          <Link to="/settings/preferences"><RailIcon id="/settings/preferences" size={26} /><span>{tx("העדפות", "Preferences")}</span></Link>
          <Link to="/"><RailIcon id="site" size={26} /><span>{tx("לאתר", "To the site")}</span></Link>
          {user && (
            <button type="button" className="ck-logout" onClick={() => void leave()}>
              <RailIcon id="logout" size={26} /><span>{tx("התנתקות", "Sign out")}</span>
            </button>
          )}
        </div>
      </aside>
      {moreOpen && !bookkeeper && (
        <div className="ck-moremenu" id="ck-more-menu" role="dialog" aria-label={tx("עוד כלים", "More tools")} ref={morePanel}>
          <div className="ck-moremenu-head">
            <b>{tx("עוד כלים", "More tools")}</b>
            <button type="button" className="ck-moremenu-x" aria-label={tx("סגירה", "Close")} onClick={() => { closeMore(); moreBtn.current?.focus(); }}><Icon name="x" size={18} /></button>
          </div>
          <div className="ck-moremenu-grid">
            {moreGroups.map((g) => (
              <section key={g.heading} aria-label={heading(g.heading) ?? undefined}>
                <div className="ck-moremenu-h" aria-hidden="true">{heading(g.heading)}</div>
                <ul role="list">
                  {g.items.map(([to, label, end]) => (
                    <li key={to}><NavLink to={to} end={end || to === "/workspace"} onClick={closeMore}><RailIcon id={to} size={26} /><span>{navLabel(to, label)}</span></NavLink></li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        </div>
      )}
      <div className="ck-shell">
        <header className="ck-top">
          <h1 className="serif">{shownTitle}</h1>
          <div className="ck-top-tools">
            {hasMember && <ClientNamesToggle />}
            <CkLangSwitch />
          </div>
        </header>
        {(() => { const Art = BAND[path]; return Art ? <div className="ck-band"><div className="ck-band-art"><Art size={92} /></div><p>{shownDesc}</p></div> : null; })()}
        <main ref={mainRef} {...bodyLang}>{body}</main>
      </div>
      {controlRoom && stripReady && <Suspense fallback={null}><ControlStrip onWall={path === "/workspace/control"} /></Suspense>}
      {hasMember && !bookkeeper && <QuickAdd />}
    </div>
    </ClientNamesProvider>
  );
}
