#!/usr/bin/env node
// QA pass for lalumapp.com before the lalum.co DNS cutover (task #5).
// Run locally with network access: `node scripts/qa-check.mjs`
// (Claude's sandbox has no outbound access to lalumapp.com, so this
// must be run by a human or CI runner that does.)
//
// What it does:
// 1. Reads public/sitemap.xml, requests every URL against the live site.
// 2. For each HTML page, extracts <img src> and checks each image loads.
// 3. Flags any image still hosted on static.wixstatic.com (task #8 list).
// 4. Prints a summary: broken pages, broken images, wixstatic image count.

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
  const srcs = [...html.matchAll(/<img[^>]+src=["']([^"']+)["']/gi)].map((m) => m[1]);
  return srcs.map((src) => {
    if (src.startsWith("http")) return src;
    if (src.startsWith("//")) return "https:" + src;
    return new URL(src, pageUrl).toString();
  });
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

  const wixstaticImages = new Set();
  const allImageUrls = new Set();
  for (const r of pageResults) {
    if (r.ok && r.body) {
      for (const img of extractImageUrls(r.body, r.finalUrl || r.url)) {
        allImageUrls.add(img);
        if (img.includes("wixstatic.com")) wixstaticImages.add(img);
      }
    }
  }

  console.log(`--- Page status ---`);
  console.log(`OK: ${pageResults.length - brokenPages.length}/${pageResults.length}`);
  if (brokenPages.length) {
    console.log(`BROKEN PAGES:`);
    for (const p of brokenPages) console.log(`  [${p.status}] ${p.url} ${p.error || ""}`);
  }

  console.log(`\n--- Images found across pages: ${allImageUrls.size} total, ${wixstaticImages.size} on wixstatic.com ---`);
  console.log(`Checking image reachability...`);
  const imageResults = await pool([...allImageUrls], checkImage, CONCURRENCY);
  const brokenImages = imageResults.filter((r) => !r.ok);
  console.log(`Images OK: ${imageResults.length - brokenImages.length}/${imageResults.length}`);
  if (brokenImages.length) {
    console.log(`BROKEN IMAGES:`);
    for (const im of brokenImages) console.log(`  [${im.status}] ${im.url}`);
  }

  console.log(`\n--- wixstatic.com images (candidates for task #8: download + self-host before closing Wix) ---`);
  for (const w of [...wixstaticImages].sort()) console.log(`  ${w}`);
  console.log(`\nTotal wixstatic images referenced: ${wixstaticImages.size}`);

  console.log(`\n=== SUMMARY ===`);
  console.log(`Pages: ${pageResults.length}, broken: ${brokenPages.length}`);
  console.log(`Images: ${imageResults.length}, broken: ${brokenImages.length}, wixstatic: ${wixstaticImages.size}`);
  process.exitCode = brokenPages.length || brokenImages.length ? 1 : 0;
}

main();
