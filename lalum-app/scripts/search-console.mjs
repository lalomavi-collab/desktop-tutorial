// Pull the site's own search performance out of Google Search Console.
//
// Why this exists: nothing else can tell us which queries the site actually
// appears for, at what position, and which pages get impressions but no clicks.
// Every other check in this repo reads what we published; this one reads what
// the world did with it.
//
// Why it runs in a workflow and not from a session: Search Console needs a
// credential, and a credential must never live in a chat transcript or in an
// ephemeral container. It lives in GitHub Secrets, the workflow runs with it,
// and the resulting data is committed to the repo, where it can be read
// afterwards without holding the key.
//
// No dependencies. The service-account flow is a signed JWT exchanged for an
// access token, which is about forty lines of node:crypto, and adding the
// Google client library to a Vite site's package.json to avoid them would be a
// worse trade.
//
//   GSC_SERVICE_ACCOUNT_JSON='{"client_email":...,"private_key":...}' \
//   node scripts/search-console.mjs
//
// Setup (the part a person has to do once) is in docs/search-console-setup.md.

import { createSign } from "node:crypto";
import { writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const SCOPE = "https://www.googleapis.com/auth/webmasters.readonly";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const API = "https://searchconsole.googleapis.com/webmasters/v3";

// The property is a URL-prefix one: the Search Console link for this site
// carries resource_id=https://lalumapp.com/, and a URL-prefix property is
// addressed by that exact string, trailing slash included. A domain property
// would be "sc-domain:lalumapp.com" instead. The wrong one produces a 403 that
// reads like a permission problem, so it is overridable, and the failure path
// below prints what the account can actually see.
const SITE = process.env.GSC_SITE_URL || "https://lalumapp.com/";

// Search Console finalises a day's data two to three days late. Asking for
// yesterday returns a partial row set that looks like a traffic collapse.
const LAG_DAYS = 3;
const WINDOW_DAYS = Number(process.env.GSC_WINDOW_DAYS || 28);

const b64url = (buf) => Buffer.from(buf).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

export function signedJwt(clientEmail, privateKey, now = Math.floor(Date.now() / 1000)) {
  const header = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claims = b64url(JSON.stringify({
    iss: clientEmail,
    scope: SCOPE,
    aud: TOKEN_URL,
    iat: now,
    exp: now + 3600,
  }));
  const signer = createSign("RSA-SHA256");
  signer.update(`${header}.${claims}`);
  return `${header}.${claims}.${b64url(signer.sign(privateKey))}`;
}

async function accessToken(key) {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      // The private key in the JSON file carries literal \n sequences.
      assertion: signedJwt(key.client_email, String(key.private_key).replace(/\\n/g, "\n")),
    }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`token exchange failed (${res.status}): ${JSON.stringify(body).slice(0, 300)}`);
  return body.access_token;
}

async function api(token, path, init = {}) {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json", ...(init.headers || {}) },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(`${path} failed (${res.status}): ${JSON.stringify(body).slice(0, 400)}`);
    err.status = res.status;
    throw err;
  }
  return body;
}

const isoDaysAgo = (n) => new Date(Date.now() - n * 86400000).toISOString().slice(0, 10);

async function query(token, site, dimensions, extra = {}) {
  const rows = [];
  // The API caps a response at 25000 rows and pages with startRow.
  for (let start = 0; ; start += 25000) {
    const body = await api(token, `/sites/${encodeURIComponent(site)}/searchAnalytics/query`, {
      method: "POST",
      body: JSON.stringify({
        startDate: isoDaysAgo(LAG_DAYS + WINDOW_DAYS),
        endDate: isoDaysAgo(LAG_DAYS),
        dimensions,
        rowLimit: 25000,
        startRow: start,
        ...extra,
      }),
    });
    const page = body.rows || [];
    rows.push(...page);
    if (page.length < 25000) break;
  }
  return rows.map((r) => ({
    keys: r.keys,
    clicks: r.clicks,
    impressions: r.impressions,
    ctr: +(r.ctr || 0).toFixed(4),
    position: +(r.position || 0).toFixed(2),
  }));
}

async function main() {
  const raw = process.env.GSC_SERVICE_ACCOUNT_JSON;
  if (!raw) {
    console.error("GSC_SERVICE_ACCOUNT_JSON is not set. See docs/search-console-setup.md.");
    process.exit(1);
  }
  let key;
  try { key = JSON.parse(raw); } catch { console.error("GSC_SERVICE_ACCOUNT_JSON is not valid JSON (paste the whole key file)."); process.exit(1); }
  if (!key.client_email || !key.private_key) { console.error("The key file has no client_email or private_key."); process.exit(1); }

  const token = await accessToken(key);
  console.log(`authenticated as ${key.client_email}`);

  let site = SITE;
  try {
    await api(token, `/sites/${encodeURIComponent(site)}`);
  } catch (e) {
    if (e.status !== 403 && e.status !== 404) throw e;
    // The most common first-run failure is the service account not being added
    // to the property, or the property being a URL-prefix rather than a domain
    // one. Both are invisible from the error alone, so list what it can see.
    const list = await api(token, "/sites").catch(() => ({}));
    const seen = (list.siteEntry || []).map((s) => `${s.siteUrl} (${s.permissionLevel})`);
    console.error(`cannot read ${site}.`);
    console.error(seen.length
      ? `This account can see: ${seen.join(", ")}. Set GSC_SITE_URL to one of them.`
      : `This account has no properties. Add ${key.client_email} as a user on the property in Search Console.`);
    process.exit(1);
  }

  const [queries, pages, byQueryPage, dates, countries] = [
    await query(token, site, ["query"]),
    await query(token, site, ["page"]),
    await query(token, site, ["query", "page"]),
    await query(token, site, ["date"]),
    await query(token, site, ["country"]),
  ];

  const out = {
    site,
    fetchedAt: new Date().toISOString(),
    window: { start: isoDaysAgo(LAG_DAYS + WINDOW_DAYS), end: isoDaysAgo(LAG_DAYS) },
    totals: queries.reduce((a, r) => ({ clicks: a.clicks + r.clicks, impressions: a.impressions + r.impressions }), { clicks: 0, impressions: 0 }),
    queries, pages, byQueryPage, dates, countries,
  };
  const dir = join(root, "data", "search-console");
  mkdirSync(dir, { recursive: true });
  const file = join(dir, `${out.window.end}.json`);
  writeFileSync(file, JSON.stringify(out, null, 1), "utf8");
  writeFileSync(join(dir, "latest.json"), JSON.stringify(out, null, 1), "utf8");
  console.log(`${out.window.start} to ${out.window.end}: ${out.totals.clicks} clicks, ${out.totals.impressions} impressions`);
  console.log(`${queries.length} queries, ${pages.length} pages, written to data/search-console/${out.window.end}.json`);
}

// Importable for the signing test without firing a request.
if (process.argv[1] && process.argv[1].endsWith("search-console.mjs")) await main();
