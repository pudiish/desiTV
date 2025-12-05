/**
 * JWT Authentication Middleware for DesiTV™ Admin Portal
 * 
 * Features:
 * - Token validation
 * - Token refresh handling
 * - Role-based access (future)
 * - Audit logging
 */

const jwt = require('jsonwebtoken');

/**
 * Verify JWT token and attach admin to request
 */
const requireAuth = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader) {
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
      return res.status(401).json({ 
        error: 'Authentication required',
        message: 'No token provided'
      });
    }
    
    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Check token expiration (extra safety)
    if (decoded.exp && Date.now() >= decoded.exp * 1000) {
      return res.status(401).json({ 
        error: 'Token expired',
        message: 'Please login again'
      });
    }
    
    // Attach admin info to request
    req.admin = {
      id: decoded.id,
      username: decoded.username,
      role: decoded.role || 'admin'
    };
    
    // Log admin action (for audit)
    if (process.env.NODE_ENV !== 'production') {
      console.log(`[Auth] Admin "${decoded.username}" accessed ${req.method} ${req.path}`);
    }
    
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ 
        error: 'Token expired',
        message: 'Please login again'
      });
    }
    if (err.name === 'JsonWebTokenError') {
      return res.status(401).json({ 
        error: 'Invalid token',
        message: 'Authentication failed'
      });
    }
    
    console.error('[Auth] Verification error:', err.message);
    return res.status(401).json({ 
      error: 'Authentication failed',
      message: 'Invalid or malformed token'
    });
  }
};

/**
 * Optional auth - attaches admin if token present, continues if not
 */
const optionalAuth = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader) {
      return next();
    }
    
    const token = authHeader.startsWith('Bearer ') 
      ? authHeader.slice(7) 
      : authHeader;
    
    if (token) {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      req.admin = {
        id: decoded.id,
        username: decoded.username,
        role: decoded.role || 'admin'
      };
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
