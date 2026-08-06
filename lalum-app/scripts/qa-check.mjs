#!/usr/bin/env node
// QA pass for lalumapp.com before the lalum.co DNS cutover (task #5).
// Run locally with network access: `node scripts/qa-check.mjs`
// (Claude's sandbox has no outbound access to lalumapp.com, so this
// must be run by a human or CI runner that does.)
//
// What it does:
// 1. Reads public/sitemap.xml, requests every URL against the live site.
// 2. Scans the raw HTML each URL returns for <img src> / og:image tags.
//    NOTE: the app is a client-rendered SPA, so the raw HTML of article
//    pages does NOT contain the article body images (React renders those
//    in the browser after JS runs). This step only catches images that
//    are present in the static shell (e.g. the og:image meta tag), it is
//    not a substitute for step 3 below.
// 3. Reads src/lib/blogMeta.ts directly (the actual source of truth for
//    article cover images) and checks every cover URL for reachability.
//    Flags any image still hosted on static.wixstatic.com (task #8 list)
//    and any article with no cover at all.
// 4. Prints a summary: broken pages, broken images, wixstatic image count,
//    articles missing a cover.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BASE = process.env.QA_BASE_URL || "https://lalumapp.com";
const CONCURRENCY = 8;

function readSitemapUrls() {
  const xml = readFileSync(path.join(__dirname, "..", "public", "sitemap.xml"), "utf8");
  const matches = [...xml.matchAll(/<loc>(.*?)<\/loc>/g)].map((m) => m[1]);
  if (BASE !== "https://lalumapp.com") {
    return matches.map((u) => u.replace("https://lalumapp.com", BASE));
  }
  return matches;
}

async function fetchStatus(url) {
  try {
    const res = await fetch(url, { redirect: "follow" });
    return { url, status: res.status, ok: res.ok, finalUrl: res.url, body: res.ok ? await res.text() : null };
  } catch (err) {
    return { url, status: 0, ok: false, error: String(err) };
  }
}

async function checkImage(url) {
  try {
    const res = await fetch(url, { method: "HEAD" });
    if (res.status === 405 || res.status === 501) {
      // Some hosts (incl. wixstatic) reject HEAD; fall back to GET.
      const res2 = await fetch(url);
      return { url, ok: res2.ok, status: res2.status };
    }
    return { url, ok: res.ok, status: res.status };
  } catch (err) {
    return { url, ok: false, status: 0, error: String(err) };
  }
}

function extractImageUrls(html, pageUrl) {
  const srcs = [
    ...html.matchAll(/<img[^>]+src=["']([^"']+)["']/gi),
    ...html.matchAll(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/gi),
  ].map((m) => m[1]);
  return srcs.map((src) => {
    if (src.startsWith("http")) return src;
    if (src.startsWith("//")) return "https:" + src;
    return new URL(src, pageUrl).toString();
  });
}

function readBlogCovers() {
  const src = readFileSync(path.join(__dirname, "..", "src", "lib", "blogMeta.ts"), "utf8");
  const start = src.indexOf("blogMeta: BlogMeta[] = [") + "blogMeta: BlogMeta[] = ".length;
  const jsonText = src.slice(start, src.lastIndexOf("];") + 1);
  return JSON.parse(jsonText);
}

async function pool(items, worker, concurrency) {
  const results = new Array(items.length);
  let i = 0;
  async function run() {
    while (i < items.length) {
      const idx = i++;
      results[idx] = await worker(items[idx], idx);
    }
  }
  await Promise.all(Array.from({ length: concurrency }, run));
  return results;
}

async function main() {
  const urls = readSitemapUrls();
  console.log(`Base: ${BASE}`);
  console.log(`Checking ${urls.length} sitemap URLs...\n`);

  const pageResults = await pool(urls, fetchStatus, CONCURRENCY);
  const brokenPages = pageResults.filter((r) => !r.ok);

  const allImageUrls = new Set();
  for (const r of pageResults) {
    if (r.ok && r.body) {
      for (const img of extractImageUrls(r.body, r.finalUrl || r.url)) {
        allImageUrls.add(img);
      }
    }
  }

  console.log(`--- Page status ---`);
  console.log(`OK: ${pageResults.length - brokenPages.length}/${pageResults.length}`);
  if (brokenPages.length) {
    console.log(`BROKEN PAGES:`);
    for (const p of brokenPages) console.log(`  [${p.status}] ${p.url} ${p.error || ""}`);
  }

  console.log(`\n--- Images found in raw page HTML (shell only, e.g. og:image): ${allImageUrls.size} ---`);
  const shellImageResults = await pool([...allImageUrls], checkImage, CONCURRENCY);
  const brokenShellImages = shellImageResults.filter((r) => !r.ok);
  console.log(`OK: ${shellImageResults.length - brokenShellImages.length}/${shellImageResults.length}`);
  if (brokenShellImages.length) {
    console.log(`BROKEN:`);
    for (const im of brokenShellImages) console.log(`  [${im.status}] ${im.url}`);
  }

  // The real article-cover inventory: read straight from source, since the
  // SPA never renders these into the HTML this script fetches.
  const articles = readBlogCovers();
  const wixCovers = articles.filter((a) => a.cover && a.cover.includes("wixstatic.com"));
  const missingCovers = articles.filter((a) => !a.cover);
  console.log(`\n--- Article covers (source of truth: src/lib/blogMeta.ts) ---`);
  console.log(`Total articles: ${articles.length}`);
  console.log(`Covers on wixstatic.com: ${wixCovers.length} (candidates for task #8: download + self-host before closing Wix)`);
  console.log(`Checking reachability of all ${wixCovers.length} wixstatic covers...`);
  const wixResults = await pool(wixCovers.map((a) => a.cover), checkImage, CONCURRENCY);
  const brokenWix = wixResults.filter((r) => !r.ok);
  console.log(`Reachable: ${wixResults.length - brokenWix.length}/${wixResults.length}`);
  if (brokenWix.length) {
    console.log(`BROKEN wixstatic covers (already unreachable, migrate/replace urgently):`);
    for (const im of brokenWix) console.log(`  [${im.status}] ${im.url}`);
  }
  if (missingCovers.length) {
    console.log(`\nArticles with NO cover image at all (${missingCovers.length}):`);
    for (const a of missingCovers) console.log(`  ${a.slug}`);
  }
  console.log(`\nFull wixstatic cover list:`);
  for (const a of wixCovers) console.log(`  ${a.slug} -> ${a.cover}`);

  console.log(`\n=== SUMMARY ===`);
  console.log(`Pages: ${pageResults.length}, broken: ${brokenPages.length}`);
  console.log(`Shell images: ${shellImageResults.length}, broken: ${brokenShellImages.length}`);
  console.log(`Article covers: ${articles.length}, on wixstatic: ${wixCovers.length}, broken wixstatic: ${brokenWix.length}, missing entirely: ${missingCovers.length}`);
  process.exitCode = brokenPages.length || brokenShellImages.length || brokenWix.length ? 1 : 0;
}

main();
