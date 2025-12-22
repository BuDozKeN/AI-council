import { useRef, useCallback } from 'react';
import { hapticMedium } from '../lib/haptics';

/**
 * useLongPress - Hook for detecting long press gestures
 *
 * @param {Object} options
 * @param {Function} options.onLongPress - Callback when long press is detected
 * @param {Function} options.onClick - Callback for regular click (if not long press)
 * @param {number} options.delay - Time in ms to trigger long press (default: 500)
 * @param {boolean} options.hapticFeedback - Whether to trigger haptic on long press (default: true)
 * @param {boolean} options.enabled - Whether the hook is active (default: true)
 * @returns {Object} - Event handlers to spread on element
 */
export function useLongPress({
  onLongPress,
  onClick,
  delay = 500,
  hapticFeedback = true,
  enabled = true,
} = {}) {
  const timerRef = useRef(null);
  const isLongPressRef = useRef(false);
  const touchStartPosRef = useRef(null);

  const start = useCallback((e) => {
    if (!enabled) return;

    // Record start position
    if (e.touches) {
      touchStartPosRef.current = {
        x: e.touches[0].clientX,
        y: e.touches[0].clientY,
      };
    }

    isLongPressRef.current = false;

    timerRef.current = setTimeout(() => {
      isLongPressRef.current = true;
      if (hapticFeedback) {
        hapticMedium();
      }
      onLongPress?.(e);
    }, delay);
  }, [enabled, delay, hapticFeedback, onLongPress]);

  const move = useCallback((e) => {
    if (!touchStartPosRef.current || !timerRef.current) return;

    // Cancel if moved too far (> 10px)
    const moveThreshold = 10;
    const touch = e.touches[0];
    const deltaX = Math.abs(touch.clientX - touchStartPosRef.current.x);
    const deltaY = Math.abs(touch.clientY - touchStartPosRef.current.y);

    if (deltaX > moveThreshold || deltaY > moveThreshold) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const end = useCallback((e) => {
    clearTimeout(timerRef.current);
    timerRef.current = null;
    touchStartPosRef.current = null;

    // If it was a long press, don't trigger onClick
    if (isLongPressRef.current) {
      isLongPressRef.current = false;
      e.preventDefault();
      return;
    }

    // Regular click
    onClick?.(e);
  }, [onClick]);

  const cancel = useCallback(() => {
    clearTimeout(timerRef.current);
    timerRef.current = null;
    isLongPressRef.current = false;
  }, []);

  return {
    onTouchStart: start,
    onTouchMove: move,
    onTouchEnd: end,
    onTouchCancel: cancel,
    onMouseDown: start,
    onMouseUp: end,
    onMouseLeave: cancel,
  };
}

export default useLongPress;
