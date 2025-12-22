/**
 * DesiTV™ Auth Context
 * 
 * Centralized authentication state management using React Context.
 * This provides a single source of truth for auth state across the app.
 */

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { apiClient } from '../services/apiClient';

const TOKEN_KEY = 'desiTV_admin_token';
const ADMIN_KEY = 'desiTV_admin_info';

// Create context
const AuthContext = createContext(null);

/**
 * Parse JWT token payload
 */
const parseToken = (token) => {
  try {
    if (!token) return null;
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    return JSON.parse(atob(parts[1]));
  } catch (e) {
    return null;
  }
};

/**
 * Check if token is expired
 */
const isTokenExpired = (token) => {
  const payload = parseToken(token);
  if (!payload || !payload.exp) return true;
  return Date.now() >= payload.exp * 1000;
};

/**
 * Auth Provider Component
 */
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);
  const [initialized, setInitialized] = useState(false);

  /**
   * Clear auth state
   */
  const clearAuth = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(ADMIN_KEY);
    setToken(null);
    setUser(null);
  }, []);

  /**
   * Initialize auth state from localStorage
   */
  useEffect(() => {
    const initAuth = () => {
      try {
        const storedToken = localStorage.getItem(TOKEN_KEY);
        const storedUser = localStorage.getItem(ADMIN_KEY);

        if (storedToken && !isTokenExpired(storedToken)) {
          setToken(storedToken);
          setUser(storedUser ? JSON.parse(storedUser) : null);
        } else if (storedToken) {
          // Token exists but expired
          clearAuth();
        }
      } catch (e) {
        console.error('[AuthContext] Init error:', e);
        clearAuth();
      } finally {
        setLoading(false);
        setInitialized(true);
      }
    };

    initAuth();
  }, [clearAuth]);

  /**
   * Login function
   */
  const login = useCallback(async (username, password) => {
    try {
      // Use apiClient which handles CSRF tokens automatically
      const data = await apiClient.post('/api/auth/login', {
        username,
        password,
      });

      // Store auth data
      localStorage.setItem(TOKEN_KEY, data.token);
      localStorage.setItem(ADMIN_KEY, JSON.stringify(data.admin));
      
      setToken(data.token);
      setUser(data.admin);

      return { success: true, user: data.admin };
    } catch (error) {
      console.error('[AuthContext] Login error:', error);
      return { success: false, error: error.message || 'Network error' };
    }
  }, []);

  /**
   * Logout function
   */
  const logout = useCallback(async () => {
    try {
      // Notify server (non-blocking)
      if (token) {
        fetch(`${API_BASE}/api/auth/logout`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }).catch(() => {});
      }
    } finally {
      clearAuth();
    }
  }, [token, clearAuth]);

  /**
   * Setup admin account
   */
  const setupAdmin = useCallback(async (username, password) => {
    try {
      const response = await fetch(`${API_BASE}/api/auth/setup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        return { success: false, error: data.message || 'Setup failed' };
      }

      return { success: true, admin: data.admin };
    } catch (error) {
      console.error('[AuthContext] Setup error:', error);
      return { success: false, error: error.message || 'Network error' };
    }
  }, []);

  /**
   * Get auth headers for API calls
   */
  const getAuthHeaders = useCallback(() => {
    if (!token) return {};
    return { 'Authorization': `Bearer ${token}` };
  }, [token]);

  // Computed auth state
  const isAuthenticated = !!token && !isTokenExpired(token);

  const value = {
    user,
    token,
    loading,
    initialized,
    isAuthenticated,
    login,
    logout,
    setupAdmin,
    getAuthHeaders,
    clearAuth,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

/**
 * Hook to use auth context
 */
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

export default AuthContext;
