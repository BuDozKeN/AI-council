import { useState, useRef, useCallback, useEffect } from 'react';

export interface UsePullToRefreshOptions {
  onRefresh?: (() => Promise<void> | void) | undefined;
  threshold?: number | undefined;
  maxPull?: number | undefined;
  enabled?: boolean | undefined;
}

export interface UsePullToRefreshReturn {
  ref: React.RefObject<HTMLElement | null>;
  isPulling: boolean;
  pullDistance: number;
  isRefreshing: boolean;
  progress: number;
}

/**
 * usePullToRefresh - Hook for implementing pull-to-refresh gesture
 */
export function usePullToRefresh({
  onRefresh,
  threshold = 80,
  maxPull = 120,
  enabled = true,
}: UsePullToRefreshOptions = {}): UsePullToRefreshReturn {
  const [isPulling, setIsPulling] = useState<boolean>(false);
  const [pullDistance, setPullDistance] = useState<number>(0);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const containerRef = useRef<HTMLElement | null>(null);
  const touchStartY = useRef<number | null>(null);
  const touchStartScrollTop = useRef<number | null>(null);

  const handleTouchStart = useCallback((e: TouchEvent): void => {
    if (!enabled || isRefreshing) return;

    const container = containerRef.current;
    if (!container) return;

    // Only track if at top of scroll
    if (container.scrollTop <= 0) {
      const touch = e.touches[0];
      if (touch) {
        touchStartY.current = touch.clientY;
        touchStartScrollTop.current = container.scrollTop;
      }
    }
  }, [enabled, isRefreshing]);

  const handleTouchMove = useCallback((e: TouchEvent): void => {
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

    const touch = e.touches[0];
    if (!touch) return;
    const deltaY = touch.clientY - touchStartY.current;

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

  const handleTouchEnd = useCallback(async (): Promise<void> => {
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
