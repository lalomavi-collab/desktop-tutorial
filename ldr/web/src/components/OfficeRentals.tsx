import { useI18n } from "../i18n";

// Compact room-sharing entry — whoever's interested clicks to enter (kept small
// so the map + people stay the focus, Waze/Gett style).
export default function OfficeRentals() {
  const { t } = useI18n();
  return (
    <div className="container" style={{ position: "relative", zIndex: 2, maxWidth: 1100, padding: "8px 0 4px" }}>
      <div style={{
        display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap",
        background: "#fff", border: "1px solid #E8E5DD", borderRadius: 16, padding: "14px 18px",
        boxShadow: "0 8px 24px rgba(31,30,29,.06)",
      }}>
        <span style={{ fontSize: 26 }}>🤝</span>
        <div style={{ flex: 1, minWidth: 200 }}>
          <div style={{ fontWeight: 700, fontSize: 15, color: "#1F1E1D" }}>{t("office.title")}</div>
          <div style={{ color: "#6B6862", fontSize: 12.5, marginTop: 2 }}>{t("office.sub")}</div>
        </div>
        <button style={{ background: "#D97757", color: "#fff", border: "none", borderRadius: 12, padding: "10px 20px", fontWeight: 700, fontFamily: "inherit", fontSize: 14, cursor: "pointer", whiteSpace: "nowrap" }}>
          {t("office.book")} →
        </button>
      </div>
    </div>
  );
}
