import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { strings, type Dict } from "../lib/strings";
import { syncLangParam } from "../lib/langParam";

export type Lang = "en" | "he";

type LangValue = {
  lang: Lang;
  dir: "rtl" | "ltr";
  t: Dict;
  setLang: (l: Lang) => void;
  toggle: () => void;
};

const LangContext = createContext<LangValue | null>(null);

const STORAGE_KEY = "lalum_lang";
const LANG_PARAM = "lang";
// Hebrew is the primary language for the Israeli audience. Visitors can switch
// to English from the header, and the choice is remembered for next time.
const DEFAULT_LANG: Lang = "he";

// Order of precedence for the opening language:
// 1. an explicit ?lang= in the URL (so a shared or crawled English link opens
//    in English regardless of any saved choice),
// 2. a previously saved choice,
// 3. the primary language.
function initialLang(): Lang {
  try {
    const param = new URLSearchParams(window.location.search).get(LANG_PARAM);
    if (param === "en" || param === "he") return param;
  } catch { /* ignore */ }
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === "en" || saved === "he") return saved;
  } catch { /* ignore */ }
  return DEFAULT_LANG;
}

export function LangProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(initialLang);

  useEffect(() => {
    const dir = lang === "he" ? "rtl" : "ltr";
    document.documentElement.lang = lang;
    document.documentElement.dir = dir;
    // Reflect the active language into the URL so canonical, og:url, and the
    // hreflang alternates PageMeta emits all describe the address actually
    // being viewed (clean URL for Hebrew, ?lang=en for English).
    syncLangParam(lang);
  }, [lang]);

  const setLang = (l: Lang) => {
    setLangState(l);
    try { localStorage.setItem(STORAGE_KEY, l); } catch { /* ignore */ }
    // The URL sync happens in the effect above, which fires on every lang change.
  };
  const toggle = () => setLang(lang === "he" ? "en" : "he");

  return (
    <LangContext.Provider value={{ lang, dir: lang === "he" ? "rtl" : "ltr", t: strings[lang], setLang, toggle }}>
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
