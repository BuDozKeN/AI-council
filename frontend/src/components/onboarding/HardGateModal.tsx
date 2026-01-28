/**
 * HardGateModal - API key/subscription gate for continued usage
 *
 * Appears when authenticated users have exhausted their free trial
 * and need to either add an API key or upgrade to continue.
 *
 * Features:
 * - Clear explanation of why access is blocked
 * - "Add API Key" CTA (opens settings)
 * - Option to dismiss (user can browse but not deliberate)
 */

import { motion } from 'framer-motion';
import { Key, AlertTriangle, ExternalLink } from 'lucide-react';
import { AppModal } from '../ui/AppModal';
import { Button } from '../ui/button';
import { springs } from '../../lib/animations';
import './HardGateModal.css';

interface HardGateModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Called when user wants to add API key */
  onAddApiKey: () => void;
  /** User's company name for personalization */
  companyName?: string | undefined;
  /** Reason for blocking: 'trial_exhausted' | 'no_api_key' */
  reason?: 'trial_exhausted' | 'no_api_key' | undefined;
}

export function HardGateModal({
  isOpen,
  onClose,
  onAddApiKey,
  companyName,
  reason = 'trial_exhausted',
}: HardGateModalProps) {
  const title = reason === 'trial_exhausted' ? 'Trial Complete' : 'API Key Required';

  const description =
    reason === 'trial_exhausted'
      ? `You've used your free trial for ${companyName || 'your council'}. Add your own API key to continue deliberating.`
      : 'To run Council deliberations, you need to provide an OpenRouter API key.';

  return (
    <AppModal isOpen={isOpen} onClose={onClose} title={title} size="sm" className="hard-gate-modal">
      <div className="hard-gate-content">
        {/* Warning icon */}
        <motion.div
          className="hard-gate-icon-wrapper"
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={springs.gentle}
        >
          <AlertTriangle className="hard-gate-icon" />
        </motion.div>

        {/* Description */}
        <motion.p
          className="hard-gate-description"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, ...springs.gentle }}
        >
          {description}
        </motion.p>

        {/* How it works */}
        <motion.div
          className="hard-gate-info"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, ...springs.gentle }}
        >
          <h4 className="hard-gate-info-title">How it works</h4>
          <ul className="hard-gate-info-list">
            <li>Get a free OpenRouter API key</li>
            <li>Pay only for the AI tokens you use</li>
            <li>Average cost: ~$0.50 per deliberation</li>
          </ul>
        </motion.div>

        {/* Actions */}
        <div className="hard-gate-actions">
          <Button onClick={onAddApiKey} size="lg" className="hard-gate-primary-btn">
            <Key className="button-icon" />
            Add API Key
          </Button>

          <a
            href="https://openrouter.ai/keys"
            target="_blank"
            rel="noopener noreferrer"
            className="hard-gate-link"
            aria-label="Get free API key (opens in new tab)"
          >
            Get free API key
            <ExternalLink className="hard-gate-link-icon" aria-hidden="true" />
          </a>
        </div>

        {/* Dismiss option */}
        <button type="button" className="hard-gate-dismiss" onClick={onClose}>
          Maybe later
        </button>
      </div>
    </AppModal>
  );
}

export default HardGateModal;
