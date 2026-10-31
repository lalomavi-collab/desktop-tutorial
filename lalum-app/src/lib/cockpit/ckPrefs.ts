import { useEffect, useState } from "react";
import "../../styles/cockpit-prefs.css";

// Personal display preferences of the system (owner, 31.10.2026, from the competitor scan): text size in five steps, high
// contrast, and reduced motion. They are this browser's choices, kept in one storage key, and they apply as attributes on
// <html> that only the system's own roots read (.ck-root, .ck-entry), so the public site never changes. The frame and the
// entry gate apply them when their code loads, before the first screen paints; the preferences screen changes them live.
// The look (navy, beige, dark) lives in useCkLook.ts and the language in ckLang.ts; the screen shows all of them together.

export interface CkPrefs { size: number; contrast: boolean; motion: boolean }
export const DEFAULT_PREFS: CkPrefs = { size: 1, contrast: false, motion: false };
/** Five steps, the second is the default. The zoom of each lives in cockpit-prefs.css. */
export const SIZE_STEPS = ["קטן", "רגיל", "גדול", "גדול מאוד", "הגדול ביותר"] as const;
export const SIZE_STEPS_EN = ["Small", "Normal", "Large", "Larger", "Largest"] as const;
export const SIZE_ZOOM = [0.92, 1, 1.1, 1.22, 1.36] as const;
const KEY = "lalum_ck_prefs";
const EVENT = "lalum-ck-prefs";

/** Reads a stored value back safely: anything unexpected falls back to the default, field by field. */
export function parsePrefs(raw: string | null | undefined): CkPrefs {
  let o: Record<string, unknown> = {};
  try { const v = raw ? JSON.parse(raw) : null; if (v && typeof v === "object" && !Array.isArray(v)) o = v as Record<string, unknown>; } catch { /* not JSON */ }
  const size = typeof o.size === "number" && Number.isInteger(o.size) && o.size >= 0 && o.size < SIZE_STEPS.length ? o.size : DEFAULT_PREFS.size;
  return { size, contrast: o.contrast === true, motion: o.motion === true };
}

/** The attributes the stylesheet reads. A default value removes its attribute, so nothing changes for anyone who never opened the screen. */
export function prefAttrs(p: CkPrefs): Record<"data-ck-size" | "data-ck-contrast" | "data-ck-motion", string | null> {
  return {
    "data-ck-size": p.size === DEFAULT_PREFS.size ? null : String(p.size),
    "data-ck-contrast": p.contrast ? "high" : null,
    "data-ck-motion": p.motion ? "reduce" : null,
  };
}

export const isDefault = (p: CkPrefs): boolean => p.size === DEFAULT_PREFS.size && !p.contrast && !p.motion;

function readStored(): CkPrefs {
  try { return parsePrefs(localStorage.getItem(KEY)); } catch { return DEFAULT_PREFS; }
}

export function applyPrefs(p: CkPrefs): void {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  for (const [k, v] of Object.entries(prefAttrs(p))) { if (v == null) root.removeAttribute(k); else root.setAttribute(k, v); }
}

/** Called once when the frame or the entry gate loads. Safe without a window and with storage blocked. */
export function bootCkPrefs(): void {
  if (typeof window === "undefined") return;
  applyPrefs(readStored());
}

/** The choices and a setter. Every open copy of the hook follows a change, in this tab (the event carries the value, so a
 *  private window that cannot store still updates) and in other tabs (the storage event). */
export function useCkPrefs(): [CkPrefs, (p: CkPrefs) => void] {
  const [prefs, setState] = useState<CkPrefs>(() => (typeof window === "undefined" ? DEFAULT_PREFS : readStored()));
  useEffect(() => {
    const here = (e: Event) => setState((e as CustomEvent<CkPrefs>).detail ?? readStored());
    const other = (e: StorageEvent) => { if (e.key === KEY || e.key === null) { const p = readStored(); applyPrefs(p); setState(p); } };
    window.addEventListener(EVENT, here);
    window.addEventListener("storage", other);
    return () => { window.removeEventListener(EVENT, here); window.removeEventListener("storage", other); };
  }, []);
  const set = (p: CkPrefs) => {
    applyPrefs(p);
    try { if (isDefault(p)) localStorage.removeItem(KEY); else localStorage.setItem(KEY, JSON.stringify(p)); } catch { /* private window: the choice lasts this visit */ }
    setState(p);
    window.dispatchEvent(new CustomEvent<CkPrefs>(EVENT, { detail: p }));
  };
  return [prefs, set];
}
