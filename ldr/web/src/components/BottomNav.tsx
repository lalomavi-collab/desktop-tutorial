// Professional mobile-app bottom tab bar (LinkedIn / Facebook / Meat2Me style).
// Visible only on small screens (see .bottom-nav in styles.css); the desktop
// top bar handles navigation on larger viewports.

type Tab =
  | "feed" | "room" | "new" | "find" | "map" | "gigs" | "cases" | "rooms" | "jobs"
  | "referrals" | "qa" | "lab" | "board" | "profile" | "invite" | "admin";

const ITEMS: { tab: Tab; icon: string; label: string }[] = [
  { tab: "map", icon: "🗺", label: "מפה" },
  { tab: "feed", icon: "🏠", label: "בית" },
  { tab: "find", icon: "🔍", label: "איתור" },
  { tab: "referrals", icon: "🤝", label: "הפניות" },
  { tab: "profile", icon: "👤", label: "פרופיל" },
];

export default function BottomNav({
  tab, setTab,
}: { tab: Tab; setTab: (t: Tab) => void }) {
  return (
    <nav className="bottom-nav" aria-label="ניווט ראשי">
      {ITEMS.map((it) => (
        <button
          key={it.tab}
          className={`bn-item${tab === it.tab ? " active" : ""}`}
          onClick={() => setTab(it.tab)}
          aria-current={tab === it.tab ? "page" : undefined}
        >
          <span className="bn-icon">{it.icon}</span>
          <span className="bn-label">{it.label}</span>
        </button>
      ))}
    </nav>
  );
}
