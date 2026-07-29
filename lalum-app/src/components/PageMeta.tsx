import { useEffect } from "react";
import { useLang } from "../context/LangContext";
import { langUrl, alternatesFor } from "../lib/hreflang";
import { syncLangParam } from "../lib/langParam";

// Per-route SEO: sets the document title, description, canonical, and Open Graph
// tags so each page and article is indexed and shared with its own metadata.
// This is a SPA, so we update the tags in the <head> on each route.
type Props = { title: string; description?: string; image?: string; path?: string; jsonLd?: object; noindex?: boolean };

// The site-wide default: index everything with large image previews.
const ROBOTS_DEFAULT = "index, follow, max-image-preview:large";

function setMeta(attr: "name" | "property", key: string, content: string) {
  let el = document.head.querySelector(`meta[${attr}="${key}"]`) as HTMLMetaElement | null;
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute("content", content);
}

// Keep exactly one <link rel="alternate" hreflang="X"> per language in the
// head, updating hrefs on navigation so they always match the current route.
function setAlternates(path: string) {
  for (const a of alternatesFor(path)) {
    const sel = `link[rel="alternate"][hreflang="${a.hreflang}"]`;
    let el = document.head.querySelector(sel) as HTMLLinkElement | null;
    if (!el) {
      el = document.createElement("link");
      el.setAttribute("rel", "alternate");
      el.setAttribute("hreflang", a.hreflang);
      document.head.appendChild(el);
    }
    el.setAttribute("href", a.href);
  }
}

export function PageMeta({ title, description, image, path, jsonLd, noindex }: Props) {
  const { lang } = useLang();
  const ldStr = jsonLd ? JSON.stringify(jsonLd) : "";
  useEffect(() => {
    document.title = title;
    // React Router navigation rebuilds the URL from the target path and drops
    // any query, so re-assert ?lang=en (or clear it for Hebrew) on every route,
    // keeping the address bar shareable and consistent with the head tags.
    syncLangParam(lang);
    const routePath = path ?? window.location.pathname;
    // The canonical (and og:url) is language-specific: English lives at
    // ?lang=en, Hebrew at the clean URL, so each language variant is its own
    // self-referencing canonical, reciprocal with the hreflang alternates.
    const url = langUrl(routePath, lang);
    // Keep auth pages (login, portal) out of the index; restore the default on
    // every other route so navigation never leaves a stale noindex behind.
    setMeta("name", "robots", noindex ? "noindex, nofollow" : ROBOTS_DEFAULT);
    setMeta("property", "og:title", title);
    setMeta("name", "twitter:title", title);
    setMeta("property", "og:url", url);
    setMeta("property", "og:locale", lang === "he" ? "he_IL" : "en_US");
    if (description) {
      setMeta("name", "description", description);
      setMeta("property", "og:description", description);
      setMeta("name", "twitter:description", description);
    }
    if (image) {
      setMeta("property", "og:image", image);
      setMeta("name", "twitter:image", image);
    }
    let canon = document.head.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
    if (!canon) {
      canon = document.createElement("link");
      canon.setAttribute("rel", "canonical");
      document.head.appendChild(canon);
    }
    canon.setAttribute("href", url);

    // Language alternates for indexable pages only. Auth pages (login, portal)
    // are noindex and single-language, so they carry no hreflang set; strip any
    // left over from a previous indexable route.
    if (noindex) {
      document.head.querySelectorAll('link[rel="alternate"][hreflang]').forEach((el) => el.remove());
    } else {
      setAlternates(routePath);
    }

    // Optional per-page structured data (Article, FAQPage, etc.). A single
    // page-scoped script is added or updated, and removed when a route has none,
    // so it never leaks onto the next page.
    const LD_ID = "page-jsonld";
    let ld = document.getElementById(LD_ID) as HTMLScriptElement | null;
    if (ldStr) {
      if (!ld) {
        ld = document.createElement("script");
        ld.type = "application/ld+json";
        ld.id = LD_ID;
        document.head.appendChild(ld);
      }
      ld.textContent = ldStr;
    } else if (ld) {
      ld.remove();
    }
  }, [title, description, image, path, ldStr, noindex, lang]);

  return null;
}
