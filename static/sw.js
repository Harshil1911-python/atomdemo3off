/* Atom Bills — offline-first (cache always wins; Render only if cache miss) */
const VER = 'atom-bills-offline-v40';
const ASSETS = [
  '/',
  '/?source=pwa',
  '/billing',
  '/proprietor',
  '/calculator',
  '/accountant',
  '/static/common.css',
  '/static/common.css?v=23',
  '/static/common.js',
  '/static/xlsx.full.min.js',
  '/static/billing-pos.js',
  '/static/db.js',
  '/static/common.js?v=23',
  '/static/proprietor-extra.js',
  '/static/manifest.webmanifest',
  '/manifest.webmanifest',
  '/static/icon-192.png',
  '/static/icon-512.png',
  '/static/icon-192-maskable.png',
  '/static/icon-512-maskable.png',
  '/static/logo.png',
  '/static/logo-white.png',
  '/static/logo-header.png',
  '/static/sounds/beep.mp3',
  '/sw.js'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(VER)
      .then(c => Promise.all(ASSETS.map(u => c.add(u).catch(() => {}))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== VER).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('message', e => {
  if (e.data && e.data.type === 'SKIP_WAITING') self.skipWaiting();
  if (e.data && e.data.type === 'CACHE_STATUS') {
    caches.open(VER).then(c => c.keys()).then(keys => {
      e.ports && e.ports[0] && e.ports[0].postMessage({ count: keys.length, ver: VER });
    });
  }
});

// CACHE-FIRST always — Wi‑Fi ON does not force network for app shell
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  if (url.origin !== self.location.origin) return; // leave CDN alone

  // Never cache API — but this app has no required APIs
  if (url.pathname.startsWith('/api/')) {
    e.respondWith(fetch(e.request).catch(() => new Response(JSON.stringify({ offline: true }), { headers: { 'Content-Type': 'application/json' } })));
    return;
  }

  const isNav = e.request.mode === 'navigate' ||
    ['/', '/billing', '/proprietor', '/calculator', '/accountant'].includes(url.pathname);

  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) {
        // Background refresh only for shell updates (optional); do not block UI
        if (!isNav) {
          fetch(e.request).then(r => {
            if (r && r.ok) caches.open(VER).then(c => c.put(e.request, r.clone()));
          }).catch(() => {});
        }
        return cached;
      }
      return fetch(e.request).then(r => {
        if (r && r.ok) {
          const clone = r.clone();
          caches.open(VER).then(c => {
            c.put(e.request, clone);
            if (isNav) {
              c.put('/', r.clone()).catch(() => {});
              c.put('/?source=pwa', r.clone()).catch(() => {});
            }
          });
        }
        return r;
      }).catch(() => {
        if (isNav) {
          return caches.match('/') || caches.match('/?source=pwa') || caches.match('/billing') ||
            new Response('<h1>Offline</h1><p>Open once online to cache the app.</p>', { headers: { 'Content-Type': 'text/html' } });
        }
        return new Response('', { status: 503, statusText: 'Offline' });
      });
    })
  );
});
