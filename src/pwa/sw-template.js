// SEED.html service worker — offline app shell.
//
// This file is the SOURCE. The build (`emit-service-worker` plugin in
// vite.config.ts) stamps a per-build cache id into the version placeholder below
// and emits the result to dist/sw.js. Do not edit dist/sw.js directly.
//
// The whole app is inlined into a single index.html (viteSingleFile), so the
// "shell" to cache is just the document plus the manifest, icons, and the runtime
// scripts served separately from public/.

const CACHE_VERSION = '__SW_VERSION__';
const CACHE_NAME = `seed-shell-${CACHE_VERSION}`;

const PRECACHE_URLS = [
  '/',
  '/manifest.webmanifest',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/icon-512-maskable.png',
  '/icons/apple-touch-icon.png',
  '/paged.polyfill.js',
  '/axe.min.js',
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith('seed-shell-') && key !== CACHE_NAME)
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return; // leave cross-origin requests alone

  // App-shell navigation (the SPA root only): network-first (fresh when online),
  // falling back to the cached shell offline. Refresh the cached shell on success.
  //
  // Crucially, ONLY the root path is treated as the shell. Plugin views load their
  // own HTML document in an iframe (e.g. /plugins/<id>/plugin.html) — also a
  // `navigate` request. Those must NOT overwrite the cached shell, or an offline
  // reload would serve the last-loaded plugin page instead of the app. They fall
  // through to the per-URL asset cache below and are served under their own URL.
  if (request.mode === 'navigate' && (url.pathname === '/' || url.pathname === '/index.html')) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put('/', copy));
          return response;
        })
        .catch(() => caches.match('/'))
    );
    return;
  }

  // Same-origin assets (and non-root navigations, e.g. plugin iframe documents):
  // stale-while-revalidate, cached under their own URL.
  event.respondWith(
    caches.open(CACHE_NAME).then(async (cache) => {
      const cached = await cache.match(request);
      const network = fetch(request)
        .then((response) => {
          if (response && response.ok && response.type === 'basic') {
            cache.put(request, response.clone());
          }
          return response;
        })
        .catch(() => cached);
      return cached || network;
    })
  );
});
