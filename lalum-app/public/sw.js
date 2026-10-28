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
// installed from an earlier visit. Only Vite's build assets under
// /assets/, which are content-hashed and therefore immutable under a given
// URL, are cached-first.

// Two caches, each with a version in its name and a cap on its size. The
// first worker only ever added to one cache ("lalum-runtime-v1"): every deploy
// brought new hashed assets and none was ever removed, so a returning visitor's
// cache only grew. Now activate deletes every cache this version does not own,
// and each put trims its cache to the newest entries. Bump the version when the
// caching rules change, and the old caches go with the next activation.
const ASSET_CACHE = "lalum-assets-v2";
const PAGE_CACHE = "lalum-pages-v2";
const KEEP = new Set([ASSET_CACHE, PAGE_CACHE]);
// A page needs a few dozen hashed files, so 120 holds the current build and the
// one before it; 30 navigations cover an offline fallback for recent pages.
const MAX_ASSETS = 120;
const MAX_PAGES = 30;

// Cache.keys() lists entries in insertion order, so the first ones are the oldest.
async function trim(cache, max) {
  const keys = await cache.keys();
  for (let i = 0; i < keys.length - max; i++) await cache.delete(keys[i]);
}

async function store(name, max, req, res) {
  const cache = await caches.open(name);
  await cache.put(req, res);
  await trim(cache, max);
}

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((names) => Promise.all(names.filter((n) => !KEEP.has(n)).map((n) => caches.delete(n))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);

  // Hashed build assets never change under the same URL: cache-first, with
  // the network as a fallback for anything not cached yet.
  if (url.origin === self.location.origin && url.pathname.startsWith("/assets/")) {
    event.respondWith(
      caches.open(ASSET_CACHE).then(async (cache) => {
        const cached = await cache.match(req);
        if (cached) return cached;
        const res = await fetch(req);
        // Clone before the response is handed back: once the page starts
        // reading the body, a clone taken later throws.
        if (res.ok) event.waitUntil(store(ASSET_CACHE, MAX_ASSETS, req, res.clone()));
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
          event.waitUntil(store(PAGE_CACHE, MAX_PAGES, req, res.clone()));
        }
        return res;
      })
      .catch(() => caches.match(req).then((cached) => cached || Response.error())),
  );
});
