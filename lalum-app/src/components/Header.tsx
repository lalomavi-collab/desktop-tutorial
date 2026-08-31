import { useState } from "react";
import { Link, NavLink } from "./AppLink";
import { useAuth } from "../context/AuthContext";
import { useLang } from "../context/LangContext";
import { ShareButton } from "./ShareButton";
import { Icon } from "./Icon";
import { OPEN_GUIDE_EVENT } from "./UserGuide";
import { whatsappNumber, telegramUrl, officePhone, paymentsEnabled } from "../lib/content";
import { LANGS } from "../lib/hreflang";
import { Wordmark } from "./Wordmark";

export function Header() {
  const { user } = useAuth();
  const { t, lang, setLang } = useLang();
  const [langOpen, setLangOpen] = useState(false);
  const current = LANGS.find((l) => l.code === lang) ?? LANGS[0];

  // The top bar names the two areas the practice leads with, then the advisory
  // hub, courses and the Knowledge hub. It used to open with two anchors into
  // the home page (practice areas, pre-deal strategy) and a single "Advisory"
  // pill, so neither focus area had a link anywhere in the navigation: the two
  // pages carrying the positioning were reachable only from the footer and from
  // the middle of the home page. Both anchors still sit on the home page, and
  // pre-deal strategy is a section of /advisory as well, so nothing lost an
  // address. Payment is a one-tap action from the floating ContactRail.
  const nav: { to: string; label: string; end: boolean; hash?: boolean }[] = [
    { to: "/", label: t.ui.nav.home, end: true },
    { to: "/real-estate-legal-advisory", label: t.ui.nav.realEstate, end: false },
    { to: "/ai-legal-advisory", label: t.ui.nav.ai, end: false },
    { to: "/advisory", label: t.ui.nav.advisory, end: false },
    { to: "/training", label: t.ui.nav.training, end: false },
    { to: "/knowledge", label: t.ui.nav.knowledge, end: false },
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
        </nav>

        <div className="header-tools">
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
          {/* The assessment CTA lives in the page body (hero, advisory card,
              closing CTA), not the top bar, so the header stays uncluttered.
              Only the client login/portal button remains here. */}
          <Link to={user ? "/portal" : "/login"} className="btn btn-ink btn-sm header-cta hide-mobile" aria-label={user ? t.ui.clientPortal : t.ui.clientLogin} title={user ? t.ui.clientPortal : t.ui.clientLogin}>
            <Icon name="user" size={16} /> <span className="header-cta-label">{user ? t.ui.clientPortal : t.ui.clientLogin}</span>
          </Link>
        </div>
      </div>
    </header>
  );
}
