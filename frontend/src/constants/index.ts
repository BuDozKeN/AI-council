/**
 * Centralized constants for the AI Council frontend.
 *
 * Use these instead of magic numbers throughout the codebase.
 */

// =============================================================================
// BREAKPOINTS
// =============================================================================

export const BREAKPOINTS = {
  /** Mobile breakpoint (max-width for mobile devices) */
  MOBILE: 768,
  /** Small mobile/compact breakpoint */
  SM: 640,
  /** Tablet breakpoint */
  TABLET: 1024,
  /** Desktop breakpoint */
  DESKTOP: 1280,
};

/**
 * Check if current viewport is mobile
 * @returns {boolean}
 */
export const isMobileDevice = () =>
  typeof window !== 'undefined' && window.innerWidth <= BREAKPOINTS.MOBILE;

/**
 * Check if current viewport is small mobile
 * @returns {boolean}
 */
export const isSmallMobile = () =>
  typeof window !== 'undefined' && window.innerWidth < BREAKPOINTS.SM;

// =============================================================================
// PAGINATION
// =============================================================================

export const PAGINATION = {
  /** Number of conversations per page */
  CONVERSATIONS_PAGE_SIZE: 10,
  /** Number of activity log items per page */
  ACTIVITY_PAGE_SIZE: 20,
  /** Number of leaderboard items per page */
  LEADERBOARD_PAGE_SIZE: 50,
};

// =============================================================================
// TEXT LIMITS
// =============================================================================

export const TEXT_LIMITS = {
  /** Max length for generated titles */
  TITLE_MAX_LENGTH: 60,
  /** Max length for question summaries */
  QUESTION_SUMMARY_LENGTH: 80,
  /** Max length for text truncation displays */
  TRUNCATE_DISPLAY_LENGTH: 150,
};

// =============================================================================
// TIMEOUTS & INTERVALS
// =============================================================================

export const TIMEOUTS = {
  /** Throttle for decision status checks (ms) */
  DECISION_CHECK_THROTTLE: 5000,
  /** Debounce delay for saving preferences (ms) */
  DEBOUNCE_SAVE_PREFS: 1000,
  /** Duration to show error messages (ms) */
  ERROR_DISPLAY_DURATION: 5000,
  /** API request timeout (ms) */
  API_TIMEOUT: 60000,
  /** Animation transition duration (ms) */
  ANIMATION_DURATION: 300,
  /** Small UI delay for coordination (ms) */
  UI_DELAY: 100,
};

// =============================================================================
// FILE UPLOAD
// =============================================================================

export const UPLOAD = {
  /** Maximum number of images per message */
  MAX_IMAGES: 5,
  /** Maximum image file size in bytes (10MB) */
  MAX_IMAGE_SIZE_BYTES: 10 * 1024 * 1024,
  /** Maximum image file size in MB */
  MAX_IMAGE_SIZE_MB: 10,
  /** Allowed image MIME types */
  ALLOWED_IMAGE_TYPES: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
};

// =============================================================================
// UI CONSTANTS
// =============================================================================

export const UI = {
  /** Pull-to-refresh threshold in pixels */
  PULL_REFRESH_THRESHOLD: 80,
  /** Swipe gesture threshold in pixels */
  SWIPE_THRESHOLD: 50,
  /** Long press duration (ms) */
  LONG_PRESS_DURATION: 500,
};

// =============================================================================
// DEFAULT VALUES
// =============================================================================

export const DEFAULTS = {
  /** Default department when none available */
  DEFAULT_DEPARTMENT: {
    id: 'general',
    name: 'General',
    description: 'General department for all queries',
  },
};
