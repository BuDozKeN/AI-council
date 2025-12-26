/**
 * Premium Spring Physics Animation System
 *
 * Centralized animation configuration for consistent, buttery-smooth
 * interactions across the entire application.
 *
 * Based on Apple/Linear design principles with carefully tuned spring values.
 */

import type { Transition, Variants, TargetAndTransition } from 'framer-motion';

// =============================================================================
// SPRING CONFIGURATIONS
// =============================================================================

/**
 * Spring presets for different interaction types
 *
 * - snappy: Quick, responsive micro-interactions (buttons, toggles)
 * - smooth: Standard UI transitions (modals, panels)
 * - gentle: Slow, elegant reveals (page transitions, large elements)
 * - bouncy: Playful, delightful interactions (success states, celebrations)
 */
export const springs = {
  // Quick micro-interactions - buttons, toggles, small elements
  snappy: {
    type: 'spring' as const,
    stiffness: 500,
    damping: 30,
    mass: 0.8,
  },

  // Standard UI transitions - cards, modals, dropdowns
  smooth: {
    type: 'spring' as const,
    stiffness: 400,
    damping: 35,
    mass: 1,
  },

  // Gentle reveals - page transitions, large panels
  gentle: {
    type: 'spring' as const,
    stiffness: 300,
    damping: 40,
    mass: 1.2,
  },

  // Playful bounce - success states, celebrations
  bouncy: {
    type: 'spring' as const,
    stiffness: 400,
    damping: 20,
    mass: 0.8,
  },

  // Mobile-optimized - slightly reduced for performance
  mobile: {
    type: 'spring' as const,
    stiffness: 350,
    damping: 30,
    mass: 1,
  },
} as const;

// =============================================================================
// TRANSITION PRESETS
// =============================================================================

export const transitions = {
  // Fast fade for subtle state changes
  fade: {
    duration: 0.15,
    ease: [0.4, 0, 0.2, 1], // Material Design ease-out
  } as Transition,

  // Micro-interaction (hover, press states)
  micro: {
    ...springs.snappy,
  } as Transition,

  // Standard element transitions
  standard: {
    ...springs.smooth,
  } as Transition,

  // Page/panel transitions
  page: {
    ...springs.gentle,
  } as Transition,

  // Success/celebration animations
  success: {
    ...springs.bouncy,
  } as Transition,
} as const;

// =============================================================================
// HOVER/TAP ANIMATION STATES
// =============================================================================

/**
 * Premium hover/tap states for interactive elements
 * Use with motion component's whileHover and whileTap props
 */
export const interactionStates = {
  // Subtle lift effect for cards
  cardHover: {
    y: -2,
    scale: 1.01,
    transition: springs.snappy,
  } as TargetAndTransition,

  cardTap: {
    scale: 0.98,
    transition: springs.snappy,
  } as TargetAndTransition,

  // Button press effect
  buttonHover: {
    scale: 1.02,
    transition: springs.snappy,
  } as TargetAndTransition,

  buttonTap: {
    scale: 0.95,
    transition: springs.snappy,
  } as TargetAndTransition,

  // Icon/small element tap
  iconTap: {
    scale: 0.85,
    transition: springs.snappy,
  } as TargetAndTransition,

  // Chip/pill press
  chipTap: {
    scale: 0.92,
    transition: springs.snappy,
  } as TargetAndTransition,

  // Row/list item press
  rowTap: {
    scale: 0.99,
    backgroundColor: 'rgba(99, 102, 241, 0.05)',
    transition: springs.snappy,
  } as TargetAndTransition,
} as const;

// =============================================================================
// VARIANT PRESETS
// =============================================================================

/**
 * Pre-built animation variants for common patterns
 */
