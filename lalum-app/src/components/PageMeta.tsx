import { useEffect } from "react";

// Per-route SEO: sets the document title, description, canonical, and Open Graph
// tags so each page and article is indexed and shared with its own metadata.
// This is a SPA, so we update the tags in the <head> on each route.
type Props = { title: string; description?: string; image?: string; path?: string };

function setMeta(attr: "name" | "property", key: string, content: string) {
  let el = document.head.querySelector(`meta[${attr}="${key}"]`) as HTMLMetaElement | null;
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute("content", content);
}

export function PageMeta({ title, description, image, path }: Props) {
  useEffect(() => {
    document.title = title;
    const url = `https://lalumapp.com${path ?? window.location.pathname}`;
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
  }, [title, description, image, path]);

  return null;
}
