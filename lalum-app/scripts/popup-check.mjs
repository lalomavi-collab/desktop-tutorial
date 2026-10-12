// Proves, in a real Chromium with the popup blocker ON, that opening a window after a long wait is blocked
// and that the openPendingWindow pattern is not. Run with: npm run popup-check
// Needs Chromium (set PW_CHROMIUM to its path if Playwright's own browser is not installed). Not part of the
// build: it takes about fifteen seconds because the simulated server wait must outlast the activation window.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";
import { chromium } from "playwright";

const helper = ts.transpileModule(readFileSync(new URL("../src/lib/cockpit/printWindow.ts", import.meta.url), "utf8"), {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 },
}).outputText;

const WAIT = 6500; // longer than Chromium's user activation window (about five seconds)
const page$ = `<!doctype html><meta charset="utf-8"><body>
<button id="old">old</button><button id="new">new</button>
<script type="module">
${helper}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
document.getElementById("old").onclick = async () => { await sleep(${WAIT}); window.open("", "_blank"); window.__oldDone = true; };
document.getElementById("new").onclick = async () => {
  const w = openPendingWindow();
  window.__newOpened = !!w;
  await sleep(${WAIT});
  if (w) { w.print = () => {}; window.__newPrinted = printInto(w, "<!doctype html><p id=done>ready</p>"); }
};
</script>`;

const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || undefined, ignoreDefaultArgs: ["--disable-popup-blocking"] });
const context = await browser.newContext();
const page = await context.newPage();
await page.goto("data:text/html," + encodeURIComponent(page$));
let popups = 0; context.on("page", () => { popups++; });

await page.click("#old");
await page.waitForFunction(() => window.__oldDone, null, { timeout: WAIT + 5000 });
await page.waitForTimeout(500);
const afterOld = popups;
console.log(`old pattern (open after a ${WAIT} ms wait): ${afterOld} window(s) opened`);

await page.click("#new");
await page.waitForFunction(() => window.__newPrinted !== undefined, null, { timeout: WAIT + 5000 });
await page.waitForTimeout(500);
const afterNew = popups - afterOld;
const content = await context.pages().at(-1).content();
console.log(`new pattern (open first, fill after the wait): ${afterNew} window(s) opened, filled: ${content.includes("ready")}`);
await browser.close();

assert.equal(afterOld, 0, "the blocker did not block the old pattern, so this run proves nothing");
assert.equal(afterNew, 1, "the new pattern was blocked");
assert.ok(content.includes("ready"), "the pending window did not receive the document");
console.log("\nPopup check passed");
