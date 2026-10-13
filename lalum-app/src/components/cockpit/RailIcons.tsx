// Illustrated icons for the cockpit's side rail: one small picture per screen, so the topic reads before the label does.
// Original artwork in the same mint palette and soft-gradient style as CockpitIllustrations. Fixed colours (not theme
// tokens) so they read the same on the light and the dark theme. Decorative only: the label under each icon names it.
import type { ReactNode } from "react";

const B = "url(#rl-g)", D = "url(#rl-d)", S = "url(#rl-s)", W = "#fff", L = "#3f5a43";

/** Gradients shared by every rail icon. Rendered once, in the sidebar. A 0x0 svg, not display:none, so the references keep working. */
export function RailDefs() {
  return (
    <svg width="0" height="0" style={{ position: "absolute" }} aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id="rl-g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#9bbb9f" /><stop offset="1" stopColor="#5f8564" /></linearGradient>
        <linearGradient id="rl-d" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#5f8564" /><stop offset="1" stopColor="#3f5a43" /></linearGradient>
        <linearGradient id="rl-s" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#ffe58a" /><stop offset="1" stopColor="#f2b705" /></linearGradient>
      </defs>
    </svg>
  );
}

const stroke = (c: string, w = 2.4) => ({ stroke: c, strokeWidth: w, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, fill: "none" });