export const variants = {
  // Fade in from bottom (standard element entrance)
  fadeUp: {
    hidden: {
      opacity: 0,
      y: 20,
    },
    visible: {
      opacity: 1,
      y: 0,
      transition: springs.smooth,
    },
    exit: {
      opacity: 0,
      y: -10,
      transition: { duration: 0.15 },
    },
  } as Variants,

  // Fade in with scale (modal/card entrance)
  scaleIn: {
    hidden: {
      opacity: 0,
      scale: 0.95,
    },
    visible: {
      opacity: 1,
      scale: 1,
      transition: springs.smooth,
    },
    exit: {
      opacity: 0,
      scale: 0.95,
      transition: { duration: 0.15 },
    },
  } as Variants,

  // Slide from right (panel/drawer)
  slideRight: {
    hidden: {
      opacity: 0,
      x: 20,
    },
    visible: {
      opacity: 1,
      x: 0,
      transition: springs.smooth,
    },
    exit: {
      opacity: 0,
      x: 20,
      transition: { duration: 0.15 },
    },
  } as Variants,

  // Slide from left
  slideLeft: {
    hidden: {
      opacity: 0,
      x: -20,
    },
    visible: {
      opacity: 1,
      x: 0,
      transition: springs.smooth,
    },
    exit: {
      opacity: 0,
      x: -20,
      transition: { duration: 0.15 },
    },
  } as Variants,

  // Expand/collapse (accordion)
  expand: {
    hidden: {
      height: 0,
      opacity: 0,
      overflow: 'hidden',
    },
    visible: {
      height: 'auto',
      opacity: 1,
      transition: {
        height: springs.smooth,
        opacity: { duration: 0.2 },
      },
    },
    exit: {
      height: 0,
      opacity: 0,
      transition: {
        height: springs.snappy,
        opacity: { duration: 0.1 },
      },
    },
  } as Variants,

  // Staggered children (list items)
  staggerContainer: {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.05,
        delayChildren: 0.1,
      },
    },
    exit: {
      opacity: 0,
      transition: {
        staggerChildren: 0.03,
        staggerDirection: -1,
      },
    },
  } as Variants,

  staggerItem: {
    hidden: {
      opacity: 0,
      y: 12,
    },
    visible: {
      opacity: 1,
      y: 0,
      transition: springs.smooth,
    },
    exit: {
      opacity: 0,
      y: -8,
      transition: { duration: 0.1 },
    },
  } as Variants,

  // Presence animation for elements appearing/disappearing
  presence: {
    initial: {
      opacity: 0,
      scale: 0.96,
    },
    animate: {
      opacity: 1,
      scale: 1,
      transition: springs.snappy,
    },
    exit: {
      opacity: 0,
      scale: 0.96,
      transition: { duration: 0.12 },
    },
  } as Variants,
} as const;

// =============================================================================
// ANIMATION HELPERS
// =============================================================================

/**
 * Create a staggered delay for list items
 */
export function staggerDelay(index: number, baseDelay = 0.05): number {
  return index * baseDelay;
}

/**
 * Get spring transition with optional delay
 */
export function springWithDelay(
  preset: keyof typeof springs = 'smooth',
  delay = 0
): Transition {
  return {
    ...springs[preset],
    delay,
  };
}

/**
 * Combine multiple transition configs
 */
export function combineTransitions(
  ...configs: Partial<Transition>[]
): Transition {
  return configs.reduce((acc, config) => ({ ...acc, ...config }), {}) as Transition;
}

// =============================================================================
// CSS ANIMATION UTILITIES
// =============================================================================

/**
 * CSS custom properties for spring-like animations
 * Use when Framer Motion overhead isn't justified
 */
export const cssAnimations = {
  // Cubic bezier curves that approximate spring physics
  easeSpring: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
  easeSnappy: 'cubic-bezier(0.22, 1, 0.36, 1)',
  easeGentle: 'cubic-bezier(0.16, 1, 0.3, 1)',

  // Duration recommendations
  durationFast: '150ms',
  durationNormal: '250ms',
  durationSlow: '400ms',
} as const;

// =============================================================================
// REDUCED MOTION SUPPORT
// =============================================================================

/**
 * Check if user prefers reduced motion
 */
export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Get spring config with reduced motion fallback
 */
export function getSpring(preset: keyof typeof springs = 'smooth'): Transition {
  if (prefersReducedMotion()) {
    return { duration: 0.01 };
  }
  return springs[preset];
}

/**
 * Get variants with reduced motion support
 */
export function getVariants(preset: keyof typeof variants): Variants {
  if (prefersReducedMotion()) {
    return {
      hidden: { opacity: 0 },
      visible: { opacity: 1, transition: { duration: 0.01 } },
      exit: { opacity: 0, transition: { duration: 0.01 } },
    };
  }
  return variants[preset];
}

export default {
  springs,
  transitions,
  interactionStates,
  variants,
  staggerDelay,
  springWithDelay,
  combineTransitions,
  cssAnimations,
  prefersReducedMotion,
  getSpring,
  getVariants,
};
