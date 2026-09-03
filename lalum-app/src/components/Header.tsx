import { Link, NavLink } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useLang } from "../context/LangContext";
import { ShareButton } from "./ShareButton";
import { Icon } from "./Icon";
import { OPEN_GUIDE_EVENT } from "./UserGuide";
import { OPEN_SOS_EVENT } from "./SosMenu";
import { whatsappNumber, telegramUrl, officePhone, paymentsEnabled } from "../lib/content";

export function Header() {
  const { user } = useAuth();
  const { t, toggle } = useLang();

  // Articles, Q&A and guides now live under the single Knowledge hub, so the top
  // bar stays lean: Home, Advisory, Courses, and the Knowledge hub. Payment is a
  // one-tap action from the floating ContactRail, not the top bar.
  const nav: { to: string; label: string; end: boolean; hash?: boolean }[] = [
    { to: "/", label: t.ui.nav.home, end: true },
    { to: "/#practice-areas", label: t.ui.nav.practice, end: false, hash: true },
    { to: "/#pre-deal", label: t.ui.nav.strategy, end: false, hash: true },
    { to: "/advisory", label: t.ui.nav.advisory, end: false },
    { to: "/training", label: t.ui.nav.training, end: false },
    { to: "/knowledge", label: t.ui.nav.knowledge, end: false },
  ];

  return (
    <header className="site-header">
      <div className="wrap header-inner">
        <Link to="/" className="brand">
          <span className="brand-word">LALUM</span>
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
          <button
            type="button"
            onClick={toggle}
            className="tb-btn tb-lang"
            aria-label="Switch language"
            title={t.ui.otherLangName}
          >
            {t.ui.otherLangShort}
          </button>
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