const ICONS: Record<string, ReactNode> = {
  // dashboard: three rising bars, the tallest in gold
  "/workspace/dashboard": <><rect x="3" y="4" width="26" height="24" rx="6" fill={B} /><rect x="8" y="17" width="4" height="7" rx="1.5" fill={W} /><rect x="14" y="12" width="4" height="12" rx="1.5" fill={W} /><rect x="20" y="8" width="4" height="16" rx="1.5" fill={S} /></>,
  // matters: a folder with a sheet sticking out
  "/workspace": <><path d="M3 10a3 3 0 0 1 3-3h6l3 3h11a3 3 0 0 1 3 3v12a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3z" fill={D} /><rect x="8" y="8" width="16" height="11" rx="2" fill={W} transform="rotate(-4 16 13)" /><path d="M3 15a3 3 0 0 1 3-3h20a3 3 0 0 1 3 3l-1.2 10a3 3 0 0 1-3 3H7.2a3 3 0 0 1-3-3z" fill={B} /></>,
  // client inquiries: a speech bubble with a question mark
  "/workspace/inquiries": <><path d="M5 5h22a3 3 0 0 1 3 3v12a3 3 0 0 1-3 3H15l-6 5v-5H5a3 3 0 0 1-3-3V8a3 3 0 0 1 3-3z" fill={B} /><text x="16" y="19" textAnchor="middle" fontSize="14" fontWeight="800" fill={W} fontFamily="Arial, sans-serif">?</text><circle cx="27" cy="6" r="4" fill={S} /></>,
  // incoming calls: a handset with signal arcs
  "/workspace/calls": <><path d="M8 4c-3 0-5 2-5 5 0 10 10 20 20 20 3 0 5-2 5-5l-1-2-5-2-3 3c-3-1-7-5-8-8l3-3-2-5z" fill={B} /><path d="M18 5a9 9 0 0 1 9 9" {...stroke("#f2b705", 2.8)} /><path d="M18 10.5a3.5 3.5 0 0 1 3.5 3.5" {...stroke("#f2b705", 2.8)} /></>,
  // message inbox: a tray holding a letter
  "/workspace/inbox": <><path d="M3 17 7 7a3 3 0 0 1 3-2h12a3 3 0 0 1 3 2l4 10v8a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3z" fill={B} /><rect x="9" y="8" width="14" height="10" rx="1.8" fill={W} /><path d="M11 12h10M11 15h6" {...stroke(L, 1.6)} /><path d="M3 17h7a2 2 0 0 1 2 2 4 4 0 0 0 8 0 2 2 0 0 1 2-2h7v8a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3z" fill={D} /><circle cx="27" cy="6" r="3.6" fill={S} /></>,
  // client documents: a page with a check badge
  "/workspace/client-docs": <><path d="M8 3h11l7 7v16a3 3 0 0 1-3 3H8a3 3 0 0 1-3-3V6a3 3 0 0 1 3-3z" fill={B} /><path d="M19 3v5a2 2 0 0 0 2 2h5z" fill={W} opacity=".85" /><path d="M10 14h10M10 18h7" {...stroke(W, 2)} /><circle cx="23" cy="24" r="6" fill={S} /><path d="M20.2 24.2l2 2 3.6-4" {...stroke(L, 2.2)} /></>,
  // know your client: an ID card seen through a magnifier
  "/workspace/kyc": <><rect x="2" y="6" width="26" height="19" rx="4" fill={B} /><circle cx="9.5" cy="13" r="3" fill={W} /><path d="M4.5 21a5 5 0 0 1 10 0z" fill={W} /><path d="M17 12h8M17 16h6" {...stroke(W, 2)} /><circle cx="23" cy="22" r="5.2" fill="#fff" fillOpacity=".3" stroke="#f2b705" strokeWidth="2.6" /><path d="M27 26l3 3" {...stroke("#f2b705", 3)} /></>,
  // tasks: a clipboard with ticks
  "/workspace/tasks": <><rect x="5" y="5" width="22" height="24" rx="4" fill={B} /><rect x="11" y="2" width="10" height="6" rx="2" fill={D} /><path d="M9.5 14l2 2 3.5-3.8" {...stroke(W, 2.2)} /><path d="M18 14h5" {...stroke(W, 2)} /><path d="M9.5 21l2 2 3.5-3.8" {...stroke("#ffe58a", 2.2)} /><path d="M18 21h5" {...stroke(W, 2)} /></>,
  // calendar: a month grid with today in gold
  "/workspace/scheduling": <><rect x="3" y="6" width="26" height="23" rx="5" fill={W} /><path d="M3 11a5 5 0 0 1 5-5h16a5 5 0 0 1 5 5v3H3z" fill={B} /><rect x="9" y="3" width="3" height="7" rx="1.5" fill={D} /><rect x="20" y="3" width="3" height="7" rx="1.5" fill={D} /><g fill={B}><circle cx="9.5" cy="19" r="1.7" /><circle cx="16" cy="19" r="1.7" /><circle cx="22.5" cy="19" r="1.7" /><circle cx="9.5" cy="24.2" r="1.7" /><circle cx="16" cy="24.2" r="1.7" /></g><circle cx="22.5" cy="24.2" r="2.3" fill={S} /></>,
  // service scorecard: a gauge with a needle
  "/workspace/scorecard": <><circle cx="16" cy="16" r="13" fill={B} /><path d="M7.5 21a9 9 0 0 1 17 0" {...stroke(W, 3)} /><path d="M16 21l5-9" {...stroke("#ffe58a", 3)} /><circle cx="16" cy="21" r="2.6" fill={S} /></>,
  // import: a document arrow dropping into a tray
  "/workspace/import": <><path d="M4 19h24v6a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3z" fill={B} /><path d="M4 19h7a2 2 0 0 1 2 2 3 3 0 0 0 6 0 2 2 0 0 1 2-2h7" fill="none" stroke={W} strokeOpacity=".5" strokeWidth="1.6" /><path d="M12 3h8v8h4.5L16 19.5 7.5 11H12z" fill={S} /></>,
  // matter management: a briefcase
  "/admin/matters": <><path d="M11 10V8a3 3 0 0 1 3-3h4a3 3 0 0 1 3 3v2" {...stroke("#3f5a43", 3)} /><rect x="3" y="10" width="26" height="18" rx="4" fill={B} /><rect x="3" y="17" width="26" height="3.4" fill={D} /><rect x="14" y="15.2" width="4" height="7" rx="1.2" fill={S} /></>,
  // client collection: gold coins with a shekel sign
  "/workspace/payments": <><circle cx="12" cy="20" r="10" fill={D} /><circle cx="19" cy="13" r="11.5" fill={S} /><circle cx="19" cy="13" r="8.6" fill="none" stroke={L} strokeOpacity=".35" strokeWidth="1.2" /><text x="19" y="18.2" textAnchor="middle" fontSize="13" fontWeight="800" fill={L} fontFamily="Arial, sans-serif">₪</text></>,
  // public discussions: two overlapping bubbles
  "/workspace/discussions": <><path d="M3 4h16a3 3 0 0 1 3 3v7a3 3 0 0 1-3 3h-8l-4 3.5V17H6a3 3 0 0 1-3-3V7a3 3 0 0 1 3-3z" fill={D} /><path d="M13 12h14a3 3 0 0 1 3 3v8a3 3 0 0 1-3 3h-2v4l-5-4h-7a3 3 0 0 1-3-3v-8a3 3 0 0 1 3-3z" fill={B} /><g fill={W}><circle cx="15.5" cy="19" r="1.5" /><circle cx="20" cy="19" r="1.5" /><circle cx="24.5" cy="19" r="1.5" /></g></>,
  // firm members: two people, the front one larger
  "/settings/members": <><circle cx="22" cy="9.5" r="4.5" fill={D} /><path d="M14 23a8 8 0 0 1 16 0z" fill={D} /><circle cx="12" cy="11" r="5.5" fill={B} /><path d="M2 28a10 10 0 0 1 20 0z" fill={B} /><circle cx="27" cy="5" r="3" fill={S} /></>,
  // billing and settings: a card with a cog
  "/settings/billing": <><rect x="2" y="6" width="26" height="19" rx="4" fill={B} /><rect x="2" y="11" width="26" height="4" fill={D} /><rect x="6" y="18" width="7" height="3.4" rx="1.2" fill={S} /><circle cx="24" cy="23" r="5" fill={S} /><circle cx="24" cy="23" r="1.9" fill={W} /><circle cx="24" cy="23" r="7.2" fill="none" stroke="#f2b705" strokeWidth="2.6" strokeDasharray="2.6 2.2" /></>,
  // security: a shield with a tick
  "/settings/security": <><path d="M16 2.5l11 4v8.5c0 7-4.8 12-11 14.5C9.8 27 5 22 5 15V6.5z" fill={B} /><path d="M16 2.5l11 4v8.5c0 7-4.8 12-11 14.5z" fill={D} opacity=".35" /><path d="M10.8 15.5l3.8 3.8 6.8-7.6" {...stroke(W, 3)} /></>,
  // recycle bin
  "/workspace/bin": <><path d="M12 7V5.5A1.5 1.5 0 0 1 13.5 4h5A1.5 1.5 0 0 1 20 5.5V7" {...stroke("#3f5a43", 2.6)} /><rect x="4.5" y="7" width="23" height="4" rx="2" fill={D} /><path d="M7 12h18l-1.5 14a3 3 0 0 1-3 2.7h-9a3 3 0 0 1-3-2.7z" fill={B} /><path d="M12.5 15.5v9M16 15.5v9M19.5 15.5v9" {...stroke(W, 1.8)} /></>,
  // guide: an open book with a gold ribbon
  "/workspace/guide": <><path d="M2.5 7c5-1.8 9.5-1.2 13.5 2v19c-4-3-8.5-3.6-13.5-1.8z" fill={B} /><path d="M29.5 7c-5-1.8-9.5-1.2-13.5 2v19c4-3 8.5-3.6 13.5-1.8z" fill={D} /><path d="M6 12.5c2.5-.6 5-.4 7 .8M6 17c2.5-.6 5-.4 7 .8" {...stroke(W, 1.6)} /><path d="M21 3h4.5v10l-2.25-1.9L21 13z" fill={S} /></>,
  // footer actions
  theme: <><circle cx="16" cy="16" r="6.4" fill={S} /><g {...stroke("#f2b705", 2.6)}><path d="M16 3v3M16 26v3M3 16h3M26 16h3M6.8 6.8l2.1 2.1M23.1 23.1l2.1 2.1M25.2 6.8l-2.1 2.1M8.9 23.1l-2.1 2.1" /></g></>,
  user: <><circle cx="16" cy="16" r="13.5" fill={B} /><circle cx="16" cy="12.5" r="4.6" fill={W} /><path d="M7 25a9 9 0 0 1 18 0 13 13 0 0 1-18 0z" fill={W} /></>,
  site: <><circle cx="16" cy="16" r="13.5" fill={B} /><g {...stroke(W, 1.7)}><ellipse cx="16" cy="16" rx="5.6" ry="13.5" /><path d="M2.5 16h27M5 9h22M5 23h22" /></g></>,
  logout: <><path d="M5 4h13a2 2 0 0 1 2 2v20a2 2 0 0 1-2 2H5z" fill={B} /><circle cx="15" cy="16" r="1.4" fill={W} /><path d="M17 16h12m-5-5 5 5-5 5" {...stroke("#e5604d", 3)} /></>,
};

/** One rail icon. `id` is a screen path (or one of theme, user, site, logout); an unknown id draws nothing. */
export function RailIcon({ id, size = 30 }: { id: string; size?: number }) {
  return (
    <svg className="ck-railicon" viewBox="0 0 32 32" width={size} height={size} aria-hidden="true" focusable="false">
      {ICONS[id] ?? null}
    </svg>
  );
}
