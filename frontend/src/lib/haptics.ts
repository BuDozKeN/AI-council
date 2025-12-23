/**
 * Haptic Feedback Utilities
 *
 * Provides haptic feedback on supported devices (iOS, Android)
 * Gracefully degrades on unsupported devices
 */

/**
 * Check if haptic feedback is supported
 */
export const isHapticSupported = () => {
  return 'vibrate' in navigator;
};

/**
 * Light haptic feedback - for button presses, selections
 * Duration: 10ms
 */
export const hapticLight = () => {
  if (isHapticSupported()) {
    navigator.vibrate(10);
  }
};

/**
 * Medium haptic feedback - for confirmations, tab switches
 * Duration: 20ms
 */
export const hapticMedium = () => {
  if (isHapticSupported()) {
    navigator.vibrate(20);
  }
};

/**
 * Heavy haptic feedback - for important actions, errors
 * Duration: 30ms
 */
export const hapticHeavy = () => {
  if (isHapticSupported()) {
    navigator.vibrate(30);
  }
};

/**
 * Success haptic pattern - double tap
 * Pattern: 10ms on, 50ms off, 10ms on
 */
export const hapticSuccess = () => {
  if (isHapticSupported()) {
    navigator.vibrate([10, 50, 10]);
  }
};

/**
 * Warning haptic pattern - triple tap
 * Pattern: 10ms on, 30ms off, 10ms on, 30ms off, 20ms on
 */
export const hapticWarning = () => {
  if (isHapticSupported()) {
    navigator.vibrate([10, 30, 10, 30, 20]);
  }
};

/**
 * Error haptic pattern - long buzz
 * Duration: 50ms
 */
export const hapticError = () => {
  if (isHapticSupported()) {
    navigator.vibrate(50);
  }
};

/**
 * Selection changed haptic - very light
 * Duration: 5ms
 */
export const hapticSelection = () => {
  if (isHapticSupported()) {
    navigator.vibrate(5);
  }
};

/**
 * Impact haptic - for swipe actions revealing
 * Duration: 15ms
 */
export const hapticImpact = () => {
  if (isHapticSupported()) {
    navigator.vibrate(15);
  }
};

export default {
  isSupported: isHapticSupported,
  light: hapticLight,
  medium: hapticMedium,
  heavy: hapticHeavy,
  success: hapticSuccess,
  warning: hapticWarning,
  error: hapticError,
  selection: hapticSelection,
  impact: hapticImpact,
};
