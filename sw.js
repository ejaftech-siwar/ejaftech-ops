// Girêk — Service Worker
// EJAF Technology — Operations Department
// This file MUST sit next to index.html on the server (same folder),
// alongside: theme.css, app.css, pwa-manifest.js, firebase-init.js, app.js

const CACHE = 'ejaftech-v145';

// Everything needed to cold-start with no network. The Firebase SDK files are
// immutable, version-pinned URLs — caching them is what makes offline launch
// possible at all; without them the module imports fail and nothing boots.
const SHELL = [
  './', './index.html', './theme.css', './app.css', './firebase-init.js', './pwa-manifest.js',
  './01-core.js','./02-report-engine.js','./03-dashboard-logs.js','./04-reports.js',
  './05-assets.js','./06-database.js','./07-instructions.js','./08-clients.js',
  './09-tasks-requests.js','./10-integrations.js','./11-settings.js','./12-exports.js',
  'https://www.gstatic.com/firebasejs/10.13.1/firebase-app.js',
  'https://www.gstatic.com/firebasejs/10.13.1/firebase-auth.js',
  'https://www.gstatic.com/firebasejs/10.13.1/firebase-firestore.js',
];
self.addEventListener('install', (e) => {
  // NOTE (v90): no skipWaiting here. The new version WAITS until the user taps
  // "Update now" in the in-app banner — no surprise reloads mid-work.
  e.waitUntil(
    caches.open(CACHE).then(c =>
      // addAll is all-or-nothing, so warm them one by one: a single CDN hiccup
      // must not leave the whole shell uncached.
      Promise.all(SHELL.map(u => c.add(new Request(u, {cache:'reload'})).catch(()=>{})))
    )
  );
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
  // LIVE data + auth endpoints: always straight to the network, never cached.
  // (Firestore has its own IndexedDB cache and handles offline itself.)
  if (url.includes('firestore.googleapis.com') || url.includes('identitytoolkit') ||
      url.includes('securetoken') || url.includes('firebaseinstallations') ||
      url.includes('google-analytics') || url.includes('firebaselogging')) {
    return;
  }
  // The Firebase SDK bundle and other CDN libraries are immutable, version-
  // pinned files. CACHE-FIRST so the app can boot and export with no network.
  if (url.includes('gstatic.com/firebasejs') || url.includes('cdnjs.cloudflare.com') ||
      url.includes('fonts.googleapis.com') || url.includes('fonts.gstatic.com') ||
      url.includes('cdn.jsdelivr.net') || url.includes('unpkg.com')) {
    e.respondWith(
      caches.match(e.request).then(hit => hit || fetch(e.request).then(resp => {
        if (resp && resp.status === 200) {
          const copy = resp.clone();
          caches.open(CACHE).then(c => c.put(e.request, copy));
        }
        return resp;
      }).catch(() => hit))
    );
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
      // cache:'no-store' bypasses the BROWSER's own HTTP cache (not just the
      // Cache API) — without this, GitHub Pages' Cache-Control headers let the
      // browser serve a stale file straight from disk, so "network-first"
      // wasn't actually reaching the network. This is why Update-now needed a
      // manual cache clear before.
      fetch(e.request, {cache: 'no-store'}).then(resp => {
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

// Activate only when the page asks (user tapped the Update banner)
self.addEventListener('message',(e)=>{
  if(e && e.data==='SKIP_WAITING') self.skipWaiting();
});

// Tap on a system notification → focus the app (or open it)
self.addEventListener('notificationclick',(e)=>{
  e.notification.close();
  e.waitUntil(clients.matchAll({type:'window',includeUncontrolled:true}).then(list=>{
    for(const c of list){ if('focus' in c) return c.focus(); }
    return clients.openWindow('./');
  }));
});
