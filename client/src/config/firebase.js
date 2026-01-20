/**
 * Firebase Configuration for DesiTV
 * Authentication handled by Firebase Auth
 * 
 * Note: Firebase client config is public by design.
 * Security is enforced through Firebase Security Rules, not by hiding these values.
 */

import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged } from 'firebase/auth';

// Firebase configuration from environment variables
// Falls back to hardcoded values for development convenience
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyCHuANZcHfMZbPUxyNk85vcO0oftupl_x8",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "desitv-81d8d.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "desitv-81d8d",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "desitv-81d8d.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "201094665646",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:201094665646:web:96fb76d0190653d311243f",
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || "G-VC72PYZ1FM"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

export { auth, signInWithEmailAndPassword, signOut, onAuthStateChanged };
export default app;
