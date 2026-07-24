import { Link, NavLink } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useLang } from "../context/LangContext";
import { ShareButton } from "./ShareButton";
import { Icon } from "./Icon";
import { OPEN_GUIDE_EVENT } from "./UserGuide";
import { whatsappNumber, telegramUrl, officePhone } from "../lib/content";

export function Header() {
  const { user } = useAuth();
  const { t, toggle } = useLang();

  const nav = [
    { to: "/", label: t.ui.nav.home, end: true },
    { to: "/advisory", label: t.ui.nav.advisory, end: false },
    { to: "/training", label: t.ui.nav.training, end: false },
    { to: "/insights", label: t.ui.nav.insights, end: false },
    { to: "/knowledge", label: t.ui.nav.knowledge, end: false },
  ];

  return (
    <header className="site-header">
      <div className="wrap header-inner">
        <Link to="/" className="brand">
          <span className="brand-word">LALUM</span>
        </Link>

        <nav className="nav-pills">
          {nav.map((n) => (
            <NavLink key={n.to} to={n.to} end={n.end} className={({ isActive }) => "nav-pill" + (isActive ? " active" : "")}>
              {n.label}
            </NavLink>
          ))}
        </nav>

        <div className="header-tools">
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
          <Link to="/book" className="btn btn-clay btn-sm header-cta hide-mobile" aria-label={t.ui.bookPage.navCta} title={t.ui.bookPage.navCta}>
            <Icon name="calendar" size={16} /> <span className="header-cta-label">{t.ui.bookPage.navCta}</span>
          </Link>
          <Link to={user ? "/portal" : "/login"} className="btn btn-ink btn-sm header-cta hide-mobile" aria-label={user ? t.ui.clientPortal : t.ui.clientLogin} title={user ? t.ui.clientPortal : t.ui.clientLogin}>
            <Icon name="user" size={16} /> <span className="header-cta-label">{user ? t.ui.clientPortal : t.ui.clientLogin}</span>
          </Link>
        </div>
      </div>
    </header>
  );
}
