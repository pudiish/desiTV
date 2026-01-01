/**
 * Logger Utility for Server
 * 
 * Conditionally logs messages based on environment.
 * In production, only errors and warnings are logged (reduces log verbosity).
 * In development, all logs are shown.
 */

const isDev = process.env.NODE_ENV !== 'production';

/**
 * Logger with environment-aware logging
 */
const logger = {
  /**
   * Log debug messages (development only)
   * @param {...any} args - Arguments to log
   */
  log(...args) {
    if (isDev) {
      console.log(...args);
    }
  },

  /**
   * Log info messages (development only)
   * @param {...any} args - Arguments to log
   */
  info(...args) {
    if (isDev) {
      console.info(...args);
    }
  },

  /**
   * Log warnings (always shown)
   * @param {...any} args - Arguments to log
   */
  warn(...args) {
    console.warn(...args);
  },

  /**
   * Log errors (always shown)
   * @param {...any} args - Arguments to log
   */
  error(...args) {
    console.error(...args);
  },

  /**
   * Log debug messages with label (development only)
   * @param {string} label - Label for the log
   * @param {...any} args - Arguments to log
   */
  debug(label, ...args) {
    if (isDev) {
      console.log(`[${label}]`, ...args);
    }
  },

  /**
   * Log with timestamp (always shown for important events)
   * @param {string} message - Message to log
   * @param {...any} args - Additional arguments
   */
  timestamp(message, ...args) {
    const ts = new Date().toISOString();
    console.log(`[${ts}] ${message}`, ...args);
  },

  /**
   * Log performance timing (development only)
   * @param {string} label - Timer label
   */
  time(label) {
    if (isDev) {
      console.time(label);
    }
  },

  /**
   * End performance timing (development only)
   * @param {string} label - Timer label
   */
  timeEnd(label) {
    if (isDev) {
      console.timeEnd(label);
    }
  },
};

module.exports = logger;
