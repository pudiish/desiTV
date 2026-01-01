/**
 * Centralized Error Handler Service
 * 
 * All errors across the app go through here for:
 * - Consistent formatting
 * - User-friendly messages
 * - Dev logging with context
 * - Optional: Sentry/Analytics integration
 */

export const ErrorCodes = {
  // Network errors
  NETWORK_TIMEOUT: 'E_001_TIMEOUT',
  NETWORK_FAILURE: 'E_002_NO_CONNECTION',
  API_ERROR: 'E_003_API_ERROR',
  
  // YouTube errors
  YOUTUBE_NOT_FOUND: 'E_101_YOUTUBE_NOT_FOUND',
  YOUTUBE_QUOTA: 'E_102_YOUTUBE_QUOTA',
  YOUTUBE_INVALID: 'E_103_YOUTUBE_INVALID_ID',
  
  // VJ Chat errors
  CHAT_TIMEOUT: 'E_201_CHAT_TIMEOUT',
  CHAT_INVALID_INPUT: 'E_202_INVALID_INPUT',
  
  // Generic errors
  UNKNOWN: 'E_999_UNKNOWN'
};

const ErrorMessages = {
  [ErrorCodes.NETWORK_TIMEOUT]: {
    user: 'Network slow! Try again in a moment 🌐',
    severity: 'warning'
  },
  [ErrorCodes.NETWORK_FAILURE]: {
    user: 'No internet connection. Check your WiFi! 📡',
    severity: 'error'
  },
  [ErrorCodes.API_ERROR]: {
    user: 'Server error. Please try again or contact support.',
    severity: 'error'
  },
  [ErrorCodes.YOUTUBE_NOT_FOUND]: {
    user: 'Video not found on YouTube. Try a different query! 🔍',
    severity: 'warning'
  },
  [ErrorCodes.YOUTUBE_QUOTA]: {
    user: 'YouTube quota exceeded. Try again later! 📺',
    severity: 'error'
  },
  [ErrorCodes.YOUTUBE_INVALID]: {
    user: 'Invalid YouTube link or ID. Check the URL and try again.',
    severity: 'warning'
  },
  [ErrorCodes.CHAT_TIMEOUT]: {
    user: 'DJ Desi is thinking... took too long! ⏱️',
    severity: 'warning'
  },
  [ErrorCodes.CHAT_INVALID_INPUT]: {
    user: 'Invalid chat input. Please correct your message and resend.',
    severity: 'warning'
  },
  [ErrorCodes.UNKNOWN]: {
    user: 'Something went wrong. Our team has been notified! 🚨',
    severity: 'error'
  }
};

class ErrorHandler {
  constructor() {
    this.isDev = process.env.NODE_ENV === 'development';
  }

  /**
   * Handle and format error
   * @param {Error} error - The error object
   * @param {string} context - Where the error occurred (e.g., 'VJChat', 'Player')
   * @param {string} errorCode - Custom error code from ErrorCodes
   * @returns {object} Formatted error with user message and dev logs
   */
  handle(error, context = 'Unknown', errorCode = ErrorCodes.UNKNOWN) {
    const userMessage = ErrorMessages[errorCode]?.user || ErrorMessages[ErrorCodes.UNKNOWN].user;
    const severity = ErrorMessages[errorCode]?.severity || 'error';

    // Dev logs (only in development or when user opens dev tools)
    if (this.isDev) {
      console.group(`❌ [${context}] ${errorCode}`);
      console.error('Error Object:', error);
      console.error('Message:', error.message);
      console.error('Stack:', error.stack);
      console.error('Timestamp:', new Date().toISOString());
      console.groupEnd();
    }

    // Send to analytics/error tracking in production
    if (!this.isDev && window.errorTracker) {
      window.errorTracker.captureException(error, {
        tags: { context, errorCode, severity },
        extra: { 
          userAgent: navigator.userAgent,
          url: window.location.href 
        }
      });
    }

    return {
      success: false,
      errorCode,
      userMessage,
      severity,
      devMessage: error.message,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Transform network errors to our error codes
   */
  classifyNetworkError(error) {
    if (error.code === 'ECONNABORTED' || error.message.includes('timeout')) {
      return ErrorCodes.NETWORK_TIMEOUT;
    }
    if (error.message.includes('Failed to fetch') || error.message.includes('Network')) {
      return ErrorCodes.NETWORK_FAILURE;
    }
    if (error.status >= 500) {
      return ErrorCodes.API_ERROR;
    }
    return ErrorCodes.UNKNOWN;
  }

  /**
   * Handle YouTube-specific errors
   */
  classifyYouTubeError(error, response) {
    if (response?.status === 404 || error.message.includes('not found')) {
      return ErrorCodes.YOUTUBE_NOT_FOUND;
    }
    if (error.message.includes('quota')) {
      return ErrorCodes.YOUTUBE_QUOTA;
    }
    if (error.message.includes('invalid')) {
      return ErrorCodes.YOUTUBE_INVALID;
    }
    return ErrorCodes.UNKNOWN;
  }
}

export const errorHandler = new ErrorHandler();
