import { initializeApp, getApps, type FirebaseApp } from "firebase/app";
import {
  getAuth,
  setPersistence,
  browserLocalPersistence,
  type Auth,
} from "firebase/auth";

// ─────────────────────────────────────────────────────────────────────────────
// Firebase configuration
//
// Add these to Replit Secrets (or a .env.local file for local dev):
//
//   VITE_FIREBASE_API_KEY
//   VITE_FIREBASE_AUTH_DOMAIN
//   VITE_FIREBASE_PROJECT_ID
//   VITE_FIREBASE_STORAGE_BUCKET
//   VITE_FIREBASE_MESSAGING_SENDER_ID
//   VITE_FIREBASE_APP_ID
//
// The app runs without auth when these are not set — Firebase features
// will show a "not configured" state rather than crashing.
// ─────────────────────────────────────────────────────────────────────────────

const apiKey = import.meta.env.VITE_FIREBASE_API_KEY;
const authDomain = import.meta.env.VITE_FIREBASE_AUTH_DOMAIN;
const projectId = import.meta.env.VITE_FIREBASE_PROJECT_ID;

export const isFirebaseConfigured = !!(apiKey && authDomain && projectId);

let _app: FirebaseApp | null = null;
let _auth: Auth | null = null;

if (isFirebaseConfigured) {
  try {
    _app =
      getApps().length === 0
        ? initializeApp({
            apiKey,
            authDomain,
            projectId,
            storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET ?? "",
            messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID ?? "",
            appId: import.meta.env.VITE_FIREBASE_APP_ID ?? "",
          })
        : getApps()[0]!;
    _auth = getAuth(_app);
    // Keep users signed in across page reloads and browser sessions.
    setPersistence(_auth, browserLocalPersistence).catch((err) => {
      console.warn("[VirJoy] Failed to set auth persistence:", err);
    });
  } catch (err) {
    console.warn("[VirJoy] Firebase initialization failed:", err);
  }
}

export const app = _app;
export const auth = _auth;
export default _app;
