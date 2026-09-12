import { useEffect, useRef, useState } from "react";
import { Link, NavLink } from "./AppLink";
import { useAuth } from "../context/AuthContext";
import { useLang } from "../context/LangContext";
import { useShare } from "./ShareButton";
import { DownloadIcon, useInstall } from "./AppInstall";
import { Icon } from "./Icon";
import { OPEN_GUIDE_EVENT } from "./UserGuide";
import { OPEN_SOS_EVENT } from "./SosMenu";
import { whatsappNumber, telegramUrl, officePhone, paymentsEnabled } from "../lib/content";
import { LANGS } from "../lib/hreflang";
import { Wordmark } from "./Wordmark";
import { useScrollLock } from "../lib/useScrollLock";

export function Header() {
  const { user } = useAuth();
  const { t, lang, setLang } = useLang();
  const [moreOpen, setMoreOpen] = useState(false);
  const [insightsOpen, setInsightsOpen] = useState(false);
  // The full menu renders as a bottom sheet only below 900px; above it, it is a
  // small anchored dropdown. Scroll-lock the page behind the sheet, but not
  // behind the desktop dropdown (which closes on any outside click) so the page
  // does not freeze under a small card.
  const [isSheet, setIsSheet] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 900px)");
    const update = () => setIsSheet(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);
  // Desktop only: once the pointer leaves the mark and its menu, the menu
  // closes on its own after a short grace period, so a visitor never has to
  // click elsewhere to dismiss it. The delay is long enough to cross the small
  // gap between the button and the menu without it closing underneath the
  // pointer; entering either one cancels a pending close. On the mobile bottom
  // sheet this does nothing (pointer events do not fire): that sheet closes by
  // tapping its backdrop or a row.
  const closeTimer = useRef<number | undefined>(undefined);
  const cancelAutoClose = () => {
    if (closeTimer.current !== undefined) {
      window.clearTimeout(closeTimer.current);
      closeTimer.current = undefined;
    }
  };
  const scheduleAutoClose = () => {
    if (isSheet) return;
    cancelAutoClose();
    // A generous grace period so the menu does not vanish the instant the
    // pointer drifts off it; long enough to glance away and come back.
    closeTimer.current = window.setTimeout(() => setMoreOpen(false), 900);
  };
  useEffect(() => () => cancelAutoClose(), []);
  const { share, copied: shareCopied } = useShare();
  // One-tap desktop install (Chrome/Edge). canPrompt is false everywhere the
  // browser has no native prompt (Safari, Firefox), so this stays invisible
  // there instead of adding a seventh permanent icon to a row already at its
  // documented limit of six.
  const { installed: appInstalled, canPrompt: canInstall, promptInstall } = useInstall();

  // Below 900px the "more" menu becomes a bottom sheet (see index.css); a
  // sheet that only closes by tapping its own backdrop reads as broken on a
  // phone, and locking the page behind it keeps the body from scrolling out
  // from under a surface that is meant to feel anchored to the screen edge.
  useEffect(() => {
    if (!moreOpen && !insightsOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setMoreOpen(false);
      setInsightsOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [moreOpen, insightsOpen]);
  useScrollLock(moreOpen && isSheet);

  // The two areas the practice leads with, first and named as domains: AI &
  // Law, then Real Estate. Clinic is the existing advisory hub under a name
  // that matches how the practice already describes its own operating model
  // (see the FAQ on "Clinic and Engine"); Engine is the home page's own
  // #engine section, reachable from anywhere via the cross-page hash scroll
  // in App.tsx; Decision Room is the existing readiness quiz. None of these
  // three is a new page or a new URL, only a new name for one already live.
  // Training and Knowledge have no slot of their own in this shape: they, and
  // Articles, live inside the Insights dropdown below instead of three more
  // pills competing with the five domain/model links for space.
  const nav: { to: string; label: string; end: boolean; hash?: boolean }[] = [
    { to: "/ai-legal-advisory", label: t.ui.nav.ai, end: false },
    { to: "/real-estate-legal-advisory", label: t.ui.nav.realEstate, end: false },
    { to: "/advisory", label: t.ui.nav.clinic, end: false },
    { to: "/#engine", label: t.ui.nav.engine, end: false, hash: true },
    { to: "/risk", label: t.ui.nav.decisionRoom, end: false },
  ];
  const insightsLinks = [
    { to: "/insights", label: t.ui.nav.insights },
    { to: "/knowledge", label: t.ui.nav.knowledge },
    { to: "/training", label: t.ui.nav.training },
  ];

  return (
    <header className="site-header">
      <div className="wrap header-inner">
        <Link to="/" className="brand">
          <Wordmark height={19} />
        </Link>

        {/* The one menu, right beside the wordmark: a labelled control that
            opens a single panel with the full site nav, the reading menu,
            every contact and utility action, and the language switch. It shows
            on every width (the nav pills hide on phones, this does not), so
            there is one obvious place that reaches everything, and it closes on
            its own once the pointer leaves it (see scheduleAutoClose). */}
        <div className="header-more-wrap">
          <button
            type="button"
            className="header-menu-btn"
            onClick={() => setMoreOpen((v) => !v)}
            onMouseEnter={cancelAutoClose}
            onMouseLeave={scheduleAutoClose}
            aria-haspopup="menu"
            aria-expanded={moreOpen}
          >
            <Icon name="menu" size={17} />
            <span>{t.ui.nav.menu}</span>
          </button>
          {moreOpen && (
            <>
              <div onClick={() => setMoreOpen(false)} className="header-more-backdrop" />
              <div
                role="menu"
                aria-label={t.ui.nav.menu}
                className="card header-more-menu"
                onMouseEnter={cancelAutoClose}
                onMouseLeave={scheduleAutoClose}
              >
                <span className="sheet-handle" aria-hidden="true" />
                {nav.map((n) =>
                  n.hash ? (
                    <Link key={n.to} to={n.to} role="menuitem" className="header-more-item" onClick={() => setMoreOpen(false)}>
                      {n.label}
                    </Link>
                  ) : (
                    <NavLink
                      key={n.to}
                      to={n.to}
                      end={n.end}
                      role="menuitem"
                      onClick={() => setMoreOpen(false)}
                      className={({ isActive }) => "header-more-item" + (isActive ? " active" : "")}
                    >
                      {n.label}
                    </NavLink>
                  )
                )}
                {insightsLinks.map((l) => (
                  <NavLink
                    key={l.to}
                    to={l.to}
                    role="menuitem"
                    onClick={() => setMoreOpen(false)}
                    className={({ isActive }) => "header-more-item" + (isActive ? " active" : "")}
                  >
                    {l.label}
                  </NavLink>
                ))}
                <div className="header-more-divider" role="separator" />
                <button
                  type="button"
                  role="menuitem"
                  className="header-more-item"
                  onClick={() => { window.dispatchEvent(new Event(OPEN_GUIDE_EVENT)); setMoreOpen(false); }}
                >
                  <Icon name="compass" size={18} /> {t.ui.guide.open}
                </button>
                <a role="menuitem" className="header-more-item" href={`tel:${officePhone.tel}`} onClick={() => setMoreOpen(false)}>
                  <Icon name="headset" size={18} /> {t.ui.botCall.aria}
                </a>
                <a
                  role="menuitem"
                  className="header-more-item"
                  href={`https://wa.me/${whatsappNumber}?text=${encodeURIComponent(t.ui.whatsapp.msg)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => setMoreOpen(false)}
                >
                  <Icon name="whatsapp" size={18} /> {t.ui.whatsapp.aria}
                </a>
                <a role="menuitem" className="header-more-item" href={telegramUrl} target="_blank" rel="noopener noreferrer" onClick={() => setMoreOpen(false)}>
                  <Icon name="telegram" size={18} /> {t.ui.telegram.aria}
                </a>
                <button type="button" role="menuitem" className="header-more-item" onClick={share}>
                  <Icon name="share" size={18} /> {shareCopied ? t.ui.share.copied : t.ui.share.aria}
                </button>
                {canInstall && !appInstalled && (
                  <button
                    type="button"
                    role="menuitem"
                    className="header-more-item"
                    onClick={() => { void promptInstall(); setMoreOpen(false); }}
                  >
                    <DownloadIcon size={18} /> {t.ui.footer.installApp}
                  </button>
                )}
                <Link
                  to={user ? "/portal" : "/login"}
                  role="menuitem"
                  className="header-more-item"
                  onClick={() => setMoreOpen(false)}
                >
                  <Icon name="user" size={18} /> {user ? t.ui.clientPortal : t.ui.clientLogin}
                </Link>
                <div className="header-more-divider" role="separator" />
                <div className="header-more-langs">
                  {LANGS.map((l) => (
                    <button
                      key={l.code}
                      type="button"
                      role="menuitemradio"
                      aria-checked={l.code === lang}
                      onClick={() => { setLang(l.code); setMoreOpen(false); }}
                      dir={l.dir}
                      className={"header-more-lang" + (l.code === lang ? " active" : "")}
                    >
                      {l.autonym}
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>

        <nav className="nav-pills">
          {nav.map((n) =>
            n.hash ? (
              <Link key={n.to} to={n.to} className="nav-pill">
                {n.label}
              </Link>
            ) : (
              <NavLink key={n.to} to={n.to} end={n.end} className={({ isActive }) => "nav-pill" + (isActive ? " active" : "")}>
                {n.label}
              </NavLink>
            )
          )}
          {/* Articles, Knowledge and Courses, folded under one pill: three
              destinations that all answer "I want to read/learn something,"
              none of which is one of the two domains or the operating-model
              links above, so they share a menu instead of each claiming a
              pill of their own. */}
          <div style={{ position: "relative" }}>
            <button
              type="button"
              onClick={() => setInsightsOpen((v) => !v)}
              className={"nav-pill" + (insightsOpen ? " active" : "")}
              aria-haspopup="menu"
              aria-expanded={insightsOpen}
            >
              {t.ui.nav.insightsMenu}
            </button>
            {insightsOpen && (
              <>
                <div onClick={() => setInsightsOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 40 }} />
                <div role="menu" aria-label={t.ui.nav.insightsMenu} className="card" style={{ position: "absolute", insetInlineStart: 0, top: "calc(100% + 8px)", zIndex: 41, padding: 6, minWidth: 160, display: "flex", flexDirection: "column", gap: 2 }}>
                  {insightsLinks.map((l) => (
                    <NavLink
                      key={l.to}
                      to={l.to}
                      role="menuitem"
                      onClick={() => setInsightsOpen(false)}
                      className={({ isActive }) => "header-more-item" + (isActive ? " active" : "")}
                    >
                      {l.label}
                    </NavLink>
                  ))}
                </div>
              </>
            )}
          </div>
        </nav>

        <div className="header-tools">
          {/* The urgent-contact button: always visible on desktop, first in
              the row, so it is never lost among the other tools. Opens a
              small sheet with every fast channel (call, WhatsApp, Telegram)
              instead of picking one action for the client. On phones it
              drops out here (hide-mobile): the bottom tab bar already carries
              its own always-reachable SOS tab, and showing both crowded the
              top bar for no benefit — one reachable SOS is enough. */}
          <button
            type="button"
            className="tb-btn tb-sos hide-mobile"
            onClick={() => window.dispatchEvent(new Event(OPEN_SOS_EVENT))}
            aria-label={t.ui.sos.aria}
            title={t.ui.sos.aria}
          >
            {t.ui.sos.open}
          </button>
          {/* On phones payment lives in the header (which has room there); on
              desktop it lives in the floating ContactRail, so the two never
              show at once. A bare card icon reads as decoration on a
              touch screen with no hover to reveal the title, so — like the
              SOS button beside it — this one carries its own short visible
              label instead of relying on an icon alone. */}
          {paymentsEnabled && (
            <Link
              to={user ? "/portal" : "/login"}
              className="tb-btn tb-pay header-pay-m"
              aria-label={t.ui.bookPage.quickPayTitle}
              title={t.ui.bookPage.quickPayTitle}
            >
              ₪
            </Link>
          )}
          {/* A dedicated "Start" pill was tried here and dropped: the toolbar
              already carries six round controls plus the client login link,
              and one more rigid, non-shrinking pill pushed the nav-pills row
              below what six domain/model links need, forcing two of them
              into a scroll with no visible affordance. The practice's primary
              CTA (/book) already anchors the hero, FocusAreas, and every
              closing section, so nothing was actually missing an entry
              point. Only the client login/portal button remains here, so the
              header stays uncluttered. */}
          <Link to={user ? "/portal" : "/login"} className="btn btn-ink btn-sm header-cta hide-mobile" aria-label={user ? t.ui.clientPortal : t.ui.clientLogin} title={user ? t.ui.clientPortal : t.ui.clientLogin}>
            <Icon name="user" size={16} /> <span className="header-cta-label">{user ? t.ui.clientPortal : t.ui.clientLogin}</span>
          </Link>
        </div>
      </div>
    </header>
  );
}
