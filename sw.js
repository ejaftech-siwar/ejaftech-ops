// Girêk — Service Worker
// EJAF Technology — Operations Department
// This file MUST sit next to index.html on the server (same folder),
// alongside: theme.css, app.css, pwa-manifest.js, firebase-init.js, app.js

const CACHE = 'ejaftech-v197';

// Everything needed to cold-start with no network. The Firebase SDK files are
// immutable, version-pinned URLs — caching them is what makes offline launch
// possible at all; without them the module imports fail and nothing boots.
const SHELL = [
  './', './index.html', './manifest.json', './theme.css', './app.css', './firebase-init.js', './pwa-manifest.js',
  './01-core.js','./02-report-engine.js','./03-dashboard-logs.js','./04-reports.js',
  './05-assets.js','./06-database.js','./07-instructions.js','./08-clients.js',
  './09-tasks-requests.js','./10-integrations.js','./11-settings.js','./12-exports.js','./13-fieldops.js','./14-finance.js','./15-invoicing.js','./16-advances.js',
  // If these exist in the repo they are precached and offline launch is
  // guaranteed; if not, the .catch() below simply skips them.
  './sdk/firebase-app.js','./sdk/firebase-auth.js','./sdk/firebase-firestore.js',
  'https://www.gstatic.com/firebasejs/10.13.1/firebase-app.js',
  'https://www.gstatic.com/firebasejs/10.13.1/firebase-auth.js',
  'https://www.gstatic.com/firebasejs/10.13.1/firebase-firestore.js',
  // Export libraries. Not needed to LAUNCH, but without them Excel, PDF and QR
  // quietly stop working the moment there is no signal — precaching them keeps
  // the whole app usable in the field, not just the parts that read data.
  'https://cdn.jsdelivr.net/npm/xlsx-js-style@1.2.0/dist/xlsx.bundle.js',
  'https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js',
  'https://cdn.jsdelivr.net/npm/jspdf-autotable@3.8.0/dist/jspdf.plugin.autotable.min.js',
  'https://cdn.jsdelivr.net/npm/qrcodejs@1.0.0/qrcode.min.js',
  'https://cdn.jsdelivr.net/npm/@emailjs/browser@4/dist/email.min.js',
  'https://unpkg.com/@zxing/library@0.21.3/umd/index.min.js',
];
self.addEventListener('install', (e) => {
  // NOTE (v90): no blanket skipWaiting — the new version waits for "Update now"
  // so nobody gets a surprise reload mid-work.
  //
  // BUT (v151): waiting also meant the PREVIOUS worker stayed in control, and
  // an older worker knows nothing about ./sdk/ — so those files were never
  // cached and the offline cold start kept failing even though the folder was
  // deployed correctly. When there is no controller yet (a genuinely fresh
  // install) there is no work to interrupt, so we take over at once.
  e.waitUntil((async () => {
    const clients = await self.clients.matchAll();
    if (!clients.length) { try { await self.skipWaiting(); } catch (_) {} }
  })());
  e.waitUntil(
    caches.open(CACHE).then(c =>
      // addAll is all-or-nothing, so warm them one by one: a single CDN hiccup
      // must not leave the whole shell uncached.
      //
      // cache.add() REJECTS opaque responses, which is what a cross-origin CDN
      // returns without CORS — so the SDK was silently never precached. fetch +
      Promise.all(SHELL.map(async (u) => {
        try {
          const r = await fetch(u, {cache:'reload'});
          if (r && r.ok && r.type !== 'opaque') { await c.put(u, r.clone()); return; }
        } catch (e) {}
        // NO no-cors fallback here: an opaque response is REJECTED by the ES
        // module loader, so caching one would guarantee the offline import
        // fails. Better an empty slot than a poisoned one.
      }))
    )
  );
});

