/**
 * Impersonation Hook
 *
 * Manages admin impersonation sessions for viewing the platform as another user.
 *
 * Features:
 * - Start/end impersonation sessions
 * - Automatic session expiry detection
 * - Session persistence in sessionStorage
 * - Real-time countdown to expiry
 * - Full audit trail (backend-side)
 *
 * Usage:
 *   const {
 *     isImpersonating,
 *     session,
 *     timeRemaining,
 *     startImpersonation,
 *     endImpersonation,
 *     isLoading,
 *   } = useImpersonation();
 *
 * Security:
 * - Only admins can impersonate (backend enforced)
 * - Cannot impersonate other admins
 * - 30-minute maximum session duration
 * - All actions logged for audit
 */

import { useState, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../api';
import type { ImpersonationSession } from '../api';
import { useAdminAccess } from './useAdminAccess';

// Session storage key for impersonation data
const IMPERSONATION_STORAGE_KEY = 'axcouncil_impersonation_session';

// Query keys
export const impersonationKeys = {
  all: ['impersonation'] as const,
  status: (sessionId?: string) => ['impersonation', 'status', sessionId] as const,
  sessions: (params?: Record<string, unknown>) => ['impersonation', 'sessions', params] as const,
};

export interface ImpersonationState {
  /** Whether currently impersonating a user */
  isImpersonating: boolean;
  /** Current impersonation session (if active) */
  session: ImpersonationSession | null;
  /** Seconds remaining until session expires */
  timeRemaining: number;
  /** Formatted time remaining (e.g., "12:34") */
  timeRemainingFormatted: string;
  /** Whether session check is in progress */
  isLoading: boolean;
  /** Whether start/end mutation is in progress */
  isMutating: boolean;
  /** Error from the last operation */
  error: Error | null;
  /** Start impersonating a user */
  startImpersonation: (targetUserId: string, reason: string) => Promise<void>;
  /** End the current impersonation session */
  endImpersonation: () => Promise<void>;
  /** Refresh session status from server */
  refreshStatus: () => void;
}

/**
 * Get impersonation session from storage.
 */
function getStoredSession(): ImpersonationSession | null {
  try {
    const stored = sessionStorage.getItem(IMPERSONATION_STORAGE_KEY);
    if (!stored) return null;
    return JSON.parse(stored) as ImpersonationSession;
  } catch {
    return null;
  }
}

/**
 * Store impersonation session.
 */
function storeSession(session: ImpersonationSession | null): void {
  try {
    if (session) {
      sessionStorage.setItem(IMPERSONATION_STORAGE_KEY, JSON.stringify(session));
    } else {
      sessionStorage.removeItem(IMPERSONATION_STORAGE_KEY);
    }
  } catch {
    // Ignore storage errors
  }
}

/**
 * Calculate seconds remaining until expiry.
 */
function calculateTimeRemaining(expiresAt: string): number {
  const expiry = new Date(expiresAt).getTime();
  const now = Date.now();
  return Math.max(0, Math.floor((expiry - now) / 1000));
}

/**
 * Format seconds as MM:SS string.
 */
function formatTimeRemaining(seconds: number): string {
  if (seconds <= 0) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Hook to manage admin impersonation sessions.
 */
export function useImpersonation(): ImpersonationState {
  const queryClient = useQueryClient();
  const { isAdmin, isLoading: isAdminLoading } = useAdminAccess();

  // Check for session ID in URL (backup mechanism for redirect)
  const urlParams = new URLSearchParams(window.location.search);
  const urlSessionId = urlParams.get('imp_session');

  // DEBUG: Check sessionStorage immediately on hook init
  const rawStorage = sessionStorage.getItem('axcouncil_impersonation_session');
  console.log('[useImpersonation] RAW sessionStorage on init:', rawStorage);
  console.log('[useImpersonation] URL session param:', urlSessionId);

  // Local state for countdown timer
  const [timeRemaining, setTimeRemaining] = useState(0);

  // Track stored session in state so it updates when storage changes
  // Use lazy initializer so this runs synchronously during first render
  const [storedSession, setStoredSession] = useState<ImpersonationSession | null>(() => {
    const initial = getStoredSession();
    console.log(
      '[useImpersonation] Initial stored session:',
      initial ? initial.session_id : 'null'
    );
    return initial;
  });

  // If we have a URL session ID but no stored session, we need to fetch the session from server
  // This handles the case where sessionStorage didn't persist across redirect
  // DON'T clean up the URL until AFTER we have the session stored
  useEffect(() => {
    if (urlSessionId && storedSession) {
      // We have both URL param and stored session - safe to clean up URL
      console.log('[useImpersonation] Session stored, cleaning up URL param');
      const newUrl = window.location.pathname;
      window.history.replaceState({}, '', newUrl);
    } else if (urlSessionId && !storedSession) {
      console.log(
        '[useImpersonation] URL has session ID but no stored session, waiting for server response...'
      );
    }
  }, [urlSessionId, storedSession]);

  // Use URL session ID as fallback if no stored session
  // Convert null to undefined for type compatibility
  const sessionId = storedSession?.session_id ?? urlSessionId ?? undefined;

  // Re-read storage on mount and when page becomes visible (handles page reload)
  useEffect(() => {
    const updateFromStorage = () => {
      const current = getStoredSession();
      console.log(
        '[useImpersonation] Reading from storage:',
        current ? current.session_id : 'null'
      );
      setStoredSession(current);
    };

    // Check on mount
    updateFromStorage();

    // Check when page becomes visible (tab switching)
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        updateFromStorage();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, []);

  // Query server for session status
  // IMPORTANT: Only enable when user is CONFIRMED as admin (not just loading)
  // This prevents unauthenticated requests that return false negatives
  console.log('[useImpersonation] Query config:', {
    sessionId,
    isAdmin,
    isAdminLoading,
    enabled: !!sessionId && isAdmin && !isAdminLoading,
  });
  const {
    data: statusData,
    isLoading,
    error: statusError,
    refetch: refreshStatus,
  } = useQuery({
    queryKey: impersonationKeys.status(sessionId),
    queryFn: async () => {
      console.log('[useImpersonation] Fetching status from server...');
      const result = await api.getImpersonationStatus(sessionId);
      console.log('[useImpersonation] Server status response:', result);
      return result;
    },
    // ONLY enable when user is CONFIRMED as admin - prevents unauthenticated requests
    enabled: !!sessionId && isAdmin && !isAdminLoading,
    staleTime: 30 * 1000, // 30 seconds
    gcTime: 5 * 60 * 1000, // 5 minutes
    refetchInterval: 60 * 1000, // Check every minute for expiry
    refetchOnWindowFocus: true, // Check on tab focus
  });

  // Determine active session (prefer server response over local storage)
  // If server confirms impersonating and we have session data, store it
  // If server says not impersonating, clear local storage
  useEffect(() => {
    console.log('[useImpersonation] Session sync effect:', {
      isAdminLoading,
      isAdmin,
      statusData_is_impersonating: statusData?.is_impersonating,
      storedSession: storedSession?.session_id ?? null,
      urlSessionId,
    });

    // If server confirms impersonation and we don't have it stored, store it
    // Using setTimeout(0) to defer state update and satisfy React compiler lint rules
    if (statusData?.is_impersonating && statusData.session && !storedSession) {
      console.log('[useImpersonation] Server confirms impersonation, storing session');
      storeSession(statusData.session);
      const sessionToStore = statusData.session;
      const timeout = setTimeout(() => setStoredSession(sessionToStore), 0);
      return () => clearTimeout(timeout);
    }

    // If server says not impersonating and we have a stored session, clear it
    // BUT only trust the response when:
    // - Admin check is complete (not still loading)
    // - User is confirmed admin (so request was authenticated)
    // This prevents false negatives from unauthenticated requests
    // Using setTimeout(0) to defer state update and satisfy React compiler lint rules
    if (!isAdminLoading && isAdmin && statusData && !statusData.is_impersonating && storedSession) {
      console.log('[useImpersonation] Server says not impersonating, clearing storage');
      storeSession(null);
      const timeout = setTimeout(() => setStoredSession(null), 0);
      return () => clearTimeout(timeout);
    }
    return undefined;
  }, [statusData, storedSession, isAdminLoading, isAdmin, urlSessionId]);

  // Use server session if available, fallback to stored session
  const session =
    statusData?.is_impersonating && statusData.session ? statusData.session : storedSession;

  // Check if session is expired (client-side check)
  const isSessionExpired = session ? calculateTimeRemaining(session.expires_at) <= 0 : true;

  // User is impersonating if:
  // 1. We have a stored session that's not expired AND
  // 2. Server hasn't explicitly said "not impersonating" (or we haven't checked yet)
  //
  // IMPORTANT: Show banner immediately based on stored session, don't wait for server
  // Only trust server "not impersonating" response when:
  // - Admin check is complete (not still loading)
  // - User is confirmed admin (so the API request was authenticated)
  // - The query has actually run (statusData is defined)
  // - Server explicitly returned is_impersonating: false
  // This prevents false negatives when auth token isn't ready yet
  const serverExplicitlyDenied =
    !isAdminLoading && isAdmin && statusData !== undefined && statusData.is_impersonating === false;
  const isImpersonating = !!session && !isSessionExpired && !serverExplicitlyDenied;
  console.log('[useImpersonation] Final state:', {
    session: session?.session_id ?? null,
    isSessionExpired,
    isAdmin,
    isAdminLoading,
    statusData_is_impersonating: statusData?.is_impersonating,
    serverExplicitlyDenied,
    isImpersonating,
  });

  // Start impersonation mutation
  const startMutation = useMutation({
    mutationFn: ({ targetUserId, reason }: { targetUserId: string; reason: string }) =>
      api.startImpersonation(targetUserId, reason),
    onSuccess: (data) => {
      if (data.success && data.session) {
        storeSession(data.session);
        setStoredSession(data.session); // Update local state immediately
        // Invalidate status query to pick up new session
        queryClient.invalidateQueries({ queryKey: impersonationKeys.all });
      }
    },
  });

  // End impersonation mutation
  const endMutation = useMutation({
    mutationFn: () => api.endImpersonation(sessionId),
    onSuccess: () => {
      storeSession(null);
      setStoredSession(null); // Update local state immediately
      // Invalidate status query
      queryClient.invalidateQueries({ queryKey: impersonationKeys.all });
    },
  });

  // Start impersonation handler
  const startImpersonation = useCallback(
    async (targetUserId: string, reason: string): Promise<void> => {
      console.log('[useImpersonation] Starting impersonation for:', targetUserId);
      const result = await startMutation.mutateAsync({ targetUserId, reason });
      console.log('[useImpersonation] Mutation result:', result);
      // Store session immediately after mutation completes (before any redirect)
      // This is critical because onSuccess may run asynchronously after mutateAsync resolves
      if (result.success && result.session) {
        console.log('[useImpersonation] Storing session:', result.session.session_id);
        storeSession(result.session);
        setStoredSession(result.session);
        // Verify it was stored
        const verified = sessionStorage.getItem(IMPERSONATION_STORAGE_KEY);
        console.log('[useImpersonation] Session stored, verified:', !!verified);
      } else {
        console.error('[useImpersonation] No session in result:', result);
      }
    },
    [startMutation]
  );

  // End impersonation handler
  const endImpersonation = useCallback(async (): Promise<void> => {
    await endMutation.mutateAsync();
  }, [endMutation]);

  // Countdown timer effect - manages the countdown display and auto-expiry
  useEffect(() => {
    // No session or no expiry time - nothing to count down
    if (!session?.expires_at) {
      return;
    }

    // Calculate and update time remaining
    const updateRemaining = () => {
      const remaining = calculateTimeRemaining(session.expires_at);
      setTimeRemaining(remaining);

      // Auto-end session when expired
      if (remaining <= 0) {
        storeSession(null);
        setStoredSession(null);
        queryClient.invalidateQueries({ queryKey: impersonationKeys.all });
      }
    };

    // Initial calculation
    updateRemaining();

    // Update every second for live countdown
    const interval = setInterval(updateRemaining, 1000);
    return () => clearInterval(interval);
  }, [session?.expires_at, queryClient]);

  // Reset timeRemaining when session ends
  // Using setTimeout(0) to defer state update and satisfy React compiler lint rules
  useEffect(() => {
    if (!session) {
      const timeout = setTimeout(() => setTimeRemaining(0), 0);
      return () => clearTimeout(timeout);
    }
    return undefined;
  }, [session]);

  // Clear local storage on unmount if session expired
  useEffect(() => {
    return () => {
      const stored = getStoredSession();
      if (stored) {
        const remaining = calculateTimeRemaining(stored.expires_at);
        if (remaining <= 0) {
          storeSession(null);
        }
      }
    };
  }, []);

  return {
    isImpersonating,
    session,
    timeRemaining,
    timeRemainingFormatted: formatTimeRemaining(timeRemaining),
    isLoading,
    isMutating: startMutation.isPending || endMutation.isPending,
    error: statusError ?? startMutation.error ?? endMutation.error ?? null,
    startImpersonation,
    endImpersonation,
    refreshStatus: () => {
      refreshStatus();
    },
  };
}
