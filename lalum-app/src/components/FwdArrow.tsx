import { useLang } from "../context/LangContext";

/* An arrow that points where the reader goes: left in right to left text,
   right otherwise. A written arrow cannot be mirrored with CSS without
   mirroring the words beside it, so the glyph itself changes. */
export function FwdArrow() {
  const { dir } = useLang();
  return <>{dir === "rtl" ? "←" : "→"}</>;
}
