// LALUM service worker.
//
// Purpose: make the site an installable Progressive Web App (a real install
// prompt on Android and desktop Chrome, and the prerequisite for the Google
// Play TWA and the iOS wrapper), plus a graceful offline screen. It is written
// to be update safe on a site that deploys often:
//
//   - Page navigations are network first, so an online visitor always gets the
//     freshly deployed HTML, never a stale cached page. Only when the network
//     fails do they get the cached offline screen.
//   - Static build assets under /assets/ are content hashed by Vite, so their
//     URL changes on every deploy. They are cache first (immutable), and a new
//     deploy simply caches the new hashed files; the old cache is purged on the
//     next activate.
//   - Supabase, payments, and any cross origin request are never touched by the
//     cache: they always go straight to the network.
//
// Bump CACHE_VERSION only when this file's caching logic changes. It does not
// need bumping per content deploy, because navigations are network first and
// assets are hashed.

const CACHE_VERSION = "lalum-v1";
const OFFLINE_URL = "/offline.html";

// Precache just the offline fallback and the app icons, nothing that goes stale.
const PRECACHE = [OFFLINE_URL, "/manifest.webmanifest", "/icon-192.png", "/icon-512.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => cache.addAll(PRECACHE)).then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

function isHashedAsset(url) {
  // Vite emits build files under /assets/ with a content hash in the name.
  return url.origin === self.location.origin && url.pathname.startsWith("/assets/");
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);

  // Only same origin is cached. Everything cross origin (Supabase, fonts,
  // payments, widgets) goes straight to the network, untouched.
  if (url.origin !== self.location.origin) return;

  // Page navigations: network first, offline screen as the fallback.
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req).catch(() => caches.match(OFFLINE_URL).then((r) => r || Response.error())),
    );
    return;
  }

  // Immutable hashed build assets: cache first.
  if (isHashedAsset(url)) {
    event.respondWith(
      caches.match(req).then((cached) =>
        cached ||
        fetch(req).then((res) => {
          if (res && res.ok) {
            const copy = res.clone();
            caches.open(CACHE_VERSION).then((cache) => cache.put(req, copy));
          }
          return res;
        }),
      ),
    );
    return;
  }

  // Other same origin GETs (icons, manifest, static files): stale while
  // revalidate, so they are fast but still refresh in the background.
  event.respondWith(
    caches.match(req).then((cached) => {
      const network = fetch(req)
        .then((res) => {
          if (res && res.ok) {
            const copy = res.clone();
            caches.open(CACHE_VERSION).then((cache) => cache.put(req, copy));
          }
          return res;
        })
        .catch(() => cached);
      return cached || network;
    }),
  );
});
