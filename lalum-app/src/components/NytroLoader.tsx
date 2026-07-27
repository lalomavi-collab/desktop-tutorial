import { useEffect } from "react";
import { useLocation } from "react-router-dom";

// NytroSEO global plugin. It optimizes the public marketing pages for search, so
// it loads there only. It must never run on the authenticated surfaces (the
// login page and the client portal), where clients type credentials and view
// private files and a remote third-party script has no business executing.
//
// Because this is a single page app that keeps one document across soft
// navigations, once the plugin has run it stays live in memory. So to guarantee
// it is truly absent on a sensitive page we drop it and hard reload, which
// rebuilds the document without it. The static index.html carries no Nytro tag,
// so a fresh document on a sensitive route never has it, and no reload loop is
// possible (we only inject on public routes).
const NYTRO_SRC =
  "https://plugin.nytsys.com/api/site/1e4f54a0-1017-4520-8517-796277982699/nytsys.min.js";
const NYTRO_ID = "nytsys-global";

// Login and the portal (and anything nested under them) are the private zone.
function isSensitivePath(pathname: string): boolean {
  return /^\/(login|portal)(\/|$)/.test(pathname);
}

export function NytroLoader() {
  const { pathname } = useLocation();

  useEffect(() => {
    const existing = document.getElementById(NYTRO_ID);

    if (isSensitivePath(pathname)) {
      // Private page: if the plugin was injected on an earlier public page in
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
