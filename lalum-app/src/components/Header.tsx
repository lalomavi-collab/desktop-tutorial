import { Link, NavLink } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const nav = [
  { to: "/", label: "Home", end: true },
  { to: "/advisory", label: "Advisory & Mediation", end: false },
  { to: "/training", label: "Training", end: false },
  { to: "/insights", label: "Insights", end: false },
];

export function Header() {
  const { user } = useAuth();
  return (
    <header className="site-header">
      <div className="wrap header-inner">
        <Link to="/" className="brand">
          <span className="brand-mark">L</span>
          <span className="brand-word">LALUM</span>
        </Link>

        <nav className="nav-pills">
          {nav.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.end}
              className={({ isActive }) => "nav-pill" + (isActive ? " active" : "")}
            >
              {n.label}
            </NavLink>
          ))}
        </nav>

        <Link to={user ? "/portal" : "/login"} className="btn btn-ink btn-sm">
          {user ? "Client portal" : "Client login"}
        </Link>
      </div>
    </header>
  );
}
