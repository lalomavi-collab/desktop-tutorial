import { useEffect, useState } from "react";

export type CkLook = "navy" | "beige" | "dark";
export const LOOKS: Array<[CkLook, string]> = [["navy", "כחול"], ["beige", "בז׳"], ["dark", "כהה"]];

// Three looks (owner, 30.10.2026: the navy of Clio's apps is added beside the beige and the dark, not instead of them).
// Beige stays the default; the choice is remembered per browser in the keys the cockpit already used (storage may be blocked, so every access is guarded).
// The rail and the entry gate share this hook, so a look picked on one is the look of the other.
export function useCkLook(): [CkLook, (l: CkLook) => void] {
  const [look, setLookState] = useState<CkLook>("beige");
  useEffect(() => { try { if (localStorage.getItem("ck-theme") === "dark") setLookState("dark"); else if (localStorage.getItem("ck-skin") === "navy") setLookState("navy"); } catch { /* storage blocked */ } }, []);
  const setLook = (l: CkLook) => { setLookState(l); try { localStorage.setItem("ck-theme", l === "dark" ? "dark" : "mint"); localStorage.setItem("ck-skin", l === "navy" ? "navy" : "sage"); } catch { /* storage blocked */ } };
  return [look, setLook];
}

/** The two attributes on .ck-root that select a look. */
export function lookAttrs(look: CkLook): { "data-ck-theme": "dark" | "mint"; "data-ck-skin"?: "navy" } {
  return look === "dark" ? { "data-ck-theme": "dark" } : look === "navy" ? { "data-ck-theme": "mint", "data-ck-skin": "navy" } : { "data-ck-theme": "mint" };
}
