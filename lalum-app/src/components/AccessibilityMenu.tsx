import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Icon } from "./Icon";
import { useLang } from "../context/LangContext";

// Self-contained accessibility menu (no third-party vendor). A fixed button at
// the bottom-inline-start opens a panel of real controls: text size, high
// contrast, link highlighting, a readable font, and reduced motion. Choices
// persist in localStorage and apply as classes / zoom on <html>.

type Settings = {
  font: 0 | 1 | 2 | 3;
  contrast: boolean;
  links: boolean;
  readable: boolean;
  motion: boolean;
};
const DEFAULTS: Settings = { font: 0, contrast: false, links: false, readable: false, motion: false };
const KEY = "lalum-a11y";
const ZOOM = ["100%", "112%", "125%", "140%"];

function load(): Settings {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return { ...DEFAULTS, ...JSON.parse(raw) };
  } catch { /* ignore */ }
  return DEFAULTS;
}

function apply(s: Settings) {
  const root = document.documentElement;
  root.classList.toggle("a11y-contrast", s.contrast);
  root.classList.toggle("a11y-links", s.links);
  root.classList.toggle("a11y-readable", s.readable);
  root.classList.toggle("a11y-reduce-motion", s.motion);
  // Page zoom for text scaling (works with the app's pixel-based sizing).
  (root.style as CSSStyleDeclaration & { zoom?: string }).zoom = ZOOM[s.font];
}

export function AccessibilityMenu() {
  const { t } = useLang();
  const a = t.ui.a11y;
  const [open, setOpen] = useState(false);
  const [s, setS] = useState<Settings>(DEFAULTS);
  const panelRef = useRef<HTMLDivElement>(null);

  // Load saved settings once on mount.
  useEffect(() => {
    const loaded = load();
    setS(loaded);
    apply(loaded);
  }, []);

  function update(next: Settings) {
    setS(next);
    apply(next);
    try { localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* ignore */ }
  }
  const reset = () => update(DEFAULTS);

  // Close on Escape.
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") setOpen(false); }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <div className="a11y-dock">
      {open && (
        <div className="a11y-panel" ref={panelRef} role="dialog" aria-label={a.title}>
          <div className="a11y-panel-head">
            <span><Icon name="accessibility" size={18} /> {a.title}</span>
            <button type="button" className="a11y-x" onClick={() => setOpen(false)} aria-label="Close"><Icon name="x" size={16} /></button>
          </div>

          <div className="a11y-row">
            <span>{a.textSize}</span>
            <div className="a11y-steps">
              <button type="button" onClick={() => update({ ...s, font: Math.max(0, s.font - 1) as Settings["font"] })} aria-label="A-">A<span style={{ fontSize: 11 }}>-</span></button>
              <span className="a11y-step-val" aria-live="polite">{ZOOM[s.font]}</span>
              <button type="button" onClick={() => update({ ...s, font: Math.min(3, s.font + 1) as Settings["font"] })} aria-label="A+">A<span style={{ fontSize: 15 }}>+</span></button>
            </div>
          </div>

          <button type="button" className={"a11y-toggle" + (s.contrast ? " on" : "")} aria-pressed={s.contrast} onClick={() => update({ ...s, contrast: !s.contrast })}>
            <span>{a.contrast}</span><span className="a11y-knob" />
          </button>
          <button type="button" className={"a11y-toggle" + (s.links ? " on" : "")} aria-pressed={s.links} onClick={() => update({ ...s, links: !s.links })}>
            <span>{a.links}</span><span className="a11y-knob" />
          </button>
          <button type="button" className={"a11y-toggle" + (s.readable ? " on" : "")} aria-pressed={s.readable} onClick={() => update({ ...s, readable: !s.readable })}>
            <span>{a.readable}</span><span className="a11y-knob" />
          </button>
          <button type="button" className={"a11y-toggle" + (s.motion ? " on" : "")} aria-pressed={s.motion} onClick={() => update({ ...s, motion: !s.motion })}>
            <span>{a.motion}</span><span className="a11y-knob" />
          </button>

          <div className="a11y-panel-foot">
            <button type="button" className="a11y-reset" onClick={reset}>{a.reset}</button>
            <Link to="/legal#accessibility" className="a11y-statement" onClick={() => setOpen(false)}>{a.statement}</Link>
          </div>
        </div>
      )}
      <button type="button" className="a11y-fab" aria-label={a.open} aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <Icon name="accessibility" size={24} />
      </button>
    </div>
  );
}
