// LAWDin brand mark — a refined scales-of-justice monogram.
// Rendered as an SVG so it stays crisp at any size and needs no image asset.

export function LogoMark({ size = 40, glow = true }: { size?: number; glow?: boolean }) {
  return (
    <div
      className="logo-mark"
      style={{
        width: size, height: size,
        borderRadius: size * 0.28,
        display: "grid", placeItems: "center",
        background: "linear-gradient(145deg, #e3a17f, #b75c3f)",
        boxShadow: glow ? "0 4px 16px rgba(217,119,87,0.40)" : "none",
        flexShrink: 0,
      }}
      aria-label="LAWDin"
    >
      <svg width={size * 0.62} height={size * 0.62} viewBox="0 0 24 24" fill="none"
        stroke="#1B1B1B" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
        {/* central column */}
        <path d="M12 3.4 V20" />
        {/* base */}
        <path d="M8.5 20 H15.5" />
        {/* beam */}
        <path d="M5 7 H19" />
        {/* fulcrum knot */}
        <circle cx="12" cy="5.4" r="1.15" fill="#1B1B1B" stroke="none" />
        {/* left pan hangers + pan */}
        <path d="M5 7 L3.2 11.2 H6.8 Z" fill="rgba(27,27,27,0.12)" />
        {/* right pan hangers + pan */}
        <path d="M19 7 L17.2 11.2 H20.8 Z" fill="rgba(27,27,27,0.12)" />
      </svg>
    </div>
  );
}

// Wordmark = mark + "LAWDin" + optional tagline. Used in the top bar / landing.
export function Wordmark({
  size = 40, tagline = true,
}: { size?: number; tagline?: boolean }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
      <LogoMark size={size} />
      <div className="name" style={{ lineHeight: 1.05 }}>
        <span style={{ fontWeight: 800, letterSpacing: 0.3, fontSize: size * 0.42 }}>LAWDin</span>
        {tagline && (
          <small style={{ display: "block", color: "var(--cream-dim)", fontWeight: 400, fontSize: 11, letterSpacing: 2 }}>
            Legal Operating System
          </small>
        )}
      </div>
    </div>
  );
}
