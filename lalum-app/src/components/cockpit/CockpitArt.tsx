// Decorative line-art for the cockpit. Pure inline SVG on the site's own tokens (no raster, no new colours),
// always aria-hidden: nothing here carries meaning that the neighbouring text does not already state.
import type { ReactNode } from "react";

const common = { viewBox: "0 0 48 48", width: 44, height: 44, role: "presentation", "aria-hidden": true, focusable: false } as const;
const stroke = { fill: "none", stroke: "var(--clay)", strokeWidth: 1.6, strokeLinecap: "round", strokeLinejoin: "round" } as const;

function Tile({ children }: { children: ReactNode }) {
  return (
    <svg {...common}>
      <rect x="2" y="2" width="44" height="44" rx="14" fill="var(--clay-tint)" />
      <circle cx="37" cy="11" r="7" fill="var(--clay-soft)" opacity="0.55" />
      <g {...stroke}>{children}</g>
    </svg>
  );
}

export type ArtKey = "intake" | "guide" | "admin" | "billing" | "security";

export function CardArt({ name }: { name: ArtKey }) {
  switch (name) {
    case "intake": return (
      <Tile><path d="M16 12h12l6 6v18H16z" /><path d="M28 12v6h6" /><path d="M24 22v10M19 27h10" /></Tile>
    );
    case "guide": return (
      <Tile><path d="M12 15c4-2 8-2 12 1 4-3 8-3 12-1v19c-4-2-8-2-12 1-4-3-8-3-12-1z" /><path d="M24 16v19" /></Tile>
    );
    case "admin": return (
      <Tile><rect x="12" y="13" width="24" height="22" rx="3" /><path d="M12 21h24M19 21v14" /><circle cx="28" cy="28" r="2" /></Tile>
    );
    case "billing": return (
      <Tile><rect x="11" y="16" width="26" height="17" rx="3" /><path d="M11 22h26M16 29h6" /></Tile>
    );
    case "security": return (
      <Tile><path d="M24 11l10 4v8c0 7-4.5 11-10 14-5.5-3-10-7-10-14v-8z" /><path d="M19.5 24l3.5 3.5 6-7" /></Tile>
    );
  }
}

// Wide illustration for the firm header: a stack of documents passing through a shield into a ledger.
export function HeroArt() {
  return (
    <svg viewBox="0 0 360 150" width="100%" height="100%" role="presentation" aria-hidden="true" focusable="false" preserveAspectRatio="xMidYMid meet">
      <circle cx="90" cy="86" r="86" fill="var(--clay-tint)" opacity="0.7" />
      <circle cx="270" cy="70" r="58" fill="var(--clay-soft)" opacity="0.4" />
      <g fill="var(--paper)" stroke="var(--clay)" strokeWidth="1.4" strokeLinejoin="round">
        <rect x="26" y="40" width="54" height="72" rx="4" transform="rotate(-6 53 76)" />
        <rect x="40" y="34" width="54" height="72" rx="4" />
        <g stroke="var(--clay)" opacity="0.7"><path d="M50 52h34M50 62h34M50 72h22M50 82h30" /></g>
      </g>
      <g fill="none" stroke="var(--clay)" strokeWidth="1.4" strokeDasharray="3 4" opacity="0.7"><path d="M104 70h38M218 70h38" /></g>
      <path d="M180 28l38 14v28c0 26-17 40-38 52-21-12-38-26-38-52V42z" fill="var(--paper)" stroke="var(--clay)" strokeWidth="1.6" strokeLinejoin="round" />
      <path d="M164 74l11 11 22-26" fill="none" stroke="var(--clay)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
      <g fill="var(--paper)" stroke="var(--clay)" strokeWidth="1.4">
        <rect x="262" y="38" width="64" height="76" rx="6" />
        <g stroke="var(--clay)" opacity="0.7"><path d="M272 56h44M272 70h44M272 84h30" /></g>
      </g>
      <g fill="var(--clay)"><circle cx="318" cy="102" r="3.4" /><circle cx="300" cy="102" r="3.4" opacity="0.5" /><circle cx="282" cy="102" r="3.4" opacity="0.25" /></g>
    </svg>
  );
}

// Empty state for the matters table.
export function EmptyArt() {
  return (
    <svg viewBox="0 0 160 110" width="160" height="110" role="presentation" aria-hidden="true" focusable="false">
      <ellipse cx="80" cy="96" rx="52" ry="7" fill="var(--clay-tint)" />
      <g fill="var(--paper)" stroke="var(--clay)" strokeWidth="1.5" strokeLinejoin="round">
        <path d="M30 44l16-14h68l16 14v44a6 6 0 0 1-6 6H36a6 6 0 0 1-6-6z" />
      </g>
      <path d="M30 44h34a6 6 0 0 1 6 6 10 10 0 0 0 20 0 6 6 0 0 1 6-6h34" fill="none" stroke="var(--clay)" strokeWidth="1.5" strokeLinejoin="round" />
      <g stroke="var(--clay)" strokeWidth="1.4" strokeLinecap="round" opacity="0.6"><path d="M80 10v10M62 14l4 8M98 14l-4 8" /></g>
    </svg>
  );
}
