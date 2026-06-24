// LAWDin brand mark — a scales-of-justice tile + the "LAWDin" wordmark.
// (Distinct from LinkedIn: the whole name is plain text beside a justice tile,
// rather than boxing the "in".)

// Scales-of-justice tile (clay rounded square). Also the standalone mark.
export function LogoMark({ size = 40, glow = true }: { size?: number; glow?: boolean }) {
  return (
    <div
      className="logo-mark"
      style={{
        width: size, height: size,
        borderRadius: size * 0.24,
        display: "grid", placeItems: "center",
        background: "linear-gradient(145deg, #E08A6C, #BE5D3D)",
        boxShadow: glow ? "0 4px 16px rgba(217,119,87,0.40)" : "none",
        flexShrink: 0,
      }}
      aria-label="LAWDin"
    >
      <span className="ms" style={{ fontSize: size * 0.58, color: "#fff", fontVariationSettings: "'FILL' 1" }}>balance</span>
    </div>
  );
}

// Wordmark = scales tile + "LAWDin" (one clean wordmark, not a boxed "in").
export function Wordmark({
  size = 40, tagline = true, tone = "light",
}: { size?: number; tagline?: boolean; tone?: "light" | "dark" }) {
  const nameColor = tone === "dark" ? "#1F1E1D" : "var(--cream)";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <LogoMark size={size} />
      <div style={{ display: "flex", flexDirection: "column", lineHeight: 1 }}>
        <span dir="ltr" style={{ fontWeight: 800, fontSize: size * 0.6, letterSpacing: "-0.5px", color: nameColor }}>
          LAWDin
        </span>
        {tagline && (
          <small style={{ color: tone === "dark" ? "#6B6862" : "var(--cream-dim)", fontWeight: 400, fontSize: size * 0.26, letterSpacing: 1 }}>
            Professional Legal Network
          </small>
        )}
      </div>
    </div>
  );
}
