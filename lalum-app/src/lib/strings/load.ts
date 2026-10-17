import type { Dict } from "./en";
import type { Lang } from "../hreflang";

// One language per chunk. Hebrew is the default and most visits; the other four
// are fetched only when a visitor is on that language. Before this, one 539KB
// chunk carried all five on every page.
const loaders: Record<Lang, () => Promise<Dict>> = {
  en: () => import("./en").then((m) => m.en),
  he: () => import("./he").then((m) => m.he),
  es: () => import("./es").then((m) => m.es),
  fr: () => import("./fr").then((m) => m.fr),
  ar: () => import("./ar").then((m) => m.ar),
};

const cache = new Map<Lang, Dict>();
const pending = new Map<Lang, Promise<Dict>>();

/** The dictionary if it has already been loaded, else undefined. */
export function loadedDict(lang: Lang): Dict | undefined {
  return cache.get(lang);
}

export function loadDict(lang: Lang): Promise<Dict> {
  const hit = cache.get(lang);
  if (hit) return Promise.resolve(hit);
  let p = pending.get(lang);
  if (!p) {
    p = loaders[lang]().then((d) => { cache.set(lang, d); pending.delete(lang); return d; });
    pending.set(lang, p);
  }
  return p;
}
