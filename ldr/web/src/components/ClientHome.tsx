import type { Profile } from "../lib/supabase";
import Avatar from "./Avatar";

// ── Private-client home: a Gett-style "personal card" ───────────────────────
// Private individuals (role === "client") get a simple, consumer-grade screen
// instead of the professional attorney toolset: a personal card on top, then a
// few large primary actions (find a lawyer, request a service, my requests).

type Nav = "map" | "cases" | "profile";

const ACTIONS: { key: Nav; icon: string; title: string; desc: string; primary?: boolean }[] = [
  { key: "map", icon: "search", title: "מצא עורך דין", desc: "חיפוש על המפה לפי עיר ותחום", primary: true },
  { key: "cases", icon: "post_add", title: "בקשת שירות חדשה", desc: "פרסמו בקשה וקבלו הצעות מעורכי דין" },
  { key: "cases", icon: "inbox", title: "הבקשות שלי", desc: "מעקב אחרי הבקשות וההצעות שהתקבלו" },
];

export default function ClientHome({ profile, onNavigate }: {
  profile: Profile; onNavigate: (tab: Nav) => void;
}) {
  const name = profile.display_name || "אורח/ת";
  return (
    <div className="container" dir="rtl" style={{ maxWidth: 560, paddingTop: 22 }}>

      {/* Personal card */}
      <div className="card pad" style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 22 }}>
        <Avatar name={name} url={profile.avatar_url} size={64} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, color: "var(--cream-dim)" }}>שלום,</div>
          <h1 className="font-headline" style={{ margin: "2px 0 6px", fontSize: 22 }}>{name}</h1>
          <span className="tag" style={{ fontSize: 11 }}>
            <span className="conn-dot connected" /> לקוח/ה פרטי/ת
          </span>
        </div>
      </div>

      {/* Primary actions */}
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {ACTIONS.map((a) => (
          <button key={a.title} onClick={() => onNavigate(a.key)}
            className="card card-interactive"
            style={{
              display: "flex", alignItems: "center", gap: 14, padding: 18, textAlign: "start",
              cursor: "pointer", fontFamily: "inherit", color: "var(--cream)",
              border: a.primary ? "1px solid var(--line-bright)" : undefined,
            }}>
            <span aria-hidden="true" style={{
              width: 46, height: 46, flexShrink: 0, borderRadius: 14, display: "grid", placeItems: "center",
              background: a.primary ? "linear-gradient(145deg, #4dd2ff, #1ba3e0)" : "rgba(51,204,255,0.10)",
            }}>
              <span className="ms" style={{ fontSize: 24, color: a.primary ? "var(--obsidian)" : "var(--gold)" }}>{a.icon}</span>
            </span>
            <span style={{ flex: 1, minWidth: 0 }}>
              <span style={{ display: "block", fontWeight: 700, fontSize: 16 }}>{a.title}</span>
              <span style={{ display: "block", fontSize: 13, color: "var(--cream-dim)", marginTop: 2 }}>{a.desc}</span>
            </span>
            <span className="ms" aria-hidden="true" style={{ color: "var(--cream-dim)" }}>chevron_left</span>
          </button>
        ))}
      </div>

      <p className="muted" style={{ fontSize: 12.5, textAlign: "center", marginTop: 22, lineHeight: 1.7 }}>
        השירות חינמי לאנשים פרטיים. הבקשה נשלחת ישירות לעורכי דין מאומתים, ללא עמלות וללא מתווכים.
      </p>
    </div>
  );
}
