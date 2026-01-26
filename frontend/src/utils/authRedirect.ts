/**
 * Auth Redirect Utilities
 *
 * Handles preserving and restoring return URLs across OAuth redirects.
 * Uses sessionStorage so the return URL only persists for the current browser session.
 *
 * Problem: When a user clicks "Sign in with Google" while on a page like
 * /?returnTo=/accept-company-invite?token=xxx, the OAuth flow redirects
 * away and back, losing the returnTo query parameter.
 *
 * Solution: Save the returnTo URL to sessionStorage before OAuth, then
 * consume it after authentication completes.
 */

const AUTH_RETURN_KEY = 'auth_return_to';

/**
 * Saves the current returnTo URL parameter to sessionStorage.
 * Call this before initiating an OAuth redirect.
 */
export function saveReturnUrl(): void {
  const returnTo = new URLSearchParams(window.location.search).get('returnTo');
  if (returnTo) {
    sessionStorage.setItem(AUTH_RETURN_KEY, returnTo);
  }
}

/**
 * Retrieves and removes the saved return URL from sessionStorage.
 * Returns null if no URL was saved.
 */
export function consumeReturnUrl(): string | null {
  const url = sessionStorage.getItem(AUTH_RETURN_KEY);
  if (url) {
    sessionStorage.removeItem(AUTH_RETURN_KEY);
  }
  return url;
}

/**
 * Clears any saved return URL without returning it.
 * Useful for cleanup in error scenarios.
 */
export function clearReturnUrl(): void {
  sessionStorage.removeItem(AUTH_RETURN_KEY);
}
