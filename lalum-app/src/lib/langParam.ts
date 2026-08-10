// Browser-only helper: keep the address bar's ?lang= query in sync with the
// active language. Kept out of hreflang.ts (which is isomorphic and imported by
// the build-time prerender in vite.config.ts) so no DOM globals leak into the
// Node build config's type-check.

import { LANG_PARAM, type Lang } from "./hreflang";

// Without pushing a history entry: every non-Hebrew language carries ?lang=xx
// so it is a distinct, shareable, crawlable address; Hebrew is the clean
// canonical URL with no param. Called both when the language changes and on
// each route change, so client-side navigation (which would otherwise drop
// the query) preserves the choice.
export function syncLangParam(lang: Lang) {
  try {
    const url = new URL(window.location.href);
    const current = url.searchParams.get(LANG_PARAM);
    if (lang === "he") {
      if (current === null) return;
      url.searchParams.delete(LANG_PARAM);
    } else {
      if (current === lang) return;
      url.searchParams.set(LANG_PARAM, lang);
    }
    window.history.replaceState(window.history.state, "", url.toString());
  } catch { /* ignore */ }
}
