import { Link, NavLink } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useLang } from "../context/LangContext";
import { ShareButton } from "./ShareButton";
import { Icon } from "./Icon";
import { OPEN_GUIDE_EVENT } from "./UserGuide";

export function Header() {
  const { user } = useAuth();
  const { t, toggle } = useLang();

  const nav = [
    { to: "/", label: t.ui.nav.home, end: true },
    { to: "/advisory", label: t.ui.nav.advisory, end: false },
    { to: "/training", label: t.ui.nav.training, end: false },
    { to: "/insights", label: t.ui.nav.insights, end: false },
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
            className="tb-btn tb-btn-accent guide-fab"
            onClick={() => window.dispatchEvent(new Event(OPEN_GUIDE_EVENT))}
            aria-label={t.ui.guide.open}
            title={t.ui.guide.open}
          >
            <Icon name="compass" size={18} />
            <span className="guide-fab-ring" aria-hidden="true" />
          </button>
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
          <Link to="/book" className="btn btn-clay btn-sm hide-mobile">{t.ui.bookPage.navCta}</Link>
          <Link to={user ? "/portal" : "/login"} className="btn btn-ink btn-sm hide-mobile">
            {user ? t.ui.clientPortal : t.ui.clientLogin}
          </Link>
        </div>
      </div>
    </header>
  );
}
