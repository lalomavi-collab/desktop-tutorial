import { useLang } from "../context/LangContext";
import { byLang } from "../lib/byLang";
import { setStyle, useSiteStyle } from "../lib/siteStyle";

// One round button, like the sun in the partners system: light or dark green.
// It flips between the classic site and Dark sage; the accessibility menu still
// cycles through all three looks (Sovereign included), and both stay in step.
const LABEL = {
  he: { dark: "מצב כהה", light: "מצב בהיר" },
  en: { dark: "Dark mode", light: "Light mode" },
  ar: { dark: "الوضع الداكن", light: "الوضع الفاتح" },
  es: { dark: "Modo oscuro", light: "Modo claro" },
  fr: { dark: "Mode sombre", light: "Mode clair" },
};

export function ThemeToggle() {
  const { lang } = useLang();
  const style = useSiteStyle();
  const toDark = style === "classic";
  const label = byLang(LABEL, lang)[toDark ? "dark" : "light"];
  return (
    <button
      type="button"
      className="tb-btn tb-theme"
      onClick={() => setStyle(toDark ? "sage" : "classic")}
      aria-label={label}
      title={label}
    >
      <svg width="22" height="22" viewBox="0 0 32 32" aria-hidden="true">
        <defs>
          <linearGradient id="tt-sun" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#ecd48b" />
            <stop offset="1" stopColor="#c9a94f" />
          </linearGradient>
        </defs>
        <circle cx="16" cy="16" r="6.4" fill="url(#tt-sun)" />
        <g stroke="#c9a94f" strokeWidth="2.6" strokeLinecap="round" fill="none">
          <path d="M16 3v3M16 26v3M3 16h3M26 16h3M6.8 6.8l2.1 2.1M23.1 23.1l2.1 2.1M25.2 6.8l-2.1 2.1M8.9 23.1l-2.1 2.1" />
        </g>
      </svg>
    </button>
  );
}
