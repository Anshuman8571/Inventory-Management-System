// Service worker for offline support.
//
// Scope, honestly: this app's core actions (scanning a sticker, reading a bill)
// call an AI-backed API and genuinely need a connection — there's no offline
// equivalent to fake. What CAN work offline, and what this worker does:
//   1. The app shell (HTML/CSS/JS) loads even with no signal, instead of a blank
//      white screen — useful in a warehouse with patchy coverage.
//   2. The last successful /products and /reports/summary responses are cached,
//      so "View Inventory Dashboard" / "View Reports" still show the last-known
//      numbers offline, clearly labeled as such by the app (see api.js/offline.js)
//      rather than silently going stale.
// Anything that writes data (login, /scan, /bills, confirm) is never cached and
// is left to fail with a clear error — caching a write and "pretending" it
// succeeded would risk silent data loss when it never actually reached the server.

const SHELL_CACHE = 'stock-inventory-shell-v1';
const DATA_CACHE = 'stock-inventory-data-v1';

const SHELL_ASSETS = [
  'index.html',
  'manifest.json',
  'src/styles.css',
  'src/api.js',
  'src/nav.js',
  'src/camera.js',
  'src/categorySelect.js',
  'src/confirmCard.js',
  'src/scan.js',
  'src/billFlow.js',
  'src/home.js',
  'src/dashboard.js',
  'src/reportsView.js',
  'src/auth.js',
];

// Read-only endpoints worth serving from cache when offline. Matched by pathname
// suffix so this works whether the API is same-origin or on a separate host.
const CACHEABLE_GET_PATHS = ['/products', '/reports/summary'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then((cache) => cache.addAll(SHELL_ASSETS)).catch(() => {
      // Don't block install if e.g. icons/assets are missing — shell caching is
      // best-effort, not a hard requirement for the app to keep working online.
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== SHELL_CACHE && key !== DATA_CACHE)
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

function isCacheableGet(request) {
  if (request.method !== 'GET') return false;
  const url = new URL(request.url);
  return CACHEABLE_GET_PATHS.some((path) => url.pathname === path || url.pathname.endsWith(path));
}

self.addEventListener('fetch', (event) => {
  const { request } = event;

  if (isCacheableGet(request)) {
    // Network-first: always prefer live data when online, but fall back to the
    // last cached copy (and refresh the cache on success) when offline.
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(DATA_CACHE).then((cache) => cache.put(request, copy));
          return response;
        })
        .catch(() => caches.match(request))
    );
    return;
  }

  // App shell: cache-first so the UI itself loads instantly and works offline.
  if (request.method === 'GET' && new URL(request.url).origin === self.location.origin) {
    event.respondWith(
      caches.match(request).then((cached) => cached || fetch(request))
    );
  }
  // Everything else (auth, scan, bills, confirm) — let it hit the network
  // normally; these are writes and shouldn't be served from or saved to cache.
});