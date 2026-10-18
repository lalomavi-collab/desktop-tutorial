import type { Lang } from "./hreflang";

// Picks the entry for the visitor's language, falling back to English. Used by
// the small interface labels that live beside their component rather than in
// the five big string files.
export function byLang<T>(dict: { he: T; en: T } & Partial<Record<Lang, T>>, lang: Lang): T {
  return dict[lang] ?? dict.en;
}
