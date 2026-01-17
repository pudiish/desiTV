/**
 * Centralized Error Handler Service
 * 
 * All errors across the app go through here for:
 * - Consistent formatting
 * - User-friendly messages
 * - Dev logging with context
 * - Optional: Sentry/Analytics integration
 */

import logger from '../utils/logger';

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
} as const;

export type ErrorCode = typeof ErrorCodes[keyof typeof ErrorCodes];

interface ErrorMessage {
  user: string;
  severity: 'error' | 'warning' | 'info';
}

interface ErrorHandlerResult {
  success: false;
  errorCode: ErrorCode;
  userMessage: string;
  severity: 'error' | 'warning' | 'info';
  devMessage: string;
  timestamp: string;
}

const ErrorMessages: Record<ErrorCode, ErrorMessage> = {
  [ErrorCodes.NETWORK_TIMEOUT]: {
    user: 'Network slow! Try again in a moment 🌐',
    severity: 'warning'
  },
  [ErrorCodes.NETWORK_FAILURE]: {
    user: 'No internet connection. Check your WiFi! 📡',
    severity: 'error'
  },
  [ErrorCodes.API_ERROR]: {
    user: 'Server error. Try again in a moment! 🔧',
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
    user: 'Invalid video ID. Please try again! 🎬',
    severity: 'warning'
  },
  [ErrorCodes.CHAT_TIMEOUT]: {
    user: 'DJ Desi is thinking... took too long! ⏱️',
    severity: 'warning'
  },
  [ErrorCodes.CHAT_INVALID_INPUT]: {
    user: 'Invalid input. Please try again! 💬',
    severity: 'warning'
  },
  [ErrorCodes.UNKNOWN]: {
    user: 'Something went wrong. Our team has been notified! 🚨',
    severity: 'error'
  }
};

interface WindowWithErrorTracker extends Window {
  errorTracker?: {
    captureException: (error: Error, context: {
      tags: Record<string, string>;
      extra: Record<string, string>;
    }) => void;
  };
}

class ErrorHandler {
  private isDev: boolean;

  constructor() {
    this.isDev = import.meta.env.DEV || import.meta.env.MODE === 'development';
  }

  /**
   * Handle and format error
   */
  handle(
    error: Error | unknown,
    context: string = 'Unknown',
    errorCode: ErrorCode = ErrorCodes.UNKNOWN
  ): ErrorHandlerResult {
    const errorObj = error instanceof Error ? error : new Error(String(error));
    const userMessage = ErrorMessages[errorCode]?.user || ErrorMessages[ErrorCodes.UNKNOWN].user;
    const severity = ErrorMessages[errorCode]?.severity || 'error';

    // Dev logs (only in development or when user opens dev tools)
    if (this.isDev) {
      logger.error(`[${context}] ${errorCode}`, {
        message: errorObj.message,
        stack: errorObj.stack,
        error: errorObj,
        timestamp: new Date().toISOString()
      });
    } else {
      // Production: minimal logging
      logger.error(`[${context}] ${errorCode}: ${errorObj.message}`);
    }

    // Send to analytics/error tracking in production
    if (!this.isDev && typeof window !== 'undefined') {
      const win = window as WindowWithErrorTracker;
      if (win.errorTracker) {
        win.errorTracker.captureException(errorObj, {
          tags: { context, errorCode, severity },
          extra: { 
            userAgent: navigator.userAgent,
            url: window.location.href 
          }
        });
      }
    }

    return {
      success: false,
      errorCode,
      userMessage,
      severity,
      devMessage: errorObj.message,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Transform network errors to our error codes
   */
  classifyNetworkError(error: Error | { code?: string; message?: string; status?: number }): ErrorCode {
    if ('code' in error && error.code === 'ECONNABORTED') {
      return ErrorCodes.NETWORK_TIMEOUT;
    }
    if (error.message?.includes('timeout')) {
      return ErrorCodes.NETWORK_TIMEOUT;
    }
    if (error.message?.includes('Failed to fetch') || error.message?.includes('Network')) {
      return ErrorCodes.NETWORK_FAILURE;
    }
    if ('status' in error && error.status && error.status >= 500) {
      return ErrorCodes.API_ERROR;
    }
    return ErrorCodes.UNKNOWN;
  }

  /**
   * Handle YouTube-specific errors
   */
  classifyYouTubeError(
    error: Error | { message?: string },
    response?: { status?: number }
  ): ErrorCode {
    if (response?.status === 404 || error.message?.includes('not found')) {
      return ErrorCodes.YOUTUBE_NOT_FOUND;
    }
    if (error.message?.includes('quota')) {
      return ErrorCodes.YOUTUBE_QUOTA;
    }
    if (error.message?.includes('invalid')) {
      return ErrorCodes.YOUTUBE_INVALID;
    }
    return ErrorCodes.UNKNOWN;
  }
}

export const errorHandler = new ErrorHandler();
