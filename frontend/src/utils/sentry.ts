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
      // Vite chunk preload errors (stale cache after deployments)
      // These self-resolve when user gets fresh assets
      /Unable to preload CSS/,
      /dynamically imported module/,
      /Failed to fetch dynamically/,
      // Service worker registration failures (non-critical PWA feature)
      // Common causes: network issues, ad blockers, browser restrictions
      /serviceWorker/i,
      /sw\.js/,
    ],

    // Filter errors by URL pattern (external scripts, extensions)
    denyUrls: [
      // Browser extensions
      /extensions\//i,
      /^chrome:\/\//i,
      /^chrome-extension:\/\//i,
      /^moz-extension:\/\//i,
      // Vercel/analytics scripts that may cause SW errors
      /registerSW\.js/i,
    ],

    // Don't send PII and filter out deployment-related errors
    beforeSend(event) {
      // Get error message from exception or event
      const errorValue = event.exception?.values?.[0]?.value || event.message || '';

      // Filter out CSS/chunk preload errors (stale cache after deployments)
      // These are handled by auto-reload in main.tsx - no need to report
      if (
        errorValue.includes('Unable to preload CSS') ||
        errorValue.includes('Failed to fetch dynamically') ||
        errorValue.includes('dynamically imported module') ||
        (errorValue.includes('/assets/') && errorValue.includes('preload'))
      ) {
        return null; // Drop the event
      }

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
