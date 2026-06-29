// Operation Department Track — Service Worker
// EJAF Technology — Operations Department
// This file MUST sit next to index.html on the server (same folder).

const CACHE = 'ejaftech-v34';

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
  // Never cache Firebase / Google API calls
  if (e.request.url.includes('firebase') ||
      e.request.url.includes('googleapis') ||
      e.request.url.includes('gstatic')) {
    return;
  }
  // NETWORK-FIRST for navigation/HTML (always get the latest app version)
  if (e.request.mode === 'navigate' ||
      e.request.destination === 'document' ||
      e.request.url.endsWith('/') ||
      e.request.url.includes('index.html')) {
    e.respondWith(
      fetch(e.request).then(resp => {
        const c = resp.clone();
        caches.open(CACHE).then(ca => ca.put(e.request, c));
        return resp;
      }).catch(() => caches.match(e.request).then(r => r || caches.match('./')))
    );
    return;
  }
  // CACHE-FIRST for other assets (fonts, etc.)
  e.respondWith(
    caches.match(e.request).then(r =>
      r || fetch(e.request).then(resp => {
        if (e.request.url.startsWith(self.location.origin)) {
          const c = resp.clone();
          caches.open(CACHE).then(ca => ca.put(e.request, c));
        }
        return resp;
      }).catch(() => caches.match('./'))
    )
  );
});
