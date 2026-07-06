import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.1/firebase-app.js";
import {
  getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged,
  createUserWithEmailAndPassword,
  updatePassword, sendPasswordResetEmail, reauthenticateWithCredential, EmailAuthProvider
} from "https://www.gstatic.com/firebasejs/10.13.1/firebase-auth.js";
import {
  getFirestore, initializeFirestore, persistentLocalCache, persistentMultipleTabManager,
  collection, doc, getDoc, setDoc, updateDoc, deleteDoc, onSnapshot, query, where, orderBy, limit, getDocs, addDoc, runTransaction, deleteField
} from "https://www.gstatic.com/firebasejs/10.13.1/firebase-firestore.js";

// ╔═══════════════════════════════════════════════════════════════════╗
// ║   🔥  FIREBASE CONFIG — REPLACE WITH YOUR KEYS                    ║
// ║   See FIREBASE_SETUP.md for step-by-step instructions              ║
// ╚═══════════════════════════════════════════════════════════════════╝
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

if (isConfigured) {
  try {
    const app = initializeApp(firebaseConfig);
    const auth = getAuth(app);
    // OFFLINE-FIRST: persistent local cache — reads serve instantly from
    // device storage, writes queue while offline and sync automatically.
    let db;
    try {
      db = initializeFirestore(app, {
        localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() })
      });
    } catch(e) {
      console.warn("Persistent cache unavailable, falling back:", e.message);
      db = getFirestore(app);
    }
    window.__fb = {
      isConfigured: true,
      app, auth, db,
      signInWithEmailAndPassword, signOut, onAuthStateChanged, createUserWithEmailAndPassword,
      updatePassword, sendPasswordResetEmail, reauthenticateWithCredential, EmailAuthProvider,
      collection, doc, getDoc, setDoc, updateDoc, deleteDoc, onSnapshot, query, where, orderBy, limit, getDocs, addDoc, runTransaction, deleteField
    };
  } catch(e) { console.error("Firebase init error:", e); }
}
window.dispatchEvent(new Event('fb-ready'));
