// Operation Department Track — Service Worker
// EJAF Technology — Operations Department
// This file MUST sit next to index.html on the server (same folder).
// Android Chrome requires a real same-origin service worker to offer full "Install app".

const CACHE = 'ejaftech-v3';

self.addEventListener('install', (e) => {
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (e) => {
  // Never cache Firebase / Google API calls — always go to network
  if (e.request.url.includes('firebase') ||
      e.request.url.includes('googleapis') ||
      e.request.url.includes('gstatic')) {
    return;
  }
  e.respondWith(
    caches.match(e.request).then((r) =>
      r || fetch(e.request).then((resp) => {
        if (e.request.url.startsWith(self.location.origin)) {
          const c = resp.clone();
          caches.open(CACHE).then((ca) => ca.put(e.request, c));
        }
        return resp;
      }).catch(() => caches.match('./'))
    )
  );
});
