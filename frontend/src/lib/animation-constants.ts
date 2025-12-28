/**
 * Animation Constants
 *
 * Single source of truth for all animation timing and configuration.
 * These values are used in both CSS (via design tokens) and JavaScript.
 *
 * IMPORTANT: Keep these in sync with design-tokens.css
 */

// =============================================================================
// DURATION TOKENS
// =============================================================================

export const DURATION = {
  /** Instant feedback (0ms) */
  INSTANT: 0,
  /** Fast interactions - button clicks, micro-feedback (150ms) */
  FAST: 150,
  /** Standard transitions - most UI state changes (250ms) */
  NORMAL: 250,
  /** Emphasized transitions - modals, panels (400ms) */
  SLOW: 400,
  /** Major transitions - page changes (500ms) */
  SLOWER: 500,
} as const;

// =============================================================================
// CELEBRATION TIMINGS
// =============================================================================

export const CELEBRATION = {
  /** Stage completion celebration duration */
  STAGE_COMPLETE: 800,
  /** Winner reveal animation duration */
  WINNER_REVEAL: 600,
  /** Council/chairman completion celebration */
  COUNCIL_COMPLETE: 1100,
  /** Project creation success display time - enough to read the message */
  PROJECT_SUCCESS: 2500,
  /** Cursor fade-out before celebration */
  CURSOR_FADE: 300,
  /** Stagger delay between list items */
  STAGGER_DELAY: 50,
  /** Maximum items in stagger animation */
  STAGGER_MAX_ITEMS: 8,
} as const;

// =============================================================================
// AUTO-COLLAPSE TIMINGS
// =============================================================================

export const AUTO_COLLAPSE = {
  /** Delay before Stage 1 auto-collapses after completion */
  STAGE1: 600,
  /** Delay before Stage 2 auto-collapses after completion */
  STAGE2: 600,
} as const;

// =============================================================================
// EASING FUNCTIONS
// =============================================================================

export const EASING = {
  /** Default smooth easing */
  DEFAULT: 'cubic-bezier(0.22, 1, 0.36, 1)',
  /** Standard ease-in */
  IN: 'cubic-bezier(0.4, 0, 1, 1)',
  /** Standard ease-out */
  OUT: 'cubic-bezier(0, 0, 0.2, 1)',
  /** Standard ease-in-out */
  IN_OUT: 'cubic-bezier(0.4, 0, 0.2, 1)',
  /** Spring-like bounce with overshoot */
  SPRING: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
  /** Quick responsive spring */
  SNAPPY: 'cubic-bezier(0.22, 1, 0.36, 1)',
  /** Gentle deceleration */
  GENTLE: 'cubic-bezier(0.16, 1, 0.3, 1)',
  /** Playful bounce */
  BOUNCE: 'cubic-bezier(0.68, -0.55, 0.265, 1.55)',
} as const;

// =============================================================================
// SPRING CONFIGURATIONS (for Framer Motion)
// =============================================================================

export const SPRING = {
  /** Snappy micro-interactions */
  SNAPPY: { type: 'spring' as const, stiffness: 500, damping: 30, mass: 0.8 },
  /** Standard UI transitions */
  SMOOTH: { type: 'spring' as const, stiffness: 400, damping: 35, mass: 1 },
  /** Gentle page transitions */
  GENTLE: { type: 'spring' as const, stiffness: 300, damping: 40, mass: 1.2 },
  /** Bouncy celebrations */
  BOUNCY: { type: 'spring' as const, stiffness: 400, damping: 20, mass: 0.8 },
} as const;

// =============================================================================
// CSS CLASS NAMES
// =============================================================================

export const ANIMATION_CLASS = {
  /** Success checkmark/badge pop */
  SUCCESS_POP: 'animate-success-pop',
  /** Container completion glow */
  COMPLETE_GLOW: 'animate-complete-glow',
  /** Stage header icon celebration */
  STAGE_COMPLETE: 'animate-stage-complete',
  /** Trophy/winner bouncy entrance */
  WINNER_REVEAL: 'animate-winner-reveal',
  /** Content reveal slide */
  FADE_SLIDE_UP: 'animate-fade-slide-up',
  /** Staggered children entrance */
  STAGGER: 'animate-stagger',
  /** Active/thinking pulse */
  PULSE_RING: 'animate-pulse-ring',
  /** Streaming end cursor fade */
  CURSOR_FADE: 'animate-cursor-fade',
  /** Subtle shake celebration */
  CELEBRATE: 'animate-celebrate',
} as const;

// =============================================================================
// STATE CLASS NAMES
// =============================================================================

export const STATE_CLASS = {
  /** Stage is celebrating completion */
  CELEBRATING: 'celebrating',
  /** Content has completion glow */
  COMPLETE_GLOW: 'complete-glow',
} as const;

// =============================================================================
// TYPE EXPORTS
// =============================================================================

export type Duration = typeof DURATION[keyof typeof DURATION];
export type Celebration = typeof CELEBRATION[keyof typeof CELEBRATION];
export type Easing = typeof EASING[keyof typeof EASING];
export type SpringConfig = typeof SPRING[keyof typeof SPRING];
export type AnimationClass = typeof ANIMATION_CLASS[keyof typeof ANIMATION_CLASS];
export type StateClass = typeof STATE_CLASS[keyof typeof STATE_CLASS];
