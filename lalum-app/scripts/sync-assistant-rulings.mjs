// Keeps the assistant's grounded case law in step with the app's corpus.
//
// The chat assistant is told to answer case law questions only from a verified
// database and never to invent a ruling. That promise is only worth something
// if the database it carries is the same one the /rulings page renders, so the
// corpus lives in exactly one file (src/data/rulings.json) and this script
// copies the fields the assistant needs into the edge function, which deploys
// on its own and cannot import across the project.
//
// Usage: node scripts/sync-assistant-rulings.mjs           (write)
//        node scripts/sync-assistant-rulings.mjs --check   (fail if stale)

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const source = join(root, "src/data/rulings.json");
const target = join(root, "supabase/functions/lalum-assistant/rulings.data.ts");

const { rulings } = JSON.parse(readFileSync(source, "utf8"));

const slim = rulings.map((r) => ({
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
  article: r.article ? `https://lalumapp.com/insights/${r.article}/` : undefined,
}));

const out = `// GENERATED FILE, do not edit by hand.
// Source: src/data/rulings.json. Regenerate with:
//   node scripts/sync-assistant-rulings.mjs
//
// The verified case law the assistant may answer from. Anything not in this
// list is, as far as the assistant is concerned, not in the database.
export const RULINGS = ${JSON.stringify(slim, null, 2)} as const;
`;

const current = existsSync(target) ? readFileSync(target, "utf8") : "";

if (process.argv.includes("--check")) {
  if (current !== out) {
    console.error("[FAIL] supabase/functions/lalum-assistant/rulings.data.ts is stale. Run: node scripts/sync-assistant-rulings.mjs");
    process.exit(1);
  }
  console.log(`[PASS] assistant case law is in step (${slim.length} rulings)`);
} else {
  writeFileSync(target, out, "utf8");
  console.log(`[ok] wrote ${slim.length} rulings to ${target}`);
}
