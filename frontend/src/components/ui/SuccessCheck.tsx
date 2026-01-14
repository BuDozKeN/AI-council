/**
 * SuccessCheck - Delightful success animation with Framer Motion
 *
 * A premium check mark animation that appears when actions complete successfully.
 * Uses spring physics for natural, bouncy feel (Stripe/Linear quality).
 *
 * Usage:
 * ```tsx
 * <SuccessCheck size={24} />
 * ```
 */
import { motion } from 'framer-motion';
import { Check } from 'lucide-react';

interface SuccessCheckProps {
  size?: number;
  className?: string;
}

export function SuccessCheck({ size = 24, className = '' }: SuccessCheckProps) {
  return (
    <motion.div
      initial={{ scale: 0, rotate: -15 }}
      animate={{ scale: 1, rotate: 0 }}
      transition={{
        type: 'spring',
        stiffness: 300,
        damping: 20,
      }}
      className={`inline-flex items-center justify-center rounded-full bg-green-500 text-white ${className}`}
      style={{
        width: size,
        height: size,
      }}
    >
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{
          delay: 0.1,
          type: 'spring',
          stiffness: 400,
          damping: 15,
        }}
      >
        <Check size={size * 0.6} strokeWidth={3} />
      </motion.div>
    </motion.div>
  );
}
