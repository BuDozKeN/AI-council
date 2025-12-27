/**
 * Sentry Error Tracking Configuration
 *
 * Initializes Sentry for production error monitoring.
 * Set VITE_SENTRY_DSN in your .env file to enable.
 */

import * as Sentry from '@sentry/react';

const SENTRY_DSN = import.meta.env.VITE_SENTRY_DSN;
const IS_PRODUCTION = import.meta.env.PROD;

export function initSentry() {
  // Only initialize if DSN is configured
  if (!SENTRY_DSN) {
    if (IS_PRODUCTION) {
      console.warn('Sentry DSN not configured. Error tracking disabled.');
    }
    return;
  }

  Sentry.init({
    dsn: SENTRY_DSN,

    // Only enable in production by default
    enabled: IS_PRODUCTION,

    // Capture 100% of transactions for performance monitoring
    // Adjust in production based on volume
    tracesSampleRate: IS_PRODUCTION ? 0.1 : 1.0,

    // Session replay for debugging (10% of sessions, 100% on error)
    replaysSessionSampleRate: 0.1,
    replaysOnErrorSampleRate: 1.0,

    // Environment tag
    environment: IS_PRODUCTION ? 'production' : 'development',

    // Filter out noisy errors
    ignoreErrors: [
      // Browser extensions
      /^chrome-extension:\/\//,
      /^moz-extension:\/\//,
      // Network errors (usually user connectivity)
      'Network Error',
      'Failed to fetch',
      'Load failed',
      // User-initiated aborts
      'AbortError',
      // ResizeObserver loop errors (benign)
      'ResizeObserver loop',
    ],

    // Don't send PII
    beforeSend(event) {
      // Remove any email addresses from error messages
      if (event.message) {
        event.message = event.message.replace(
          /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
          '[email]'
        );
      }
      return event;
    },

    integrations: [
      // Browser tracing for performance
      Sentry.browserTracingIntegration(),
      // Session replay
      Sentry.replayIntegration({
        maskAllText: false,
        blockAllMedia: false,
      }),
    ],
  });
}

// Export Sentry for manual error capturing
export { Sentry };

// Helper to capture errors with additional context
export function captureError(error: unknown, context: Record<string, unknown> = {}) {
  if (!SENTRY_DSN) return;

  Sentry.withScope((scope) => {
    Object.entries(context).forEach(([key, value]) => {
      scope.setExtra(key, value);
    });
    Sentry.captureException(error);
  });
}

// Set user context (call after login)
export function setUserContext(user: { id: string; email?: string } | null) {
  if (!SENTRY_DSN || !user) return;

  Sentry.setUser({
    id: user.id,
    ...(user.email ? { email: user.email } : {}),
  });
}

// Clear user context (call after logout)
export function clearUserContext() {
  if (!SENTRY_DSN) return;
  Sentry.setUser(null);
}
