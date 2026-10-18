// The site's look. Sovereign (dark) is the default for a visitor who has not chosen; "classic" is the light paper site; "sage" and "sovereign"
// are the two dark systems (src/styles/sovereign.css). The choice is the
// visitor's, kept in localStorage and set on <html data-style> before first
// paint by public/style-boot.js.

import { useSyncExternalStore } from "react";

export type SiteStyle = "classic" | "sage" | "sovereign";
export const STYLES: SiteStyle[] = ["classic", "sage", "sovereign"];
const KEY = "lalum-style";
const THEME: Record<SiteStyle, string> = { classic: "#f5f1e8", sage: "#14161b", sovereign: "#07080B" };

export function getStyle(): SiteStyle {
  const v = document.documentElement.getAttribute("data-style");
  return v === "sage" || v === "sovereign" ? v : "classic";
}

const STYLE_EVENT = "lalum:style";

export function setStyle(s: SiteStyle) {
  const root = document.documentElement;
  if (s === "classic") root.removeAttribute("data-style");
  else root.setAttribute("data-style", s);
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", THEME[s]);
  try {
    // Classic is stored too: with sovereign as the default, "nothing saved"
    // and "chose light" are different answers.
    localStorage.setItem(KEY, s);
  } catch { /* storage blocked: applies for this visit only */ }
  window.dispatchEvent(new Event(STYLE_EVENT));
}

/** The current style, kept in step across every control that changes it. */
export function useSiteStyle(): SiteStyle {
  return useSyncExternalStore(
    (cb) => { window.addEventListener(STYLE_EVENT, cb); return () => window.removeEventListener(STYLE_EVENT, cb); },
    getStyle,
    () => "classic" as SiteStyle,
  );
}

export function nextStyle(s: SiteStyle): SiteStyle {
  return STYLES[(STYLES.indexOf(s) + 1) % STYLES.length];
}
