import covers from "../data/articleCovers.json";

// One cover per article, drawn by scripts/generate-covers.mjs from the article's
// own slug and title, so two articles never share a picture. The map is keyed by
// slug; `fallback` is only reached by an article added since the last run of
// `npm run covers`, and the build check fails until it is regenerated.
const map = covers as Record<string, string>;

export function coverFor(slug: string, fallback = ""): string {
  return map[slug] ?? fallback;
}

// The card-sized copy (640x336). A list of 250 cards decoded at 1200x630 is about
// 750MB of bitmap on a phone, enough for iOS to kill the page; cards use this.
export function coverThumb(slug: string): string {
  return map[slug] ? `/images/articles/t/${slug}.webp` : "";
}
