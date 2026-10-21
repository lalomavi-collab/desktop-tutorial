// Fails the build when an application route in App.tsx has no prerendered page in vite.config.ts STATIC_ROUTES.
// There is no SPA catch-all on the host: a route that is only client side answers a direct hit or a refresh with the 404 page
// (this is how /workspace/export, /workspace/hours and /workspace/kyc returned 404 on 21.10.2026 although the app has them).
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const app = readFileSync(new URL("../src/App.tsx", import.meta.url), "utf8");
const vite = readFileSync(new URL("../vite.config.ts", import.meta.url), "utf8");
const PRIVATE = /^(workspace|settings|admin|partners|portal|os)(\/|$)/;
const routes = [...app.matchAll(/<Route path="([^"*:]+)"/g)].map((m) => m[1]).filter((p) => PRIVATE.test(p));
const prerendered = new Set([...vite.matchAll(/path:\s*"([^"]+)"/g)].map((m) => m[1]));
const missing = routes.filter((p) => !prerendered.has(p));
assert.deepEqual(missing, [], `routes without a prerendered page (add them to STATIC_ROUTES in vite.config.ts): ${missing.join(", ")}`);
// two pages must not share a description (the build already fails on that for articles; routes are checked here for the ones added by hand)
const descs = [...vite.matchAll(/desc:\s*"([^"]+)"/g)].map((m) => m[1]);
const dup = descs.filter((d, i) => descs.indexOf(d) !== i);
assert.deepEqual(dup, [], `duplicate route descriptions: ${dup.join(" | ")}`);
console.log(`private-routes-check: ok (${routes.length} application routes prerendered)`);
