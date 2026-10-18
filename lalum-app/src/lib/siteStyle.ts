// The site's look. "classic" is the default light site; "sage" and "sovereign"
// are the two dark systems (src/styles/sovereign.css). The choice is the
// visitor's, kept in localStorage and set on <html data-style> before first
// paint by public/style-boot.js.

export type SiteStyle = "classic" | "sage" | "sovereign";
export const STYLES: SiteStyle[] = ["classic", "sage", "sovereign"];
const KEY = "lalum-style";
const THEME: Record<SiteStyle, string> = { classic: "#f5f1e8", sage: "#14161b", sovereign: "#07080B" };

export function getStyle(): SiteStyle {
  const v = document.documentElement.getAttribute("data-style");
  return v === "sage" || v === "sovereign" ? v : "classic";
}

export function setStyle(s: SiteStyle) {
  const root = document.documentElement;
  if (s === "classic") root.removeAttribute("data-style");
  else root.setAttribute("data-style", s);
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", THEME[s]);
  try {
    if (s === "classic") localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, s);
  } catch { /* storage blocked: applies for this visit only */ }
}

export function nextStyle(s: SiteStyle): SiteStyle {
  return STYLES[(STYLES.indexOf(s) + 1) % STYLES.length];
}
