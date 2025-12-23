/**
 * Centralized error handling utility
 *
 * Provides consistent error handling across the application with:
 * - Logging via the logger utility
 * - Toast notifications for user feedback
 * - Optional Sentry integration
 *
 * Usage:
 *   import { handleError, handleApiError } from '../utils/errorHandler';
 *
 *   try {
 *     await api.someCall();
 *   } catch (error) {
 *     handleError(error, 'MyComponent.someAction');
 *   }
 */

import { logger } from './logger';
import { toast } from '../components/ui/sonner';

/**
 * Extract a user-friendly message from an error
 * @param {Error|string|unknown} error
 * @returns {string}
 */
function extractErrorMessage(error) {
  if (!error) return 'An unexpected error occurred';

  if (typeof error === 'string') return error;

  if (error instanceof Error) {
    // Check for API error response
    if (error.message) return error.message;
  }

  // Check for API error object
  if (typeof error === 'object') {
    if (error.message) return error.message;
    if (error.error) return error.error;
    if (error.detail) return error.detail;
  }

  return 'An unexpected error occurred';
}

/**
 * Handle an error with logging and optional user notification
 *
 * @param {Error|string|unknown} error - The error to handle
 * @param {string} context - Where the error occurred (e.g., 'Settings.loadProfile')
 * @param {Object} options - Options
 * @param {boolean} options.showToast - Whether to show a toast notification (default: true)
 * @param {string} options.userMessage - Custom message to show user (default: extracted from error)
 * @param {boolean} options.silent - If true, don't log or show toast (default: false)
 * @returns {{ error: true, message: string }}
 */
export function handleError(error, context, options = {}) {
  const {
    showToast = true,
    userMessage = null,
    silent = false,
  } = options;

  const message = userMessage || extractErrorMessage(error);

  if (!silent) {
    // Log the error
    logger.error(`[${context}]`, error);

    // Show toast notification
    if (showToast) {
      toast.error(message);
    }
  }

  return { error: true, message };
}

/**
 * Handle an API error specifically
 * Extracts status codes and provides appropriate messaging
 *
 * @param {Error|Response|unknown} error - The API error
 * @param {string} context - Where the error occurred
 * @param {Object} options - Same options as handleError
 * @returns {{ error: true, message: string, status?: number }}
 */
export function handleApiError(error, context, options = {}) {
  let status = null;
  let message = extractErrorMessage(error);

  // Check for HTTP status
  if (error?.status) {
    status = error.status;

    // Provide user-friendly messages for common status codes
    switch (status) {
      case 401:
        message = options.userMessage || 'Please sign in to continue';
        break;
      case 403:
        message = options.userMessage || 'You don\'t have permission to do this';
        break;
      case 404:
        message = options.userMessage || 'The requested resource was not found';
        break;
      case 429:
        message = options.userMessage || 'Too many requests. Please try again later';
        break;
      case 500:
      case 502:
      case 503:
        message = options.userMessage || 'Server error. Please try again later';
        break;
      default:
        // Keep the extracted message
        break;
    }
  }

  const result = handleError(error, context, { ...options, userMessage: message });

  return { ...result, status };
}

/**
 * Wrap an async function with error handling
 * Useful for event handlers and callbacks
 *
 * @param {Function} fn - Async function to wrap
 * @param {string} context - Error context
 * @param {Object} options - Error handler options
 * @returns {Function} Wrapped function
 *
 * @example
 * const handleClick = withErrorHandling(
 *   async () => { await api.doSomething(); },
 *   'Button.handleClick'
 * );
 */
export function withErrorHandling(fn, context, options = {}) {
  return async (...args) => {
    try {
      return await fn(...args);
    } catch (error) {
      return handleError(error, context, options);
    }
  };
}

/**
 * Create a scoped error handler for a component
 *
 * @param {string} componentName - Name of the component
 * @returns {Object} Scoped error handler
 *
 * @example
 * const errorHandler = createErrorHandler('Settings');
 * errorHandler.handle(error, 'loadProfile');
 */
export function createErrorHandler(componentName) {
  return {
    handle: (error, action, options = {}) =>
      handleError(error, `${componentName}.${action}`, options),

    handleApi: (error, action, options = {}) =>
      handleApiError(error, `${componentName}.${action}`, options),

    wrap: (fn, action, options = {}) =>
      withErrorHandling(fn, `${componentName}.${action}`, options),
  };
}
