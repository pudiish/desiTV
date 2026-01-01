/**
 * Logger Utility
 * 
 * Conditionally logs messages based on environment.
 * In production, only errors and warnings are logged.
 * In development, all logs are shown.
 */

const isDev = import.meta.env.DEV || import.meta.env.MODE === 'development';

/**
 * Logger with environment-aware logging
 */
const logger = {
  /**
   * Log debug messages (development only)
   */
  log: (...args) => {
    if (isDev) {
      console.log(...args);
    }
  },

  /**
   * Log info messages (development only)
   */
  info: (...args) => {
    if (isDev) {
      console.info(...args);
    }
  },

  /**
   * Log warnings (always shown)
   */
  warn: (...args) => {
    console.warn(...args);
  },

  /**
   * Log errors (always shown)
   */
  error: (...args) => {
    console.error(...args);
  },

  /**
   * Log debug messages with label (development only)
   */
  debug: (label, ...args) => {
    if (isDev) {
      console.log(`[${label}]`, ...args);
    }
  },

  /**
   * Log performance timing (development only)
   */
  time: (label) => {
    if (isDev) {
      console.time(label);
    }
  },

  timeEnd: (label) => {
    if (isDev) {
      console.timeEnd(label);
    }
  },
};

export default logger;
