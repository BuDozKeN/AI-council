/**
 * useOnlineStatus - Hook to track online/offline network status
 *
 * Returns true when online, false when offline.
 * Updates reactively when network status changes.
 *
 * Uses useSyncExternalStore (React 18+) for proper external state subscription.
 */

import { useSyncExternalStore } from 'react';

function subscribe(callback: () => void) {
  window.addEventListener('online', callback);
  window.addEventListener('offline', callback);
  return () => {
    window.removeEventListener('online', callback);
    window.removeEventListener('offline', callback);
  };
}

function getSnapshot() {
  return navigator.onLine;
}

function getServerSnapshot() {
  // SSR fallback - assume online
  return true;
}

export function useOnlineStatus(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
