/**
 * DesiTV™ Authentication Routes
 * 
 * Endpoints:
 * - POST /api/auth/login - Admin login
 * - POST /api/auth/logout - Admin logout (token invalidation)
 * - GET /api/auth/verify - Verify token validity
 * - POST /api/auth/setup - Initial admin setup (dev only)
 * - POST /api/auth/refresh - Refresh token
 */

const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const Admin = require('../models/Admin');
const { requireAuth } = require('../middleware/auth');
const { authLimiter } = require('../middleware/security');

// Track failed login attempts (in-memory for free tier)
const failedAttempts = new Map();
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION = 15 * 60 * 1000; // 15 minutes

/**
 * Check if IP is locked out
 */
const isLockedOut = (ip) => {
  const attempts = failedAttempts.get(ip);
  if (!attempts) return false;
  
  if (attempts.count >= MAX_FAILED_ATTEMPTS) {
    if (Date.now() - attempts.lastAttempt < LOCKOUT_DURATION) {
      return true;
    }
    // Lockout expired, reset
    failedAttempts.delete(ip);
  }
  return false;
};

/**
 * Record failed login attempt
 */
const recordFailedAttempt = (ip) => {
  const attempts = failedAttempts.get(ip) || { count: 0, lastAttempt: 0 };
  attempts.count++;
  attempts.lastAttempt = Date.now();
  failedAttempts.set(ip, attempts);
};

/**
 * Clear failed attempts for IP
 */
const clearFailedAttempts = (ip) => {
  failedAttempts.delete(ip);
};

/**
 * POST /api/auth/login
 * Admin login with username/password
 */
router.post('/login', authLimiter, async (req, res) => {
  try {
    const clientIP = req.ip || req.connection.remoteAddress;
    
    // Check lockout
    if (isLockedOut(clientIP)) {
      const remaining = Math.ceil((LOCKOUT_DURATION - (Date.now() - failedAttempts.get(clientIP).lastAttempt)) / 60000);
      return res.status(429).json({ 
        error: 'Too many failed attempts',
        message: `Account locked. Try again in ${remaining} minutes.`
      });
    }
    
    const { username, password } = req.body;
    
    if (!username || !password) {
      return res.status(400).json({ 
        error: 'Validation error',
        message: 'Username and password are required'
      });
    }
    
    // Find admin
    const admin = await Admin.findOne({ username: username.toLowerCase() });
    
    if (!admin) {
      recordFailedAttempt(clientIP);
      return res.status(401).json({ 
        error: 'Authentication failed',
        message: 'Invalid credentials'
      });
    }
    
    // Verify password
    const isValid = await bcrypt.compare(password, admin.passwordHash);
    
    if (!isValid) {
      recordFailedAttempt(clientIP);
      const attempts = failedAttempts.get(clientIP);
      const remaining = MAX_FAILED_ATTEMPTS - attempts.count;
      
      return res.status(401).json({ 
        error: 'Authentication failed',
        message: `Invalid credentials. ${remaining > 0 ? `${remaining} attempts remaining.` : 'Account will be locked.'}`
      });
    }
    
    // Clear failed attempts on success
    clearFailedAttempts(clientIP);
    
    // Generate token
    const token = jwt.sign(
      { 
        id: admin._id, 
        username: admin.username,
        role: admin.role || 'admin'
      }, 
      process.env.JWT_SECRET, 
      { expiresIn: '7d' }
    );
    
    // Update last login
    admin.lastLogin = new Date();
    await admin.save();
    
    console.log(`[Auth] Admin "${username}" logged in from ${clientIP}`);
    
    res.json({ 
      success: true,
      token,
      admin: {
        username: admin.username,
        role: admin.role || 'admin'
      },
      expiresIn: '7d'
    });
    
  } catch (err) {
    console.error('[Auth] Login error:', err.message);
    res.status(500).json({ 
      error: 'Server error',
      message: 'Login failed. Please try again.'
    });
  }
});

/**
 * GET /api/auth/verify
 * Verify if current token is valid
 */
router.get('/verify', requireAuth, (req, res) => {
  res.json({ 
    valid: true,
    admin: {
      username: req.admin.username,
      role: req.admin.role
    }
  });
});

/**
 * POST /api/auth/refresh
 * Refresh token before expiry
 */
router.post('/refresh', requireAuth, async (req, res) => {
  try {
    const admin = await Admin.findById(req.admin.id);
    
    if (!admin) {
      return res.status(404).json({ 
        error: 'Admin not found',
        message: 'Please login again'
      });
    }
    
    // Generate new token
    const token = jwt.sign(
      { 
        id: admin._id, 
        username: admin.username,
        role: admin.role || 'admin'
      }, 
      process.env.JWT_SECRET, 
      { expiresIn: '7d' }
    );
    
    res.json({ 
      success: true,
      token,
      expiresIn: '7d'
    });
    
  } catch (err) {
    console.error('[Auth] Refresh error:', err.message);
    res.status(500).json({ 
      error: 'Server error',
      message: 'Token refresh failed'
    });
  }
});

/**
 * POST /api/auth/logout
 * Logout (client-side token removal, server can track for blacklist)
 */
router.post('/logout', requireAuth, (req, res) => {
  // In a production app, you'd add the token to a blacklist
  // For free tier, we rely on client-side token removal
  console.log(`[Auth] Admin "${req.admin.username}" logged out`);
  res.json({ 
    success: true,
    message: 'Logged out successfully'
  });
});

/**
 * POST /api/auth/setup
 * One-time admin setup (only in development or if no admins exist)
 */
router.post('/setup', authLimiter, async (req, res) => {
  try {
    // Check if any admin exists
    const adminCount = await Admin.countDocuments();
    
    if (adminCount > 0 && process.env.NODE_ENV === 'production') {
      return res.status(403).json({ 
        error: 'Setup disabled',
        message: 'Admin already exists. Use login instead.'
      });
    }
    
    const { username, password } = req.body;
    
    if (!username || !password) {
      return res.status(400).json({ 
        error: 'Validation error',
        message: 'Username and password are required'
      });
    }
    
    // Password strength check
    if (password.length < 8) {
      return res.status(400).json({ 
        error: 'Validation error',
        message: 'Password must be at least 8 characters'
      });
    }
    
    // Check if username exists
    const existing = await Admin.findOne({ username: username.toLowerCase() });
    if (existing) {
      return res.status(409).json({ 
        error: 'Conflict',
        message: 'Username already exists'
      });
    }
    
    // Hash password
    const hash = await bcrypt.hash(password, 12);
    
    // Create admin
    const admin = await Admin.create({ 
      username: username.toLowerCase(), 
      passwordHash: hash,
      role: 'admin',
      createdAt: new Date()
    });
    
    console.log(`[Auth] New admin "${username}" created`);
    
    res.status(201).json({ 
      success: true,
      message: 'Admin created successfully',
      admin: {
        username: admin.username,
        role: admin.role
      }
    });
    
  } catch (err) {
    console.error('[Auth] Setup error:', err.message);
    res.status(500).json({ 
      error: 'Server error',
      message: 'Admin setup failed'
    });
  }
});

// Cleanup old failed attempts every hour
setInterval(() => {
  const now = Date.now();
  for (const [ip, attempts] of failedAttempts.entries()) {
    if (now - attempts.lastAttempt > LOCKOUT_DURATION * 2) {
      failedAttempts.delete(ip);
    }
  }
}, 60 * 60 * 1000);

module.exports = router;
