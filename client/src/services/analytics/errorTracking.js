/**
 * Error Tracking Utility
 * 
 * Provides centralized error tracking that can integrate with services like Sentry
 * Works gracefully without external services (logs to console)
 * 
 * Usage:
 *   import errorTracking from './utils/errorTracking'
 *   errorTracking.captureException(error, { context: 'Player' })
 */

class ErrorTracking {
  constructor() {
    this.isInitialized = false;
    this.service = null; // Will be set to 'sentry' if available
    // Use import.meta.env for Vite (browser) instead of process.env (Node.js)
    this.enabled = import.meta.env.MODE === 'production' || import.meta.env.PROD;
  }

  /**
   * Initialize error tracking service
   * Currently supports Sentry (optional)
   */
  init(options = {}) {
    if (this.isInitialized) {
      console.warn('[ErrorTracking] Already initialized');
      return;
    }

    // Check if Sentry is available (optional dependency)
    const sentryDsn = options.sentryDsn || import.meta.env.VITE_SENTRY_DSN;
    if (sentryDsn) {
      try {
        // Dynamic import - only loads if Sentry is installed
        // This allows the app to work without Sentry
        this._initSentry(sentryDsn, options);
        this.service = 'sentry';
        console.log('[ErrorTracking] Sentry initialized');
      } catch (err) {
        console.warn('[ErrorTracking] Sentry not available, using console logging:', err.message);
        this.service = 'console';
      }
    } else {
      this.service = 'console';
      console.log('[ErrorTracking] Using console logging (no Sentry DSN provided)');
    }

    this.isInitialized = true;
    this._setupGlobalErrorHandlers();
  }

  /**
   * Initialize Sentry (if available)
   */
  _initSentry(dsn, options = {}) {
    // Try to use Sentry if available
    // This is a graceful fallback - app works without it
    if (typeof window !== 'undefined' && window.Sentry) {
      window.Sentry.init({
        dsn: dsn,
        environment: import.meta.env.MODE || import.meta.env.NODE_ENV || 'development',
        tracesSampleRate: options.tracesSampleRate || 0.1, // 10% of transactions
        beforeSend(event, hint) {
          // Filter out browser extension errors
          if (event.exception) {
            const error = hint.originalException || hint.syntheticException;
            if (error && error.message) {
              if (
                error.message.includes('runtime.lastError') ||
                error.message.includes('content-script') ||
                error.message.includes('AdUnit')
              ) {
                return null; // Don't send browser extension errors
              }
            }
          }
          return event;
        },
        ...options.sentryOptions
      });
      this.service = 'sentry';
    } else {
      // Sentry not loaded - will use console logging
      throw new Error('Sentry not available');
    }
  }

  /**
   * Setup global error handlers
   */
  _setupGlobalErrorHandlers() {
    if (typeof window === 'undefined') return;

    // Global error handler
    window.addEventListener('error', (event) => {
      this.captureException(event.error || new Error(event.message), {
        type: 'unhandledError',
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno
      });
    });

    // Unhandled promise rejection handler
    window.addEventListener('unhandledrejection', (event) => {
      this.captureException(event.reason, {
        type: 'unhandledRejection',
        promise: true
      });
    });
  }

  /**
   * Capture an exception/error
   */
  captureException(error, context = {}) {
    if (!error) return;

    const errorInfo = {
      message: error.message || String(error),
      stack: error.stack,
      name: error.name,
      context: context,
      timestamp: new Date().toISOString(),
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown',
      url: typeof window !== 'undefined' ? window.location.href : 'unknown'
    };

    // Send to Sentry if available
    if (this.service === 'sentry' && window.Sentry) {
      try {
        window.Sentry.captureException(error, {
          contexts: {
            custom: context
          },
          tags: {
            component: context.component || 'unknown',
            type: context.type || 'error'
          }
        });
      } catch (err) {
        console.error('[ErrorTracking] Failed to send to Sentry:', err);
        this._logToConsole(errorInfo);
      }
    } else {
      // Fallback to console logging
      this._logToConsole(errorInfo);
    }
  }

  /**
   * Capture a message (non-error)
   */
  captureMessage(message, level = 'info', context = {}) {
    const messageInfo = {
      message: message,
      level: level,
      context: context,
      timestamp: new Date().toISOString()
    };

    if (this.service === 'sentry' && window.Sentry) {
      try {
        window.Sentry.captureMessage(message, {
          level: level,
          contexts: {
            custom: context
          }
        });
      } catch (err) {
        console.log('[ErrorTracking]', messageInfo);
      }
    } else {
      console.log('[ErrorTracking]', messageInfo);
    }
  }

  /**
   * Log to console (fallback)
   */
  _logToConsole(errorInfo) {
    if (this.enabled) {
      // In production, log structured error info
      console.error('[ErrorTracking]', JSON.stringify(errorInfo, null, 2));
    } else {
      // In development, log with full details
      console.error('[ErrorTracking] Error captured:', errorInfo);
    }
  }

  /**
   * Set user context (for Sentry)
   */
  setUser(user) {
    if (this.service === 'sentry' && window.Sentry) {
      window.Sentry.setUser(user);
    }
  }

  /**
   * Clear user context
   */
  clearUser() {
    if (this.service === 'sentry' && window.Sentry) {
      window.Sentry.setUser(null);
    }
  }

  /**
   * Add breadcrumb (for Sentry)
   */
  addBreadcrumb(breadcrumb) {
    if (this.service === 'sentry' && window.Sentry) {
      window.Sentry.addBreadcrumb(breadcrumb);
    }
  }
}

// Export singleton instance
const errorTracking = new ErrorTracking();
export default errorTracking;

