import { Link } from "./AppLink";
import { useAuth } from "../context/AuthContext";
import { useLang } from "../context/LangContext";
import { Icon } from "./Icon";
import { paymentsEnabled } from "../lib/content";

// A small floating side rail for promoted, recently added actions, so the top
// header keeps its original, uncrowded set. For now it holds the one-tap
// payment button (which used to crowd the top icon row). New promoted actions
// can be added here without touching the header.
export function ContactRail() {
  const { user } = useAuth();
  const { t } = useLang();

  if (!paymentsEnabled) return null;

  return (
    <aside className="contact-rail" aria-label={t.ui.quickActions}>
      <Link
        to={user ? "/portal" : "/login"}
        className="tb-btn tb-pay rail-pay"
        aria-label={t.ui.bookPage.quickPayTitle}
        title={t.ui.bookPage.quickPayTitle}
      >
        <Icon name="card" size={20} />
      </Link>
    </aside>
  );
}
