// The small line icons of the documents list (view, print, mail, WhatsApp, more, the sent ticks and the allocation mark).
// Drawn on a 24 grid in the current text colour, so they follow the three looks of the cockpit like every other icon.
const PATH = {
  eye: "M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12ZM12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6Z",
  print: "M6 9V3h12v6M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2M6 14h12v7H6Z",
  mail: "M3 5h18v14H3ZM3 6l9 7 9-7",
  whatsapp: "M3.5 20.5l1.3-4.2A8.5 8.5 0 1 1 8 19.4ZM9 8.6c0 3.4 3 6.4 6.4 6.4l1.4-1.5-2-1-1 .8a5 5 0 0 1-2.7-2.7l.8-1-1-2Z",
  more: "M5 12h.01M12 12h.01M19 12h.01",
  check: "M5 12.5l4 4L19 7",
  checks: "M2 12.5l4 4L16 7M9.5 15.5l1 1L22 7",
  hash: "M10 4 8 20M16 4l-2 16M4.5 9h16M3.5 15h16",
} as const;
export type DocIconName = keyof typeof PATH;

export function DocIcon({ name, size = 18 }: { name: DocIconName; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={name === "more" ? 3 : 1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={PATH[name]} />
    </svg>
  );
}

/** One icon action. The label is both the tooltip and what a screen reader says. */
export function IconButton({ name, label, onClick, disabled, busy, tone }: { name: DocIconName; label: string; onClick: () => void; disabled?: boolean; busy?: boolean; tone?: "wa" }) {
  return (
    <button type="button" className={`doc-ico${tone ? ` ${tone}` : ""}`} title={label} aria-label={label} aria-busy={busy || undefined} disabled={disabled || busy} onClick={onClick}>
      <DocIcon name={name} />
    </button>
  );
}
