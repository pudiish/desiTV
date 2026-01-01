/**
 * Auth Service
 * 
 * Business logic for authentication operations.
 * Handles login, token generation, and failed attempt tracking.
 */

const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const Admin = require('../models/Admin');

// Validate JWT_SECRET at module load
if (!process.env.JWT_SECRET) {
  console.error('[AuthService] CRITICAL: JWT_SECRET environment variable is not set!');
  console.error('[AuthService] Authentication will fail. Please set JWT_SECRET in your .env file.');
  // In production, we should exit. In development, warn but continue.
  if (process.env.NODE_ENV === 'production') {
    throw new Error('JWT_SECRET environment variable is required in production');
  }
}

// Track failed login attempts (in-memory for free tier)
const failedAttempts = new Map();
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION = 15 * 60 * 1000; // 15 minutes

class AuthService {
  /**
   * Check if IP is locked out
   * @param {string} clientIP - Client IP address
   * @returns {boolean} True if locked out
   */
  isLockedOut(clientIP) {
    const attempts = failedAttempts.get(clientIP);
    if (!attempts) return false;
    
    if (attempts.count >= MAX_FAILED_ATTEMPTS) {
      if (Date.now() - attempts.lastAttempt < LOCKOUT_DURATION) {
        return true;
      }
      // Lockout expired, reset
      failedAttempts.delete(clientIP);
    }
    return false;
  }

  /**
   * Get remaining lockout time in minutes
   * @param {string} clientIP - Client IP address
   * @returns {number} Remaining minutes
   */
  getRemainingLockoutTime(clientIP) {
    const attempts = failedAttempts.get(clientIP);
    if (!attempts || attempts.count < MAX_FAILED_ATTEMPTS) {
      return 0;
    }
    const remaining = LOCKOUT_DURATION - (Date.now() - attempts.lastAttempt);
    return Math.ceil(remaining / 60000); // Convert to minutes
  }

  /**
   * Record failed login attempt
   * @param {string} clientIP - Client IP address
   */
  recordFailedAttempt(clientIP) {
    const attempts = failedAttempts.get(clientIP) || { count: 0, lastAttempt: 0 };
    attempts.count++;
    attempts.lastAttempt = Date.now();
    failedAttempts.set(clientIP, attempts);
  }

  /**
   * Clear failed attempts for IP
   * @param {string} clientIP - Client IP address
   */
  clearFailedAttempts(clientIP) {
    failedAttempts.delete(clientIP);
  }

  /**
   * Get remaining attempts before lockout
   * @param {string} clientIP - Client IP address
   * @returns {number} Remaining attempts
   */
  getRemainingAttempts(clientIP) {
    const attempts = failedAttempts.get(clientIP);
    if (!attempts) return MAX_FAILED_ATTEMPTS;
    return Math.max(0, MAX_FAILED_ATTEMPTS - attempts.count);
  }

  /**
   * Authenticate admin with username and password
   * @param {string} username - Admin username
   * @param {string} password - Admin password
   * @param {string} clientIP - Client IP address
   * @returns {Promise<Object>} Auth result with token and admin info
   * @throws {Error} If authentication fails
   */
  async login(username, password, clientIP) {
    // Check lockout
    if (this.isLockedOut(clientIP)) {
      const remaining = this.getRemainingLockoutTime(clientIP);
      throw new Error(`Too many failed attempts. Account locked. Try again in ${remaining} minutes.`);
    }

    if (!username || !password) {
      throw new Error('Username and password are required');
    }

    // Find admin
    const admin = await Admin.findOne({ username: username.toLowerCase() });
    
    if (!admin) {
      this.recordFailedAttempt(clientIP);
      throw new Error('Invalid credentials');
    }

    // Verify password
    const isValid = await bcrypt.compare(password, admin.passwordHash);
    
    if (!isValid) {
      this.recordFailedAttempt(clientIP);
      const remaining = this.getRemainingAttempts(clientIP);
      throw new Error(`Invalid credentials. ${remaining > 0 ? `${remaining} attempts remaining.` : 'Account will be locked.'}`);
    }

    // Clear failed attempts on success
    this.clearFailedAttempts(clientIP);

    // Generate token
    const token = this.generateToken(admin);

    // Update last login
    admin.lastLogin = new Date();
    await admin.save();

    return {
      token,
      admin: {
        username: admin.username,
        role: admin.role || 'admin'
      },
      expiresIn: '7d'
    };
  }

  /**
   * Generate JWT token for admin
   * @param {Object} admin - Admin document
   * @returns {string} JWT token
   */
  generateToken(admin) {
    return jwt.sign(
      { 
        id: admin._id, 
        username: admin.username,
        role: admin.role || 'admin'
      }, 
      process.env.JWT_SECRET, 
      { expiresIn: '7d' }
    );
  }

  /**
   * Refresh token for existing admin
   * @param {string} adminId - Admin ID
   * @returns {Promise<Object>} New token
   * @throws {Error} If admin not found
   */
  async refreshToken(adminId) {
    const admin = await Admin.findById(adminId);
    
    if (!admin) {
      throw new Error('Admin not found');
    }

    const token = this.generateToken(admin);

    return {
      token,
      expiresIn: '7d'
    };
  }

  /**
   * Create initial admin account (setup)
   * @param {string} username - Admin username
   * @param {string} password - Admin password
   * @returns {Promise<Object>} Created admin info
   * @throws {Error} If setup fails
   */
  async setupAdmin(username, password) {
    // Check if any admin exists
    const adminCount = await Admin.countDocuments();
    
    if (adminCount > 0 && process.env.NODE_ENV === 'production') {
      throw new Error('Admin already exists. Use login instead.');
    }

    if (!username || !password) {
      throw new Error('Username and password are required');
    }

    // Password strength check
    if (password.length < 8) {
      throw new Error('Password must be at least 8 characters');
    }

    // Check if username exists
    const existing = await Admin.findOne({ username: username.toLowerCase() });
    if (existing) {
      throw new Error('Username already exists');
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

    return {
      admin: {
        username: admin.username,
        role: admin.role
      }
    };
  }

  /**
   * Start cleanup interval for old failed attempts
   */
  startCleanupInterval() {
    setInterval(() => {
      const now = Date.now();
      for (const [ip, attempts] of failedAttempts.entries()) {
        if (now - attempts.lastAttempt > LOCKOUT_DURATION * 2) {
          failedAttempts.delete(ip);
        }
      }
    }, 60 * 60 * 1000); // Every hour
  }
}

// Initialize cleanup interval
const authService = new AuthService();
authService.startCleanupInterval();

module.exports = authService;


