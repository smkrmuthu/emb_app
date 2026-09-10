// Minimal service worker for installability ("Add to Home Screen") and a bit
// of resilience against flaky connections — not a real offline mode, since
// bill scanning always needs the network to reach the LLM worker anyway.
//
// Network-first: always tries the network first (so a fresh deploy is never
// masked by a stale cached bundle), only falling back to the cache when the
// network request actually fails.
// Relative to the service worker's own scope (its directory) — NOT the
// domain root. This app is deployed both at a domain root (Cloudflare) and
// under a subpath (GitHub Pages, /emb_app/), so an absolute leading-slash
// path here would silently 404 under the subpath deployment.
const CACHE_NAME = 'emb-shell-v1';
const CORE_ASSETS = ['./', './index.html', './manifest.json'];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(CORE_ASSETS).catch(() => {}))
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  // Only handle same-origin GET requests for the app shell itself — never
  // the LLM scan API (a different origin entirely) or any POST/PUT call.
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) {
    return;
  }

  event.respondWith(
    fetch(request)
      .then((response) => {
        const copy = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(request, copy)).catch(() => {});
        return response;
      })
      .catch(() => caches.match(request).then((cached) => cached || caches.match('./index.html')))
  );
});
