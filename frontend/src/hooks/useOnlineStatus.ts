/**
 * useOnlineStatus - Hook to track online/offline network status
 *
 * Returns true when online, false when offline.
 * Updates reactively when network status changes.
 */

import { useState, useEffect, useCallback } from 'react';

export function useOnlineStatus(): boolean {
  // Initialize with actual status (SSR-safe with fallback to true)
  const [isOnline, setIsOnline] = useState(() => {
    if (typeof navigator !== 'undefined') {
      return navigator.onLine;
    }
    return true;
  });

  const handleOnline = useCallback(() => setIsOnline(true), []);
  const handleOffline = useCallback(() => setIsOnline(false), []);

  useEffect(() => {
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Sync state in case it changed before mount
    setIsOnline(navigator.onLine);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [handleOnline, handleOffline]);

  return isOnline;
}
