// Browser-only helper: keep the address bar's ?lang= query in sync with the
// active language. Kept out of hreflang.ts (which is isomorphic and imported by
// the build-time prerender in vite.config.ts) so no DOM globals leak into the
// Node build config's type-check.

import { LANG_PARAM, type Lang } from "./hreflang";

// Without pushing a history entry: English carries ?lang=en so it is a distinct,
// shareable, crawlable address; Hebrew is the clean canonical URL with no param.
// Called both when the language toggles and on each route change, so client-side
// navigation (which would otherwise drop the query) preserves the choice.
export function syncLangParam(lang: Lang) {
  try {
    const url = new URL(window.location.href);
    const current = url.searchParams.get(LANG_PARAM);
    if (lang === "en") {
      if (current === "en") return;
      url.searchParams.set(LANG_PARAM, "en");
    } else {
      if (current === null) return;
      url.searchParams.delete(LANG_PARAM);
    }
    window.history.replaceState(window.history.state, "", url.toString());
  } catch { /* ignore */ }
}
