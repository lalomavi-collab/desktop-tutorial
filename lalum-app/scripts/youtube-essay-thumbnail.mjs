// Renders the YouTube thumbnail (1280x720) for the essay, in the film's own look.
//   PLAYWRIGHT_MODULE=/opt/node-tools/node_modules/playwright/index.mjs node scripts/youtube-essay-thumbnail.mjs
// OUT default /tmp/lalum-youtube-essay. The wordmark is the supplied artwork, never a typeface.
import { readFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || "playwright");
const out = process.env.OUT || "/tmp/lalum-youtube-essay";
mkdirSync(out, { recursive: true });
const logo = readFileSync(path.join(root, "public/lalum-logo-inverse.svg"), "utf8").replace(/<svg /, '<svg style="position:absolute;right:56px;bottom:44px;width:170px;opacity:.85" ');
const html = `<!doctype html><meta charset="utf-8"><style>
*{box-sizing:border-box;margin:0}body{width:1280px;height:720px;overflow:hidden;position:relative;font-family:"Liberation Sans",Arial,sans-serif;color:#f5f1e8;background:radial-gradient(90% 90% at 30% 25%,#254531 0%,#142019 55%,#0b100c 100%)}
.g{position:absolute;inset:0;opacity:.06;background-image:linear-gradient(#fff 1px,transparent 1px),linear-gradient(90deg,#fff 1px,transparent 1px);background-size:60px 60px}
.br{position:absolute;width:56px;height:56px;border:3px solid #4a7054}
.k{position:absolute;left:70px;top:92px;font-size:30px;letter-spacing:8px;color:#e7c27a;font-family:"Liberation Mono",monospace}
.a{position:absolute;left:62px;top:140px;font-size:200px;font-weight:700;letter-spacing:-6px;line-height:.95;color:#e7c27a;text-shadow:0 0 60px rgba(231,194,122,.35)}
.b{position:absolute;left:70px;top:560px;font-size:46px;font-weight:700;line-height:1.12;color:#f5f1e8;width:900px}
.s{position:absolute;right:70px;top:200px;width:300px}
.s div{height:26px;border-radius:13px;background:#35503b;margin-bottom:24px}
.s .h{background:#e7c27a}
.x{position:absolute;right:70px;top:480px;width:300px;border-bottom:6px solid #e7c27a;font-size:56px;color:#e7c27a;height:60px;line-height:50px}
</style><body><div class="g"></div>
<div class="br" style="left:30px;top:30px;border-right:0;border-bottom:0"></div><div class="br" style="right:30px;top:30px;border-left:0;border-bottom:0"></div>
<div class="br" style="left:30px;bottom:30px;border-right:0;border-top:0"></div><div class="br" style="right:30px;bottom:30px;border-left:0;border-top:0"></div>
<div class="k">GOOGLE · LEGAL AGENTS</div>
<div class="a">WHO<br>SIGNS?</div>
<div class="s"><div style="width:280px"></div><div style="width:240px"></div><div style="width:300px"></div><div class="h" style="width:200px"></div><div style="width:260px"></div></div>
<div class="x">&times;</div>
<div class="b">Google just built an AI lawyer's assistant.</div>
${logo}</body>`;
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
await p.setContent(html);
await p.evaluate(() => document.fonts.ready);
await p.screenshot({ path: path.join(out, "thumbnail.png") });
await b.close();
console.log("wrote", path.join(out, "thumbnail.png"));
