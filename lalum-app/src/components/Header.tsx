import { Link, NavLink } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useLang } from "../context/LangContext";
import { Icon } from "./Icon";
import { paymentsEnabled } from "../lib/content";

export function Header() {
  const { user } = useAuth();
  const { t, toggle } = useLang();

  // Articles, Q&A and guides now live under the single Knowledge hub, so the top
  // bar stays lean: Home, Advisory, Courses, and the Knowledge hub. When
  // payments are on, a Pay rubric leads a client to their portal (or to login
  // first), so paying through the app is one tap from the top bar.
  const nav: { to: string; label: string; end: boolean; hash?: boolean }[] = [
    { to: "/", label: t.ui.nav.home, end: true },
    { to: "/#practice-areas", label: t.ui.nav.practice, end: false, hash: true },
    { to: "/#pre-deal", label: t.ui.nav.strategy, end: false, hash: true },
    { to: "/advisory", label: t.ui.nav.advisory, end: false },
    { to: "/training", label: t.ui.nav.training, end: false },
    { to: "/knowledge", label: t.ui.nav.knowledge, end: false },
    ...(paymentsEnabled ? [{ to: user ? "/portal" : "/login", label: t.ui.nav.pay, end: false }] : []),
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
              <Link key={n.to} to={n.to} className="nav-pill nav-pill-secondary">
                {n.label}
              </Link>
            ) : (
              <NavLink key={n.to} to={n.to} end={n.end} className={({ isActive }) => "nav-pill" + (isActive ? " active" : "")}>
                {n.label}
              </NavLink>
            )
          )}
        </nav>

        {/* The top bar stays intentionally lean: brand, navigation, language and
            login. The quick-action icons (pay, call, WhatsApp, Telegram, share,
            guide) live in the floating ContactRail so the bar never crowds. */}
        <div className="header-tools">
          <button
            type="button"
            onClick={toggle}
            className="tb-btn tb-lang"
            aria-label="Switch language"
            title={t.ui.otherLangName}
          >
            {t.ui.otherLangShort}
          </button>
          <Link to={user ? "/portal" : "/login"} className="btn btn-ink btn-sm header-cta hide-mobile" aria-label={user ? t.ui.clientPortal : t.ui.clientLogin} title={user ? t.ui.clientPortal : t.ui.clientLogin}>
            <Icon name="user" size={16} /> <span className="header-cta-label">{user ? t.ui.clientPortal : t.ui.clientLogin}</span>
          </Link>
        </div>
      </div>
    </header>
  );
}
