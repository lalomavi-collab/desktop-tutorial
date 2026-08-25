// Bilingual URL and hreflang helpers.
//
// The site is one URL per page that renders in Hebrew (primary) or English via
// a client toggle. To give search engines a distinct, crawlable address for the
// English rendering, English is also reachable at the same path with a
// `?lang=en` query. Hebrew keeps the clean, canonical URL.
//
// These helpers centralise that scheme so the runtime (PageMeta, LangContext)
// and the build-time prerender (vite.config.ts) all agree on the exact URLs.

export const SITE = "https://lalumapp.com";

export type Lang = "en" | "he";

// The query key that selects English. Absent (or "he") means the primary
// Hebrew rendering at the clean URL.
export const LANG_PARAM = "lang";

// Normalise a route path to a leading-slash, TRAILING-slash form (home stays
// "/"). The content routes are prerendered as `<path>/index.html`, and the host
// serves them at `<path>/`: a request without the trailing slash 301-redirects
// to the slash form. Canonical, hreflang, and og:url must therefore use the
// trailing-slash form so they name the actual served URL and never a redirect
// (a no-slash canonical is what made Google flag the English pages as
// "redirects to another URL" and treat them as duplicates of the Hebrew URL).
function normPath(path: string): string {
  let p = path || "/";
  if (!p.startsWith("/")) p = "/" + p;
  p = p.replace(/\/+$/, "");
  return p === "" ? "/" : p + "/";
}

// The absolute URL for a given path in a given language. Hebrew is the clean
// canonical URL; English carries ?lang=en so it is its own indexable address.
export function langUrl(path: string, lang: Lang): string {
  const p = normPath(path);
  const base = `${SITE}${p}`;
  return lang === "en" ? `${base}?${LANG_PARAM}=en` : base;
}

export type Alternate = { hreflang: string; href: string };

// The reciprocal hreflang set for a path: Hebrew, English, and x-default
// (which points at the primary Hebrew URL). Every language variant of a page
// carries this same set, as Google requires.
export function alternatesFor(path: string): Alternate[] {
  return [
    { hreflang: "he-IL", href: langUrl(path, "he") },
    { hreflang: "en", href: langUrl(path, "en") },
    { hreflang: "x-default", href: langUrl(path, "he") },
  ];
}
