import { useEffect } from "react";

// Integration point for a third-party accessibility overlay / widget (for
// example an Israeli accessibility-compliance vendor). Set VITE_A11Y_WIDGET_SRC
// in the environment to the vendor's script URL to enable it in production.
// When the variable is unset nothing loads, so the app stays self-contained by
// default and the native WCAG features (focus rings, aria, keyboard paths,
// skip link, contrast) still apply on their own.
export function A11yWidget() {
  useEffect(() => {
    const src = import.meta.env.VITE_A11Y_WIDGET_SRC;
    if (!src) return;
    if (document.querySelector("script[data-a11y-widget]")) return;
    const s = document.createElement("script");
    s.src = src;
    s.async = true;
    s.setAttribute("data-a11y-widget", "true");
    document.body.appendChild(s);
  }, []);
  return null;
}
