/* Atom Bills SPA — full offline */
const VER = 'atom-bills-offline-v25';
const ASSETS = [
  '/',
  '/billing',
  '/proprietor',
  '/calculator',
  '/accountant',
  '/static/common.css',
  '/static/common.css?v=23',
  '/static/common.js',
  '/static/common.js?v=23',
  '/static/proprietor-extra.js',
  '/static/manifest.webmanifest',
  '/manifest.webmanifest',
  '/static/icon-192.png',
  '/static/icon-512.png',
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

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;

  const url = new URL(e.request.url);
  // only same-origin
  if (url.origin !== self.location.origin) {
    // try network for CDN (sheetjs); offline will fail gracefully
    return;
  }

  const path = url.pathname;
  const isStatic = path.startsWith('/static/') || path === '/sw.js' ||
    path.includes('manifest') || path.includes('icon') || path.includes('logo') || path.includes('beep');
  const isNav = e.request.mode === 'navigate' ||
    path === '/' || path === '/billing' || path === '/proprietor' ||
    path === '/calculator' || path === '/accountant';

  // Static: cache-first
  if (isStatic) {
    e.respondWith(
      caches.match(e.request).then(cached => {
        if (cached) return cached;
        return fetch(e.request).then(r => {
          if (r && r.ok) {
            const clone = r.clone();
            caches.open(VER).then(c => c.put(e.request, clone));
          }
          return r;
        }).catch(() => caches.match(e.request));
      })
    );
    return;
  }

  // Navigation / HTML: network-first, fall back to any cached SPA shell
  if (isNav) {
    e.respondWith(
      fetch(e.request)
        .then(r => {
          if (r && r.ok) {
            const clone = r.clone();
            caches.open(VER).then(c => {
              c.put(e.request, clone);
              c.put('/', r.clone()).catch(() => {});
            });
          }
          return r;
        })
        .catch(() =>
          caches.match(e.request)
            .then(c => c || caches.match('/') || caches.match('/billing'))
        )
    );
    return;
  }

  // Default: cache-first then network
  e.respondWith(
    caches.match(e.request).then(c => c || fetch(e.request).then(r => {
      if (r && r.ok) {
        const clone = r.clone();
        caches.open(VER).then(cache => cache.put(e.request, clone));
      }
      return r;
    }).catch(() => caches.match('/')))
  );
});
