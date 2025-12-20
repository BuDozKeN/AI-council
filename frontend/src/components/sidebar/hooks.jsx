/**
 * Sidebar hooks for mock mode and caching mode
 *
 * Extracted from Sidebar.jsx for better maintainability.
 */

import { useState, useEffect } from 'react';
import { api } from '../../api';
import { useAuth } from '../../AuthContext';

// Dev mode flag - set to true to show developer controls
export const DEV_MODE = typeof window !== 'undefined' && localStorage.getItem('devMode') === 'true';

/**
 * Hook to fetch and manage mock mode state
 * Only fetches when user is authenticated to avoid 401 errors
 */
export function useMockMode() {
  const { isAuthenticated } = useAuth();
  const [mockMode, setMockMode] = useState(null);
  const [isToggling, setIsToggling] = useState(false);

  useEffect(() => {
    // Only fetch if authenticated
    if (!isAuthenticated) {
      setMockMode(null);
      return;
    }

    api.getMockMode()
      .then(result => setMockMode(result.enabled))
      .catch(err => {
        console.error('Failed to get mock mode:', err);
        setMockMode(false);
      });
  }, [isAuthenticated]);

  const toggle = async () => {
    if (isToggling || mockMode === null || !isAuthenticated) return;
    setIsToggling(true);
    try {
      const result = await api.setMockMode(!mockMode);
      setMockMode(result.enabled);
    } catch (err) {
      console.error('Failed to toggle mock mode:', err);
    } finally {
      setIsToggling(false);
    }
  };

  return { mockMode, isToggling, toggle };
}

/**
 * Hook to fetch and manage prompt caching state
 * Only fetches when user is authenticated to avoid 401 errors
 */
export function useCachingMode() {
  const { isAuthenticated } = useAuth();
  const [cachingMode, setCachingMode] = useState(null);
  const [isToggling, setIsToggling] = useState(false);

  useEffect(() => {
    // Only fetch if authenticated
    if (!isAuthenticated) {
      setCachingMode(null);
      return;
    }

    api.getCachingMode()
      .then(result => setCachingMode(result.enabled))
      .catch(err => {
        console.error('Failed to get caching mode:', err);
        setCachingMode(false);
      });
  }, [isAuthenticated]);

  const toggle = async () => {
    if (isToggling || cachingMode === null || !isAuthenticated) return;
    setIsToggling(true);
    try {
      const result = await api.setCachingMode(!cachingMode);
      setCachingMode(result.enabled);
    } catch (err) {
      console.error('Failed to toggle caching mode:', err);
    } finally {
      setIsToggling(false);
    }
  };

  return { cachingMode, isToggling, toggle };
}

/**
 * Convert an ISO timestamp to a human-readable relative time string.
 */
export function getRelativeTime(isoTimestamp) {
  if (!isoTimestamp) return '';

  const now = new Date();
  const then = new Date(isoTimestamp);
  const diffMs = now - then;
  const diffSeconds = Math.floor(diffMs / 1000);
  const diffMinutes = Math.floor(diffSeconds / 60);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMinutes < 1) {
    return 'just now';
  } else if (diffMinutes < 60) {
    return diffMinutes === 1 ? '1 minute' : `${diffMinutes} minutes`;
  } else if (diffHours < 24) {
    return diffHours === 1 ? '1 hour' : `${diffHours} hours`;
  } else {
    return diffDays === 1 ? 'a day' : `${diffDays} days`;
  }
}
