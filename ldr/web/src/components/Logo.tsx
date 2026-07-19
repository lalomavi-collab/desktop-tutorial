// LAWDin brand mark — "LAW" + a square holding a lowercase "din" → "LAWdin".
// Monochrome (no orange, no icon); tone adapts to the background.

function tones(tone: "light" | "dark") {
  // "dark" = for dark backgrounds (light marks); "light" = for light backgrounds.
  return tone === "dark"
    ? { fg: "var(--cream)", boxBg: "var(--cream)", boxFg: "#16181f" }
    : { fg: "#1F1E1D", boxBg: "#1F1E1D", boxFg: "#ffffff" };
}

// The "din" square — also the standalone mark (favicon/avatar slot).
export function LogoMark({ size = 40, tone = "dark" }: { size?: number; tone?: "light" | "dark" }) {
  const c = tones(tone);
  return (
    <div
      className="logo-mark"
      style={{
        width: size, height: size, borderRadius: size * 0.22,
        display: "grid", placeItems: "center", background: c.boxBg, flexShrink: 0,
      }}
      aria-label="LAWdin"
    >
      <span style={{ fontWeight: 800, fontSize: size * 0.34, lineHeight: 1, color: c.boxFg, letterSpacing: "-0.5px" }}>din</span>
    </div>
  );
}

// Wordmark = "LAW" + the "din" square, reading "LAWdin".
export function Wordmark({
  size = 40, tone = "dark",
}: { size?: number; tagline?: boolean; tone?: "light" | "dark" }) {
  const c = tones(tone);
  return (
    <div dir="ltr" style={{ display: "flex", alignItems: "center", gap: size * 0.14 }}>
      <span style={{ fontWeight: 800, fontSize: size * 0.62, letterSpacing: "-1px", color: c.fg, lineHeight: 1 }}>LAW</span>
      <LogoMark size={size * 0.92} tone={tone} />
    </div>
  );
}
