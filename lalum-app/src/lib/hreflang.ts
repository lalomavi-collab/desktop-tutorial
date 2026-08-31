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

// Routes whose content is genuinely translated. Measured, not assumed: each
// route was loaded at every language and the share of Hebrew left in the main
// content was counted. These came back under 6%, the remainder being links to
// Hebrew articles, which is correct.
//
// Everything else on the site is Hebrew only. The 153 articles, the Q&A page
// and the course catalogue run 54% to 94% Hebrew in every language, because
// that content has no translation. Claiming an hreflang alternate for them
// told Google that four translated versions existed, sent it to crawl 4 x 157
// URLs that each served the same Hebrew document under a Hebrew canonical, and
// got them all discarded as duplicates. A page with no translation simply
// carries no alternates.
export const TRANSLATED_ROUTES = new Set([
  "/",
  "/advisory/",
  "/ai-legal-advisory/",
  "/real-estate-legal-advisory/",
  "/mediation-dispute-resolution/",
  "/knowledge/",
  "/book/",
  "/legal/",
]);

// Normalise a route path to a leading-slash, TRAILING-slash form (home stays
// "/"). The content routes are prerendered as `<path>/index.html`, and the host
// serves them at `<path>/`: a request without the trailing slash 301-redirects
// to the slash form. Canonical, hreflang, and og:url must therefore use the
// trailing-slash form so they name the actual served URL and never a redirect
// (a no-slash canonical is what made Google flag the English pages as
// "redirects to another URL" and treat them as duplicates of the Hebrew URL).
export function normPath(path: string): string {
  let p = path || "/";
  if (!p.startsWith("/")) p = "/" + p;
  p = p.replace(/\/+$/, "");
  return p === "" ? "/" : p + "/";
}

export function isTranslatedRoute(path: string): boolean {
  return TRANSLATED_ROUTES.has(normPath(path));
}

// The absolute URL for a given path in a given language. Hebrew keeps the clean
// path; every other language lives under its own path prefix, so each is a real
// address that serves its own prerendered document with its own canonical.
// A query parameter could not do this: the host serves one file per path
// regardless of the query, so `?lang=en` returned the Hebrew document, declaring
// `<html lang="he">` and a Hebrew canonical, and Google folded it away.
export function langUrl(path: string, lang: Lang): string {
  const p = normPath(path);
  return lang === "he" ? `${SITE}${p}` : `${SITE}/${lang}${p}`;
}

// The language a pathname is being served in, and the same path without its
// language prefix.
export function langFromPath(pathname: string): Lang {
  const m = /^\/([a-z]{2})(\/|$)/.exec(pathname || "/");
  return m && isLang(m[1]) && m[1] !== "he" ? (m[1] as Lang) : "he";
}

export function stripLangPrefix(pathname: string): string {
  const m = /^\/([a-z]{2})(\/|$)/.exec(pathname || "/");
  return m && isLang(m[1]) && m[1] !== "he" ? pathname.slice(3) || "/" : pathname || "/";
}

export type Alternate = { hreflang: string; href: string };

// The reciprocal hreflang set for a path. Only a route that is actually
// translated gets one; for anything else this is empty, and the page makes no
// claim about languages it does not have.
export function alternatesFor(path: string): Alternate[] {
  if (!isTranslatedRoute(path)) return [];
  return [
    ...LANGS.map((l) => ({ hreflang: l.code === "he" ? "he-IL" : l.code, href: langUrl(path, l.code) })),
    { hreflang: "x-default", href: langUrl(path, "he") },
  ];
}
