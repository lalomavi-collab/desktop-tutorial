import { NavLink } from "./AppLink";
import { Icon } from "./Icon";
import { useAuth } from "../context/AuthContext";
import { useLang } from "../context/LangContext";

// Fixed bottom navigation, shown on phones only (see .tabbar in index.css).
// Four institutional destinations, no more: seven crammed tabs read as a retail
// app. Courses, Knowledge and the direct channels (call, WhatsApp, Telegram, SOS)
// are not lost: every one of them is in the menu in the header, which is the
// single home for the full list. The client tab goes to the portal when signed
// in and to the login otherwise.
const TABS = [
  { to: "/", end: true, icon: "home", key: "platform" },
  { to: "/advisory", end: false, icon: "gavel", key: "research" },
  { to: "/book", end: false, icon: "calendar", key: "diagnostic" },
] as const;

export function BottomTabBar() {
  const { user } = useAuth();
  const { t } = useLang();
  const labels = t.ui.tabs;

  return (
    <nav className="tabbar" aria-label={labels.platform}>
      {TABS.map((tb) => (
        <NavLink key={tb.key} to={tb.to} end={tb.end} className={({ isActive }) => "tabbar-item" + (isActive ? " active" : "")}>
          <Icon name={tb.icon} size={20} />
          <span>{labels[tb.key]}</span>
        </NavLink>
      ))}
      <NavLink to={user ? "/portal" : "/login"} className={({ isActive }) => "tabbar-item" + (isActive ? " active" : "")}>
        <Icon name="user" size={20} />
        <span>{labels.portal}</span>
      </NavLink>
    </nav>
  );
}
