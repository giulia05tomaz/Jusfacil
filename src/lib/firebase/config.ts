import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "not-configured",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "not-configured.invalid",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "not-configured",
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "not-configured.invalid",
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "not-configured",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "not-configured",
};

export const isFirebaseConfigured = Boolean(
  process.env.NEXT_PUBLIC_FIREBASE_API_KEY
  && process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
  && process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID
  && process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
  && process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID
  && process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
);

// Initialize Firebase
const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
export const googleProvider = new GoogleAuthProvider();

export default app;
