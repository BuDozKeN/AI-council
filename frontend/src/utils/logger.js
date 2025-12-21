/**
 * Centralized logging utility with environment-aware log levels.
 *
 * Usage:
 *   import { logger } from './utils/logger';
 *   logger.debug('Detailed debug info');  // Only in development
 *   logger.info('General info');           // Always shown
 *   logger.warn('Warning message');        // Always shown
 *   logger.error('Error occurred', error); // Always shown + sent to Sentry
 *
 * Log levels in production: warn, error only
 * Log levels in development: debug, info, warn, error
 */

const isDev = import.meta.env.DEV;
const LOG_LEVEL = isDev ? 'debug' : 'warn';

const LEVELS = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

const currentLevel = LEVELS[LOG_LEVEL] ?? LEVELS.warn;

/**
 * Format a log message with timestamp and optional context
 */
function formatMessage(level, args) {
  const timestamp = new Date().toISOString().split('T')[1].slice(0, 12);
  const prefix = `[${timestamp}] [${level.toUpperCase()}]`;
  return [prefix, ...args];
}

export const logger = {
  /**
   * Debug-level logging (development only)
   * Use for detailed debugging info, API responses, state changes
   */
  debug: (...args) => {
    if (currentLevel <= LEVELS.debug) {
      console.log(...formatMessage('debug', args));
    }
  },

  /**
   * Info-level logging
   * Use for general operational info, user actions, flow milestones
   */
  info: (...args) => {
    if (currentLevel <= LEVELS.info) {
      console.info(...formatMessage('info', args));
    }
  },

  /**
   * Warning-level logging (always shown)
   * Use for recoverable issues, deprecation notices, fallback behavior
   */
  warn: (...args) => {
    if (currentLevel <= LEVELS.warn) {
      console.warn(...formatMessage('warn', args));
    }
  },

  /**
   * Error-level logging (always shown)
   * Use for errors, failures, exceptions
   * Errors are also captured by Sentry if configured
   */
  error: (...args) => {
    if (currentLevel <= LEVELS.error) {
      console.error(...formatMessage('error', args));
    }
  },

  /**
   * Log API request/response for debugging
   * Only logs in development
   */
  api: (method, url, data) => {
    if (currentLevel <= LEVELS.debug) {
      console.log(`[API] ${method} ${url}`, data);
    }
  },

  /**
   * Create a scoped logger with a prefix
   * Useful for component-specific logging
   *
   * Usage:
   *   const log = logger.scope('MyComponent');
   *   log.debug('mounting');
   */
  scope: (name) => ({
    debug: (...args) => logger.debug(`[${name}]`, ...args),
    info: (...args) => logger.info(`[${name}]`, ...args),
    warn: (...args) => logger.warn(`[${name}]`, ...args),
    error: (...args) => logger.error(`[${name}]`, ...args),
  }),
};

// Also export individual functions for tree-shaking
export const { debug, info, warn, error } = logger;
