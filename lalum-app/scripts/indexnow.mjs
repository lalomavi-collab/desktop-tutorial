// Submit the sitemap's URLs to IndexNow.
//
// Why this exists: there is no longer any way to notify a search engine of a
// sitemap by an unauthenticated HTTP request. Google retired its ping endpoint
// in 2023 (it now 404s) and Bing retired its own (410). Google's sitemap is
// submitted through Search Console or discovered from robots.txt, and nothing
// else. Google also does not participate in IndexNow.
//
// IndexNow does still work, and covers Bing, Yandex, Seznam and Naver. It needs
// a key hosted at the site root, which is committed in public/ and therefore
// deploys with the site.
//
// Usage:
//   npm run indexnow            submit every URL in the sitemap
//   npm run indexnow -- --dry   print what would be sent, send nothing

import { readFileSync, existsSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const HOST = "lalumapp.com";
const ENDPOINT = "https://api.indexnow.org/indexnow";
const dry = process.argv.includes("--dry");

// The key is whatever <key>.txt sits in public/, so rotating it means dropping
// in a new file and deleting the old one; nothing here needs editing.
const keyFile = readdirSync(join(root, "public")).find((f) => /^[a-f0-9]{16,128}\.txt$/i.test(f));
if (!keyFile) {
  console.error("No IndexNow key file in public/. Expected <hexkey>.txt");
  process.exit(1);
}
const key = keyFile.replace(/\.txt$/, "");
const hosted = readFileSync(join(root, "public", keyFile), "utf8").trim();
if (hosted !== key) {
  console.error(`Key file ${keyFile} must contain exactly "${key}", found "${hosted}"`);
  process.exit(1);
}

const sitemap = join(root, "dist", "sitemap.xml");
if (!existsSync(sitemap)) {
  console.error("dist/sitemap.xml missing, run the build first");
  process.exit(1);
}
const urlList = [...readFileSync(sitemap, "utf8").matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
if (!urlList.length) {
  console.error("No <loc> entries in the sitemap");
  process.exit(1);
}

const payload = { host: HOST, key, keyLocation: `https://${HOST}/${keyFile}`, urlList };

console.log(`IndexNow: ${urlList.length} urls`);
console.log(`  key         ${key}`);
console.log(`  keyLocation ${payload.keyLocation}`);
console.log(`  first       ${urlList[0]}`);
console.log(`  last        ${urlList[urlList.length - 1]}`);

if (dry) {
  console.log("\n--dry: nothing sent.");
  process.exit(0);
}

const res = await fetch(ENDPOINT, {
  method: "POST",
  headers: { "Content-Type": "application/json; charset=utf-8" },
  body: JSON.stringify(payload),
});
const body = await res.text();
// 200 accepted, 202 accepted but the key is still being validated.
console.log(`\nHTTP ${res.status} ${res.statusText}${body ? `\n${body}` : ""}`);
if (res.status !== 200 && res.status !== 202) {
  console.error("\nIndexNow submission FAILED");
  process.exit(1);
}
console.log("\nIndexNow submission accepted");
