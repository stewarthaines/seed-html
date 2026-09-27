// SEED.html service worker — offline app shell, and the served book.
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
// On the dev server the worker exists only to serve books (below): it neither
// precaches nor caches assets, which would fight Vite's module serving.
const DEV = CACHE_VERSION.startsWith('dev-');

// --- The served book -------------------------------------------------------
// `GET /__book/<workspace>/<path>` is answered by asking the app page(s) for
// the bytes over a message channel (src/lib/book-server/book-server.ts;
// process/PREVIEW_SERVED_BOOK.md). The worker holds nothing.
const BOOK_ROUTE = '/__book/';
const BOOK_REPLY_TIMEOUT_MS = 10000;

function parseBookRoute(pathname) {
  if (!pathname.startsWith(BOOK_ROUTE)) return null;
  const rest = pathname.slice(BOOK_ROUTE.length);
  const slash = rest.indexOf('/');
  if (slash <= 0) return null;
  const path = rest
    .slice(slash + 1)
    .split('/')
    .map(s => decodeURIComponent(s))
    .filter(s => s !== '' && s !== '.');
  if (path.some(s => s === '..')) return null;
  return { workspaceId: decodeURIComponent(rest.slice(0, slash)), path: path.join('/') };
}

// Ask every window client. The page holding the workspace answers `ok`, or
// "not found" when it holds the workspace but not the file; a page holding
// other books (the reader tab, another editor tab) answers "not mine"; a
// book's own frames never answer. The first `ok` wins. A "not found" settles
// a 404 after a short grace for another page to say `ok`, since silent
// frames would otherwise hold the answer until the timeout; "not mine" from
// every client settles a 404 at once; silence throughout is a 504.
const BOOK_NOT_FOUND_GRACE_MS = 400;
async function askPageForBookFile(workspaceId, path) {
  const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
  if (windows.length === 0) return { ok: false, status: 404 };
  return new Promise(resolve => {
    let settled = false;
    let grace = null;
    let notMine = 0;
    const settle = reply => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      clearTimeout(grace);
      resolve(reply);
    };
    const timer = setTimeout(() => settle({ ok: false, status: 504 }), BOOK_REPLY_TIMEOUT_MS);
    for (const client of windows) {
      const channel = new MessageChannel();
      channel.port1.onmessage = event => {
        const reply = event.data;
        if (reply && reply.ok) settle(reply);
        else if (reply && reply.reason === 'not-mine') {
          if (++notMine === windows.length) settle({ ok: false, status: 404 });
        } else if (grace === null) {
          grace = setTimeout(() => settle({ ok: false, status: 404 }), BOOK_NOT_FOUND_GRACE_MS);
        }
      };
      try {
        client.postMessage({ type: 'book-file', workspaceId, path }, [channel.port2]);
      } catch {
        // A client that cannot be reached is one that will not answer.
      }
    }
  });
}

// A Range request (media) gets the slice with a 206; anything else the whole
// file. WebKit refuses to play media from a server that ignores Range.
function bookFileResponse(request, reply) {
  if (!reply.ok)
    return new Response('', {
      status: reply.status,
      statusText: reply.status === 404 ? 'Not Found' : 'Book unavailable',
    });
  const bytes = reply.bytes;
  const total = bytes.byteLength;
  const headers = {
    'Content-Type': reply.contentType || 'application/octet-stream',
    'Accept-Ranges': 'bytes',
    'Cache-Control': 'no-store',
  };
  const range = request.headers.get('Range');
  const match = range && /^bytes=(\d*)-(\d*)$/.exec(range);
  if (match && (match[1] !== '' || match[2] !== '')) {
    let start = match[1] === '' ? Math.max(0, total - Number(match[2])) : Number(match[1]);
    let end =
      match[1] === ''
        ? total - 1
        : match[2] === ''
          ? total - 1
          : Math.min(Number(match[2]), total - 1);
    if (start > end || start >= total) {
      return new Response('', { status: 416, headers: { 'Content-Range': `bytes */${total}` } });
    }
    return new Response(bytes.slice(start, end + 1), {
      status: 206,
      headers: {
        ...headers,
        'Content-Range': `bytes ${start}-${end}/${total}`,
        'Content-Length': String(end - start + 1),
      },
    });
  }
  return new Response(bytes, {
    status: 200,
    headers: { ...headers, 'Content-Length': String(total) },
  });
}

