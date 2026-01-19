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

import { useState, useEffect, useCallback, useMemo } from 'react';
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
  const { isAdmin } = useAdminAccess();

  // Local state for countdown timer
  const [timeRemaining, setTimeRemaining] = useState(0);

  // Get session ID from storage for query key
  const storedSession = useMemo(() => getStoredSession(), []);
  const sessionId = storedSession?.session_id;

  // Query server for session status
  const {
    data: statusData,
    isLoading,
    error: statusError,
    refetch: refreshStatus,
  } = useQuery({
    queryKey: impersonationKeys.status(sessionId),
    queryFn: () => api.getImpersonationStatus(sessionId),
    enabled: isAdmin && !!sessionId, // Only check if admin and has stored session
    staleTime: 30 * 1000, // 30 seconds
    gcTime: 5 * 60 * 1000, // 5 minutes
    refetchInterval: 60 * 1000, // Check every minute for expiry
    refetchOnWindowFocus: true, // Check on tab focus
  });

  // Determine active session (prefer server response over local storage)
  const session = useMemo(() => {
    if (statusData?.is_impersonating && statusData.session) {
      return statusData.session;
    }
    // If server says not impersonating, clear local storage
    if (statusData && !statusData.is_impersonating && storedSession) {
      storeSession(null);
      return null;
    }
    return storedSession;
  }, [statusData, storedSession]);

  const isImpersonating = !!session && statusData?.is_impersonating !== false;

  // Start impersonation mutation
  const startMutation = useMutation({
    mutationFn: ({ targetUserId, reason }: { targetUserId: string; reason: string }) =>
      api.startImpersonation(targetUserId, reason),
    onSuccess: (data) => {
      if (data.success && data.session) {
        storeSession(data.session);
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
      // Invalidate status query
      queryClient.invalidateQueries({ queryKey: impersonationKeys.all });
    },
  });

  // Start impersonation handler
  const startImpersonation = useCallback(
    async (targetUserId: string, reason: string): Promise<void> => {
      await startMutation.mutateAsync({ targetUserId, reason });
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
