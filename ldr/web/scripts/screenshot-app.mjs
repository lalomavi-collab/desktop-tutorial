// Automated screenshot tour of the LAWDin web app, for sharing with the team.
//
// The app is a single page app with no per page URL, and it requires a Magic
// Link login, so this runs in two steps:
//   1) node scripts/screenshot-app.mjs login   log in once, saves the session
//   2) node scripts/screenshot-app.mjs shoot    captures every page
//
// Prerequisites (run inside ldr/web):
//   npm install
//   npm i -D playwright
//   npx playwright install chromium
//   npm run dev          in a separate terminal, serves http://localhost:5173
//
// Configuration via environment variables:
//   BASE_URL   the running app (default http://localhost:5173)
//   OUT_DIR    where screenshots are written (default ./screenshots)
//   STATE      session file path (default ./scripts/.auth-state.json)

import { chromium } from "playwright";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";
import { mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";

const BASE_URL = process.env.BASE_URL || "http://localhost:5173";
const OUT_DIR = resolve(process.env.OUT_DIR || "screenshots");
const here = dirname(fileURLToPath(import.meta.url));
const STATE = process.env.STATE || join(here, ".auth-state.json");
const VIEWPORT = { width: 1440, height: 900 };

// Every page, in the order a person would tour them. label is the visible text
// on the navigation button (copied from src/App.tsx, matched as a substring).
// more=true means the button lives inside the "עוד ▾" overflow menu.
const PAGES = [
  { key: "01-feed", label: "בית" },
  { key: "02-map", label: "מפה" },
  { key: "03-find", label: "איתור" },
  { key: "04-qa", label: "שו" },
  { key: "05-lab", label: "שאלות תשובות כללי" },
  { key: "06-room", label: "חדר ההחלטות", more: true },
  { key: "07-gigs", label: "Legal Gigs", more: true },
  { key: "08-cases", label: "תיקים מלקוחות", more: true },
  { key: "09-rooms", label: "שיתוף חדרים", more: true },
  { key: "10-referrals", label: "הפניות", more: true },
  { key: "11-board", label: "מובילים", more: true },
  { key: "12-invite", label: "הזמנות", more: true },
  { key: "13-profile", label: "פרופיל" },
  { key: "14-admin", label: "אדמין" },
];

async function settle(page) {
  await page.waitForLoadState("networkidle").catch(() => {});
  await page.waitForTimeout(1200);
}

async function doLogin() {
  await mkdir(OUT_DIR, { recursive: true });
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({ viewport: VIEWPORT });
  const page = await context.newPage();
  await page.goto(BASE_URL, { waitUntil: "domcontentloaded" });
  await settle(page);
  // Capture the entry screen (the landing and login page) before signing in.
  await page.screenshot({ path: join(OUT_DIR, "00-landing.png"), fullPage: true });
  console.log("\nA browser window opened, and the landing screen was captured.");
  console.log("Now log in with your email and the Magic Link from your inbox.");
  console.log("Waiting for login to complete (up to 10 minutes)...");
  // The logout button "יציאה" only renders once a session exists.
  await page.getByRole("button", { name: "יציאה" }).waitFor({ timeout: 10 * 60 * 1000 });
  await context.storageState({ path: STATE });
  console.log(`\nLogin captured and saved to ${STATE}. You can close the window.`);
  await browser.close();
}

async function gotoTab(page, p) {
  if (p.more) {
    await page.getByRole("button", { name: "עוד" }).first().click();
    await page.waitForTimeout(300);
  }
  await page.getByRole("button", { name: p.label }).first().click();
  await settle(page);
}

async function doShoot() {
  if (!existsSync(STATE)) {
    console.error(`No saved session at ${STATE}. Run "npm run shots:login" first.`);
    process.exit(1);
  }
  await mkdir(OUT_DIR, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    storageState: STATE,
    viewport: VIEWPORT,
    deviceScaleFactor: 2,
  });
  const page = await context.newPage();
  await page.goto(BASE_URL, { waitUntil: "domcontentloaded" });
  const ok = await page.getByRole("button", { name: "יציאה" }).waitFor({ timeout: 30000 }).then(() => true).catch(() => false);
  if (!ok) console.warn("Warning: not logged in. The session may have expired, re-run shots:login.");
  await settle(page);

  let captured = 0;
  for (const p of PAGES) {
    try {
      await gotoTab(page, p);
      const file = join(OUT_DIR, `${p.key}.png`);
      await page.screenshot({ path: file, fullPage: true });
      console.log(`captured ${file}`);
      captured++;
    } catch (err) {
      console.warn(`skipped ${p.key}: ${err.message}`);
    }
  }
  await browser.close();
  console.log(`\nDone, ${captured} of ${PAGES.length} pages captured in ${OUT_DIR}.`);
  console.log("Zip that folder and send it to the team.");
}

const cmd = process.argv[2];
if (cmd === "login") await doLogin();
else if (cmd === "shoot") await doShoot();
else {
  console.log("Usage:");
  console.log("  node scripts/screenshot-app.mjs login   log in once, saves the session");
  console.log("  node scripts/screenshot-app.mjs shoot   capture all pages");
  process.exit(1);
}
