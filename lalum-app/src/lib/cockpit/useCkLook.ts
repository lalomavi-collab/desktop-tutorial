import { useEffect, useState } from "react";

export type CkLook = "navy" | "beige" | "dark";
export const LOOKS: Array<[CkLook, string]> = [["navy", "כחול"], ["beige", "בז׳"], ["dark", "כהה"]];

// Three looks (owner, 30.10.2026: the navy of Clio's apps is added beside the beige and the dark, not instead of them).
// Beige stays the default; the choice is remembered per browser in the keys the cockpit already used (storage may be blocked, so every access is guarded).
// The rail, the entry gate and the preferences screen share this hook, and a change in one reaches the others at once:
// the event carries the look itself, so it works even where storage is blocked.
const LOOK_EVENT = "lalum-ck-look";
function readLook(): CkLook {
  try { if (localStorage.getItem("ck-theme") === "dark") return "dark"; if (localStorage.getItem("ck-skin") === "navy") return "navy"; } catch { /* storage blocked */ }
  return "beige";
}
export function useCkLook(): [CkLook, (l: CkLook) => void] {
  const [look, setLookState] = useState<CkLook>("beige");
  useEffect(() => {
    setLookState(readLook());
    const sync = (e: Event) => { const l = (e as CustomEvent<CkLook>).detail; if (l === "navy" || l === "beige" || l === "dark") setLookState(l); };
    window.addEventListener(LOOK_EVENT, sync);
    return () => window.removeEventListener(LOOK_EVENT, sync);
  }, []);
  const setLook = (l: CkLook) => {
    setLookState(l);
    try { localStorage.setItem("ck-theme", l === "dark" ? "dark" : "mint"); localStorage.setItem("ck-skin", l === "navy" ? "navy" : "sage"); } catch { /* storage blocked */ }
    window.dispatchEvent(new CustomEvent<CkLook>(LOOK_EVENT, { detail: l }));
  };
  return [look, setLook];
}

/** The two attributes on .ck-root that select a look. */
export function lookAttrs(look: CkLook): { "data-ck-theme": "dark" | "mint"; "data-ck-skin"?: "navy" } {
  return look === "dark" ? { "data-ck-theme": "dark" } : look === "navy" ? { "data-ck-theme": "mint", "data-ck-skin": "navy" } : { "data-ck-theme": "mint" };
}
