/**
 * DesiTV™ Authentication Service
 * 
 * Handles admin authentication, token management, and auth state
 */

import { STORAGE } from '../config/constants';
import { apiClient } from './apiClient';
const API_BASE = import.meta.env.VITE_API_BASE || '';

// Token storage keys
const TOKEN_KEY = STORAGE.ADMIN_TOKEN_KEY || 'desiTV_admin_token';
const ADMIN_KEY = STORAGE.ADMIN_INFO_KEY || 'desiTV_admin_info';

/**
 * Get the stored auth token
 */
export const getToken = () => {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch (e) {
    console.error('[Auth] Error reading token:', e);
    return null;
  }
};

/**
 * Get stored admin info
 */
export const getAdminInfo = () => {
  try {
    const info = localStorage.getItem(ADMIN_KEY);
    return info ? JSON.parse(info) : null;
  } catch (e) {
    console.error('[Auth] Error reading admin info:', e);
    return null;
  }
};

/**
 * Check if user is authenticated
 */
export const isAuthenticated = () => {
  const token = getToken();
  if (!token) {
    console.log('[Auth] No token found');
    return false;
  }
  
  // Basic token expiry check (JWT exp claim)
  try {
    const parts = token.split('.');
    if (parts.length !== 3) {
      console.log('[Auth] Invalid token format');
      logout();
      return false;
    }
    
    const payload = JSON.parse(atob(parts[1]));
    if (payload.exp && Date.now() >= payload.exp * 1000) {
      // Token expired, clean up
      console.log('[Auth] Token expired, logging out');
      logout();
      return false;
    }
    console.log('[Auth] Token valid for user:', payload.username);
    return true;
  } catch (e) {
    console.error('[Auth] Token validation error:', e);
    logout();
    return false;
  }
};

/**
 * Login with username and password
 */
export const login = async (username, password) => {
  try {
    // Use apiClient which handles CSRF tokens automatically
    const data = await apiClient.post('/api/auth/login', {
      username,
      password,
    });
    
    // Store token and admin info
    localStorage.setItem(TOKEN_KEY, data.token);
    localStorage.setItem(ADMIN_KEY, JSON.stringify(data.admin));
    
    return { success: true, admin: data.admin };
  } catch (error) {
    console.error('[Auth] Login error:', error);
    // Provide user-friendly error messages
    const errorMessage = error.message.includes('fetch') || error.message.includes('network')
      ? 'Server not responding. Please check if the server is running.'
      : error.message || 'Login failed';
    return { success: false, error: errorMessage };
  }
};

/**
 * Logout - clear all auth data
 */
export const logout = () => {
  try {
    // Optionally notify server
    const token = getToken();
    if (token) {
      fetch(`${API_BASE}/api/auth/logout`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      }).catch(() => {});
    }
    
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(ADMIN_KEY);
    return true;
  } catch (e) {
    console.error('[Auth] Logout error:', e);
    return false;
  }
};

/**
 * Verify current token
 */
export const verifyToken = async () => {
  const token = getToken();
  if (!token) return false;
  
  try {
    // Add timeout
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Server timeout')), 5000)
    );
    
    const fetchPromise = fetch(`${API_BASE}/api/auth/verify`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });
    
    const response = await Promise.race([fetchPromise, timeoutPromise]);
    
    if (!response.ok) {
      logout();
      return false;
    }
    
    const data = await response.json();
    return data.valid === true;
  } catch (error) {
    // If server is not responding, don't logout - allow offline mode
    console.warn('[Auth] Verify error (server may be offline):', error.message);
    // Return true to allow offline access if token exists
    return true;
  }
};

/**
 * Refresh token before expiry
 */
export const refreshToken = async () => {
  const token = getToken();
  if (!token) return false;
  
  try {
    const response = await fetch(`${API_BASE}/api/auth/refresh`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });
    
    if (!response.ok) {
      return false;
    }
    
    const data = await response.json();
    localStorage.setItem(TOKEN_KEY, data.token);
    return true;
  } catch (error) {
    console.error('[Auth] Refresh error:', error);
    return false;
  }
};

/**
 * Get authorization headers for API requests
 */
export const getAuthHeaders = () => {
  const token = getToken();
  if (!token) return {};
  
  return {
    'Authorization': `Bearer ${token}`,
  };
};

/**
 * Make authenticated API request
 */
export const authFetch = async (url, options = {}) => {
  const token = getToken();
  
  const headers = {
    'Content-Type': 'application/json',
    ...(token && { 'Authorization': `Bearer ${token}` }),
    ...(options.headers || {}),
  };
  
  const response = await fetch(url, {
    ...options,
    headers,
  });
  
  // Handle 401 - token expired/invalid
  if (response.status === 401) {
    logout();
    // Redirect to login
    window.location.href = '/admin/login';
    throw new Error('Session expired. Please login again.');
  }
  
  return response;
};

/**
 * Setup admin account (first-time setup)
 */
export const setupAdmin = async (username, password) => {
  try {
    const response = await fetch(`${API_BASE}/api/auth/setup`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ username, password }),
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.message || 'Setup failed');
    }
    
    return { success: true, admin: data.admin };
  } catch (error) {
    console.error('[Auth] Setup error:', error);
    return { success: false, error: error.message };
  }
};

// Auto-refresh token before expiry (check every 30 minutes)
if (typeof window !== 'undefined') {
  setInterval(() => {
    const token = getToken();
    if (token) {
      try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        // If token expires within 1 day, refresh it
        if (payload.exp && (payload.exp * 1000 - Date.now()) < 24 * 60 * 60 * 1000) {
          refreshToken();
        }
      } catch (e) {
        // Invalid token format
      }
    }
  }, 30 * 60 * 1000);
}

export default {
  getToken,
  getAdminInfo,
  isAuthenticated,
  login,
  logout,
  verifyToken,
  refreshToken,
  getAuthHeaders,
  authFetch,
  setupAdmin,
};
