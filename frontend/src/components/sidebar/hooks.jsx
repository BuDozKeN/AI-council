/**
 * Sidebar hooks for mock mode and caching mode
 *
 * Extracted from Sidebar.jsx for better maintainability.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { api } from '../../api';
import { useAuth } from '../../AuthContext';

// Timing constants - kept in sync with CSS tokens in tailwind.css
// These are the JS equivalents of --sidebar-hover-delay and --sidebar-collapse-delay
const SIDEBAR_HOVER_DELAY = 100;
const SIDEBAR_COLLAPSE_DELAY = 300;

/**
 * Hook to manage hover expansion behavior for sidebar icons
 * Encapsulates timeout logic for entering/leaving hover states
 *
 * @param {Object} options
 * @param {boolean} options.isPinned - Whether sidebar is pinned open
 * @param {number} options.hoverDelay - Delay before expanding (default: 150ms)
 * @param {number} options.collapseDelay - Delay before collapsing (default: 200ms)
 */
export function useHoverExpansion({ isPinned = false, hoverDelay = SIDEBAR_HOVER_DELAY, collapseDelay = SIDEBAR_COLLAPSE_DELAY } = {}) {
  const [hoveredIcon, setHoveredIcon] = useState(null);
  const timeoutRef = useRef(null);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  // Clear any pending timeout
  const clearPendingTimeout = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  // Handle hover on specific icon
  const handleIconHover = useCallback((iconName) => {
    clearPendingTimeout();
    timeoutRef.current = setTimeout(() => {
      setHoveredIcon(iconName);
    }, hoverDelay);
  }, [clearPendingTimeout, hoverDelay]);

  // Handle leaving an icon
  const handleIconLeave = useCallback(() => {
    clearPendingTimeout();
    timeoutRef.current = setTimeout(() => {
      setHoveredIcon(null);
    }, collapseDelay);
  }, [clearPendingTimeout, collapseDelay]);

  // Keep expanded while mouse is in the expanded area
  const handleExpandedAreaEnter = useCallback(() => {
    clearPendingTimeout();
  }, [clearPendingTimeout]);

  // Start collapsing when leaving expanded area (unless pinned)
  const handleExpandedAreaLeave = useCallback(() => {
    if (!isPinned) {
      clearPendingTimeout();
      timeoutRef.current = setTimeout(() => {
        setHoveredIcon(null);
      }, hoverDelay);
    }
  }, [isPinned, clearPendingTimeout, hoverDelay]);

  return {
    hoveredIcon,
    handleIconHover,
    handleIconLeave,
    handleExpandedAreaEnter,
    handleExpandedAreaLeave,
  };
}

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
