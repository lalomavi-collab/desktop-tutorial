import { Link, NavLink } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useLang } from "../context/LangContext";

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

        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button
            type="button"
            onClick={toggle}
            className="btn btn-sm"
            style={{ background: "var(--card)", border: "1px solid var(--line)", color: "var(--ink)", fontWeight: 600 }}
            aria-label="Switch language"
          >
            {t.ui.otherLangName}
          </button>
          <Link to="/book" className="btn btn-clay btn-sm">{t.ui.bookPage.navCta}</Link>
          <Link to={user ? "/portal" : "/login"} className="btn btn-ink btn-sm">
            {user ? t.ui.clientPortal : t.ui.clientLogin}
          </Link>
        </div>
      </div>
    </header>
  );
}
