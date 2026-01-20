/**
 * Celebration Utilities - Delightful micro-celebrations for success moments
 *
 * Uses canvas-confetti for physics-based particle effects.
 * All celebrations respect prefers-reduced-motion.
 */
import confetti from 'canvas-confetti';

// Check if user prefers reduced motion
const prefersReducedMotion = (): boolean => {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
};

/**
 * Council complete celebration - themed for AI council
 * Use for: Stage 3 synthesis complete
 */
export function celebrateCouncilComplete(): void {
  if (prefersReducedMotion()) return;

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
}
