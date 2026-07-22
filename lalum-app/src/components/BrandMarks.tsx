// Small, self-contained brand marks used to show which services the app works
// with (nominative "works with" use): meeting tools on the Book page and
// payment wallets in the billing/footer. Simplified, recognisable, no external
// assets so they stay crisp and load instantly.
type P = { size?: number };

export function ZoomMark({ size = 22 }: P) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true">
      <rect width="48" height="48" rx="11" fill="#2D8CFF" />
      <g fill="#fff">
        <rect x="11" y="17" width="17" height="14" rx="3.5" />
        <path d="M30 22.4l6.4-3.6v10.4L30 25.6z" />
      </g>
    </svg>
  );
}

export function MeetMark({ size = 22 }: P) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true">
      <rect width="48" height="48" rx="11" fill="#fff" stroke="#e6e0d3" />
      <path d="M27 24l8-4.6v9.2L27 24z" fill="#00AC47" />
      <rect x="12" y="18" width="16" height="12" rx="2.5" fill="#4285F4" />
      <path d="M28 20.5l0 7 -4-3.5z" fill="#FFBA00" />
      <rect x="12" y="18" width="4.5" height="12" rx="1" fill="#EA4335" />
    </svg>
  );
}

export function GPayMark({ size = 22 }: P) {
  const h = size;
  return (
    <span
      aria-hidden="true"
      style={{ display: "inline-flex", alignItems: "center", height: h, padding: "0 8px", borderRadius: 6, background: "#fff", border: "1px solid #dadce0", fontFamily: "Arial, sans-serif", fontSize: h * 0.62, fontWeight: 700, lineHeight: 1, gap: 1 }}
    >
      <span style={{ color: "#4285F4" }}>G</span>
      <span style={{ color: "#5f6368" }}>Pay</span>
    </span>
  );
}

export function ApplePayMark({ size = 22 }: P) {
  const h = size;
  return (
    <span
      aria-hidden="true"
      style={{ display: "inline-flex", alignItems: "center", height: h, padding: "0 9px", borderRadius: 6, background: "#000", color: "#fff", fontFamily: "-apple-system, Arial, sans-serif", fontSize: h * 0.6, fontWeight: 600, lineHeight: 1, gap: 3 }}
    >
      <span style={{ fontSize: h * 0.72 }}>&#63743;</span>
      <span>Pay</span>
    </span>
  );
}

export function BitMark({ size = 22 }: P) {
  const h = size;
  return (
    <span
      aria-hidden="true"
      style={{ display: "inline-flex", alignItems: "center", height: h, padding: "0 10px", borderRadius: 6, background: "#0a7", color: "#fff", fontFamily: "Arial, sans-serif", fontSize: h * 0.62, fontWeight: 800, letterSpacing: 0.3, lineHeight: 1 }}
    >
      bit
    </span>
  );
}
