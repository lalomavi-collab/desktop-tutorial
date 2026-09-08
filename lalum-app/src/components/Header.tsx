import { useState } from "react";
import { Link, NavLink } from "./AppLink";
import { useAuth } from "../context/AuthContext";
import { useLang } from "../context/LangContext";
import { ShareButton, useShare } from "./ShareButton";
import { DownloadIcon, useInstall } from "./AppInstall";
import { Icon } from "./Icon";
import { OPEN_GUIDE_EVENT } from "./UserGuide";
import { OPEN_SOS_EVENT } from "./SosMenu";
import { whatsappNumber, telegramUrl, officePhone, paymentsEnabled } from "../lib/content";
import { LANGS } from "../lib/hreflang";
import { Wordmark } from "./Wordmark";

export function Header() {
  const { user } = useAuth();
  const { t, lang, setLang } = useLang();
  const [langOpen, setLangOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [insightsOpen, setInsightsOpen] = useState(false);
  const current = LANGS.find((l) => l.code === lang) ?? LANGS[0];
  const { share, copied: shareCopied } = useShare();
  // One-tap desktop install (Chrome/Edge). canPrompt is false everywhere the
  // browser has no native prompt (Safari, Firefox), so this stays invisible
  // there instead of adding a seventh permanent icon to a row already at its
  // documented limit of six.
  const { installed: appInstalled, canPrompt: canInstall, promptInstall } = useInstall();

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
          {/* The urgent-contact button: always visible, first in the row, so
              it is never lost among the other tools. Opens a small sheet with
              every fast channel (call, WhatsApp, Telegram) instead of picking
              one action for the client. */}
          <button
            type="button"
            className="tb-btn tb-sos"
            onClick={() => window.dispatchEvent(new Event(OPEN_SOS_EVENT))}
            aria-label={t.ui.sos.aria}
            title={t.ui.sos.aria}
          >
            {t.ui.sos.open}
          </button>
          {/* On phones payment lives in the header (which has room there); on
              desktop it lives in the floating ContactRail, so the two never
              show at once. */}
          {paymentsEnabled && (
            <Link
              to={user ? "/portal" : "/login"}
              className="tb-btn tb-pay header-pay-m"
              aria-label={t.ui.bookPage.quickPayTitle}
              title={t.ui.bookPage.quickPayTitle}
            >
              <Icon name="card" size={18} />
            </Link>
          )}
          {/* The full icon row. It only has room next to the wordmark from
              here up: below 900px (the width where the nav already moves into
              the bottom tab bar) it hides in favour of the single "more"
              button below, so the two never show at once and the row never
              has to shrink icons down to squeeze six of them past the logo. */}
          <div className="header-util-group">
            <button
              type="button"
              className="tb-btn hdr-secondary"
              onClick={() => window.dispatchEvent(new Event(OPEN_GUIDE_EVENT))}
              aria-label={t.ui.guide.open}
              title={t.ui.guide.open}
            >
              <Icon name="compass" size={18} />
            </button>
            <a
              className="tb-btn tb-bot"
              href={`tel:${officePhone.tel}`}
              aria-label={t.ui.botCall.aria}
              title={t.ui.botCall.aria}
            >
              <Icon name="headset" size={19} />
            </a>
            <a
              className="tb-btn"
              href={`https://wa.me/${whatsappNumber}?text=${encodeURIComponent(t.ui.whatsapp.msg)}`}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={t.ui.whatsapp.aria}
              title={t.ui.whatsapp.aria}
            >
              <Icon name="whatsapp" size={19} />
            </a>
            <a
              className="tb-btn tb-tg"
              href={telegramUrl}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={t.ui.telegram.aria}
              title={t.ui.telegram.aria}
            >
              <Icon name="telegram" size={18} />
            </a>
            <ShareButton />
            {/* One-tap install: only rendered where the browser can actually
                offer it (a real beforeinstallprompt fired), so it never sits
                here inert on Safari/Firefox as a seventh dead icon. */}
            {canInstall && !appInstalled && (
              <button
                type="button"
                className="tb-btn"
                onClick={() => void promptInstall()}
                aria-label={t.ui.footer.installApp}
                title={t.ui.footer.installApp}
              >
                <DownloadIcon size={17} />
              </button>
            )}
            <div className="tb-lang-wrap" style={{ position: "relative" }}>
              <button
                type="button"
                onClick={() => setLangOpen((v) => !v)}
                className="tb-btn tb-lang"
                aria-label="Switch language"
                aria-haspopup="listbox"
                aria-expanded={langOpen}
                title={current.autonym}
              >
                {current.code.toUpperCase()}
              </button>
              {langOpen && (
                <>
                  {/* Backdrop closes the menu on outside click without a global listener. */}
                  <div onClick={() => setLangOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 40 }} />
                  <ul
                    role="listbox"
                    className="card"
                    style={{ position: "absolute", insetInlineEnd: 0, top: "calc(100% + 8px)", zIndex: 41, listStyle: "none", margin: 0, padding: 6, minWidth: 140, display: "flex", flexDirection: "column", gap: 2 }}
                  >
                    {LANGS.map((l) => (
                      <li key={l.code}>
                        <button
                          type="button"
                          role="option"
                          aria-selected={l.code === lang}
                          onClick={() => { setLang(l.code); setLangOpen(false); }}
                          dir={l.dir}
                          style={{
                            width: "100%", textAlign: l.dir === "rtl" ? "right" : "left", padding: "9px 12px", borderRadius: 8, border: "none",
                            background: l.code === lang ? "var(--clay-tint)" : "transparent", color: "var(--ink)", cursor: "pointer", fontSize: 14.5,
                            fontWeight: l.code === lang ? 700 : 500,
                          }}
                        >
                          {l.autonym}
                        </button>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </div>
          </div>

          {/* Phones: the six controls above collapse into one button, so the
              header never has more than the logo, this button and (when it
              applies) the one-tap payment icon next to it. The sheet gives
              each action a label, which a bare row of round icons never had
              room for anyway. */}
          <div className="header-more-wrap">
            <button
              type="button"
              className="tb-btn header-more-btn"
              onClick={() => setMoreOpen((v) => !v)}
              aria-label={t.ui.quickActions}
              aria-haspopup="menu"
              aria-expanded={moreOpen}
            >
              <Icon name="menu" size={19} />
            </button>
            {moreOpen && (
              <>
                <div onClick={() => setMoreOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 40 }} />
                <div role="menu" aria-label={t.ui.quickActions} className="card header-more-menu">
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
