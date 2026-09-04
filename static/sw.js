/* Atom Bills — offline-first PWA */
const VER = 'atom-bills-offline-v26';
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

// OFFLINE-FIRST: always prefer cache when present (even with internet)
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;

  const url = new URL(e.request.url);
  if (url.origin !== self.location.origin) return;

  const path = url.pathname;
  const isNav = e.request.mode === 'navigate' ||
    path === '/' || path === '/billing' || path === '/proprietor' ||
    path === '/calculator' || path === '/accountant';

  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) {
        // revalidate in background (stale-while-revalidate)
        fetch(e.request).then(r => {
          if (r && r.ok) {
            caches.open(VER).then(c => c.put(e.request, r.clone()));
          }
        }).catch(() => {});
        return cached;
      }
      return fetch(e.request).then(r => {
        if (r && r.ok) {
          const clone = r.clone();
          caches.open(VER).then(c => {
            c.put(e.request, clone);
            if (isNav) c.put('/', r.clone()).catch(() => {});
          });
        }
        return r;
      }).catch(() => {
        if (isNav) {
          return caches.match('/') || caches.match('/billing') || caches.match('/?source=pwa');
        }
        return caches.match(e.request);
      });
    })
  );
});
