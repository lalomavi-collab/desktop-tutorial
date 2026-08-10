// Multilingual URL and hreflang helpers.
//
// The site is one URL per page that renders in Hebrew (primary) or one of four
// secondary languages via a client toggle. To give search engines a distinct,
// crawlable address for each secondary rendering, every non-Hebrew language is
// also reachable at the same path with a `?lang=xx` query. Hebrew keeps the
// clean, canonical URL.
//
// These helpers centralise that scheme so the runtime (PageMeta, LangContext)
// and the build-time prerender (vite.config.ts) all agree on the exact URLs.

export const SITE = "https://lalumapp.com";

export type Lang = "he" | "en" | "es" | "fr" | "ar";

// The query key that selects a secondary language. Absent (or "he") means the
// primary Hebrew rendering at the clean URL.
export const LANG_PARAM = "lang";

// Every supported language, in menu order. `autonym` is always written in that
// language's own script (shown regardless of the current UI language, so a
// visitor can recognise their language even if they can't read the current
// one). `bcp47` feeds Intl/speech APIs and og:locale.
export const LANGS: { code: Lang; autonym: string; dir: "rtl" | "ltr"; bcp47: string }[] = [
  { code: "he", autonym: "עברית", dir: "rtl", bcp47: "he-IL" },
  { code: "en", autonym: "English", dir: "ltr", bcp47: "en-US" },
  { code: "es", autonym: "Español", dir: "ltr", bcp47: "es-ES" },
  { code: "fr", autonym: "Français", dir: "ltr", bcp47: "fr-FR" },
  { code: "ar", autonym: "العربية", dir: "rtl", bcp47: "ar-SA" },
];

const LANG_CODES = LANGS.map((l) => l.code);

export function isLang(v: string | null): v is Lang {
  return v !== null && (LANG_CODES as string[]).includes(v);
}

// Hebrew and Arabic render right-to-left; English, Spanish, and French render
// left-to-right.
export function dirFor(lang: Lang): "rtl" | "ltr" {
  return LANGS.find((l) => l.code === lang)?.dir ?? "ltr";
}

export function bcp47For(lang: Lang): string {
  return LANGS.find((l) => l.code === lang)?.bcp47 ?? "en-US";
}

// Normalise a route path to a leading-slash, no-trailing-slash form, so the
// home route is "/" and every other route is "/path".
function normPath(path: string): string {
  let p = path || "/";
  if (!p.startsWith("/")) p = "/" + p;
  if (p.length > 1 && p.endsWith("/")) p = p.replace(/\/+$/, "");
  return p;
}

// The absolute URL for a given path in a given language. Hebrew is the clean
// canonical URL; every other language carries ?lang=xx so it is its own
// indexable address.
export function langUrl(path: string, lang: Lang): string {
  const p = normPath(path);
  const base = `${SITE}${p}`;
  return lang === "he" ? base : `${base}?${LANG_PARAM}=${lang}`;
}

export type Alternate = { hreflang: string; href: string };

// The reciprocal hreflang set for a path: one entry per supported language,
// plus x-default (which points at the primary Hebrew URL). Every language
// variant of a page carries this same set, as Google requires.
export function alternatesFor(path: string): Alternate[] {
  return [
    ...LANGS.map((l) => ({ hreflang: l.code === "he" ? "he-IL" : l.code, href: langUrl(path, l.code) })),
    { hreflang: "x-default", href: langUrl(path, "he") },
  ];
}
