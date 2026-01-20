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

  const { data, isLoading, error } = useQuery({
    queryKey: adminAccessKeys.user(user?.id ?? 'anonymous'),
    queryFn: () => api.checkAdminAccess(),
    enabled: !isAuthLoading && !!user, // Only check when user is authenticated
    staleTime: 5 * 60 * 1000, // 5 minutes - admin status rarely changes
    gcTime: 30 * 60 * 1000, // 30 minutes cache
    retry: 2, // Retry twice on failure (handles transient auth errors)
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 5000), // Exponential backoff
    refetchOnWindowFocus: false, // Don't refetch on tab focus
    refetchOnMount: 'always', // Always check on mount to catch auth state changes
  });

  // Only show loading on initial load, not on background refetches
  // This prevents the admin portal from showing a loading spinner forever
  // when the API responds but isFetching is still true during refetch
  const showLoading = isAuthLoading || (isLoading && !data);

  return {
    isAdmin: data?.is_admin ?? false,
    adminRole: data?.role ?? null,
    isLoading: showLoading,
    error: error instanceof Error ? error : null,
  };
}
