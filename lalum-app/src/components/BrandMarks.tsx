// Small, self-contained brand marks used to show which services the app works
// with (nominative "works with" use): meeting tools on the Book page and
// payment wallets in the billing/footer. Simplified, recognisable, no external
// assets so they stay crisp and load instantly.
import { Icon } from "./Icon";

type P = { size?: number };

// Coloured badge wrapping a glyph from the icon sheet, for the recognisable
// contact brands (WhatsApp green, Telegram blue).
function GlyphBadge({ size, bg, icon }: { size: number; bg: string; icon: string }) {
  return (
    <span
      aria-hidden="true"
      style={{ display: "inline-flex", width: size, height: size, borderRadius: size * 0.28, background: bg, color: "#fff", alignItems: "center", justifyContent: "center" }}
    >
      <Icon name={icon} size={Math.round(size * 0.62)} />
    </span>
  );
}

export function WhatsAppMark({ size = 24 }: P) {
  return <GlyphBadge size={size} bg="#25D366" icon="whatsapp" />;
}

export function TelegramMark({ size = 24 }: P) {
  return <GlyphBadge size={size} bg="#229ED9" icon="telegram" />;
}

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

export function TeamsMark({ size = 22 }: P) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true">
      <rect width="48" height="48" rx="11" fill="#5B5FC7" />
      <circle cx="32.5" cy="16" r="4.3" fill="#fff" />
      <rect x="27" y="22" width="12" height="11" rx="3" fill="#fff" />
      <rect x="10" y="16" width="18" height="16" rx="3" fill="#fff" />
      <rect x="13" y="20" width="12" height="3" rx="1.2" fill="#5B5FC7" />
      <rect x="17.5" y="20" width="3" height="9" rx="1.2" fill="#5B5FC7" />
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
      style={{ display: "inline-flex", alignItems: "center", height: h, padding: "0 9px", borderRadius: 6, background: "#000", color: "#fff", fontFamily: "-apple-system, Arial, sans-serif", fontSize: h * 0.6, fontWeight: 600, lineHeight: 1, gap: 4 }}
    >
      {/* Drawn apple so it renders on every platform (the glyph is Apple-only). */}
      <svg width={h * 0.6} height={h * 0.6} viewBox="0 0 24 24" fill="#fff" aria-hidden="true">
        <path d="M17.05 12.9c-.03-2.3 1.88-3.4 1.96-3.46-1.07-1.56-2.73-1.78-3.32-1.8-1.41-.14-2.76.83-3.47.83-.72 0-1.82-.81-3-.79-1.54.02-2.96.9-3.75 2.28-1.6 2.78-.41 6.89 1.15 9.15.76 1.1 1.67 2.34 2.86 2.29 1.15-.05 1.58-.74 2.97-.74 1.38 0 1.77.74 2.98.72 1.23-.02 2.01-1.12 2.76-2.23.87-1.28 1.23-2.52 1.25-2.58-.03-.01-2.4-.92-2.42-3.65z" />
        <path d="M14.77 6.15c.64-.77 1.07-1.85.95-2.92-.92.04-2.03.61-2.69 1.38-.59.68-1.11 1.78-.97 2.83 1.03.08 2.07-.52 2.71-1.29z" />
      </svg>
      <span>Pay</span>
    </span>
  );
}

export function LeumiMark({ size = 22 }: P) {
  const h = size;
  return (
    <span
      aria-hidden="true"
      style={{ display: "inline-flex", alignItems: "center", height: h, padding: "0 11px", borderRadius: 6, background: "#002d72", color: "#fff", fontFamily: "Arial, sans-serif", fontSize: h * 0.56, fontWeight: 800, lineHeight: 1, letterSpacing: 0.2, gap: 6 }}
    >
      <span style={{ width: h * 0.42, height: h * 0.42, borderRadius: "50%", border: `2px solid #fff`, display: "inline-block", flex: "none" }} />
      בנק לאומי
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
