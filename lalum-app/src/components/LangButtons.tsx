import { useLang } from "../context/LangContext";
import { LANGS } from "../lib/hreflang";

// The five languages as plain buttons on the page itself, so a visitor who
// landed in the wrong one does not have to find the menu first. Each label is
// the language's own name (autonym), written in its own script and direction.
export function LangButtons({ className = "" }: { className?: string }) {
  const { lang, setLang } = useLang();
  return (
    <div className={("lang-buttons " + className).trim()} role="group" aria-label="Language">
      {LANGS.map((l) => (
        <button
          key={l.code}
          type="button"
          lang={l.code}
          dir={l.dir}
          className={"lang-buttons-btn" + (l.code === lang ? " on" : "")}
          aria-pressed={l.code === lang}
          onClick={() => setLang(l.code)}
        >
          {l.autonym}
        </button>
      ))}
    </div>
  );
}
