// Weekly security check: read only, no secrets needed. Run by .github/workflows/weekly-security-check.yml
// and by hand with: node scripts/weekly-security-check.mjs [--skip-bundle]
//
// What it checks, and nothing more (each line maps to an id in docs/security-page/verified-claims.md):
//   SEC-14  the live site sends HSTS, a Content-Security-Policy and nosniff
//   SEC-01  an anonymous call to the site assistant gets login_required, not an answer
//   SEC-07  the built browser bundle (dist) holds no service key, provider key or private key
//   SEC-12  a payment confirmation without the shared secret is rejected (4xx, never 2xx)
// It does NOT test the database (RLS, policies, cron). That is the SQL audit in
// public/downloads/lalum-supabase-security-audit.sql, which needs a database session.
// Exit code 1 when any check fails; the last line of stdout is a one line summary for Telegram.
import { readdirSync, readFileSync, existsSync, statSync } from "node:fs";
import { join } from "node:path";

const SITE = "https://lalumapp.com";
const FN = "https://meoymkcotomoluwlwues.supabase.co/functions/v1";
const skipBundle = process.argv.includes("--skip-bundle");
const results = [];
const record = (id, ok, detail) => { results.push({ id, ok, detail }); console.log(`[${ok ? "PASS" : "FAIL"}] ${id} ${detail}`); };

async function safe(id, fn) {
  try { await fn(); } catch (e) { record(id, false, `check could not run: ${String(e).slice(0, 120)}`); }
}

await safe("SEC-14", async () => {
  const r = await fetch(SITE, { redirect: "follow" });
  const h = r.headers;
  const hsts = h.get("strict-transport-security") ?? "";
  const csp = h.get("content-security-policy") ?? "";
  const nosniff = (h.get("x-content-type-options") ?? "").toLowerCase() === "nosniff";
  const ok = r.ok && /max-age=\d{7,}/.test(hsts) && csp.includes("default-src") && nosniff;
  record("SEC-14", ok, `status ${r.status}; HSTS ${hsts ? "present" : "missing"}; CSP ${csp ? "present" : "missing"}; nosniff ${nosniff}`);
});

await safe("SEC-01", async () => {
  const r = await fetch(`${FN}/lalum-assistant`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ messages: [{ role: "user", content: "hi" }] }) });
  const j = await r.json().catch(() => ({}));
  record("SEC-01", r.ok && j.login_required === true, `status ${r.status}; login_required ${j.login_required === true}`);
});

await safe("SEC-12", async () => {
  const r = await fetch(`${FN}/lalum-pay-webhook`, { method: "POST", headers: { "content-type": "application/json" }, body: "{}" });
  record("SEC-12", r.status >= 400 && r.status < 500, `status ${r.status} for a call without the secret (expected 4xx)`);
});

if (!skipBundle) {
  await safe("SEC-07", async () => {
    const dist = new URL("../dist", import.meta.url).pathname;
    if (!existsSync(dist)) { record("SEC-07", false, "dist not found: run npm run build first"); return; }
    const patterns = [/service_role/, /sk-ant-/, /sk_live/, /-----BEGIN [A-Z ]*PRIVATE KEY-----/];
    let files = 0; const hits = [];
    const walk = (d) => {
      for (const n of readdirSync(d)) {
        const p = join(d, n);
        if (statSync(p).isDirectory()) { walk(p); continue; }
        if (!/\.(js|mjs|html|json|map)$/.test(n)) continue;
        files++;
        const t = readFileSync(p, "utf8");
        for (const re of patterns) if (re.test(t)) hits.push(`${p.replace(dist, "dist")}: ${re}`);
      }
    };
    walk(dist);
    record("SEC-07", hits.length === 0 && files > 0, `${files} files scanned, ${hits.length} matches${hits.length ? " (" + hits.slice(0, 3).join("; ") + ")" : ""}`);
  });
}

const failed = results.filter((r) => !r.ok);
console.log(failed.length
  ? `Weekly security check: ${failed.length} of ${results.length} FAILED (${failed.map((f) => f.id).join(", ")})`
  : `Weekly security check: ${results.length} of ${results.length} passed (${results.map((r) => r.id).join(", ")})`);
process.exit(failed.length ? 1 : 0);
