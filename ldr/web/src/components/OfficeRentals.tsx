import { useI18n } from "../i18n";

// Office-room rental — a free extra service: attorneys with a spare room rent it
// to colleagues by day/hours. (Landing showcase; booking opens the app.)
const ROOMS = [
  { name: "חדר ישיבות מעוצב", city: "רוטשילד 22, תל אביב", img: "https://images.unsplash.com/photo-1497366216548-37526070297c?w=600&q=70", price: 250, free: [true, true, true, false, false] },
  { name: "חדר עבודה פרטי", city: "דרך מנחם בגין, רמת גן", img: "https://images.unsplash.com/photo-1604328698692-f76ea9498e76?w=600&q=70", price: 180, free: [false, true, true, true, true] },
  { name: "משרד מלא ליום", city: "ז׳בוטינסקי, חיפה", img: "https://images.unsplash.com/photo-1524758631624-e2822e304c36?w=600&q=70", price: 320, free: [true, false, true, false, true] },
];
const DAYS = ["א׳", "ב׳", "ג׳", "ד׳", "ה׳"];

export default function OfficeRentals() {
  const { t } = useI18n();
  return (
    <div className="container" style={{ position: "relative", zIndex: 2, maxWidth: 1100, padding: "8px 0 4px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6, flexWrap: "wrap" }}>
        <h2 style={{ margin: 0, fontSize: 20 }}>{t("office.title")}</h2>
        <span style={{ background: "#fbe9e1", color: "#BE5D3D", fontSize: 11, fontWeight: 700, padding: "2px 9px", borderRadius: 999 }}>{t("office.new")}</span>
        <span style={{ flex: 1 }} />
        <button className="btn btn-ghost" style={{ fontSize: 13, padding: "7px 14px" }}>{t("office.list")}</button>
      </div>
      <p className="muted" style={{ fontSize: 13, margin: "0 0 14px", maxWidth: 620, lineHeight: 1.6 }}>{t("office.sub")}</p>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 14 }}>
        {ROOMS.map((r) => (
          <div key={r.name} style={{ background: "#fff", border: "1px solid #E8E5DD", borderRadius: 16, overflow: "hidden", boxShadow: "0 8px 24px rgba(31,30,29,.08)" }}>
            <div style={{ height: 110, backgroundImage: `url('${r.img}')`, backgroundSize: "cover", backgroundPosition: "center" }} />
            <div style={{ padding: 14, color: "#1F1E1D" }}>
              <div style={{ fontWeight: 700, fontSize: 15 }}>{r.name}</div>
              <div style={{ color: "#6B6862", fontSize: 12.5, display: "flex", alignItems: "center", gap: 4, marginTop: 3 }}>
                <span className="ms" style={{ fontSize: 15 }}>location_on</span>{r.city}
              </div>
              <div style={{ display: "flex", gap: 5, margin: "10px 0" }}>
                {DAYS.map((d, i) => (
                  <span key={d} style={{ width: 30, height: 30, borderRadius: 8, display: "grid", placeItems: "center", fontSize: 12, fontWeight: 700, background: r.free[i] ? "#e3f6ee" : "#F2F0E9", color: r.free[i] ? "#0f7a52" : "#b3b0a8" }}>{d}</span>
                ))}
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontWeight: 800, color: "#BE5D3D", fontSize: 16 }}>₪{r.price}<small style={{ color: "#6B6862", fontWeight: 500 }}>{t("office.perDay")}</small></span>
                <button style={{ background: "#D97757", color: "#fff", border: "none", borderRadius: 10, padding: "8px 16px", fontWeight: 700, fontFamily: "inherit", fontSize: 13, cursor: "pointer" }}>{t("office.book")}</button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
