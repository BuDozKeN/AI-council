/**
 * SoftGateModal - Authentication gate for starting deliberations
 *
 * Appears when unauthenticated users click "Start Deliberation" in onboarding.
 * Encourages sign-up without being overly aggressive.
 *
 * Features:
 * - Google OAuth as primary CTA
 * - Personalized context (shows company name if available)
 * - Option to skip (goes to regular sign-in flow)
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { Sparkles, ShieldCheck, Users } from 'lucide-react';
import { AppModal } from '../ui/AppModal';
import { Button } from '../ui/button';
import { useAuth } from '../../AuthContext';
import { springs } from '../../lib/animations';
import './SoftGateModal.css';

// Google Icon SVG (reused from Login.tsx)
const GoogleIcon = () => (
  <svg viewBox="0 0 24 24" width="20" height="20" xmlns="http://www.w3.org/2000/svg">
    <g transform="matrix(1, 0, 0, 1, 27.009001, -39.238998)">
      <path
        fill="#4285F4"
        d="M -3.264 51.509 C -3.264 50.719 -3.334 49.969 -3.454 49.239 L -14.754 49.239 L -14.754 53.749 L -8.284 53.749 C -8.574 55.229 -9.424 56.479 -10.684 57.329 L -10.684 60.329 L -6.824 60.329 C -4.564 58.239 -3.264 55.159 -3.264 51.509 Z"
      />
      <path
        fill="#34A853"
        d="M -14.754 63.239 C -11.514 63.239 -8.804 62.159 -6.824 60.329 L -10.684 57.329 C -11.764 58.049 -13.134 58.489 -14.754 58.489 C -17.884 58.489 -20.534 56.379 -21.484 53.529 L -25.464 53.529 L -25.464 56.619 C -23.494 60.539 -19.444 63.239 -14.754 63.239 Z"
      />
      <path
        fill="#FBBC05"
        d="M -21.484 53.529 C -21.734 52.809 -21.864 52.039 -21.864 51.239 C -21.864 50.439 -21.724 49.669 -21.484 48.949 L -21.484 45.859 L -25.464 45.859 C -26.284 47.479 -26.754 49.299 -26.754 51.239 C -26.754 53.179 -26.284 54.999 -25.464 56.619 L -21.484 53.529 Z"
      />
      <path
        fill="#EA4335"
        d="M -14.754 44.989 C -12.984 44.989 -11.404 45.599 -10.154 46.789 L -6.734 43.369 C -8.804 41.449 -11.514 40.239 -14.754 40.239 C -19.444 40.239 -23.494 42.939 -25.464 46.859 L -21.484 49.949 C -20.534 47.099 -17.884 44.989 -14.754 44.989 Z"
      />
    </g>
  </svg>
);

interface SoftGateModalProps {
  isOpen: boolean;
  onClose: () => void;
  companyName?: string | undefined;
  /** Called when user successfully authenticates */
  onAuthenticated?: (() => void) | undefined;
}

export function SoftGateModal({
  isOpen,
  onClose,
  companyName,
  onAuthenticated,
}: SoftGateModalProps) {
  const { signInWithGoogle, user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Track if we've already triggered the callback to prevent duplicate calls
  const hasTriggeredAuth = useRef(false);

  // If user becomes authenticated while modal is open, trigger callback
  useEffect(() => {
    if (isOpen && user && onAuthenticated && !hasTriggeredAuth.current) {
      hasTriggeredAuth.current = true;
      onAuthenticated();
    }
    // Reset the flag when modal closes
    if (!isOpen) {
      hasTriggeredAuth.current = false;
    }
  }, [isOpen, user, onAuthenticated]);

  const handleGoogleSignIn = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      await signInWithGoogle();
      // Note: The OAuth flow will redirect, so we may not reach here
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to sign in');
      setLoading(false);
    }
  }, [signInWithGoogle]);

  const benefits = [
    {
      icon: Sparkles,
      title: 'Free Trial',
      description: 'Get one full Council deliberation at no cost',
    },
    {
      icon: ShieldCheck,
      title: 'Save Your Work',
      description: 'Access your decision history anytime',
    },
    {
      icon: Users,
      title: 'Your Council',
      description: companyName
        ? `Personalized advisors for ${companyName}`
        : 'AI advisors tailored to your needs',
    },
  ];

  return (
    <AppModal
      isOpen={isOpen}
      onClose={onClose}
      title="One Quick Step"
      description="Sign in to start your Council deliberation"
      size="sm"
      className="soft-gate-modal"
    >
      <div className="soft-gate-content">
        {/* Benefits list */}
        <div className="soft-gate-benefits">
          {benefits.map((benefit, index) => (
            <motion.div
              key={benefit.title}
              className="soft-gate-benefit"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.1, ...springs.gentle }}
            >
              <div className="soft-gate-benefit-icon">
                <benefit.icon />
              </div>
              <div className="soft-gate-benefit-text">
                <span className="soft-gate-benefit-title">{benefit.title}</span>
                <span className="soft-gate-benefit-desc">{benefit.description}</span>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Error message */}
        {error && (
          <motion.div
            className="soft-gate-error"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={springs.snappy}
          >
            {error}
          </motion.div>
        )}

        {/* Google Sign In - Primary CTA */}
        <Button
          onClick={handleGoogleSignIn}
          disabled={loading}
          size="lg"
          className="soft-gate-google-btn"
        >
          <GoogleIcon />
          {loading ? 'Connecting...' : 'Continue with Google'}
        </Button>

        {/* Skip option */}
        <button type="button" className="soft-gate-skip" onClick={onClose}>
          I'll sign in later
        </button>
      </div>
    </AppModal>
  );
}

export default SoftGateModal;
