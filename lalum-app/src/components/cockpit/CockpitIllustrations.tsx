// Soft 3D-style illustrations for the cockpit dashboard: layered gradients, a floor shadow and a highlight on each object.
// Original artwork in the mint palette (fixed colours, not theme tokens, so they read the same on the light and the dark theme).
// Decorative only: aria-hidden, nothing here carries meaning the neighbouring text does not already state.
import type { ReactNode } from "react";

const G = { a: "#8ed46a", b: "#4ea53a", c: "#2f7a27", d: "#d9f0c0", sun: "#f6c93b", sun2: "#ffe58a", ink: "#1f4d1a" };

function Svg({ id, children, size = 96 }: { id: string; children: ReactNode; size?: number }) {
  return (
    <svg viewBox="0 0 120 120" width={size} height={size} role="presentation" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id={`${id}-g`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={G.a} /><stop offset="1" stopColor={G.b} /></linearGradient>
        <linearGradient id={`${id}-d`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={G.b} /><stop offset="1" stopColor={G.c} /></linearGradient>
        <linearGradient id={`${id}-s`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={G.sun2} /><stop offset="1" stopColor={G.sun} /></linearGradient>
        <linearGradient id={`${id}-w`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#ffffff" /><stop offset="1" stopColor="#e9f5dc" /></linearGradient>
      </defs>
      <ellipse cx="60" cy="108" rx="38" ry="6" fill="#2f7a27" opacity=".16" />
      {children}
    </svg>
  );
}

export function FolderArt({ size }: { size?: number }) {
  return (
    <Svg id="fa" size={size}>
      <path d="M16 36a6 6 0 0 1 6-6h24l8 9h44a6 6 0 0 1 6 6v46a6 6 0 0 1-6 6H22a6 6 0 0 1-6-6z" fill="url(#fa-d)" />
      <g transform="rotate(-6 50 56)"><rect x="28" y="30" width="46" height="56" rx="5" fill="url(#fa-w)" /><path d="M36 44h30M36 53h30M36 62h20" stroke="#9fd18a" strokeWidth="3" strokeLinecap="round" /></g>
      <g transform="rotate(5 76 58)"><rect x="52" y="34" width="44" height="54" rx="5" fill="#fff" /><path d="M60 48h28M60 57h28M60 66h16" stroke="#b9e0a6" strokeWidth="3" strokeLinecap="round" /></g>
      <path d="M12 56a6 6 0 0 1 6-6h84a6 6 0 0 1 6 6l-4 38a6 6 0 0 1-6 6H22a6 6 0 0 1-6-6z" fill="url(#fa-g)" />
      <path d="M18 54h82" stroke="#fff" strokeOpacity=".45" strokeWidth="2.5" strokeLinecap="round" />
      <circle cx="96" cy="40" r="15" fill="url(#fa-s)" /><path d="M96 33v14M89 40h14" stroke="#7a5300" strokeWidth="3.4" strokeLinecap="round" />
    </Svg>
  );
}

export function ImportArt({ size }: { size?: number }) {
  return (
    <Svg id="ia" size={size}>
      <path d="M18 58l42-18 42 18v34l-42 16-42-16z" fill="url(#ia-d)" />
      <path d="M18 58l42 16 42-16" fill="none" stroke="#fff" strokeOpacity=".4" strokeWidth="2.5" strokeLinejoin="round" />
      <path d="M60 74v34l-42-16V58z" fill="url(#ia-g)" /><path d="M60 74v34l42-16V58z" fill="#3f8f2f" />
      <g transform="rotate(-8 50 36)"><rect x="34" y="14" width="34" height="42" rx="4" fill="#fff" /><path d="M41 26h20M41 34h20M41 42h12" stroke="#b9e0a6" strokeWidth="3" strokeLinecap="round" /></g>
      <rect x="58" y="12" width="34" height="42" rx="4" fill="url(#ia-w)" transform="rotate(7 75 33)" />
      <circle cx="94" cy="30" r="15" fill="url(#ia-s)" /><path d="M94 22v14M88 31l6 6 6-6" fill="none" stroke="#7a5300" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export function InboxArt({ size }: { size?: number }) {
  return (
    <Svg id="na" size={size}>
      <rect x="14" y="36" width="92" height="62" rx="10" fill="url(#na-w)" />
      <path d="M14 46a10 10 0 0 1 10-10h72a10 10 0 0 1 10 10l-46 32z" fill="url(#na-g)" />
      <path d="M14 98l36-34M106 98L70 64" stroke="#b9e0a6" strokeWidth="3" strokeLinecap="round" />
      <path d="M22 44l38 26 38-26" fill="none" stroke="#fff" strokeOpacity=".5" strokeWidth="2.4" strokeLinecap="round" />
      <circle cx="94" cy="30" r="17" fill="url(#na-s)" />
      <path d="M94 21a7 7 0 0 0-7 7v5l-3 4h20l-3-4v-5a7 7 0 0 0-7-7zM91 40a3 3 0 0 0 6 0z" fill="#7a5300" />
    </Svg>
  );
}

export function TasksArt({ size }: { size?: number }) {
  return (
    <Svg id="ta" size={size}>
      <rect x="22" y="16" width="70" height="90" rx="10" fill="url(#ta-d)" />
      <rect x="29" y="26" width="56" height="74" rx="6" fill="url(#ta-w)" />
      <rect x="44" y="9" width="26" height="16" rx="6" fill="url(#ta-g)" /><circle cx="57" cy="17" r="3" fill="#fff" />
      <g fill="none" strokeLinecap="round" strokeLinejoin="round">
        <path d="M37 45l4 4 7-8" stroke="#3d8d2e" strokeWidth="3.4" /><path d="M55 45h24" stroke="#b9e0a6" strokeWidth="3.4" />
        <path d="M37 62l4 4 7-8" stroke="#3d8d2e" strokeWidth="3.4" /><path d="M55 62h24" stroke="#b9e0a6" strokeWidth="3.4" />
        <path d="M37 79l4 4 7-8" stroke="#3d8d2e" strokeWidth="3.4" /><path d="M55 79h16" stroke="#b9e0a6" strokeWidth="3.4" />
      </g>
      <g transform="rotate(35 92 76)"><rect x="84" y="46" width="12" height="52" rx="3" fill="url(#ta-s)" /><path d="M84 98l6 10 6-10z" fill="#f3d9a4" /><path d="M88 104l2 4 2-4z" fill="#3a2a00" /></g>
    </Svg>
  );
}

export function ScalesArt({ size }: { size?: number }) {
  return (
    <Svg id="sa" size={size}>
      <rect x="38" y="96" width="44" height="9" rx="4.5" fill="url(#sa-d)" />
      <rect x="55" y="26" width="10" height="72" rx="4" fill="url(#sa-g)" />
      <circle cx="60" cy="24" r="8" fill="url(#sa-s)" />
      <path d="M22 36h76" stroke="url(#sa-d)" strokeWidth="6" strokeLinecap="round" />
      <path d="M26 38L12 70M26 38l14 32M94 38L80 70M94 38l14 32" stroke="#2f7a27" strokeWidth="2.4" strokeLinecap="round" />
      <path d="M8 70h36a18 18 0 0 1-36 0z" fill="url(#sa-g)" /><path d="M76 70h36a18 18 0 0 1-36 0z" fill="url(#sa-g)" />
      <path d="M12 72h28M80 72h28" stroke="#fff" strokeOpacity=".5" strokeWidth="2.4" strokeLinecap="round" />
    </Svg>
  );
}

export function ShieldArt({ size }: { size?: number }) {
  return (
    <Svg id="ha" size={size}>
      <path d="M60 12l38 14v28c0 26-16 42-38 54-22-12-38-28-38-54V26z" fill="url(#ha-d)" />
      <path d="M60 20l30 11v23c0 21-12 34-30 44-18-10-30-23-30-44V31z" fill="url(#ha-g)" />
      <path d="M60 20l30 11v23c0 4-.4 8-1.3 11.4C80 62 68 56 60 44z" fill="#fff" fillOpacity=".18" />
      <path d="M44 60l11 11 22-24" fill="none" stroke="#fff" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="94" cy="30" r="10" fill="url(#ha-s)" />
    </Svg>
  );
}

export function HeadsetArt({ size }: { size?: number }) {
  return (
    <Svg id="ea" size={size}>
      <circle cx="60" cy="62" r="34" fill="url(#ea-w)" />
      <path d="M26 62a34 34 0 0 1 68 0" fill="none" stroke="url(#ea-d)" strokeWidth="9" strokeLinecap="round" />
      <rect x="18" y="56" width="14" height="26" rx="7" fill="url(#ea-g)" /><rect x="88" y="56" width="14" height="26" rx="7" fill="url(#ea-g)" />
      <path d="M95 80c0 14-12 18-26 18" fill="none" stroke="#2f7a27" strokeWidth="4" strokeLinecap="round" /><circle cx="66" cy="98" r="5" fill="url(#ea-s)" />
      <circle cx="48" cy="62" r="3.4" fill="#2f7a27" /><circle cx="72" cy="62" r="3.4" fill="#2f7a27" />
      <path d="M50 74q10 8 20 0" fill="none" stroke="#2f7a27" strokeWidth="3.2" strokeLinecap="round" />
    </Svg>
  );
}

export function SearchArt({ size }: { size?: number }) {
  return (
    <Svg id="sra" size={size}>
      <rect x="14" y="30" width="62" height="68" rx="8" fill="url(#sra-w)" /><path d="M24 46h42M24 58h42M24 70h26" stroke="#b9e0a6" strokeWidth="3.2" strokeLinecap="round" />
      <circle cx="74" cy="60" r="24" fill="#ffffff" fillOpacity=".55" stroke="url(#sra-d)" strokeWidth="9" />
      <circle cx="74" cy="60" r="24" fill="none" stroke="#fff" strokeOpacity=".5" strokeWidth="2" strokeDasharray="30 120" strokeLinecap="round" />
      <path d="M92 78l16 18" stroke="url(#sra-d)" strokeWidth="11" strokeLinecap="round" />
      <circle cx="102" cy="26" r="11" fill="url(#sra-s)" /><path d="M98 26l3 3 6-6" fill="none" stroke="#7a5300" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export function GavelArt({ size }: { size?: number }) {
  return (
    <Svg id="ga" size={size}>
      <rect x="22" y="92" width="70" height="12" rx="6" fill="url(#ga-d)" />
      <g transform="rotate(-35 62 52)"><rect x="34" y="28" width="52" height="26" rx="8" fill="url(#ga-g)" /><rect x="40" y="31" width="40" height="5" rx="2.5" fill="#fff" fillOpacity=".4" /></g>
      <g transform="rotate(-35 62 52)"><rect x="56" y="50" width="9" height="52" rx="4.5" fill="url(#ga-s)" /></g>
      <circle cx="94" cy="34" r="14" fill="#fff" fillOpacity=".8" /><path d="M94 26v16M86 34h16" stroke="#3d8d2e" strokeWidth="3.4" strokeLinecap="round" />
    </Svg>
  );
}

export function CardArt2({ size }: { size?: number }) {
  return (
    <Svg id="ca" size={size}>
      <rect x="10" y="30" width="88" height="56" rx="10" fill="url(#ca-d)" transform="rotate(-8 54 58)" />
      <rect x="22" y="38" width="88" height="56" rx="10" fill="url(#ca-g)" />
      <rect x="22" y="52" width="88" height="12" fill="#2f7a27" fillOpacity=".55" />
      <rect x="32" y="74" width="26" height="6" rx="3" fill="#fff" fillOpacity=".8" /><rect x="64" y="74" width="14" height="6" rx="3" fill="#fff" fillOpacity=".5" />
      <circle cx="96" cy="32" r="15" fill="url(#ca-s)" /><text x="96" y="38" textAnchor="middle" fontSize="17" fontWeight="800" fill="#7a5300">₪</text>
    </Svg>
  );
}

export function BookArt({ size }: { size?: number }) {
  return (
    <Svg id="ba" size={size}>
      <path d="M12 38c14-6 32-6 48 4v58c-16-10-34-10-48-4z" fill="url(#ba-d)" />
      <path d="M108 38c-14-6-32-6-48 4v58c16-10 34-10 48-4z" fill="url(#ba-g)" />
      <path d="M20 46c10-3 24-2 36 5M20 58c10-3 24-2 36 5M20 70c10-3 24-2 36 5" fill="none" stroke="#fff" strokeOpacity=".5" strokeWidth="3" strokeLinecap="round" />
      <path d="M100 46c-10-3-24-2-36 5M100 58c-10-3-24-2-36 5" fill="none" stroke="#fff" strokeOpacity=".6" strokeWidth="3" strokeLinecap="round" />
      <path d="M84 14l5 11 12 1-9 8 3 12-11-6-11 6 3-12-9-8 12-1z" fill="url(#ba-s)" />
    </Svg>
  );
}

export function TrashArt({ size }: { size?: number }) {
  return (
    <Svg id="tra" size={size}>
      <path d="M30 40h60l-5 58a8 8 0 0 1-8 7H43a8 8 0 0 1-8-7z" fill="url(#tra-g)" />
      <rect x="24" y="30" width="72" height="12" rx="6" fill="url(#tra-d)" /><rect x="50" y="20" width="20" height="12" rx="5" fill="url(#tra-d)" />
      <path d="M48 54v38M60 54v38M72 54v38" stroke="#fff" strokeOpacity=".5" strokeWidth="4" strokeLinecap="round" />
      <path d="M96 40a14 14 0 1 0 8 14" fill="none" stroke="url(#tra-s)" strokeWidth="6" strokeLinecap="round" /><path d="M102 30l-2 12-11-4z" fill="#f6c93b" />
    </Svg>
  );
}

export function ChartArt({ size }: { size?: number }) {
  return (
    <Svg id="cha" size={size}>
      <rect x="12" y="22" width="96" height="76" rx="12" fill="url(#cha-w)" />
      <rect x="26" y="62" width="16" height="28" rx="8" fill="url(#cha-g)" /><rect x="50" y="46" width="16" height="44" rx="8" fill="url(#cha-d)" /><rect x="74" y="34" width="16" height="56" rx="8" fill="url(#cha-s)" />
      <path d="M22 58l22-14 20 8 30-24" fill="none" stroke="#2f7a27" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" /><circle cx="94" cy="28" r="5" fill="#fff" stroke="#2f7a27" strokeWidth="3" />
    </Svg>
  );
}

export function CheckArt({ size }: { size?: number }) {
  return (
    <Svg id="ka" size={size}>
      <circle cx="60" cy="58" r="40" fill="url(#ka-g)" /><circle cx="60" cy="58" r="40" fill="none" stroke="#fff" strokeOpacity=".4" strokeWidth="3" />
      <path d="M40 60l14 14 28-30" fill="none" stroke="#fff" strokeWidth="9" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="98" cy="24" r="9" fill="url(#ka-s)" />
    </Svg>
  );
}
