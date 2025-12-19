import { useRef, useCallback, useEffect } from 'react';

/**
 * Custom hook for detecting swipe gestures on touch devices
 *
 * @param {Object} options - Configuration options
 * @param {Function} options.onSwipeLeft - Callback when swipe left is detected
 * @param {Function} options.onSwipeRight - Callback when swipe right is detected
 * @param {Function} options.onSwipeDown - Callback when swipe down is detected
 * @param {number} options.threshold - Minimum distance in px to trigger swipe (default: 50)
 * @param {boolean} options.edgeOnly - Only trigger on edge swipes (default: false)
 * @param {number} options.edgeWidth - Width of edge zone in px (default: 30)
 * @param {boolean} options.enabled - Whether the hook is active (default: true)
 * @returns {Object} - Ref to attach to the element
 */
export function useSwipeGesture({
  onSwipeLeft,
  onSwipeRight,
  onSwipeDown,
  threshold = 50,
  edgeOnly = false,
  edgeWidth = 30,
  enabled = true,
} = {}) {
  const touchStartRef = useRef(null);
  const elementRef = useRef(null);

  const handleTouchStart = useCallback((e) => {
    if (!enabled) return;

    const touch = e.touches[0];
    touchStartRef.current = {
      x: touch.clientX,
      y: touch.clientY,
      time: Date.now(),
    };
  }, [enabled]);

  const handleTouchEnd = useCallback((e) => {
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

/**
 * Global swipe hook - attaches to document/body for app-wide gestures
 * Used for edge swipes to open sidebar
 */
export function useGlobalSwipe({
  onSwipeRight,
  onSwipeLeft,
  edgeWidth = 30,
  threshold = 80,
  enabled = true,
} = {}) {
  const touchStartRef = useRef(null);

  useEffect(() => {
    if (!enabled) return;

    const handleTouchStart = (e) => {
      const touch = e.touches[0];
      touchStartRef.current = {
        x: touch.clientX,
        y: touch.clientY,
        time: Date.now(),
      };
    };

    const handleTouchEnd = (e) => {
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
        } else if (deltaX < 0 && isFromRightEdge) {
          // Swipe left from right edge
          onSwipeLeft?.();
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
  }, [enabled, edgeWidth, threshold, onSwipeRight, onSwipeLeft]);
}

export default useSwipeGesture;
