import { useEffect } from "react";
import { useLocation } from "react-router-dom";

// NytroSEO global plugin. It optimizes the public marketing pages for search, so
// it loads there only. It must never run on any non-public surface (login, the
// client portal, and anything that is not an indexable marketing page), where a
// remote third-party script has no business executing next to credentials or
// private client data.
//
// The gate is an explicit ALLOWLIST of public routes, so the plugin is secure by
// default: any route not listed here, including any route added in the future,
// is excluded automatically rather than accidentally exposed.
//
// Because this is a single page app that keeps one document across soft
// navigations, once the plugin has run it stays live in memory. So to guarantee
// it is truly absent on a non-public page we drop it and hard reload, which
// rebuilds the document without it. The static index.html carries no Nytro tag,
// so a fresh document on a non-public route never has it, and no reload loop is
// possible (we only inject on public routes).
const NYTRO_SRC =
  "https://plugin.nytsys.com/api/site/1e4f54a0-1017-4520-8517-796277982699/nytsys.min.js";
const NYTRO_ID = "nytsys-global";

// The public, indexable marketing pages, the only pages that promote the site
// and carry SEO value. Everything else (login, portal, unknown paths) is private
// by default and never gets the plugin.
const PUBLIC_PREFIXES = [
  "/advisory",
  "/training",
  "/insights",
  "/knowledge",
  "/faq",
  "/legal",
  "/book",
];

function isPublicPath(pathname: string): boolean {
  if (pathname === "/") return true;
  return PUBLIC_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + "/"));
}

export function NytroLoader() {
  const { pathname } = useLocation();

  useEffect(() => {
    const existing = document.getElementById(NYTRO_ID);

    if (!isPublicPath(pathname)) {
      // Non-public page: if the plugin was injected on an earlier public page in
      // this session it is still live in this document. Remove it and reload so
      // the private page runs in a clean document with no Nytro present.
      if (existing) {
        existing.remove();
        window.location.reload();
      }
      return;
    }

    // Public marketing page: inject once, in the head, if not already present.
    if (!existing) {
      const script = document.createElement("script");
      script.id = NYTRO_ID;
      script.src = NYTRO_SRC;
      document.head.appendChild(script);
    }
  }, [pathname]);

  return null;
}
