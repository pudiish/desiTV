/**
 * Authentication Middleware for DesiTV™ Admin Portal
 * 
 * Supports both Firebase Auth and legacy JWT tokens
 */

const jwt = require('jsonwebtoken');

// Firebase Admin SDK for token verification
let firebaseAuth = null;
try {
  const admin = require('firebase-admin');
  if (admin.apps.length === 0) {
    // Check for service account credentials
    if (process.env.FIREBASE_SERVICE_ACCOUNT) {
      try {
        // Production: Use service account from environment variable (JSON string)
        const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
        admin.initializeApp({
          credential: admin.credential.cert(serviceAccount),
          projectId: 'desitv-81d8d'
        });
        console.log('[Auth] ✅ Firebase Admin SDK ready (service account)');
        console.log(`[Auth]    Project: ${serviceAccount.project_id}`);
        console.log(`[Auth]    Email: ${serviceAccount.client_email}`);
      } catch (parseErr) {
        console.error('[Auth] ❌ Failed to parse FIREBASE_SERVICE_ACCOUNT:', parseErr.message);
        throw parseErr;
      }
    } else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
      // Alternative: Use GOOGLE_APPLICATION_CREDENTIALS file path
      admin.initializeApp({ projectId: 'desitv-81d8d' });
      console.log('[Auth] ✅ Firebase Admin SDK ready (credentials file)');
    } else {
      // Development: Initialize without credentials (limited functionality)
      admin.initializeApp({ projectId: 'desitv-81d8d' });
      console.log('[Auth] ⚠️  Firebase Admin SDK ready (dev mode - limited)');
      console.log('[Auth]    Set FIREBASE_SERVICE_ACCOUNT for full functionality');
    }
  }
  firebaseAuth = admin.auth();
} catch (err) {
  console.warn('[Auth] ❌ Firebase Admin SDK not available:', err.message);
  console.log('[Auth] ℹ️  Falling back to JWT-only authentication');
  console.log('[Auth] ℹ️  To use Firebase, set FIREBASE_SERVICE_ACCOUNT environment variable');
}

/**
 * Verify Firebase token
 */
async function verifyFirebaseToken(token) {
  if (!firebaseAuth) return null;
  
  try {
    const decoded = await firebaseAuth.verifyIdToken(token);
    return {
      id: decoded.uid,
      email: decoded.email,
      username: decoded.email?.split('@')[0] || 'admin',
      role: 'admin',
      provider: 'firebase'
    };
  } catch (err) {
    // Token is not a valid Firebase token
    return null;
  }
}

/**
 * Verify legacy JWT token
 */
function verifyJwtToken(token) {
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    if (decoded.exp && Date.now() >= decoded.exp * 1000) {
      return null;
    }
    
    return {
      id: decoded.id,
      username: decoded.username,
      role: decoded.role || 'admin',
      provider: 'jwt'
    };
  } catch (err) {
    return null;
  }
}

/**
 * Verify JWT token and attach admin to request
 * Supports both Firebase and legacy JWT
 */
const requireAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader) {
      if (process.env.DEBUG_AUTH) {
        console.log('[Auth] No authorization header provided');
      }
      return res.status(401).json({ 
        error: 'Authentication required',
        message: 'No authorization header provided'
      });
    }
    
    // Support both "Bearer <token>" and raw token
    const token = authHeader.startsWith('Bearer ') 
      ? authHeader.slice(7) 
      : authHeader;
    
    if (!token) {
      if (process.env.DEBUG_AUTH) {
        console.log('[Auth] Authorization header present but no token');
      }
      return res.status(401).json({ 
        error: 'Authentication required',
        message: 'No token provided'
      });
    }
    
    if (process.env.DEBUG_AUTH) {
      console.log('[Auth] Token received, length:', token.length);
      console.log('[Auth] Firebase Auth available:', !!firebaseAuth);
    }
    
    // Try Firebase token first
    let admin = await verifyFirebaseToken(token);
    
    if (process.env.DEBUG_AUTH && !admin) {
      console.log('[Auth] Firebase verification failed, trying JWT fallback');
    }
    
    // Fall back to legacy JWT
    if (!admin) {
      admin = verifyJwtToken(token);
    }
    
    if (!admin) {
      console.error('[Auth] Token verification failed - both Firebase and JWT failed');
      console.error('[Auth] Firebase SDK:', firebaseAuth ? 'available' : 'NOT available');
      console.error('[Auth] JWT_SECRET:', process.env.JWT_SECRET ? 'set' : 'NOT set');
      return res.status(401).json({ 
        error: 'Invalid token',
        message: 'Authentication failed'
      });
    }
    
    // Attach admin info to request
    req.admin = admin;
    
    // Log admin action (for audit)
    console.log(`[Auth] ${admin.provider === 'firebase' ? '🔥' : '🔑'} "${admin.username}" accessed ${req.method} ${req.path}`);
    
    next();
  } catch (err) {
    console.error('[Auth] Verification error:', err.message);
    if (process.env.DEBUG_AUTH) {
      console.error('[Auth] Full error:', err);
    }
    return res.status(401).json({ 
      error: 'Authentication failed',
      message: 'Invalid or malformed token'
    });
  }
};

/**
 * Optional auth - attaches admin if token present, continues if not
 */
const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader) {
      return next();
    }
    
    const token = authHeader.startsWith('Bearer ') 
      ? authHeader.slice(7) 
      : authHeader;
    
    if (token) {
      // Try Firebase first, then JWT
      let admin = await verifyFirebaseToken(token);
      if (!admin) {
        admin = verifyJwtToken(token);
      }
      if (admin) {
        req.admin = admin;
      }
    }
  } catch (err) {
    // Ignore errors for optional auth
  }
  next();
};

/**
 * Check if user is authenticated (for conditional responses)
 */
const isAuthenticated = (req) => {
  return req.admin && req.admin.id;
};

module.exports = requireAuth;
module.exports.requireAuth = requireAuth;
module.exports.optionalAuth = optionalAuth;
module.exports.isAuthenticated = isAuthenticated;
