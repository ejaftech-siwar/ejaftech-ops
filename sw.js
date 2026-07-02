// Girêk — Service Worker
// EJAF Technology — Operations Department
// This file MUST sit next to index.html on the server (same folder),
// alongside: theme.css, app.css, pwa-manifest.js, firebase-init.js, app.js

const CACHE = 'ejaftech-v50';

self.addEventListener('install', (e) => {
  self.skipWaiting();  // activate new version immediately
});

self.addEventListener('activate', (e) => {
  // Delete ALL old caches so users always get the latest version
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const url = e.request.url;
  // Never cache Firebase / Google API calls
  if (url.includes('firebase') || url.includes('googleapis') || url.includes('gstatic')) {
    return;
  }
  // Our own split JS/CSS (same-origin) — treat like the app shell
  const sameOrigin = url.startsWith(self.location.origin);
  const isAppAsset = sameOrigin && (url.includes('.js') || url.includes('.css'));
  // NETWORK-FIRST for HTML navigation AND our own JS/CSS (always get the latest)
  if (e.request.mode === 'navigate' ||
      e.request.destination === 'document' ||
      url.endsWith('/') ||
      url.includes('index.html') ||
      isAppAsset) {
    e.respondWith(
      fetch(e.request).then(resp => {
        const c = resp.clone();
        caches.open(CACHE).then(ca => ca.put(e.request, c));
        return resp;
      }).catch(() => caches.match(e.request).then(r => r || caches.match('./')))
    );
    return;
  }
  // CACHE-FIRST for other assets (fonts, CDN libraries)
  e.respondWith(
    caches.match(e.request).then(r =>
      r || fetch(e.request).then(resp => {
        if (sameOrigin) {
          const c = resp.clone();
          caches.open(CACHE).then(ca => ca.put(e.request, c));
        }
        return resp;
      }).catch(() => caches.match('./'))
    )
  );
});