self.addEventListener('activate', (e) => {
  // Delete ALL old caches so users always get the latest version
  e.waitUntil(
    caches.keys().then(keys =>
      // Keep the SDK mirror: it is version-pinned, costly to rebuild, and wiping
      // it on every upgrade would silently break offline launch all over again.
      Promise.all(keys.filter(k => k !== CACHE && k !== 'ejaftech-sdk-mirror')
                      .map(k => caches.delete(k)))
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
  // ── SDK PROXY ──────────────────────────────────────────────────────────
  // The page imports ./sdk-mirror/<ver>/<file>. That is same-origin, so the ES
  // module loader has no CORS requirement to fail on. We fetch the real bytes
  // from the CDN once, re-serve them under our own origin, and cache them.
  // Every previous attempt failed because the page imported the CROSS-ORIGIN
  // url directly: cached without CORS it becomes an opaque response, and the
  // module loader refuses to execute an opaque module.
  const mirror = url.match(/\/sdk-mirror\/([\d.]+)\/(firebase-[a-z]+\.js)$/);
  if (mirror) {
    e.respondWith((async () => {
      const c = await caches.open('ejaftech-sdk-mirror');
      const hit = await c.match(e.request.url);
      if (hit) return hit;
      try {
        const r = await fetch(`https://www.gstatic.com/firebasejs/${mirror[1]}/${mirror[2]}`, {mode:'cors'});
        if (!r.ok) throw new Error('cdn ' + r.status);
        let body = await r.text();
        // CRITICAL: the auth and firestore bundles import firebase-app from an
        // ABSOLUTE CDN url baked inside them. Served as-is, that pulls a SECOND
        // copy of firebase-app: auth registers itself into that copy while
        // initializeApp() uses ours, and Firebase throws
        //   "Component auth has not been registered yet".
        // Rewriting the import to a sibling path keeps every module on one
        // single firebase-app instance.
        body = body.replace(
          /((?:from|import)\s*)(["'])https:\/\/www\.gstatic\.com\/firebasejs\/[\d.]+\/firebase-app\.js\2/g,
          '$1$2./firebase-app.js$2');
        const resp = new Response(body, {status:200,
          headers:{'Content-Type':'text/javascript; charset=utf-8'}});
        await c.put(e.request.url, resp.clone());
        return resp;
      } catch (err) {
        // Offline with nothing cached — a clear 504 lets the page show a real
        // message instead of hanging.
        return new Response('', {status:504, statusText:'SDK unavailable offline'});
      }
    })());
    return;
  }
  // Other CDN libraries are immutable, version-pinned files. CACHE-FIRST so
  // exports keep working with no network.
  if (url.includes('gstatic.com/firebasejs') || url.includes('cdnjs.cloudflare.com') ||
      url.includes('fonts.googleapis.com') || url.includes('fonts.gstatic.com') ||
      url.includes('cdn.jsdelivr.net') || url.includes('unpkg.com')) {
    e.respondWith(
      caches.match(e.request).then(hit => hit || fetch(e.request).then(resp => {
        // status 0 + type 'opaque' is a valid cross-origin script response and
        // must be cached too, or the SDK is re-fetched on every single launch.
        // Only genuine CORS responses: opaque ones cannot satisfy a module import.
        if (resp && resp.status === 200 && resp.type !== 'opaque') {
          const copy = resp.clone();
          caches.open(CACHE).then(c => c.put(e.request, copy)).catch(()=>{});
        }
        return resp;
      }).catch(() => caches.match(e.request)))
    );
    return;
  }
  // Our own split JS/CSS (same-origin) — treat like the app shell
  const sameOrigin = url.startsWith(self.location.origin);
  // ./sdk/ holds the Firebase engine: it must be CACHE-FIRST, never
  // network-first. Version-pinned and unchanging, and treating it like ordinary
  // app code meant an offline launch waited on a network request that could
  // never succeed.
  if (sameOrigin && url.includes('/sdk/firebase-')) {
    e.respondWith(
      caches.match(e.request).then(hit => hit || fetch(e.request).then(resp => {
        if (resp && resp.ok) { const c2 = resp.clone();
          caches.open(CACHE).then(c => c.put(e.request, c2)).catch(()=>{}); }
        return resp;
      }).catch(() => caches.match(e.request)))
    );
    return;
  }
  const isAppAsset = sameOrigin && !url.includes('/sdk-mirror/') &&
                     (url.includes('.js') || url.includes('.css'));
  // NETWORK-FIRST for HTML navigation AND our own JS/CSS (always get the latest)
  if (e.request.mode === 'navigate' ||
      e.request.destination === 'document' ||
      url.endsWith('/') ||
      url.includes('index.html') ||
      isAppAsset) {
    e.respondWith((async () => {
      // THE BUG THAT BROKE OFFLINE LAUNCH (introduced in v107, found in v153):
      //   fetch(e.request, {cache:'no-store'})
      // A navigation request has mode 'navigate', and the spec FORBIDS building
      // a Request from one with any init options — so this threw a TypeError
      // SYNCHRONOUSLY. respondWith() then never received a promise, the worker
      // dropped out of the request entirely, and the browser fell back to the
      // network. Online that silently succeeded, which is why everything looked
      // fine; offline there was nothing to fall back to and the app would not
      // start — no matter how perfectly the cache was populated.
      //
      // no-store is still applied to sub-resources (where it is legal and does
      // keep GitHub Pages from serving stale JS), just never to navigations.
      const isNav = e.request.mode === 'navigate' || e.request.destination === 'document';
      try {
        const resp = isNav ? await fetch(e.request) : await fetch(e.request, {cache:'no-store'});
        if (resp && resp.ok) {
          const copy = resp.clone();
          caches.open(CACHE).then(ca => ca.put(e.request, copy)).catch(()=>{});
        }
        return resp;
      } catch (err) {
        // Offline (or any failure): serve the cached copy. ignoreSearch matters
        // because an installed PWA launches with its own query string appended.
        return (await caches.match(e.request, {ignoreSearch:true}))
            || (isNav ? await caches.match('./index.html', {ignoreSearch:true}) : null)
            || (isNav ? await caches.match('./', {ignoreSearch:true}) : null)
            || Response.error();
      }
    })());
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
  // Let the page ask which build this worker is, so the update banner can tell
  // a genuinely newer version from a worker that is merely sitting in "waiting"
  // with the SAME build \u2014 which is what kept the banner on screen after an
  // update had already been applied.
  if(e && e.data==='WHICH_VERSION' && e.ports && e.ports[0]){
    try{ e.ports[0].postMessage(CACHE); }catch(err){}
  }
});

// Tap on a system notification → focus the app (or open it)
self.addEventListener('notificationclick',(e)=>{
  e.notification.close();
  e.waitUntil(clients.matchAll({type:'window',includeUncontrolled:true}).then(list=>{
    for(const c of list){ if('focus' in c) return c.focus(); }
    return clients.openWindow('./');
  }));
});
