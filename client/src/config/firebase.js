/**
 * Firebase Configuration for DesiTV
 * Authentication handled by Firebase Auth
 * 
 * Note: Firebase client config is public by design.
 * Security is enforced through Firebase Security Rules, not by hiding these values.
 */

import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged } from 'firebase/auth';

// Firebase configuration from environment variables only
// IMPORTANT: Never hardcode Firebase credentials in source code
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID
};

export const isFirebaseConfigured = Object.values(firebaseConfig).every(Boolean);

// Firebase is only needed to sign in to the admin panel. It used to be
// initialized at module load even when unconfigured, and initializeApp throws
// on an invalid key - which took down the TV, because App.jsx imports the auth
// context at module scope. Watching TV must not depend on admin credentials.
let app = null;
let auth = null;

if (isFirebaseConfigured) {
  app = initializeApp(firebaseConfig);
  auth = getAuth(app);
} else {
  console.warn(
    '[Firebase] Not configured - admin sign-in is disabled. ' +
    'Set VITE_FIREBASE_API_KEY, VITE_FIREBASE_AUTH_DOMAIN, VITE_FIREBASE_PROJECT_ID, ' +
    'VITE_FIREBASE_STORAGE_BUCKET, VITE_FIREBASE_MESSAGING_SENDER_ID, VITE_FIREBASE_APP_ID ' +
    'and VITE_FIREBASE_MEASUREMENT_ID to enable it.'
  );
}

export { auth, signInWithEmailAndPassword, signOut, onAuthStateChanged };
export default app;
