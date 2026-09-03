import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { strings, type Dict } from "../lib/strings";
import { syncLangParam } from "../lib/langParam";
import { LANG_PARAM, LANGS, isLang, dirFor, langFromPath, stripLangPrefix, isTranslatedRoute, type Lang } from "../lib/hreflang";

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
// 1. the URL's own language prefix (/en/..., /fr/...), which is the address
//    the document was actually served at and therefore authoritative,
// 2. a legacy ?lang= query, still honoured so old shared links keep working,
// 3. a previously saved choice,
// 4. the primary language.
function initialLang(): Lang {
  try {
    const fromPath = langFromPath(window.location.pathname);
    if (fromPath !== "he") return fromPath;
  } catch { /* ignore */ }
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

// The path prefix the app is mounted under, so react-router keeps every link
// inside the current language.
export function langBasename(): string {
  const l = typeof window === "undefined" ? "he" : langFromPath(window.location.pathname);
  return l === "he" ? "" : `/${l}`;
}

export function LangProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(initialLang);

  useEffect(() => {
    const dir = dirFor(lang);
    document.documentElement.lang = lang;
    document.documentElement.dir = dir;
    // A legacy ?lang= link lands on the Hebrew document; move it to the real
    // language path so the address matches the rendering and the canonical.
    syncLangParam(lang);
  }, [lang]);

  const setLang = (l: Lang) => {
    try { localStorage.setItem(STORAGE_KEY, l); } catch { /* ignore */ }
    // Each language is served from its own prefixed path with its own
    // prerendered document, so switching is a real navigation rather than a
    // state flip. Only translated routes have another language to go to; on a
    // Hebrew-only page (an article, the Q&A) the choice is remembered and
    // applies from the next translated page on.
    try {
      const bare = stripLangPrefix(window.location.pathname);
      if (isTranslatedRoute(bare)) {
        const target = l === "he" ? bare : `/${l}${bare}`;
        if (target !== window.location.pathname) {
          window.location.assign(target);
          return;
        }
      }
    } catch { /* fall through to the in-place switch */ }
    setLangState(l);
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
