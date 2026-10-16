// Fails the build when an article has no cover of its own, or shares one.
// Fix: `npm run covers`.
import { readFileSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
import { join } from "node:path";

const ROOT = join(import.meta.dirname, "..");
const src = readFileSync(join(ROOT, "src/lib/blogMeta.ts"), "utf8");
const from = src.indexOf("blogMeta: BlogMeta[] = [") + "blogMeta: BlogMeta[] = ".length;
const slugs = JSON.parse(src.slice(from, src.lastIndexOf("];") + 1).replace(/,\s*\]\s*$/, "]")).map((b) => b.slug);
const map = JSON.parse(readFileSync(join(ROOT, "src/data/articleCovers.json"), "utf8"));

const problems = [];
const byPath = new Map(), byHash = new Map();
for (const slug of slugs) {
  const rel = map[slug];
  if (!rel) { problems.push(`${slug}: no cover`); continue; }
  const file = join(ROOT, "public", rel);
  if (!existsSync(file)) { problems.push(`${slug}: ${rel} is missing`); continue; }
  if (byPath.has(rel)) problems.push(`${slug} and ${byPath.get(rel)} share ${rel}`);
  byPath.set(rel, slug);
  const h = createHash("sha1").update(readFileSync(file)).digest("hex");
  if (byHash.has(h)) problems.push(`${slug} and ${byHash.get(h)} are the same image`);
  byHash.set(h, slug);
}
if (problems.length) {
  console.error(`covers-check: ${problems.length} problem(s)\n  ` + problems.slice(0, 15).join("\n  ") + "\n  run: npm run covers");
  process.exit(1);
}
console.log(`covers-check: ${slugs.length} articles, ${slugs.length} distinct covers`);
