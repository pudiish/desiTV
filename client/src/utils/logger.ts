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
interface Logger {
  log: (...args: unknown[]) => void;
  info: (...args: unknown[]) => void;
  warn: (...args: unknown[]) => void;
  error: (...args: unknown[]) => void;
  debug: (label: string, ...args: unknown[]) => void;
  time: (label: string) => void;
  timeEnd: (label: string) => void;
}

const logger: Logger = {
  /**
   * Log debug messages (development only)
   */
  log: (...args: unknown[]) => {
    if (isDev) {
      console.log(...args);
    }
  },

  /**
   * Log info messages (development only)
   */
  info: (...args: unknown[]) => {
    if (isDev) {
      console.info(...args);
    }
  },

  /**
   * Log warnings (always shown)
   */
  warn: (...args: unknown[]) => {
    console.warn(...args);
  },

  /**
   * Log errors (always shown)
   */
  error: (...args: unknown[]) => {
    console.error(...args);
  },

  /**
   * Log debug messages with label (development only)
   */
  debug: (label: string, ...args: unknown[]) => {
    if (isDev) {
      console.log(`[${label}]`, ...args);
    }
  },

  /**
   * Log performance timing (development only)
   */
  time: (label: string) => {
    if (isDev) {
      console.time(label);
    }
  },

  timeEnd: (label: string) => {
    if (isDev) {
      console.timeEnd(label);
    }
  },
};

export default logger;
