import { useLang } from "../context/LangContext";

/* An arrow that points where the reader goes: left in right to left text,
   right otherwise. It is drawn, not typed: the arrow glyphs are in none of the
   site's web fonts, so a typed arrow fell back to whatever font the device
   had, and a written arrow cannot be mirrored with CSS without mirroring the
   words beside it. A drawn one is the same everywhere and mirrors alone. */
export function FwdArrow() {
  const { dir } = useLang();
  return (
    <svg
      className="fwd-arrow"
      viewBox="0 0 16 16"
      width="1em"
      height="1em"
      aria-hidden="true"
      focusable="false"
      style={dir === "rtl" ? { transform: "scaleX(-1)" } : undefined}
    >
      <path d="M2 8h11M9 4l4 4-4 4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
