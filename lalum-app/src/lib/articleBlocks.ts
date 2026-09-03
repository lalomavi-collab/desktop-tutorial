import type { ArticleBlock } from "./content";

// Blog post bodies come in two shapes. Imported posts are one plain-text run
// with no line breaks: those are grouped into readable paragraphs by sentence.
// Authored posts use "## " on their own line for section headings and blank
// lines between paragraphs: those render with real headings for a uniform,
// professional structure. Both are handled by the same splitter.
//
// Shared by the Article route (runtime) and the SEO prerender (build time), so
// the static HTML a crawler reads and the page a visitor sees are split the
// same way and cannot drift apart.
export function toBlocks(body: string): ArticleBlock[] {
  const blocks: ArticleBlock[] = [];
  for (const raw of body.split(/\n+/)) {
    const seg = raw.trim();
    if (!seg) continue;
    if (seg.startsWith("## ")) {
      blocks.push({ type: "h2", text: seg.slice(3).trim() });
      continue;
    }
    const sentences = seg.split(/(?<=[.!?])\s+/);
    let cur: string[] = [];
    for (const s of sentences) {
      cur.push(s);
      if (cur.join(" ").length > 300) {
        blocks.push({ type: "p", text: cur.join(" ") });
        cur = [];
      }
    }
    if (cur.length) blocks.push({ type: "p", text: cur.join(" ") });
  }
  return blocks;
}

// The reading text of an article, as one plain string: every prose block joined
// with blank lines, headings included. Used for schema.org articleBody so an AI
// answer engine that reads only the structured data still gets the full piece.
export function blocksToText(blocks: ArticleBlock[]): string {
  const out: string[] = [];
  for (const b of blocks) {
    switch (b.type) {
      case "p":
      case "h2":
      case "quote":
        out.push(b.text);
        break;
      case "list":
        out.push(b.items.join("\n"));
        break;
      case "cta":
        // A call to action is navigation, not reading matter: skipped so the
        // article body stays prose.
        break;
    }
  }
  return out.join("\n\n");
}
