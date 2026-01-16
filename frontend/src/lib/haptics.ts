/**
 * Haptic Feedback Utility
 * Provides tactile feedback on mobile devices for premium app-like feel
 * Falls back gracefully on unsupported devices
 */

/**
 * Check if haptic feedback is supported
 */
export const isHapticSupported = (): boolean => {
  return 'vibrate' in navigator;
};

/**
 * Light haptic feedback - subtle tap
 * Use for: Button taps, toggles, minor interactions
 */
export const hapticLight = (): void => {
  if (isHapticSupported()) {
    navigator.vibrate(10);
  }
};

/**
 * Medium haptic feedback - noticeable tap
 * Use for: Form submissions, confirmations, selections
 */
export const hapticMedium = (): void => {
  if (isHapticSupported()) {
    navigator.vibrate(20);
  }
};

/**
 * Heavy haptic feedback - strong tap
 * Use for: Errors, important alerts, destructive actions
 */
export const hapticHeavy = (): void => {
  if (isHapticSupported()) {
    navigator.vibrate(30);
  }
};

/**
 * Success haptic pattern - double tap
 * Use for: Successful operations, completions
 */
export const hapticSuccess = (): void => {
  if (isHapticSupported()) {
    navigator.vibrate([10, 50, 10]);
  }
};

/**
 * Error haptic pattern - triple tap
 * Use for: Errors, validation failures
 */
export const hapticError = (): void => {
  if (isHapticSupported()) {
    navigator.vibrate([20, 50, 20, 50, 20]);
  }
};

/**
 * Selection haptic - very subtle
 * Use for: List scrolling, slider dragging, continuous interactions
 */
export const hapticSelection = (): void => {
  if (isHapticSupported()) {
    navigator.vibrate(5);
  }
};

/**
 * Haptic object for cleaner imports
 */
export const haptic = {
  light: hapticLight,
  medium: hapticMedium,
  heavy: hapticHeavy,
  success: hapticSuccess,
  error: hapticError,
  selection: hapticSelection,
  isSupported: isHapticSupported,
};

export default haptic;
