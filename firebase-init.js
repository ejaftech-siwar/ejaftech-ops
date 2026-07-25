// ═══════════════════════════════════════════════════════════════════════
//  Girêk — Firebase bootstrap (v148)
//
//  WHY THE OFFLINE COLD START KEPT FAILING — four distinct causes, in order:
//
//  1. Static top-level imports: an unreachable SDK stopped the module body from
//     running, so 'fb-ready' never fired and the app hung on its spinner.
//  2. The service worker excluded every 'gstatic' URL from caching — and the
//     Firebase SDK is served from gstatic.
//  3. Caching it with no-cors produced an OPAQUE response, and the ES module
//     loader refuses to execute an opaque module. The file was cached and the
//     import still failed.
//  4. A background job that copied the SDK into a mirror could silently not run.
//
//  The fix removes cross-origin behaviour from the equation entirely: the page
//  imports a SAME-ORIGIN path, and the service worker fetches the real bytes
//  once, re-serves them under our own origin, and caches them. Same-origin
//  modules have no CORS dimension to fail on.
// ═══════════════════════════════════════════════════════════════════════
const SDK_VER = "10.13.1";
const SDK     = "https://www.gstatic.com/firebasejs/" + SDK_VER + "/";
const FILES   = ["firebase-app.js", "firebase-auth.js", "firebase-firestore.js"];
const mirrorUrl = (f) => new URL("sdk-mirror/" + SDK_VER + "/" + f, location.href).href;

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

async function loadSDK(){
  // ── 1. bundled copy in ./sdk/ — offline guaranteed, no caching involved ──
  // Import directly rather than probing with HEAD first: some static hosts and
  // service-worker paths answer HEAD unhelpfully, and a failed probe silently
  // demoted a perfectly good local bundle to the network path.
  try{
    const mods = await Promise.all(FILES.map(f => import(new URL("sdk/"+f, location.href).href)));
    if(mods[0] && mods[0].initializeApp) return { mods, source:"bundled" };
  }catch(e){ /* no bundle present — carry on */ }

  // ── 2. same-origin path served by the service worker ──
  if("serviceWorker" in navigator){
    try{
      if(!navigator.serviceWorker.controller){
        // First-ever visit: give the worker a moment to take control, otherwise
        // it cannot proxy anything yet.
        await Promise.race([
          navigator.serviceWorker.ready.then(()=>new Promise(r=>setTimeout(r,400))),
          new Promise(r=>setTimeout(r,3500))
        ]);
      }
      if(navigator.serviceWorker.controller){
        const mods = await Promise.all(FILES.map(f => import(mirrorUrl(f))));
        return { mods, source:"mirror" };
      }
    }catch(e){
      console.warn("Mirror import failed, falling back to CDN:", e && e.message);
      // A mirrored file that will not execute is worse than none.
      try{ await caches.delete("ejaftech-sdk-mirror"); }catch(_){}
    }
  }

  // ── 3. straight from the CDN ──
  const mods = await Promise.all(FILES.map(f => import(SDK + f)));
  return { mods, source:"cdn" };
}

// ═══ THE BOOT CONTRACT ═══════════════════════════════════════════════════
// Every offline failure in this app has had the same shape: one await on the
// startup path that never settled, and a blank screen with no explanation.
// Rather than fix them one at a time, the whole SDK setup is now RACED against
// a hard deadline. If anything stalls — for any reason, now or in the future —
// the app stops waiting and says so instead of hanging.
function withDeadline(promise, ms, label){
  return Promise.race([
    promise,
    new Promise((_, rej) => setTimeout(() => rej(new Error("timeout: " + label)), ms))
  ]);
}

try {
  if (!isConfigured) throw new Error("not-configured");

  const { mods, source } = await withDeadline(loadSDK(), 12000, "loading the engine");
  const [appMod, authMod, fsMod] = mods;

  const { initializeApp } = appMod;
  const {
    getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged,
    createUserWithEmailAndPassword, updatePassword, sendPasswordResetEmail,
    reauthenticateWithCredential, EmailAuthProvider,
    setPersistence, indexedDBLocalPersistence, browserLocalPersistence
  } = authMod;
  const {
    getFirestore, initializeFirestore, persistentLocalCache, persistentMultipleTabManager,
    collection, doc, getDoc, setDoc, updateDoc, deleteDoc, onSnapshot, query, where,
    getDocs, addDoc, runTransaction, deleteField
  } = fsMod;

  const app  = initializeApp(firebaseConfig);
  const auth = getAuth(app);
  // Session persistence: requested, never AWAITED.
  //
  // v156 awaited this and it became the newest way to hang the launch — offline
  // it can stall, and it sits before window.__fb is published and before
  // 'fb-ready' is dispatched, so the whole app waited on it and the watchdog
  // eventually reported "Engine did not load".
  //
  // Firebase applies it to subsequent operations regardless, so there is no
  // reason to block startup on the answer. NOTHING on the boot path may await
  // something that can hang.
  try{
    if(setPersistence && indexedDBLocalPersistence){
      setPersistence(auth, indexedDBLocalPersistence).catch(()=>{
        try{ if(browserLocalPersistence) setPersistence(auth, browserLocalPersistence).catch(()=>{}); }catch(_){}
      });
    }
  }catch(e){ /* persistence stays at its default — never fatal */ }

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
    isConfigured: true, app, auth, db, sdkSource: source,
    signInWithEmailAndPassword, signOut, onAuthStateChanged, createUserWithEmailAndPassword,
    updatePassword, sendPasswordResetEmail, reauthenticateWithCredential, EmailAuthProvider,
    collection, doc, getDoc, setDoc, updateDoc, deleteDoc, onSnapshot, query, where,
    getDocs, addDoc, runTransaction, deleteField
  };
  console.log("Girêk: Firebase SDK loaded via " + source);

} catch (e) {
  console.error("Firebase init failed:", e);
  window.__fb = { isConfigured, sdkError: (e && e.message) || String(e) };
}

window.dispatchEvent(new Event('fb-ready'));
