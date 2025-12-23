import { useRef, useCallback, useEffect } from 'react';

interface TouchStartData {
  x: number;
  y: number;
  time: number;
}

export interface UseSwipeGestureOptions {
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  onSwipeDown?: () => void;
  threshold?: number;
  edgeOnly?: boolean;
  edgeWidth?: number;
  enabled?: boolean;
}

/**
 * Custom hook for detecting swipe gestures on touch devices
 */
export function useSwipeGesture({
  onSwipeLeft,
  onSwipeRight,
  onSwipeDown,
  threshold = 50,
  edgeOnly = false,
  edgeWidth = 30,
  enabled = true,
}: UseSwipeGestureOptions = {}): React.RefObject<HTMLElement | null> {
  const touchStartRef = useRef<TouchStartData | null>(null);
  const elementRef = useRef<HTMLElement | null>(null);

  const handleTouchStart = useCallback((e: TouchEvent): void => {
    if (!enabled) return;

    const touch = e.touches[0];
    touchStartRef.current = {
      x: touch.clientX,
      y: touch.clientY,
      time: Date.now(),
    };
  }, [enabled]);

  const handleTouchEnd = useCallback((e: TouchEvent): void => {
    if (!enabled || !touchStartRef.current) return;

    const touch = e.changedTouches[0];
    const startData = touchStartRef.current;

    const deltaX = touch.clientX - startData.x;
    const deltaY = touch.clientY - startData.y;
    const deltaTime = Date.now() - startData.time;

    // Ignore slow swipes (> 500ms)
    if (deltaTime > 500) {
      touchStartRef.current = null;
      return;
    }

    // Check if swipe started from edge (left edge for right swipe)
    const isFromLeftEdge = startData.x <= edgeWidth;
    const isFromRightEdge = startData.x >= window.innerWidth - edgeWidth;

    const absX = Math.abs(deltaX);
    const absY = Math.abs(deltaY);

    // Swipe must be predominantly horizontal or vertical
    const isHorizontal = absX > absY;

    if (isHorizontal && absX >= threshold) {
      // Horizontal swipe
      if (deltaX > 0) {
        // Swipe right
        if (!edgeOnly || isFromLeftEdge) {
          onSwipeRight?.();
        }
      } else {
        // Swipe left
        if (!edgeOnly || isFromRightEdge) {
          onSwipeLeft?.();
        }
      }
    } else if (!isHorizontal && absY >= threshold && deltaY > 0) {
      // Swipe down
      onSwipeDown?.();
    }

    touchStartRef.current = null;
  }, [enabled, threshold, edgeOnly, edgeWidth, onSwipeLeft, onSwipeRight, onSwipeDown]);

  // Attach event listeners
  useEffect(() => {
    const element = elementRef.current;
    if (!element || !enabled) return;

    element.addEventListener('touchstart', handleTouchStart, { passive: true });
    element.addEventListener('touchend', handleTouchEnd, { passive: true });

    return () => {
      element.removeEventListener('touchstart', handleTouchStart);
      element.removeEventListener('touchend', handleTouchEnd);
    };
  }, [enabled, handleTouchStart, handleTouchEnd]);

  return elementRef;
}

export interface UseGlobalSwipeOptions {
  onSwipeRight?: () => void;
  onSwipeLeft?: () => void;
  edgeWidth?: number;
  threshold?: number;
  enabled?: boolean;
  requireEdgeForClose?: boolean;
}

/**
 * Global swipe hook - attaches to document/body for app-wide gestures
 * Used for edge swipes to open sidebar and anywhere swipes to close
 */
export function useGlobalSwipe({
  onSwipeRight,
  onSwipeLeft,
  edgeWidth = 30,
  threshold = 80,
  enabled = true,
  requireEdgeForClose = false,
}: UseGlobalSwipeOptions = {}): void {
  const touchStartRef = useRef<TouchStartData | null>(null);

  useEffect(() => {
    if (!enabled) return;

    const handleTouchStart = (e: TouchEvent): void => {
      const touch = e.touches[0];
      touchStartRef.current = {
        x: touch.clientX,
        y: touch.clientY,
        time: Date.now(),
      };
    };

    const handleTouchEnd = (e: TouchEvent): void => {
      if (!touchStartRef.current) return;

      const touch = e.changedTouches[0];
      const startData = touchStartRef.current;

      const deltaX = touch.clientX - startData.x;
      const deltaY = touch.clientY - startData.y;
      const deltaTime = Date.now() - startData.time;

      // Ignore slow swipes
      if (deltaTime > 400) {
        touchStartRef.current = null;
        return;
      }

      const absX = Math.abs(deltaX);
      const absY = Math.abs(deltaY);

      // Must be horizontal and meet threshold
      if (absX > absY && absX >= threshold) {
        const isFromLeftEdge = startData.x <= edgeWidth;
        const isFromRightEdge = startData.x >= window.innerWidth - edgeWidth;

        if (deltaX > 0 && isFromLeftEdge) {
          // Swipe right from left edge - open sidebar
          onSwipeRight?.();
        } else if (deltaX < 0) {
          // Swipe left - close sidebar (from anywhere or edge only based on config)
          if (!requireEdgeForClose || isFromRightEdge) {
            onSwipeLeft?.();
          }
        }
      }

      touchStartRef.current = null;
    };

    // Listen on document for global gestures
    document.addEventListener('touchstart', handleTouchStart, { passive: true });
    document.addEventListener('touchend', handleTouchEnd, { passive: true });

    return () => {
      document.removeEventListener('touchstart', handleTouchStart);
      document.removeEventListener('touchend', handleTouchEnd);
    };
  }, [enabled, edgeWidth, threshold, onSwipeRight, onSwipeLeft, requireEdgeForClose]);
}

export default useSwipeGesture;
