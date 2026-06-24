import { useEffect, useRef, useState } from "react";
import { LANGS, useI18n } from "../i18n";

// Compact language picker (flag + label) with a dropdown. Works in RTL and LTR.
export default function LanguageSwitcher({ light = false }: { light?: boolean }) {
  const { lang, setLang } = useI18n();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const current = LANGS.find((l) => l.code === lang)!;

  useEffect(() => {
    const onDoc = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const fg = light ? "#171c22" : "var(--cream)";
  const bg = light ? "#fff" : "rgba(20,22,34,0.96)";
  const border = light ? "#dfe2eb" : "var(--line)";

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button onClick={() => setOpen((o) => !o)} aria-label="Language" aria-haspopup="listbox"
        style={{
          display: "flex", alignItems: "center", gap: 6, height: 36, padding: "0 12px",
          borderRadius: 999, border: `1px solid ${border}`, background: "transparent",
          color: fg, cursor: "pointer", font: "inherit", fontSize: 13, fontWeight: 600,
        }}>
        <span style={{ fontSize: 15 }}>{current.flag}</span>
        <span>{current.label}</span>
        <span className="ms" style={{ fontSize: 18 }}>expand_more</span>
      </button>
      {open && (
        <ul role="listbox" style={{
          position: "absolute", top: 42, insetInlineEnd: 0, zIndex: 1000, listStyle: "none",
          margin: 0, padding: 6, minWidth: 150, background: bg, border: `1px solid ${border}`,
          borderRadius: 12, boxShadow: "0 12px 32px rgba(0,0,0,0.25)",
        }}>
          {LANGS.map((l) => (
            <li key={l.code}>
              <button onClick={() => { setLang(l.code); setOpen(false); }}
                role="option" aria-selected={l.code === lang}
                style={{
                  display: "flex", alignItems: "center", gap: 10, width: "100%", padding: "9px 12px",
                  border: "none", borderRadius: 8, cursor: "pointer", font: "inherit", fontSize: 14,
                  background: l.code === lang ? (light ? "#eaeef7" : "rgba(255,255,255,0.08)") : "transparent",
                  color: fg, textAlign: "start",
                }}>
                <span style={{ fontSize: 16 }}>{l.flag}</span>{l.label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
