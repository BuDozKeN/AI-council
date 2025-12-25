/**
 * MockModeBanner - Persistent banner shown when mock mode is enabled
 *
 * Displays at the top of the app to remind developers that they're
 * using simulated responses and no tokens will be consumed.
 */

import { FlaskConical, X } from 'lucide-react';
import './MockModeBanner.css';

interface MockModeBannerProps {
  onDismiss?: () => void;
}

export function MockModeBanner({ onDismiss }: MockModeBannerProps) {
  return (
    <div className="mock-mode-banner" role="status" aria-live="polite">
      <div className="mock-mode-banner-content">
        <FlaskConical size={16} className="mock-mode-banner-icon" />
        <span className="mock-mode-banner-text">
          <strong>Mock Mode Active</strong> — Using simulated responses. No tokens will be consumed.
        </span>
      </div>
      {onDismiss && (
        <button
          className="mock-mode-banner-dismiss"
          onClick={onDismiss}
          aria-label="Dismiss banner"
        >
          <X size={16} />
        </button>
      )}
    </div>
  );
}
