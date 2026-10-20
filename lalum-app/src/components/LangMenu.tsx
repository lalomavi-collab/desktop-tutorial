import { useEffect, useRef, useState } from "react";
import { useLang } from "../context/LangContext";
import { LANGS } from "../lib/hreflang";

// One small round control in the header: a drawn globe that opens a short list
// of the five languages, each written in its own script. It is the only
// language switch on the site, on every width, so there is no second copy in
// the menu, the page or the footer. The list hangs from the header itself
// (which is sticky and so is its containing block), so it never runs off the
// screen edge on a phone.
export function LangMenu() {
  const { lang, setLang } = useLang();
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    const onDown = (e: MouseEvent | TouchEvent) => {
      if (wrap.current && !wrap.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("touchstart", onDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("touchstart", onDown);
    };
  }, [open]);
  const current = LANGS.find((l) => l.code === lang);
  return (
    <div className="lang-menu" ref={wrap}>
      <button
        type="button"
        className="tb-btn lang-menu-btn"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Language: ${current?.autonym ?? lang}`}
        title={current?.autonym}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" aria-hidden="true" focusable="false">
          <circle cx="12" cy="12" r="9" />
          <path d="M3 12h18M12 3c2.6 2.7 3.9 5.7 3.9 9s-1.3 6.3-3.9 9c-2.6-2.7-3.9-5.7-3.9-9S9.4 5.7 12 3z" />
        </svg>
      </button>
      {open && (
        <div role="menu" aria-label="Language" className="lang-menu-list">
          {LANGS.map((l) => (
            <button
              key={l.code}
              type="button"
              role="menuitemradio"
              aria-checked={l.code === lang}
              lang={l.code}
              dir={l.dir}
              className={"lang-menu-item" + (l.code === lang ? " on" : "")}
              onClick={() => { setLang(l.code); setOpen(false); }}
            >
              {l.autonym}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