const PRECACHE_URLS = [
  // The app document. The bare origin '/' redirects here (public/_redirects) and
  // must NOT be precached: cache.addAll rejects redirected responses, which
  // would fail the whole install.
  '/SEED.html',
  '/manifest.webmanifest',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/icon-512-maskable.png',
  '/icons/apple-touch-icon.png',
  '/paged.polyfill.js',
  '/axe.min.js',
  // Lazy-loaded into the preview realm on demand, like axe — precached so the
  // first announcement walk works offline rather than only after one online use.
  '/sr-preview/virtual-screen-reader.js',
  // The reader engine behind the reader-engine preview surface. view.js is the
  // entry; the rest are its static imports plus the two renderers it picks
  // between at runtime — a session that only ever paginates would otherwise
  // never warm fixed-layout.js, and vice versa.
  '/foliate/view.js',
  '/foliate/epubcfi.js',
  '/foliate/overlayer.js',
  '/foliate/progress.js',
  '/foliate/text-walker.js',
  '/foliate/paginator.js',
  '/foliate/fixed-layout.js',
  // The reader template "package as READ" fetches to build an export. This is
  // the asset; /READ.html is the Pages Function that serves it at its branded
  // URL and is not ours to cache.
  '/read/READ.html',
  '/xml-tree-viewer/xml-tree-viewer.js',
  '/xml-tree-viewer/xml-tree-viewer.css',
  // The bridge speaks to a localhost websocket, so losing the network doesn't
  // disable it — only failing to fetch its own module would. cuelume is a
  // static import of module.js.
  '/agent-bridge/module.js',
  '/agent-bridge/cuelume.js',
];

self.addEventListener('install', event => {
  if (!DEV) event.waitUntil(precache());
  self.skipWaiting();
});

async function precache() {
  const cache = await caches.open(CACHE_NAME);
  // The shell is mandatory — let a failure fail the install rather than activate a
  // broken offline app.
  await cache.addAll(PRECACHE_URLS);
  // Extensions + the discovery catalogs: best-effort. The list is generated by the
  // build (dist/precache-manifest.json) after the extension files exist, and fetched
  // here so the SW needn't know the build layout. A missing list (a host-only build
  // without `build:plugins`) or an individual 404 must not abort the install — those
  // resources simply fall back to cache-on-use.
  try {
    const res = await fetch('precache-manifest.json', { cache: 'no-cache' });
    if (res.ok) {
      const urls = await res.json();
      if (Array.isArray(urls)) {
        await Promise.all(
          urls.map(url =>
            cache.add(url).catch(() => {
              /* best-effort: skip any entry that fails (e.g. a 404) */
            })
          )
        );
      }
    }
  } catch {
    // No build-generated list — nothing extra to precache.
  }
}

self.addEventListener('activate', event => {
  event.waitUntil(
    caches
      .keys()
      .then(keys =>
        Promise.all(
          keys
            .filter(key => key.startsWith('seed-shell-') && key !== CACHE_NAME)
            .map(key => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return; // leave cross-origin requests alone

  // The served book, in every mode. The `_` workspace holds the empty frame
  // document the preview starts its iframe on (see book-server.ts).
  const book = parseBookRoute(url.pathname);
  if (book && book.workspaceId === '_') {
    event.respondWith(
      new Response('<!DOCTYPE html><html><head></head><body></body></html>', {
        headers: { 'Content-Type': 'text/html', 'Cache-Control': 'no-store' },
      })
    );
    return;
  }
  if (book) {
    event.respondWith(
      askPageForBookFile(book.workspaceId, book.path).then(reply =>
        bookFileResponse(request, reply)
      )
    );
    return;
  }
  if (DEV) return; // nothing else is the worker's business on the dev server

  // App-shell navigation (/SEED.html is the app; '/' and '/index.html' redirect
  // to it): network-first (fresh when online), falling back to the cached shell
  // offline. Refresh the cached shell on success.
  //
  // Crucially, ONLY these paths are treated as the shell. Plugin views load their
  // own HTML document in an iframe (e.g. /plugins/<id>/plugin.html) — also a
  // `navigate` request. Those must NOT overwrite the cached shell, or an offline
  // reload would serve the last-loaded plugin page instead of the app. They fall
  // through to the per-URL asset cache below and are served under their own URL.
  if (
    request.mode === 'navigate' &&
    (url.pathname === '/' || url.pathname === '/index.html' || url.pathname === '/SEED.html')
  ) {
    event.respondWith(
      fetch(request)
        .then(response => {
          // Only a direct /SEED.html load refreshes the cached shell. A '/'
          // navigation arrives here as a followed redirect, and the Cache API
          // refuses to serve redirected responses to later navigations — caching
          // one would break offline boot.
          if (url.pathname === '/SEED.html' && !response.redirected) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put('/SEED.html', copy));
          }
          return response;
        })
        .catch(() => caches.match('/SEED.html'))
    );
    return;
  }

  // Same-origin assets (and non-root navigations, e.g. plugin iframe documents):
  // stale-while-revalidate, cached under their own URL.
  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      const cached = await cache.match(request);
      const fetchAndCache = fetch(request).then(response => {
        if (response && response.ok && response.type === 'basic') {
          cache.put(request, response.clone());
        }
        return response;
      });
      if (cached) {
        // Stale-while-revalidate: refresh in the background; offline failures are fine.
        fetchAndCache.catch(() => {
          /* ignore background refresh errors */
        });
        return cached;
      }
      try {
        return await fetchAndCache;
      } catch {
        // Offline and uncached: return a real error Response (never null) so
        // respondWith always resolves to a Response — this avoids a "Returned
        // response is null" console error and, for an iframe navigation, still fires
        // `load` so the host's fallback detector trips promptly.
        return new Response('', { status: 504, statusText: 'Offline' });
      }
    })()
  );
});
