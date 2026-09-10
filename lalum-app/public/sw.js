// Minimal service worker for the LALUM PWA.
//
// Its whole job is to exist: Chrome/Edge only fire beforeinstallprompt (the
// one-tap "Install app" prompt, in the header and in the footer download
// band) for a page that has a registered service worker with a fetch
// handler. Before this file, the manifest was already correct, so the
// install buttons rendered but nothing ever happened when a Chrome/Edge
// desktop visitor clicked "Install the app": the browser never considered
// the site installable, so canInstall in useInstall() (AppInstall.tsx) was
// permanently false and the native prompt never had a reason to fire.
//
// This is a fast-moving content site (multiple deploys a day, see
// CLAUDE.md), so correctness beats offline caching: navigations are
// network-first, never served stale just because a visitor has this worker
// installed from an earlier visit. Only versioned, effectively-immutable
// same-origin paths are cached-first: Vite's build assets under /assets/
// (content-hashed), Cloudflare's Rocket Loader bootstrap under
// /cdn-cgi/scripts/, and the webfont files it serves under /cf-fonts/.
//
// Rocket Loader is not optional infrastructure here: the site runs it
// (Cloudflare dashboard setting, outside this repo), and it rewrites every
// <script type="module"> tag's type attribute before the browser sees it,
// so NOTHING in /assets/ — React included — ever executes until Rocket
// Loader's own script has run and un-mangled those tags. Caching only
// /assets/ and leaving the loader itself to always hit the network meant
// an offline visitor could get a cached HTML shell whose scripts never run:
// a blank page, the exact opposite of "feels like an app". Cache-first for
// its bootstrap script (and the fonts it proxies, same reasoning) closes
// that gap; /cdn-cgi/challenge-platform/ (Cloudflare's bot-challenge
// script) is deliberately left alone — always network, never cached.
const CACHE_FIRST_PREFIXES = ["/assets/", "/cdn-cgi/scripts/", "/cf-fonts/"];

const RUNTIME_CACHE = "lalum-runtime-v1";

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);

  // Versioned/hashed paths never change under the same URL: cache-first,
  // with the network as a fallback for anything not cached yet.
  if (url.origin === self.location.origin && CACHE_FIRST_PREFIXES.some((p) => url.pathname.startsWith(p))) {
    event.respondWith(
      caches.open(RUNTIME_CACHE).then(async (cache) => {
        const cached = await cache.match(req);
        if (cached) return cached;
        const res = await fetch(req);
        if (res.ok) cache.put(req, res.clone());
        return res;
      }),
    );
    return;
  }

  // Everything else (HTML pages, API calls): network-first. A deploy is
  // never masked by a stale cached page; the cache only steps in when the
  // network request itself fails (offline, or a dropped connection).
  event.respondWith(
    fetch(req)
      .then((res) => {
        if (res.ok && req.mode === "navigate") {
          caches.open(RUNTIME_CACHE).then((cache) => cache.put(req, res.clone()));
        }
        return res;
      })
      .catch(() => caches.match(req).then((cached) => cached || Response.error())),
  );
});
