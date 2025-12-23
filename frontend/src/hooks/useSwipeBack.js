import { useRef, useEffect, useCallback } from 'react';

/**
 * useSwipeBack - Hook for iOS-style swipe-from-edge back gesture
 *
 * Detects when user swipes from the left edge of the screen to the right,
 * and triggers the onSwipeBack callback. Mimics iOS native back gesture.
 *
 * @param {Function} onSwipeBack - Callback when swipe back is detected
 * @param {boolean} enabled - Whether hook is active (default: true)
 * @param {number} edgeWidth - Width of detection zone in px (default: 40)
 * @param {number} threshold - Min swipe distance to trigger (default: 100)
 * @returns {Object} - Ref to attach to container element
 */
export function useSwipeBack({
  onSwipeBack,
  enabled = true,
  edgeWidth = 40,
  threshold = 100,
} = {}) {
  const touchStartRef = useRef(null);
  const elementRef = useRef(null);
  const isSwiping = useRef(false);

  const handleTouchStart = useCallback((e) => {
    if (!enabled) return;

    const touch = e.touches[0];
    const isFromLeftEdge = touch.clientX <= edgeWidth;

    if (!isFromLeftEdge) {
      touchStartRef.current = null;
      return;
    }

    touchStartRef.current = {
      x: touch.clientX,
      y: touch.clientY,
      time: Date.now(),
    };
    isSwiping.current = false;
  }, [enabled, edgeWidth]);

  const handleTouchMove = useCallback((e) => {
    if (!enabled || !touchStartRef.current) return;

    const touch = e.touches[0];
    const startData = touchStartRef.current;
    const deltaX = touch.clientX - startData.x;
    const deltaY = touch.clientY - startData.y;

    // More horizontal than vertical = swipe gesture
    if (Math.abs(deltaX) > Math.abs(deltaY) && deltaX > 20) {
      isSwiping.current = true;
    }
  }, [enabled]);

  const handleTouchEnd = useCallback((e) => {
    if (!enabled || !touchStartRef.current) return;

    const touch = e.changedTouches[0];
    const startData = touchStartRef.current;
    const deltaX = touch.clientX - startData.x;
    const deltaY = touch.clientY - startData.y;
    const deltaTime = Date.now() - startData.time;

    // Reset
    touchStartRef.current = null;

    // Ignore slow swipes (> 500ms)
    if (deltaTime > 500) return;

    const absX = Math.abs(deltaX);
    const absY = Math.abs(deltaY);

    // Must be horizontal swipe to the right
    const isHorizontal = absX > absY;
    const isRight = deltaX > 0;

    if (isHorizontal && isRight && absX >= threshold && isSwiping.current) {
      onSwipeBack?.();
    }

    isSwiping.current = false;
  }, [enabled, threshold, onSwipeBack]);

  useEffect(() => {
    const element = elementRef.current;
    if (!element || !enabled) return;

    element.addEventListener('touchstart', handleTouchStart, { passive: true });
    element.addEventListener('touchmove', handleTouchMove, { passive: true });
    element.addEventListener('touchend', handleTouchEnd, { passive: true });

    return () => {
      element.removeEventListener('touchstart', handleTouchStart);
      element.removeEventListener('touchmove', handleTouchMove);
      element.removeEventListener('touchend', handleTouchEnd);
    };
  }, [enabled, handleTouchStart, handleTouchMove, handleTouchEnd]);

  return elementRef;
}

export default useSwipeBack;
