/**
 * Admin Access Hook
 *
 * Provides access to check if the current user has platform admin privileges.
 * Admin status is fetched once and cached per user session.
 *
 * Usage:
 *   const { isAdmin, adminRole, isLoading, error } = useAdminAccess();
 *
 *   if (isAdmin) {
 *     // render admin UI
 *   }
 *
 * Note: Query is keyed by user ID, so it automatically refetches when user changes.
 * On auth errors (rate limiting, expired tokens), retry after re-authentication.
 */

import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../api';
import { useAuth } from '../AuthContext';

export interface AdminAccessState {
  isAdmin: boolean;
  adminRole: string | null;
  isLoading: boolean;
  error: Error | null;
}

export const adminAccessKeys = {
  all: ['admin-access'] as const,
  user: (userId: string) => ['admin-access', userId] as const,
};

// Timeout for admin access check (15 seconds)
const AUTH_LOADING_TIMEOUT_MS = 15000;

/**
 * Hook to check admin access for the current user.
 *
 * @returns {AdminAccessState} Admin access state
 * @returns {boolean} isAdmin - True if user is a platform admin
 * @returns {string|null} adminRole - Admin role ('super_admin', 'admin', etc.) or null
 * @returns {boolean} isLoading - True while checking admin status
 * @returns {Error|null} error - Error object if check failed
 */
export function useAdminAccess(): AdminAccessState {
  const { user, loading: isAuthLoading } = useAuth();
  const [authTimeout, setAuthTimeout] = useState(false);

  // Timeout mechanism for auth loading
  // If auth loading takes too long (e.g., Supabase is down), show error instead of spinner
  useEffect(() => {
    // Only set up timeout if auth is actively loading
    if (!isAuthLoading) {
      // Clear timeout state if auth finished - use queueMicrotask to avoid
      // synchronous setState in effect body (violates react-hooks/set-state-in-effect)
      if (authTimeout) {
        queueMicrotask(() => setAuthTimeout(false));
      }
      return;
    }

    // Set a timeout to prevent infinite loading
    const timeoutId = setTimeout(() => {
      console.error('[useAdminAccess] Auth loading timeout after', AUTH_LOADING_TIMEOUT_MS, 'ms');
      setAuthTimeout(true);
    }, AUTH_LOADING_TIMEOUT_MS);

    return () => clearTimeout(timeoutId);
  }, [isAuthLoading, authTimeout]);

  const { data, isLoading, error } = useQuery({
    queryKey: adminAccessKeys.user(user?.id ?? 'anonymous'),
    queryFn: () => api.checkAdminAccess(),
    enabled: !isAuthLoading && !authTimeout && !!user, // Only check when user is authenticated and no timeout
    staleTime: 5 * 60 * 1000, // 5 minutes - admin status rarely changes
    gcTime: 30 * 60 * 1000, // 30 minutes cache
    retry: 2, // Retry twice on failure (handles transient auth errors)
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 5000), // Exponential backoff
    refetchOnWindowFocus: false, // Don't refetch on tab focus
    refetchOnMount: 'always', // Always check on mount to catch auth state changes
  });

  // Determine loading state:
  // - Show loading if auth is loading (and not timed out)
  // - Show loading if query is loading and has no cached data
  const showLoading = (isAuthLoading && !authTimeout) || (isLoading && !data);

  // Determine error state:
  // - If auth timed out, show timeout error
  // - Otherwise, show query error if any
  const effectiveError = authTimeout
    ? new Error('Authentication is taking too long. Please refresh the page or check your network connection.')
    : (error instanceof Error ? error : null);

  return {
    isAdmin: data?.is_admin ?? false,
    adminRole: data?.role ?? null,
    isLoading: showLoading,
    error: effectiveError,
  };
}
