// Decorative, theme-specific line-art for a page's hero, drawn from the same
// grammar as Partners.tsx's PartnersArt (wash circles, var(--clay) stroke,
// var(--paper) fill): never a logo substitute, never shown without the real
// Wordmark somewhere on the page, purely an illustrative companion to the
// copy. One component, three motifs, so a page picks a theme instead of
// carrying its own bespoke SVG.
export type PillarArtTheme = "ai" | "realestate" | "knowledge";

function Wash() {
  return (
    <>
      <circle cx="160" cy="150" r="150" fill="var(--clay-tint)" opacity="0.5" />
      <circle cx="235" cy="195" r="95" fill="var(--clay-soft)" opacity="0.35" />
    </>
  );
}

function AiMotif() {
  return (
    <>
      <g stroke="var(--clay)" strokeWidth="1.3" opacity="0.6">
        <line x1="120" y1="190" x2="190" y2="110" />
        <line x1="120" y1="190" x2="205" y2="215" />
        <line x1="120" y1="190" x2="155" y2="260" />
        <line x1="190" y1="110" x2="255" y2="85" />
        <line x1="190" y1="110" x2="205" y2="215" />
        <line x1="205" y1="215" x2="155" y2="260" />
        <line x1="205" y1="215" x2="255" y2="85" />
        <line x1="255" y1="85" x2="290" y2="150" />
        <line x1="205" y1="215" x2="290" y2="150" />
        <line x1="155" y1="260" x2="235" y2="270" />
        <line x1="290" y1="150" x2="235" y2="270" />
      </g>
      <g fill="var(--clay)">
        <circle cx="120" cy="190" r="4" />
        <circle cx="190" cy="110" r="4" />
        <circle cx="205" cy="215" r="5.5" />
        <circle cx="155" cy="260" r="4" />
        <circle cx="255" cy="85" r="4" />
        <circle cx="290" cy="150" r="4" />
        <circle cx="235" cy="270" r="4" />
      </g>
    </>
  );
}

function RealEstateMotif() {
  return (
    <g fill="var(--paper)" stroke="var(--clay)" strokeWidth="1.4" opacity="0.9">
      <rect x="60" y="150" width="34" height="140" />
      <rect x="104" y="100" width="34" height="190" />
      <rect x="148" y="170" width="34" height="120" />
      <rect x="192" y="70" width="34" height="220" />
      <rect x="236" y="130" width="34" height="160" />
      {[60, 104, 148, 192, 236].map((x, col) => {
        const heights = [140, 190, 120, 220, 160][col];
        const top = 290 - heights;
        const rows: number[] = [];
        for (let y = top + 20; y < 280; y += 24) rows.push(y);
        return rows.map((y) => <line key={`${x}-${y}`} x1={x} y1={y} x2={x + 34} y2={y} strokeWidth="1" opacity="0.6" />);
      })}
      <line x1="40" y1="290" x2="300" y2="290" stroke="var(--line-strong)" strokeWidth="1" />
    </g>
  );
}

function KnowledgeMotif() {
  return (
    <>
      {/* An open book: two angled pages, a handful of text lines on each. */}
      <g stroke="var(--clay)" strokeWidth="1.4" fill="var(--paper)">
        <path d="M170 110 L80 130 L80 250 L170 232 Z" opacity="0.95" />
        <path d="M170 110 L260 130 L260 250 L170 232 Z" opacity="0.95" />
      </g>
      <g stroke="var(--clay)" strokeWidth="1" opacity="0.55">
        <line x1="95" y1="155" x2="155" y2="143" />
        <line x1="95" y1="178" x2="155" y2="166" />
        <line x1="95" y1="201" x2="155" y2="189" />
        <line x1="95" y1="224" x2="150" y2="213" />
        <line x1="185" y1="143" x2="245" y2="155" />
        <line x1="185" y1="166" x2="245" y2="178" />
        <line x1="185" y1="189" x2="245" y2="201" />
        <line x1="190" y1="213" x2="245" y2="224" />
      </g>
      {/* A few idea sparks above the spine, echoing the AI motif's node dots
          without being the same shape, so the two stay visually distinct. */}
      <g fill="var(--clay)" opacity="0.85">
        <circle cx="170" cy="82" r="4" />
        <circle cx="140" cy="95" r="2.6" />
        <circle cx="200" cy="95" r="2.6" />
      </g>
      <line x1="170" y1="104" x2="170" y2="88" stroke="var(--clay)" strokeWidth="1.3" opacity="0.7" />
      <line x1="40" y1="290" x2="300" y2="290" stroke="var(--line-strong)" strokeWidth="1" />
    </>
  );
}

export function PillarArt({ theme }: { theme: PillarArtTheme }) {
  return (
    <svg viewBox="0 0 320 320" width="100%" height="100%" role="presentation" aria-hidden="true">
      <Wash />
      {theme === "ai" && <AiMotif />}
      {theme === "realestate" && <RealEstateMotif />}
      {theme === "knowledge" && <KnowledgeMotif />}
    </svg>
  );
}
