import { useRef, useCallback } from 'react';
import { hapticMedium } from '../lib/haptics';

interface TouchPosition {
  x: number;
  y: number;
}

export interface UseLongPressOptions {
  onLongPress?: (e: React.TouchEvent | React.MouseEvent) => void;
  onClick?: (e: React.TouchEvent | React.MouseEvent) => void;
  delay?: number;
  hapticFeedback?: boolean;
  enabled?: boolean;
}

export interface UseLongPressReturn {
  onTouchStart: (e: React.TouchEvent) => void;
  onTouchMove: (e: React.TouchEvent) => void;
  onTouchEnd: (e: React.TouchEvent) => void;
  onTouchCancel: () => void;
  onMouseDown: (e: React.MouseEvent) => void;
  onMouseUp: (e: React.MouseEvent) => void;
  onMouseLeave: () => void;
}

/**
 * useLongPress - Hook for detecting long press gestures
 */
export function useLongPress({
  onLongPress,
  onClick,
  delay = 500,
  hapticFeedback = true,
  enabled = true,
}: UseLongPressOptions = {}): UseLongPressReturn {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isLongPressRef = useRef<boolean>(false);
  const touchStartPosRef = useRef<TouchPosition | null>(null);

  const start = useCallback((e: React.TouchEvent | React.MouseEvent): void => {
    if (!enabled) return;

    // Record start position
    if ('touches' in e && e.touches) {
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

  const move = useCallback((e: React.TouchEvent): void => {
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

  const end = useCallback((e: React.TouchEvent | React.MouseEvent): void => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }
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

  const cancel = useCallback((): void => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }
    timerRef.current = null;
    isLongPressRef.current = false;
  }, []);

  return {
    onTouchStart: start as (e: React.TouchEvent) => void,
    onTouchMove: move,
    onTouchEnd: end as (e: React.TouchEvent) => void,
    onTouchCancel: cancel,
    onMouseDown: start as (e: React.MouseEvent) => void,
    onMouseUp: end as (e: React.MouseEvent) => void,
    onMouseLeave: cancel,
  };
}

export default useLongPress;
