import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { strings, type Dict } from "../lib/strings";
import { syncLangParam } from "../lib/langParam";
import { LANG_PARAM, LANGS, isLang, dirFor, type Lang } from "../lib/hreflang";

export type { Lang };

type LangValue = {
  lang: Lang;
  dir: "rtl" | "ltr";
  t: Dict;
  setLang: (l: Lang) => void;
  toggle: () => void;
};

const LangContext = createContext<LangValue | null>(null);

const STORAGE_KEY = "lalum_lang";
// Hebrew is the primary language for the Israeli audience. Visitors can switch
// to any other supported language from the header, and the choice is
// remembered for next time.
const DEFAULT_LANG: Lang = "he";

// Order of precedence for the opening language:
// 1. an explicit ?lang= in the URL (so a shared or crawled link opens in that
//    language regardless of any saved choice),
// 2. a previously saved choice,
// 3. the primary language.
function initialLang(): Lang {
  try {
    const param = new URLSearchParams(window.location.search).get(LANG_PARAM);
    if (isLang(param)) return param;
  } catch { /* ignore */ }
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (isLang(saved)) return saved;
  } catch { /* ignore */ }
  return DEFAULT_LANG;
}

export function LangProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(initialLang);

  useEffect(() => {
    const dir = dirFor(lang);
    document.documentElement.lang = lang;
    document.documentElement.dir = dir;
    // Reflect the active language into the URL so canonical, og:url, and the
    // hreflang alternates PageMeta emits all describe the address actually
    // being viewed (clean URL for Hebrew, ?lang=xx for every other language).
    syncLangParam(lang);
  }, [lang]);

  const setLang = (l: Lang) => {
    setLangState(l);
    try { localStorage.setItem(STORAGE_KEY, l); } catch { /* ignore */ }
    // The URL sync happens in the effect above, which fires on every lang change.
  };
  // Cycles to the next language in menu order. Kept for any caller that wants
  // a single-step switch; the header itself uses setLang with a full picker
  // now that there are more than two languages.
  const toggle = () => {
    const i = LANGS.findIndex((l) => l.code === lang);
    setLang(LANGS[(i + 1) % LANGS.length].code);
  };

  return (
    <LangContext.Provider value={{ lang, dir: dirFor(lang), t: strings[lang], setLang, toggle }}>
      {children}
    </LangContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useLang(): LangValue {
  const ctx = useContext(LangContext);
  if (!ctx) throw new Error("useLang must be used within LangProvider");
  return ctx;
}
