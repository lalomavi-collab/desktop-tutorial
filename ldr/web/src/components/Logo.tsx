// LAWDin brand mark — two-tone "LAWDIN" wordmark (3D-extruded feel).
// Per the reference: split colour across the word, with the sides swapped —
// "LAW" in cyan, "DIN" in cream.

const CYAN = "#33CCFF";
// Subtle extruded-3D depth.
const DEPTH = "0 1px 0 rgba(0,0,0,0.35), 0 2px 0 rgba(0,0,0,0.30), 0 4px 10px rgba(0,0,0,0.45)";

// Compact mark for tight spots (auth card / favicon slot): cyan tile + dark "L".
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
        fontWeight: 900, fontSize: size * 0.52, lineHeight: 1, color: "#0d1020",
        letterSpacing: "-1px",
      }}>Ld</span>
    </div>
  );
}

// Wordmark = "LAW" (cyan) + "DIN" (cream), reading "LAWDIN".
export function Wordmark({
  size = 40, tagline = true,
}: { size?: number; tagline?: boolean }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <span dir="ltr" style={{
        fontWeight: 900, fontSize: size * 0.62, letterSpacing: "-1px",
        lineHeight: 1, textShadow: DEPTH, fontFamily: "Heebo, system-ui, sans-serif",
      }}>
        <span style={{ color: CYAN }}>LAW</span>
        <span style={{ color: "var(--cream)" }}>DIN</span>
      </span>
      {tagline && (
        <small style={{ color: "var(--cream-dim)", fontWeight: 400, fontSize: 11, letterSpacing: 2 }}>
          Legal Operating System
        </small>
      )}
    </div>
  );
}
