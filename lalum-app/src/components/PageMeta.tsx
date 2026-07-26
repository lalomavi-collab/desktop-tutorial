import { useEffect } from "react";

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

export function PageMeta({ title, description, image, path, jsonLd, noindex }: Props) {
  const ldStr = jsonLd ? JSON.stringify(jsonLd) : "";
  useEffect(() => {
    document.title = title;
    const url = `https://lalumapp.com${path ?? window.location.pathname}`;
    // Keep auth pages (login, portal) out of the index; restore the default on
    // every other route so navigation never leaves a stale noindex behind.
    setMeta("name", "robots", noindex ? "noindex, nofollow" : ROBOTS_DEFAULT);
    setMeta("property", "og:title", title);
    setMeta("name", "twitter:title", title);
    setMeta("property", "og:url", url);
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
  }, [title, description, image, path, ldStr, noindex]);

  return null;
}
