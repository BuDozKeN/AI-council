/**
 * ImpersonationBanner - Sticky banner shown during user impersonation
 *
 * This banner is non-dismissible and always visible when an admin is
 * impersonating a user. It shows:
 * - Who is being impersonated
 * - Time remaining until auto-expiry
 * - Exit button to end impersonation
 *
 * Security: Cannot be hidden or dismissed - always visible during impersonation
 */

import { useCallback, memo } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, Clock, X, User } from 'lucide-react';
import { useImpersonation } from '../../hooks';
import './ImpersonationBanner.css';

interface ImpersonationBannerProps {
  /** Optional callback when impersonation ends */
  onExit?: () => void;
}

/**
 * Banner component shown during impersonation.
 * Renders via portal to ensure it's always on top.
 */
function ImpersonationBannerComponent({ onExit }: ImpersonationBannerProps) {
  const {
    isImpersonating,
    session,
    timeRemainingFormatted,
    timeRemaining,
    endImpersonation,
    isMutating,
  } = useImpersonation();

  const handleExit = useCallback(async () => {
    try {
      await endImpersonation();
      onExit?.();
    } catch (error) {
      console.error('Failed to end impersonation:', error);
    }
  }, [endImpersonation, onExit]);

  // Don't render if not impersonating
  if (!isImpersonating || !session) {
    return null;
  }

  // Determine urgency level based on time remaining
  const isUrgent = timeRemaining < 5 * 60; // Less than 5 minutes
  const isCritical = timeRemaining < 60; // Less than 1 minute

  const bannerContent = (
    <div
      className={`impersonation-banner ${isUrgent ? 'impersonation-banner--urgent' : ''} ${isCritical ? 'impersonation-banner--critical' : ''}`}
      role="alert"
      aria-live="polite"
    >
      <div className="impersonation-banner__content">
        {/* Warning icon */}
        <div className="impersonation-banner__icon">
          <AlertTriangle aria-hidden="true" />
        </div>

        {/* Main message */}
        <div className="impersonation-banner__message">
          <span className="impersonation-banner__label">
            <User className="impersonation-banner__user-icon" aria-hidden="true" />
            Viewing as:
          </span>
          <strong className="impersonation-banner__email">{session.target_user_email}</strong>
        </div>

        {/* Timer */}
        <div className="impersonation-banner__timer" aria-label={`Time remaining: ${timeRemainingFormatted}`}>
          <Clock className="impersonation-banner__clock-icon" aria-hidden="true" />
          <span className="impersonation-banner__time">{timeRemainingFormatted}</span>
          <span className="impersonation-banner__time-label">remaining</span>
        </div>

        {/* Reason (truncated) */}
        {session.reason && (
          <div className="impersonation-banner__reason" title={session.reason}>
            <span className="impersonation-banner__reason-text">
              {session.reason.length > 30 ? `${session.reason.slice(0, 30)}...` : session.reason}
            </span>
          </div>
        )}

        {/* Exit button */}
        <button
          className="impersonation-banner__exit"
          onClick={handleExit}
          disabled={isMutating}
          aria-label="Exit impersonation mode"
        >
          <X className="impersonation-banner__exit-icon" aria-hidden="true" />
          <span>Exit</span>
        </button>
      </div>

      {/* Visual watermark pattern (security indicator) */}
      <div className="impersonation-banner__watermark" aria-hidden="true">
        <span>IMPERSONATION MODE</span>
        <span>IMPERSONATION MODE</span>
        <span>IMPERSONATION MODE</span>
      </div>
    </div>
  );

  // Render via portal to ensure it's above everything
  return createPortal(bannerContent, document.body);
}

export const ImpersonationBanner = memo(ImpersonationBannerComponent);
