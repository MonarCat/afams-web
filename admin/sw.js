/* Afams admin / POS service worker
 * Purpose: make the admin installable as an app and let the shell open quickly.
 * It deliberately does NOT cache anything dynamic: Supabase, Paystack, fonts and CDN
 * scripts are cross-origin and are left completely alone, so payment and stock data
 * are never served stale. Sales need a connection — the Shop tab says so when offline.
 * Bump CACHE when shipping shell changes you need clients to pick up immediately.
 */
const CACHE = 'afams-admin-v1';
const SHELL = [
  './',
  './manifest.webmanifest',
  './icons/icon-192.png',
  '../assets/js/pos-print.js',
  '../assets/images/afams_favicon_32.png'
];

self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(CACHE).then(function (cache) {
      // Add individually so one missing file doesn't abort the install.
      return Promise.all(SHELL.map(function (url) { return cache.add(url).catch(function () {}); }));
    }).then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (event) {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // never touch Supabase / Paystack / CDNs

  // Page loads: network first (always the latest admin), cached shell only if offline.
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req).then(function (res) {
        const copy = res.clone();
        caches.open(CACHE).then(function (c) { c.put(req, copy); });
        return res;
      }).catch(function () {
        return caches.match(req).then(function (hit) { return hit || caches.match('./'); });
      })
    );
    return;
  }

  // Static same-origin assets: serve from cache, refresh in the background.
  event.respondWith(
    caches.match(req).then(function (hit) {
      const refresh = fetch(req).then(function (res) {
        if (res && res.ok) { const copy = res.clone(); caches.open(CACHE).then(function (c) { c.put(req, copy); }); }
        return res;
      }).catch(function () { return hit || Response.error(); });
      return hit || refresh;
    })
  );
});
