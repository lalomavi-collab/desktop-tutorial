import covers from "../data/articleCovers.json";

// One cover per article, drawn by scripts/generate-covers.mjs from the article's
// own slug and title, so two articles never share a picture. The map is keyed by
// slug; `fallback` is only reached by an article added since the last run of
// `npm run covers`, and the build check fails until it is regenerated.
const map = covers as Record<string, string>;

export function coverFor(slug: string, fallback = ""): string {
  return map[slug] ?? fallback;
}
