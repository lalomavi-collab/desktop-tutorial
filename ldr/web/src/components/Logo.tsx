// LAWDin brand mark — LinkedIn-inspired lockup: "LAWD" + an "in" tile.
// (LAWDin, like LinkedIn, ends in "in" — so the wordmark mirrors that style.)

// The "in" tile — a rounded square in Waze cyan, used as the standalone mark
// (favicon / avatar slot) and as the final glyph of the wordmark.
export function LogoMark({ size = 40, glow = true }: { size?: number; glow?: boolean }) {
  return (
    <div
      className="logo-mark"
      style={{
        width: size, height: size,
        borderRadius: size * 0.24,
        display: "grid", placeItems: "center",
        background: "linear-gradient(145deg, #4dd2ff, #1e9fd6)",
        boxShadow: glow ? "0 4px 16px rgba(51,204,255,0.40)" : "none",
        flexShrink: 0,
      }}
      aria-label="LAWDin"
    >
      <span style={{
        fontWeight: 900, fontSize: size * 0.5, lineHeight: 1, color: "#0d1020",
        fontFamily: "Heebo, system-ui, sans-serif", letterSpacing: "-0.5px",
      }}>in</span>
    </div>
  );
}

// Wordmark = "LAWD" + the "in" tile, reading "LAWDin".
export function Wordmark({
  size = 40, tagline = true,
}: { size?: number; tagline?: boolean }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <div style={{ display: "flex", alignItems: "center", gap: size * 0.1 }} dir="ltr">
        <span style={{
          fontWeight: 900, fontSize: size * 0.62, letterSpacing: "-1px",
          color: "var(--cream)", lineHeight: 1,
        }}>LAWD</span>
        <LogoMark size={size * 0.9} />
      </div>
      {tagline && (
        <small style={{ color: "var(--cream-dim)", fontWeight: 400, fontSize: 11, letterSpacing: 2 }}>
          Legal Operating System
        </small>
      )}
    </div>
  );
}
