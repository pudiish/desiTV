/**
 * DesiTV™ Auth Context - Firebase Edition
 * 
 * Uses Firebase Auth for secure authentication.
 * No local password storage - Firebase handles everything.
 */

import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { auth, signInWithEmailAndPassword, signOut, onAuthStateChanged } from '../config/firebase';

// Token storage key (same as authService for compatibility)
const TOKEN_KEY = 'desiTV_admin_token';
const ADMIN_KEY = 'desiTV_admin_info';

// Default context value - ensures useAuth() never throws
const DEFAULT_CONTEXT = {
  user: null,
  token: null,
  loading: true,
  initialized: false,
  isAuthenticated: false,
  login: async () => ({ success: false, error: 'Auth not initialized' }),
  logout: async () => {},
  getAuthHeaders: () => ({}),
};

// Create context with default value
const AuthContext = createContext(DEFAULT_CONTEXT);

/**
 * Auth Provider - Firebase Auth
 */
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);
  const [initialized, setInitialized] = useState(false);

  // Listen to Firebase auth state changes
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        // User is signed in - get fresh token
        const idToken = await firebaseUser.getIdToken();
        const userData = {
          uid: firebaseUser.uid,
          email: firebaseUser.email,
          username: firebaseUser.email?.split('@')[0] || 'Admin',
          role: 'admin'
        };
        
        // Store in localStorage for apiClientV2 compatibility
        localStorage.setItem(TOKEN_KEY, idToken);
        localStorage.setItem(ADMIN_KEY, JSON.stringify(userData));
        
        setUser(userData);
        setToken(idToken);
        console.log('[Auth] Firebase user signed in:', firebaseUser.email);
      } else {
        // User is signed out - clear localStorage
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(ADMIN_KEY);
        setUser(null);
        setToken(null);
      }
      setLoading(false);
      setInitialized(true);
    });

    // Cleanup subscription
    return () => unsubscribe();
  }, []);

  // Refresh Firebase token every 50 minutes (tokens expire after 1 hour)
  useEffect(() => {
    if (!user) return;

    const refreshToken = async () => {
      const currentUser = auth.currentUser;
      if (currentUser) {
        try {
          const newToken = await currentUser.getIdToken(true); // force refresh
          localStorage.setItem(TOKEN_KEY, newToken);
          setToken(newToken);
          console.log('[Auth] Token refreshed');
        } catch (error) {
          console.error('[Auth] Token refresh failed:', error);
        }
      }
    };

    // Refresh every 50 minutes
    const interval = setInterval(refreshToken, 50 * 60 * 1000);

    return () => clearInterval(interval);
  }, [user]);

  /**
   * Login with email/password via Firebase
   */
  const login = useCallback(async (email, password) => {
    try {
      setLoading(true);
      
      // Firebase handles all the auth
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const firebaseUser = userCredential.user;
      const idToken = await firebaseUser.getIdToken();
      
      const userData = {
        uid: firebaseUser.uid,
        email: firebaseUser.email,
        username: firebaseUser.email?.split('@')[0] || 'Admin',
        role: 'admin'
      };
      
      // Store in localStorage for apiClientV2 compatibility
      localStorage.setItem(TOKEN_KEY, idToken);
      localStorage.setItem(ADMIN_KEY, JSON.stringify(userData));
      
      console.log('[Auth] Login successful:', firebaseUser.email);
      
      return { 
        success: true, 
        user: userData
      };
    } catch (error) {
      console.error('[Auth] Firebase login error:', error.code, error.message);
      
      // Map Firebase error codes to user-friendly messages
      let message = 'Login failed';
      switch (error.code) {
        case 'auth/invalid-email':
          message = 'Invalid email address';
          break;
        case 'auth/user-disabled':
          message = 'Account has been disabled';
          break;
        case 'auth/user-not-found':
          message = 'No account found with this email';
          break;
        case 'auth/wrong-password':
          message = 'Incorrect password';
          break;
        case 'auth/invalid-credential':
          message = 'Invalid email or password';
          break;
        case 'auth/too-many-requests':
          message = 'Too many attempts. Try again later.';
          break;
        default:
          message = error.message || 'Login failed';
      }
      
      return { success: false, error: message };
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Logout via Firebase
   */
  const logout = useCallback(async () => {
    try {
      // Clear localStorage first
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(ADMIN_KEY);
      
      await signOut(auth);
      console.log('[Auth] Logged out');
    } catch (error) {
      console.error('[Auth] Logout error:', error);
      // Still clear local state even if Firebase logout fails
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(ADMIN_KEY);
    }
  }, []);

  /**
   * Get auth headers for API calls
   * Firebase token is automatically refreshed
   */
  const getAuthHeaders = useCallback(() => {
    if (!token) return {};
    return { 'Authorization': `Bearer ${token}` };
  }, [token]);

  const isAuthenticated = !!user && !!token;

  // Always provide value - never null or undefined
  const value = {
    user,
    token,
    loading,
    initialized,
    isAuthenticated,
    login,
    logout,
    getAuthHeaders,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

/**
 * useAuth hook - Always returns a valid context
 */
export function useAuth() {
  return useContext(AuthContext);
}

export default AuthContext;
