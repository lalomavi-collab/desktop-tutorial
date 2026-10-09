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

// Inline links inside prose. A body may carry internal links written as
// [label](/path): only root-relative paths are accepted, so a body can never
// inject an off-site or javascript: link. parseInline splits a run of text into
// plain-text and link segments, and both renderers (the Article route at
// runtime and the SEO prerender at build time) build their output from it, so
// the DOM a visitor sees and the HTML a crawler reads carry the same anchors.
export type InlineSeg = { text: string; href?: string };
const INLINE_LINK_RE = /\[([^\]]+)\]\((\/[^)\s]+)\)/g;

export function parseInline(text: string): InlineSeg[] {
  const segs: InlineSeg[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  INLINE_LINK_RE.lastIndex = 0;
  while ((m = INLINE_LINK_RE.exec(text)) !== null) {
    if (m.index > last) segs.push({ text: text.slice(last, m.index) });
    segs.push({ text: m[1], href: m[2] });
    last = m.index + m[0].length;
  }
  if (last < text.length) segs.push({ text: text.slice(last) });
  return segs;
}

// The same text with each link reduced to its label, for plain-text uses
// (schema.org articleBody) where raw [label](/path) markup would leak.
export function stripInline(text: string): string {
  return text.replace(INLINE_LINK_RE, "$1");
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
        out.push(stripInline(b.text));
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
