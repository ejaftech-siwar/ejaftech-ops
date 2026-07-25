// ═══════════════════════════════════════════════════════════════════════
//  Girêk — Firebase bootstrap (v147)
//
//  THE OFFLINE COLD-START PROBLEM, and why the obvious fixes failed:
//
//  1. Static top-level imports meant an unreachable SDK stopped the module
//     body from running at all, so 'fb-ready' never fired → dead spinner.
//     (Fixed in v146 with dynamic imports inside try/catch.)
//
//  2. Caching the CDN files was still unreliable: a cross-origin response
//     cached without CORS is OPAQUE, and the ES module loader REFUSES to
//     execute an opaque module. So the cache could hold the file and the
//     import would still fail.
//
//  The reliable answer is to stop depending on cross-origin behaviour at all:
//  on the first successful online launch we copy the three SDK files into a
//  SAME-ORIGIN mirror in the Cache API. Same-origin scripts have no CORS
//  dimension, and the service worker already serves same-origin files
//  offline. Every later launch imports the mirror first.
// ═══════════════════════════════════════════════════════════════════════
const SDK      = "https://www.gstatic.com/firebasejs/10.13.1/";
const MIRROR   = "sdk-mirror/10.13.1/";          // same-origin, relative to the app
const SDK_CACHE = "ejaftech-sdk-mirror";
const FILES    = ["firebase-app.js", "firebase-auth.js", "firebase-firestore.js"];

const firebaseConfig = {
  apiKey: "AIzaSyAmb1Wj_cGqazyG5tJjl_AzOFu-8IaxSt4",
  authDomain: "ejaftech-hr.firebaseapp.com",
  projectId: "ejaftech-hr",
  storageBucket: "ejaftech-hr.firebasestorage.app",
  messagingSenderId: "767161971639",
  appId: "1:767161971639:web:406a10412aa4b525e4ae32"
};

const isConfigured = firebaseConfig.apiKey !== "PASTE_YOUR_API_KEY_HERE";
window.__fb = { isConfigured };

const mirrorUrl = (f) => new URL(MIRROR + f, location.href).href;

// Copy the CDN files into a same-origin mirror. Runs quietly in the background
// after a successful online start; failure is harmless.
async function buildMirror(){
  try{
    if(!("caches" in window)) return;
    const c = await caches.open(SDK_CACHE);
    for(const f of FILES){
      const already = await c.match(mirrorUrl(f));
      if(already) continue;
      const r = await fetch(SDK + f, {mode:"cors", cache:"reload"});
      if(!r.ok) continue;
      const body = await r.text();
      await c.put(mirrorUrl(f), new Response(body, {
        status:200,
        headers:{ "Content-Type":"text/javascript; charset=utf-8" }
      }));
    }
  }catch(e){ console.warn("SDK mirror not built:", e && e.message); }
}

// Load order, most reliable first:
//   1. BUNDLED files in ./sdk/ — if you drop the three SDK files there, offline
//      launch is guaranteed forever with no caching involved at all.
//   2. The same-origin mirror built on a previous online run.
//   3. The CDN.
async function loadSDK(){
  let viaMirror = false;
  // ── 1. bundled copy ──
  try{
    const probe = await fetch("sdk/firebase-app.js", {method:"HEAD"});
    if(probe && probe.ok){
      const mods = await Promise.all(FILES.map(f => import(new URL("sdk/"+f, location.href).href)));
      return { mods, viaMirror:"bundled" };
    }
  }catch(e){ /* not bundled — carry on */ }
  try{
    if("caches" in window){
      const c = await caches.open(SDK_CACHE);
      const hits = await Promise.all(FILES.map(f => c.match(mirrorUrl(f))));
      if(hits.every(Boolean)){
        const mods = await Promise.all(FILES.map(f => import(mirrorUrl(f))));
        viaMirror = true;
        return { mods, viaMirror };
      }
    }
  }catch(e){
    // A mirrored file that will not execute is worse than none — drop it so the
    // next online launch rebuilds a clean copy.
    console.warn("Mirror import failed, falling back to CDN:", e && e.message);
    try{ await caches.delete(SDK_CACHE); }catch(_){}
  }
  const mods = await Promise.all(FILES.map(f => import(SDK + f)));
  return { mods, viaMirror };
}

try {
  if (!isConfigured) throw new Error("not-configured");

  const { mods, viaMirror } = await loadSDK();
  const [appMod, authMod, fsMod] = mods;

  const { initializeApp } = appMod;
  const {
    getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged,
    createUserWithEmailAndPassword, updatePassword, sendPasswordResetEmail,
    reauthenticateWithCredential, EmailAuthProvider
  } = authMod;
  const {
    getFirestore, initializeFirestore, persistentLocalCache, persistentMultipleTabManager,
    collection, doc, getDoc, setDoc, updateDoc, deleteDoc, onSnapshot, query, where,
    getDocs, addDoc, runTransaction, deleteField
  } = fsMod;

  const app  = initializeApp(firebaseConfig);
  const auth = getAuth(app);

  // OFFLINE-FIRST: reads serve from device storage, writes queue and replay.
  let db;
  try {
    db = initializeFirestore(app, {
      localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() })
    });
  } catch (e) {
    console.warn("Persistent cache unavailable, falling back:", e && e.message);
    db = getFirestore(app);
  }

  window.__fb = {
    isConfigured: true, app, auth, db, viaMirror,
    signInWithEmailAndPassword, signOut, onAuthStateChanged, createUserWithEmailAndPassword,
    updatePassword, sendPasswordResetEmail, reauthenticateWithCredential, EmailAuthProvider,
    collection, doc, getDoc, setDoc, updateDoc, deleteDoc, onSnapshot, query, where,
    getDocs, addDoc, runTransaction, deleteField
  };

  // Keep the mirror warm for the next launch — never block startup on it.
  if (navigator.onLine !== false) setTimeout(buildMirror, 1500);

} catch (e) {
  console.error("Firebase init failed:", e);
  window.__fb = { isConfigured, sdkError: (e && e.message) || String(e) };
}

window.dispatchEvent(new Event('fb-ready'));
