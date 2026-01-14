/**
 * Confetti - Celebration animation for success moments
 *
 * Lightweight confetti effect using Framer Motion.
 * Perfect for completing stages, saving decisions, or major milestones.
 *
 * Usage:
 * ```tsx
 * const [showConfetti, setShowConfetti] = useState(false);
 *
 * <Confetti show={showConfetti} onComplete={() => setShowConfetti(false)} />
 * ```
 */
import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';

interface ConfettiProps {
  show: boolean;
  onComplete?: () => void;
  count?: number;
}

export function Confetti({ show, onComplete, count = 30 }: ConfettiProps) {
  const [particles, setParticles] = useState<Array<{ id: number; x: number; y: number; color: string; rotation: number }>>([]);

  useEffect(() => {
    if (show) {
      // Generate random particles
      const colors = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'] as const;
      const newParticles = Array.from({ length: count }, (_, i) => ({
        id: i,
        x: Math.random() * 100 - 50, // -50 to 50vw
        y: Math.random() * -100 - 20, // -20 to -120vh
        color: colors[Math.floor(Math.random() * colors.length)] as string,
        rotation: Math.random() * 360,
      }));
      // eslint-disable-next-line react-hooks/set-state-in-effect -- Intentional: sync particles with show prop for animation
      setParticles(newParticles);

      // Auto-complete after animation
      const timer = setTimeout(() => {
        onComplete?.();
      }, 1500);

      return () => clearTimeout(timer);
    }
    return undefined;
  }, [show, count, onComplete]);

  if (!show) return null;

  return (
    <div className="pointer-events-none fixed inset-0 z-[9999] overflow-hidden">
      {particles.map((particle) => (
        <motion.div
          key={particle.id}
          initial={{
            x: '50vw',
            y: '50vh',
            scale: 0,
            rotate: 0,
            opacity: 1,
          }}
          animate={{
            x: `calc(50vw + ${particle.x}vw)`,
            y: `calc(100vh + ${particle.y}vh)`,
            scale: [0, 1, 0.8],
            rotate: particle.rotation,
            opacity: [1, 1, 0],
          }}
          transition={{
            duration: 1.5,
            ease: [0.34, 1.56, 0.64, 1], // Spring-like easing
          }}
          style={{
            position: 'absolute',
            width: 8,
            height: 8,
            backgroundColor: particle.color,
            borderRadius: 2,
          }}
        />
      ))}
    </div>
  );
}
