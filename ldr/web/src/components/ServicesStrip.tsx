import { useI18n } from "../i18n";

// Service rubrics strip on the landing — shows what LAWdin offers (incl. jobs),
// so visitors see the platform's services at a glance.
const SERVICES = [
  { icon: "🔄", t: "svc.referrals", d: "svc.referralsD" },
  { icon: "📩", t: "svc.cases", d: "svc.casesD" },
  { icon: "🤝", t: "svc.rooms", d: "svc.roomsD" },
  { icon: "💼", t: "svc.jobs", d: "svc.jobsD" },
];

export default function ServicesStrip() {
  const { t } = useI18n();
  return (
    <div className="container" style={{ position: "relative", zIndex: 2, maxWidth: 1100, padding: "18px 0 4px" }}>
      <h2 style={{ margin: "0 0 14px", fontSize: 20 }}>{t("svc.title")}</h2>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 14 }}>
        {SERVICES.map((s) => (
          <div key={s.t} className="card pad" style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
            <span style={{ fontSize: 26, lineHeight: 1 }}>{s.icon}</span>
            <div>
              <div style={{ fontWeight: 700, fontSize: 15 }}>{t(s.t)}</div>
              <div className="muted" style={{ fontSize: 12.5, marginTop: 3 }}>{t(s.d)}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
