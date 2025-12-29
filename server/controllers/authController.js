/**
 * Auth Controller
 * 
 * Handles HTTP requests/responses for authentication endpoints.
 * Delegates business logic to AuthService.
 */

const authService = require('../services/authService');

class AuthController {
  /**
   * POST /api/auth/login
   * Admin login with username/password
   */
  async login(request, response) {
    try {
      const clientIP = request.ip || request.connection.remoteAddress;
      
      // Check lockout
      if (authService.isLockedOut(clientIP)) {
        const remaining = authService.getRemainingLockoutTime(clientIP);
        return response.status(429).json({ 
          error: 'Too many failed attempts',
          message: `Account locked. Try again in ${remaining} minutes.`
        });
      }

      const { username, password } = request.body;

      const result = await authService.login(username, password, clientIP);
      
      console.log(`[AuthController] Admin "${username}" logged in from ${clientIP}`);
      
      response.json({ 
        success: true,
        ...result
      });
      
    } catch (error) {
      const clientIP = request.ip || request.connection.remoteAddress;
      
      if (error.message.includes('Too many failed attempts')) {
        return response.status(429).json({ 
          error: 'Too many failed attempts',
          message: error.message
        });
      }

      if (error.message === 'Invalid credentials') {
        const remaining = authService.getRemainingAttempts(clientIP);
        return response.status(401).json({ 
          error: 'Authentication failed',
          message: error.message
        });
      }

      if (error.message === 'Username and password are required') {
        return response.status(400).json({ 
          error: 'Validation error',
          message: error.message
        });
      }

      console.error('[AuthController] Login error:', error.message);
      response.status(500).json({ 
        error: 'Server error',
        message: 'Login failed. Please try again.'
      });
    }
  }

  /**
   * GET /api/auth/verify
   * Verify if current token is valid
   */
  async verify(request, response) {
    response.json({ 
      valid: true,
      admin: {
        username: request.admin.username,
        role: request.admin.role
      }
    });
  }

  /**
   * POST /api/auth/refresh
   * Refresh token before expiry
   */
  async refresh(request, response) {
    try {
      const result = await authService.refreshToken(request.admin.id);
      
      response.json({ 
        success: true,
        ...result
      });
      
    } catch (error) {
      if (error.message === 'Admin not found') {
        return response.status(404).json({ 
          error: 'Admin not found',
          message: 'Please login again'
        });
      }

      console.error('[AuthController] Refresh error:', error.message);
      response.status(500).json({ 
        error: 'Server error',
        message: 'Token refresh failed'
      });
    }
  }

  /**
   * POST /api/auth/logout
   * Logout (client-side token removal, server can track for blacklist)
   */
  async logout(request, response) {
    // In a production app, you'd add the token to a blacklist
    // For free tier, we rely on client-side token removal
    console.log(`[AuthController] Admin "${request.admin.username}" logged out`);
    response.json({ 
      success: true,
      message: 'Logged out successfully'
    });
  }

  /**
   * POST /api/auth/setup
   * One-time admin setup (only in development or if no admins exist)
   */
  async setup(request, response) {
    try {
      const { username, password } = request.body;

      const result = await authService.setupAdmin(username, password);
      
      console.log(`[AuthController] New admin "${username}" created`);
      
      response.status(201).json({ 
        success: true,
        message: 'Admin created successfully',
        ...result
      });
      
    } catch (error) {
      if (error.message === 'Admin already exists. Use login instead.') {
        return response.status(403).json({ 
          error: 'Setup disabled',
          message: error.message
        });
      }

      if (error.message === 'Username already exists') {
        return response.status(409).json({ 
          error: 'Conflict',
          message: error.message
        });
      }

      if (error.message.includes('required') || error.message.includes('at least')) {
        return response.status(400).json({ 
          error: 'Validation error',
          message: error.message
        });
      }

      console.error('[AuthController] Setup error:', error.message);
      response.status(500).json({ 
        error: 'Server error',
        message: 'Admin setup failed'
      });
    }
  }
}

module.exports = new AuthController();


