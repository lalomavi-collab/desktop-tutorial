import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { strings, type Dict } from "../lib/strings";

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
// English is the primary language. Visitors can switch to Hebrew from the
// header, and the choice is remembered for next time.
const DEFAULT_LANG: Lang = "en";

// A saved choice always wins; otherwise open in the primary language.
function initialLang(): Lang {
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
  }, [lang]);

  const setLang = (l: Lang) => {
    setLangState(l);
    try { localStorage.setItem(STORAGE_KEY, l); } catch { /* ignore */ }
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
