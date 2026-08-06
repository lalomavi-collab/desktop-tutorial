#!/usr/bin/env node
// Task #8: download the article cover images still hosted on static.wixstatic.com
// into the repo, and repoint src/lib/blogMeta.ts at the local copies, so the
// site no longer depends on Wix once the subscription is closed.
//
// Only touches entries whose cover is currently a wixstatic.com URL. Local
// covers (already migrated) and empty covers are left untouched.
//
// Run locally with network access: `node scripts/download-wix-covers.mjs`

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const BLOG_META_PATH = path.join(ROOT, "src", "lib", "blogMeta.ts");
const OUT_DIR = path.join(ROOT, "public", "images", "covers");
const CONCURRENCY = 6;

function readBlogMetaSource() {
  return readFileSync(BLOG_META_PATH, "utf8");
}

function parseArticles(src) {
  const start = src.indexOf("blogMeta: BlogMeta[] = [") + "blogMeta: BlogMeta[] = ".length;
  const end = src.lastIndexOf("];") + 1;
  return { articles: JSON.parse(src.slice(start, end)), start, end };
}

function extFromContentTypeOrUrl(contentType, url) {
  if (contentType) {
    if (contentType.includes("webp")) return "webp";
    if (contentType.includes("png")) return "png";
    if (contentType.includes("jpeg") || contentType.includes("jpg")) return "jpg";
  }
  const m = url.match(/~mv2\.(\w+)(?:$|\?)/) || url.match(/\.(\w+)$/);
  return m ? m[1].toLowerCase() : "jpg";
}

async function downloadOne(article) {
  const { slug, cover } = article;
  try {
    const res = await fetch(cover);
    if (!res.ok) return { slug, cover, ok: false, error: `HTTP ${res.status}` };
    const buf = Buffer.from(await res.arrayBuffer());
    const ext = extFromContentTypeOrUrl(res.headers.get("content-type"), cover);
    const filename = `${slug}.${ext}`;
    mkdirSync(OUT_DIR, { recursive: true });
    writeFileSync(path.join(OUT_DIR, filename), buf);
    return { slug, cover, ok: true, localPath: `/images/covers/${filename}`, bytes: buf.length };
  } catch (err) {
    return { slug, cover, ok: false, error: String(err) };
  }
}

async function pool(items, worker, concurrency) {
  const results = new Array(items.length);
  let i = 0;
  async function run() {
    while (i < items.length) {
      const idx = i++;
      results[idx] = await worker(items[idx]);
      console.log(`[${idx + 1}/${items.length}] ${items[idx].slug}: ${results[idx].ok ? "OK -> " + results[idx].localPath : "FAILED " + results[idx].error}`);
    }
  }
  await Promise.all(Array.from({ length: concurrency }, run));
  return results;
}

async function main() {
  const src = readBlogMetaSource();
  const { articles } = parseArticles(src);
  const wixArticles = articles.filter((a) => a.cover && a.cover.includes("wixstatic.com"));

  if (existsSync(OUT_DIR)) {
    console.log(`Note: ${OUT_DIR} already exists, existing files with the same name will be overwritten.`);
  }

  console.log(`Downloading ${wixArticles.length} wixstatic covers...\n`);
  const results = await pool(wixArticles, downloadOne, CONCURRENCY);

  const ok = results.filter((r) => r.ok);
  const failed = results.filter((r) => !r.ok);

  // Rewrite blogMeta.ts: replace each successfully-downloaded cover URL with
  // its local path. Do this as plain string replacement against the original
  // wixstatic URL (unique per article), so formatting/ordering is untouched.
  let newSrc = src;
  for (const r of ok) {
    const escaped = r.cover.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const re = new RegExp(`"cover":\\s*"${escaped}"`);
    if (!re.test(newSrc)) {
      console.warn(`WARN: could not find cover string for ${r.slug} in blogMeta.ts to replace (skipped rewrite for this one)`);
      continue;
    }
    newSrc = newSrc.replace(re, `"cover": "${r.localPath}"`);
  }
  writeFileSync(BLOG_META_PATH, newSrc, "utf8");

  console.log(`\n=== SUMMARY ===`);
  console.log(`Downloaded + relinked: ${ok.length}/${wixArticles.length}`);
  if (failed.length) {
    console.log(`FAILED (left pointing at wixstatic.com, retry or investigate):`);
    for (const f of failed) console.log(`  ${f.slug}: ${f.error} (${f.cover})`);
  }
  console.log(`\nblogMeta.ts updated in place. Review with \`git diff\`, then:`);
  console.log(`  npm run build   # confirm it still builds`);
  console.log(`  git add public/images/covers src/lib/blogMeta.ts`);
  console.log(`  git commit -m "..."`);
  process.exitCode = failed.length ? 1 : 0;
}

main();
