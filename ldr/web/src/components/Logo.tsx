// LAWDin brand mark — LinkedIn-style: the word "LAWD" followed by an "in" tile
// (a rounded square), exactly like LinkedIn's "Linked" + "in" lockup.

// The "in" tile — cyan rounded square with dark "in". Also the standalone mark.
export function LogoMark({ size = 40, glow = true }: { size?: number; glow?: boolean }) {
  return (
    <div
      className="logo-mark"
      style={{
        width: size, height: size,
        borderRadius: size * 0.22,
        display: "grid", placeItems: "center",
        background: "linear-gradient(145deg, #4dd2ff, #1e9fd6)",
        boxShadow: glow ? "0 4px 16px rgba(51,204,255,0.40)" : "none",
        flexShrink: 0,
      }}
      aria-label="LAWDin"
    >
      <span style={{
        fontWeight: 900, fontSize: size * 0.52, lineHeight: 1, color: "#0d1020",
        letterSpacing: "-1px", fontFamily: "Heebo, system-ui, sans-serif",
      }}>in</span>
    </div>
  );
}

// Wordmark = "LAWD" + the "in" tile, reading "LAWDin" (LinkedIn-style).
export function Wordmark({
  size = 40, tagline = true,
}: { size?: number; tagline?: boolean }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <div dir="ltr" style={{ display: "flex", alignItems: "center", gap: size * 0.08 }}>
        <span style={{
          fontWeight: 900, fontSize: size * 0.62, letterSpacing: "-1px",
          color: "var(--cream)", lineHeight: 1,
          textShadow: "0 1px 0 rgba(0,0,0,0.35), 0 2px 6px rgba(0,0,0,0.35)",
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
