/**
 * Admin Access Hook
 *
 * Provides access to check if the current user has platform admin privileges.
 * Admin status is fetched once and cached.
 *
 * Usage:
 *   const { isAdmin, adminRole, isLoading, error } = useAdminAccess();
 *
 *   if (isAdmin) {
 *     // render admin UI
 *   }
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
    queryKey: [...adminAccessKeys.all, user?.id],
    queryFn: () => api.checkAdminAccess(),
    enabled: !isAuthLoading && !!user, // Only check when user is authenticated
    staleTime: 5 * 60 * 1000, // 5 minutes - admin status rarely changes
    gcTime: 30 * 60 * 1000, // 30 minutes cache
    retry: 1, // Only retry once on failure
    refetchOnWindowFocus: false, // Don't refetch on tab focus
  });

  return {
    isAdmin: data?.is_admin ?? false,
    adminRole: data?.role ?? null,
    isLoading: isAuthLoading || isLoading,
    error: error instanceof Error ? error : null,
  };
}
