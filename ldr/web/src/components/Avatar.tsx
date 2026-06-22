// On-brand monogram avatar (gold-on-obsidian) with an optional verified seal.
// Real photo uploads arrive with the verification flow; this is the reliable default.
export default function Avatar({
  name, size = 44, verified = false,
}: { name: string | null; size?: number; verified?: boolean }) {
  const initials = (name || "עו״ד")
    .trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join("");
  const seal = Math.round(size * 0.42);
  return (
    <div style={{ position: "relative", width: size, height: size, flex: `0 0 ${size}px` }}>
      <div
        style={{
          width: size, height: size, borderRadius: "50%",
          background: "var(--obsidian-3)", border: "1px solid rgba(212,175,55,.45)",
          display: "grid", placeItems: "center",
          color: "var(--gold)", fontWeight: 800, fontSize: Math.round(size * 0.38),
        }}
      >
        {initials}
      </div>
      {verified && (
        <span
          title="מאומת"
          style={{
            position: "absolute", insetInlineEnd: -2, bottom: -2,
            width: seal, height: seal, borderRadius: "50%",
            background: "var(--gold)", color: "#000",
            display: "grid", placeItems: "center",
            fontSize: Math.round(seal * 0.62), fontWeight: 900,
            border: "2px solid var(--obsidian)",
          }}
        >
          ✓
        </span>
      )}
    </div>
  );
}
