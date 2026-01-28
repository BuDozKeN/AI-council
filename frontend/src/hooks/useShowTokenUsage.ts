/**
 * useShowTokenUsage - Hook for controlling token usage visibility
 *
 * Combines localStorage preference with admin status:
 * - Super admins: Always enabled (locked on)
 * - Regular users: Respects localStorage preference
 *
 * Usage:
 *   const { showTokenUsage, isLocked, toggleShowTokenUsage } = useShowTokenUsage();
 *
 *   // showTokenUsage: boolean - whether to show token usage
 *   // isLocked: boolean - true if super admin (cannot be toggled off)
 *   // toggleShowTokenUsage: () => void - toggle the setting (no-op if locked)
 */

import { useState, useEffect, useCallback } from 'react';
import { useAdminAccess } from './useAdminAccess';
import { getShowTokenUsage, setShowTokenUsage } from '../components/settings/tokenUsageSettings';

interface UseShowTokenUsageReturn {
  /** Whether to show token usage display */
  showTokenUsage: boolean;
  /** Whether the setting is locked (super admins always have it on) */
  isLocked: boolean;
  /** Toggle the setting (no-op if locked) */
  toggleShowTokenUsage: () => void;
  /** Whether the admin status is still loading */
  isLoading: boolean;
}

export function useShowTokenUsage(): UseShowTokenUsageReturn {
  const { adminRole, isLoading: isAdminLoading } = useAdminAccess();
  const [localStorageValue, setLocalStorageValue] = useState(getShowTokenUsage());

  // Super admins always have token usage visible
  const isSuperAdmin = adminRole === 'super_admin';
  const isLocked = isSuperAdmin;

  // Listen for changes from other components
  useEffect(() => {
    const handleChange = (e: Event) => {
      const customEvent = e as CustomEvent<boolean>;
      setLocalStorageValue(customEvent.detail);
    };

    window.addEventListener('showTokenUsageChanged', handleChange);
    return () => window.removeEventListener('showTokenUsageChanged', handleChange);
  }, []);

  const toggleShowTokenUsage = useCallback(() => {
    if (isLocked) return; // Super admins can't toggle off

    const newValue = !localStorageValue;
    setLocalStorageValue(newValue);
    setShowTokenUsage(newValue);
  }, [isLocked, localStorageValue]);

  // Final value: super admins always see it, others respect localStorage
  const showTokenUsage = isLocked ? true : localStorageValue;

  return {
    showTokenUsage,
    isLocked,
    toggleShowTokenUsage,
    isLoading: isAdminLoading,
  };
}
