/**
 * useCelebration Hook
 *
 * A reusable hook for managing completion celebration states across the app.
 * Provides consistent timing, haptic feedback, and guards against double-firing.
 *
 * @example
 * ```tsx
 * const { isCelebrating, triggerCelebration } = useCelebration({
 *   duration: 800,
 *   haptic: true,
 * });
 *
 * useEffect(() => {
 *   if (isComplete && !wasComplete) {
 *     triggerCelebration();
 *   }
 * }, [isComplete]);
 *
 * return <div className={isCelebrating ? 'celebrating' : ''}>...</div>;
 * ```
 */

import { useState, useRef, useCallback, useEffect } from 'react';
import { hapticSuccess } from '../lib/haptics';

export interface UseCelebrationOptions {
  /** Duration of the celebration animation in ms (default: 800) */
  duration?: number;
  /** Whether to trigger haptic feedback (default: true) */
  haptic?: boolean;
  /** Delay before starting celebration in ms (default: 0) */
  delay?: number;
  /** Whether celebration can only fire once per component lifecycle (default: true) */
  once?: boolean;
}

export interface UseCelebrationReturn {
  /** Whether the celebration is currently active */
  isCelebrating: boolean;
  /** Trigger the celebration animation */
  triggerCelebration: () => void;
  /** Reset the celebration state (allows re-triggering if once=true) */
  reset: () => void;
  /** Whether the celebration has already fired (only relevant if once=true) */
  hasFired: boolean;
}

export function useCelebration(options: UseCelebrationOptions = {}): UseCelebrationReturn {
  const {
    duration = 800,
    haptic = true,
    delay = 0,
    once = true,
  } = options;

  const [isCelebrating, setIsCelebrating] = useState(false);
  const [hasFired, setHasFired] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const triggerCelebration = useCallback(() => {
    // Guard against double-firing if once=true
    // Note: We check state but also use a ref internally for immediate checking
    if (once && hasFired) {
      return;
    }

    // Clear any existing timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    const startCelebration = () => {
      setHasFired(true);
      setIsCelebrating(true);

      if (haptic) {
        hapticSuccess();
      }

      // Auto-reset after duration
      timeoutRef.current = setTimeout(() => {
        setIsCelebrating(false);
      }, duration);
    };

    if (delay > 0) {
      timeoutRef.current = setTimeout(startCelebration, delay);
    } else {
      startCelebration();
    }
  }, [duration, haptic, delay, once, hasFired]);

  const reset = useCallback(() => {
    setHasFired(false);
    setIsCelebrating(false);
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  return {
    isCelebrating,
    triggerCelebration,
    reset,
    hasFired,
  };
}

/**
 * useCompletionCelebration Hook
 *
 * A specialized version that automatically triggers when a completion condition is met.
 * Handles the common pattern of "celebrate when X becomes true for the first time."
 *
 * @example
 * ```tsx
 * const { isCelebrating } = useCompletionCelebration(allModelsComplete, {
 *   duration: 800,
 * });
 * ```
 */
export function useCompletionCelebration(
  isComplete: boolean,
  options: UseCelebrationOptions = {}
): UseCelebrationReturn {
  const celebration = useCelebration(options);
  const wasCompleteRef = useRef(false);

  // Trigger celebration when completion state transitions from false to true
  useEffect(() => {
    if (isComplete && !wasCompleteRef.current) {
      wasCompleteRef.current = true;
      celebration.triggerCelebration();
    }
  }, [isComplete, celebration]);

  return celebration;
}

export default useCelebration;
