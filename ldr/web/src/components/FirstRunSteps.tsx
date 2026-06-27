// First-run progress for new attorneys: sets expectations across the entry
// journey (signup, build profile, Bar verification) so the steps feel guided.
const STEPS = [
  { key: "signup", label: "הרשמה" },
  { key: "profile", label: "בניית פרופיל" },
  { key: "verify", label: "אימות לשכה" },
];

export default function FirstRunSteps({ current }: { current: "profile" | "verify" }) {
  const idx = current === "profile" ? 1 : 2;
  return (
    <div className="container" style={{ maxWidth: 620, paddingTop: 20 }} dir="rtl">
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, flexWrap: "wrap" }}>
        {STEPS.map((s, i) => (
          <span key={s.key} style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{
              width: 24, height: 24, borderRadius: "50%", display: "grid", placeItems: "center",
              fontSize: 12, fontWeight: 800, flexShrink: 0,
              background: i < idx ? "var(--ok)" : i === idx ? "var(--gold)" : "var(--obsidian-3)",
              color: i <= idx ? "var(--obsidian)" : "var(--cream-dim)", border: "1px solid var(--line)",
            }}>{i < idx ? "✓" : i + 1}</span>
            <span style={{ fontSize: 13, fontWeight: i === idx ? 800 : 600, color: i === idx ? "var(--cream)" : "var(--cream-dim)" }}>{s.label}</span>
            {i < STEPS.length - 1 && <span style={{ width: 22, height: 2, background: "var(--line)", margin: "0 2px" }} />}
          </span>
        ))}
      </div>
    </div>
  );
}
