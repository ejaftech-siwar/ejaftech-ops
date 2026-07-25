// ═══════════════════════════════════════════════════════════════════════
//  Girêk — Firebase bootstrap (v146)
//  The SDK is now loaded with DYNAMIC imports inside a try/catch.
//
//  Why this matters: with static top-level imports, an unreachable SDK meant
//  the module body never executed at all — so the 'fb-ready' event on the last
//  line never fired, watchAuth() was never called, and the app sat on its
//  spinner forever with no explanation. Offline, that was every single launch
//  until the browser happened to have the files cached.
//
//  'fb-ready' now ALWAYS fires: either configured, or with a reason.
// ═══════════════════════════════════════════════════════════════════════
const SDK = "https://www.gstatic.com/firebasejs/10.13.1/";

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

try {
  if (!isConfigured) throw new Error("not-configured");

  const [appMod, authMod, fsMod] = await Promise.all([
    import(SDK + "firebase-app.js"),
    import(SDK + "firebase-auth.js"),
    import(SDK + "firebase-firestore.js"),
  ]);

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
    isConfigured: true, app, auth, db,
    signInWithEmailAndPassword, signOut, onAuthStateChanged, createUserWithEmailAndPassword,
    updatePassword, sendPasswordResetEmail, reauthenticateWithCredential, EmailAuthProvider,
    collection, doc, getDoc, setDoc, updateDoc, deleteDoc, onSnapshot, query, where,
    getDocs, addDoc, runTransaction, deleteField
  };
} catch (e) {
  console.error("Firebase init failed:", e);
  // Keep isConfigured truthful, but tell the app WHY nothing is available so it
  // can show a real message instead of an endless spinner.
  window.__fb = { isConfigured, sdkError: (e && e.message) || String(e) };
}

window.dispatchEvent(new Event('fb-ready'));
