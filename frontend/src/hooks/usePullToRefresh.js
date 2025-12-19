import { useState, useRef, useCallback, useEffect } from 'react';

/**
 * usePullToRefresh - Hook for implementing pull-to-refresh gesture
 *
 * @param {Object} options
 * @param {Function} options.onRefresh - Async function to call on refresh
 * @param {number} options.threshold - Pull distance required to trigger (default: 80)
 * @param {number} options.maxPull - Maximum pull distance (default: 120)
 * @param {boolean} options.enabled - Whether the hook is active (default: true)
 * @returns {Object} - { ref, isPulling, pullDistance, isRefreshing }
 */
export function usePullToRefresh({
  onRefresh,
  threshold = 80,
  maxPull = 120,
  enabled = true,
} = {}) {
  const [isPulling, setIsPulling] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const containerRef = useRef(null);
  const touchStartY = useRef(null);
  const touchStartScrollTop = useRef(null);

  const handleTouchStart = useCallback((e) => {
    if (!enabled || isRefreshing) return;

    const container = containerRef.current;
    if (!container) return;

    // Only track if at top of scroll
    if (container.scrollTop <= 0) {
      touchStartY.current = e.touches[0].clientY;
      touchStartScrollTop.current = container.scrollTop;
    }
  }, [enabled, isRefreshing]);

  const handleTouchMove = useCallback((e) => {
    if (!enabled || isRefreshing || touchStartY.current === null) return;

    const container = containerRef.current;
    if (!container) return;

    // Only allow pull when at top
    if (container.scrollTop > 0) {
      touchStartY.current = null;
      setPullDistance(0);
      setIsPulling(false);
      return;
    }

    const deltaY = e.touches[0].clientY - touchStartY.current;

    if (deltaY > 0) {
      // Pulling down
      setIsPulling(true);
      // Apply resistance - the further you pull, the harder it gets
      const resistance = 0.5;
      const pull = Math.min(deltaY * resistance, maxPull);
      setPullDistance(pull);

      // Prevent default scroll when pulling
      if (deltaY > 10) {
        e.preventDefault();
      }
    }
  }, [enabled, isRefreshing, maxPull]);

  const handleTouchEnd = useCallback(async () => {
    if (!enabled || isRefreshing || touchStartY.current === null) return;

    touchStartY.current = null;

    if (pullDistance >= threshold) {
      // Trigger refresh
      setIsRefreshing(true);
      setPullDistance(threshold * 0.5); // Keep showing indicator

      try {
        await onRefresh?.();
      } finally {
        setIsRefreshing(false);
      }
    }

    // Reset
    setPullDistance(0);
    setIsPulling(false);
  }, [enabled, isRefreshing, pullDistance, threshold, onRefresh]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || !enabled) return;

    container.addEventListener('touchstart', handleTouchStart, { passive: true });
    container.addEventListener('touchmove', handleTouchMove, { passive: false });
    container.addEventListener('touchend', handleTouchEnd, { passive: true });

    return () => {
      container.removeEventListener('touchstart', handleTouchStart);
      container.removeEventListener('touchmove', handleTouchMove);
      container.removeEventListener('touchend', handleTouchEnd);
    };
  }, [enabled, handleTouchStart, handleTouchMove, handleTouchEnd]);

  // Calculate progress (0 to 1)
  const progress = Math.min(pullDistance / threshold, 1);

  return {
    ref: containerRef,
    isPulling,
    pullDistance,
    isRefreshing,
    progress,
  };
}

export default usePullToRefresh;
