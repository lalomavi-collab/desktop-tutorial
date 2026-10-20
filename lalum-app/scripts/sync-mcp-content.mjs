// Keeps the MCP connector's public content in step with the site's corpus.
//
// The lalum-mcp edge function serves the articles and the verified case law
// that already appear on lalumapp.com. It deploys on its own and cannot import
// across the project, so this script copies the public fields into
// supabase/functions/lalum-mcp/content.data.ts. The sources stay where they
// are: article metadata in src/lib/blogMeta.ts, bodies in src/data/posts,
// topics in src/data/articleIndex.json, case law in src/data/rulings.json.
//
// Only what a visitor can already read is copied. Nothing here reads a client
// record, a lead, or anything behind sign-in.
//
// Usage: node scripts/sync-mcp-content.mjs           (write)
//        node scripts/sync-mcp-content.mjs --check   (fail if stale)

import { readFileSync, writeFileSync, existsSync, readdirSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const target = join(root, "supabase/functions/lalum-mcp/content.data.ts");
const SITE = "https://lalumapp.com";

const { blogMeta } = await import(pathToFileURL(join(root, "src/lib/blogMeta.ts")).href);
const index = JSON.parse(readFileSync(join(root, "src/data/articleIndex.json"), "utf8"));
const { rulings } = JSON.parse(readFileSync(join(root, "src/data/rulings.json"), "utf8"));

const bodyFiles = new Set(readdirSync(join(root, "src/data/posts")));
const articles = [];
for (const m of blogMeta) {
  const file = `${m.slug}.ts`;
  if (!bodyFiles.has(file)) {
    console.error(`[FAIL] no body file for article ${m.slug}`);
    process.exit(1);
  }
  const { body } = await import(pathToFileURL(join(root, "src/data/posts", file)).href);
  articles.push({
    slug: m.slug,
    title: m.title,
    excerpt: m.excerpt,
    date: m.date,
    topic: index[m.slug]?.topic ?? null,
    url: `${SITE}/insights/${m.slug}/`,
    body,
  });
}

const cases = rulings.map((r) => ({
  citation: r.citation,
  caption: r.caption,
  court: r.court,
  date: r.dateLabel,
  areas: r.areas,
  tags: r.tags,
  facts: r.facts,
  issue: r.issue,
  holding: r.holding,
  implications: r.implications,
  article: r.article ? `${SITE}/insights/${r.article}/` : undefined,
}));

const out = `// GENERATED FILE, do not edit by hand.
// Source: src/lib/blogMeta.ts, src/data/posts, src/data/articleIndex.json, src/data/rulings.json.
// Regenerate with:
//   node scripts/sync-mcp-content.mjs
//
// The public content the MCP connector may serve. Anything not in these
// lists is, as far as the connector is concerned, not on the site.
export const ARTICLES = ${JSON.stringify(articles)} as const;
export const CASES = ${JSON.stringify(cases)} as const;
`;

const current = existsSync(target) ? readFileSync(target, "utf8") : "";

if (process.argv.includes("--check")) {
  if (current !== out) {
    console.error("[FAIL] supabase/functions/lalum-mcp/content.data.ts is stale. Run: node scripts/sync-mcp-content.mjs");
    process.exit(1);
  }
  console.log(`[OK] MCP content in step: ${articles.length} articles, ${cases.length} rulings`);
} else {
  writeFileSync(target, out);
  console.log(`[OK] wrote ${articles.length} articles and ${cases.length} rulings to lalum-mcp/content.data.ts`);
}
