/**
 * Celebration Utilities - Delightful micro-celebrations for success moments
 *
 * Uses canvas-confetti for physics-based particle effects.
 * All celebrations respect prefers-reduced-motion.
 * canvas-confetti is lazily imported to reduce initial bundle size (H8).
 */

// Lazy-load canvas-confetti to keep it out of the initial bundle (H8 fix)
let confettiPromise: Promise<typeof import('canvas-confetti')> | null = null;
const getConfetti = async () => {
  if (!confettiPromise) {
    confettiPromise = import('canvas-confetti');
  }
  return (await confettiPromise).default;
};

// Check if user prefers reduced motion
const prefersReducedMotion = (): boolean => {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
};

/**
 * Standard success celebration - subtle confetti burst
 * Use for: Saves, completions, minor achievements
 */
export function celebrateSuccess(): void {
  if (prefersReducedMotion()) return;

  getConfetti().then(confetti => {
    confetti({
      particleCount: 50,
      spread: 60,
      origin: { y: 0.7 },
      colors: ['#10b981', '#34d399', '#6ee7b7'], // Emerald palette
      ticks: 150,
      gravity: 1.2,
      scalar: 0.9,
      drift: 0,
    });
  });
}

/**
 * Major milestone celebration - full confetti shower
 * Use for: Council completion, first conversation, onboarding complete
 */
export function celebrateMilestone(): void {
  if (prefersReducedMotion()) return;

  getConfetti().then(confetti => {
    const duration = 2000;
    const end = Date.now() + duration;
    const colors = ['#6366f1', '#818cf8', '#a5b4fc', '#10b981', '#fbbf24'];

    (function frame() {
      confetti({
        particleCount: 3,
        angle: 60,
        spread: 55,
        origin: { x: 0 },
        colors: colors,
        ticks: 200,
        gravity: 0.8,
        scalar: 1.1,
      });
      confetti({
        particleCount: 3,
        angle: 120,
        spread: 55,
        origin: { x: 1 },
        colors: colors,
        ticks: 200,
        gravity: 0.8,
        scalar: 1.1,
      });

      if (Date.now() < end) {
        requestAnimationFrame(frame);
      }
    })();
  });
}

/**
 * Council complete celebration - themed for AI council
 * Use for: Stage 3 synthesis complete
 */
export function celebrateCouncilComplete(): void {
  if (prefersReducedMotion()) return;

  getConfetti().then(confetti => {
    // First burst - council colors
    confetti({
      particleCount: 80,
      spread: 100,
      origin: { y: 0.6 },
      colors: [
        '#6366f1', // Indigo (Claude)
        '#10b981', // Emerald (GPT)
        '#3b82f6', // Blue (Gemini)
        '#f97316', // Orange (Grok)
        '#8b5cf6', // Purple (DeepSeek)
      ],
      ticks: 200,
      gravity: 0.9,
      scalar: 1,
    });

    // Second burst - delayed sparkle
    setTimeout(() => {
      if (prefersReducedMotion()) return;
      confetti({
        particleCount: 30,
        spread: 70,
        origin: { y: 0.65 },
        colors: ['#fbbf24', '#fcd34d'], // Gold
        ticks: 150,
        gravity: 1,
        scalar: 0.8,
      });
    }, 150);
  });
}

/**
 * Winner reveal celebration - for leaderboard/ranking reveals
 * Use for: Stage 2 winner announcement
 */
export function celebrateWinner(): void {
  if (prefersReducedMotion()) return;

  getConfetti().then(confetti => {
    // Trophy gold burst
    confetti({
      particleCount: 60,
      spread: 80,
      origin: { y: 0.65 },
      colors: ['#fbbf24', '#f59e0b', '#d97706', '#fcd34d'],
      shapes: ['circle', 'square'],
      ticks: 180,
      gravity: 1,
      scalar: 1.1,
    });
  });
}

/**
 * Fireworks celebration - for major achievements
 * Use for: Subscription upgrade, major milestones
 */
export function celebrateFireworks(): void {
  if (prefersReducedMotion()) return;

  getConfetti().then(confetti => {
    const duration = 3000;
    const animationEnd = Date.now() + duration;
    const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 10000 };

    function randomInRange(min: number, max: number): number {
      return Math.random() * (max - min) + min;
    }

    const interval = setInterval(function () {
      const timeLeft = animationEnd - Date.now();

      if (timeLeft <= 0) {
        return clearInterval(interval);
      }

      const particleCount = 50 * (timeLeft / duration);

      // Random bursts from different positions
      confetti({
        ...defaults,
        particleCount,
        origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 },
        colors: ['#6366f1', '#10b981', '#f59e0b'],
      });
      confetti({
        ...defaults,
        particleCount,
        origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 },
        colors: ['#8b5cf6', '#ec4899', '#3b82f6'],
      });
    }, 250);
  });
}

/**
 * Subtle sparkle - minimal celebration
 * Use for: Settings saved, minor actions
 */
export function celebrateSparkle(): void {
  if (prefersReducedMotion()) return;

  getConfetti().then(confetti => {
    confetti({
      particleCount: 20,
      spread: 40,
      origin: { y: 0.8, x: 0.95 }, // Bottom-right corner (where toasts appear)
      colors: ['#6366f1', '#818cf8'],
      ticks: 100,
      gravity: 1.5,
      scalar: 0.6,
      drift: -0.5,
    });
  });
}

// Export all celebrations as a namespace for convenience
export const celebrate = {
  success: celebrateSuccess,
  milestone: celebrateMilestone,
  councilComplete: celebrateCouncilComplete,
  winner: celebrateWinner,
  fireworks: celebrateFireworks,
  sparkle: celebrateSparkle,
};
