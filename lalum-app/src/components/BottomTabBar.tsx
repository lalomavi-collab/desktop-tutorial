import { NavLink } from "react-router-dom";
import { Icon } from "./Icon";
import { useAuth } from "../context/AuthContext";
import { useLang } from "../context/LangContext";

// Fixed bottom navigation, shown on phones only (see .tabbar in index.css).
// This is the signature "native app" chrome: primary destinations always in
// reach, with the active route highlighted.
const TABS = [
  { to: "/", end: true, icon: "home", key: "home" },
  { to: "/advisory", end: false, icon: "gavel", key: "advisory" },
  { to: "/training", end: false, icon: "brain", key: "training" },
  { to: "/book", end: false, icon: "calendar", key: "book" },
] as const;

export function BottomTabBar() {
  const { user } = useAuth();
  const { t } = useLang();
  const labels = t.ui.tabs;

  return (
    <nav className="tabbar" aria-label={t.ui.tabs.home}>
      {TABS.map((tb) => (
        <NavLink key={tb.key} to={tb.to} end={tb.end} className={({ isActive }) => "tabbar-item" + (isActive ? " active" : "")}>
          <Icon name={tb.icon} size={21} />
          <span>{labels[tb.key]}</span>
        </NavLink>
      ))}
      <NavLink to={user ? "/portal" : "/login"} className={({ isActive }) => "tabbar-item" + (isActive ? " active" : "")}>
        <Icon name="user" size={21} />
        <span>{labels.client}</span>
      </NavLink>
    </nav>
  );
}
