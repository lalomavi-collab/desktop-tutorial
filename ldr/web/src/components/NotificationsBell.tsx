import { useEffect, useRef, useState } from "react";
import { useI18n } from "../i18n";

// System-notifications bell with a dropdown. Tone-aware for dark/light bars.
export default function NotificationsBell({ tone = "dark" }: { tone?: "light" | "dark" }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [seen, setSeen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const items = [t("notif.1"), t("notif.2"), t("notif.3")];

  useEffect(() => {
    const onDoc = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const fg = tone === "dark" ? "var(--cream)" : "#1F1E1D";
  const panelBg = tone === "dark" ? "rgba(20,22,34,0.97)" : "#fff";
  const border = tone === "dark" ? "var(--line)" : "#E8E5DD";

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button onClick={() => { setOpen((o) => !o); setSeen(true); }} aria-label={t("notif.title")}
        style={{ position: "relative", width: 38, height: 38, borderRadius: "50%", border: `1px solid ${border}`, background: "transparent", color: fg, cursor: "pointer", display: "grid", placeItems: "center" }}>
        <span className="ms" style={{ fontSize: 20 }}>notifications</span>
        {!seen && (
          <span style={{ position: "absolute", top: -2, insetInlineEnd: -2, minWidth: 17, height: 17, padding: "0 4px", background: "#D97757", color: "#fff", fontSize: 11, fontWeight: 700, borderRadius: 999, display: "grid", placeItems: "center", border: `2px solid ${tone === "dark" ? "#16181f" : "#fff"}` }}>{items.length}</span>
        )}
      </button>
      {open && (
        <div style={{ position: "absolute", top: 46, insetInlineEnd: 0, zIndex: 1000, width: 280, background: panelBg, border: `1px solid ${border}`, borderRadius: 14, boxShadow: tone === "dark" ? "0 16px 40px rgba(0,0,0,0.3)" : "0 16px 40px rgba(31,30,29,0.12)", overflow: "hidden", backdropFilter: "blur(12px)" }}>
          <div style={{ padding: "12px 14px", fontWeight: 700, fontSize: 14, borderBottom: `1px solid ${border}`, color: fg }}>{t("notif.title")}</div>
          {items.map((it, i) => (
            <div key={i} style={{ display: "flex", gap: 10, padding: "11px 14px", borderBottom: i < items.length - 1 ? `1px solid ${border}` : "none", color: fg, fontSize: 13.5, lineHeight: 1.5 }}>
              <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#D97757", marginTop: 6, flexShrink: 0 }} />
              {it}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
