/**
 * ImpersonateUserModal - Modal to start impersonating a user
 *
 * Requires:
 * - Reason for impersonation (audit trail)
 * - Confirmation of security implications
 *
 * This modal enforces proper documentation of why impersonation is needed.
 */

import { useState, useCallback, memo } from 'react';
import { AlertTriangle, User, Clock, Loader2 } from 'lucide-react';
import { useImpersonation } from '../../hooks';
import './AdminModals.css';

interface ImpersonateUserModalProps {
  /** Whether the modal is open */
  isOpen: boolean;
  /** Callback to close the modal */
  onClose: () => void;
  /** User to impersonate */
  targetUser: {
    id: string;
    email: string;
  };
  /** Callback after successful impersonation start */
  onSuccess?: () => void;
}

/** Minimum reason length */
const MIN_REASON_LENGTH = 10;

/** Max session duration in minutes */
const SESSION_DURATION_MINUTES = 30;

function ImpersonateUserModalComponent({
  isOpen,
  onClose,
  targetUser,
  onSuccess,
}: ImpersonateUserModalProps) {
  const { startImpersonation, isMutating } = useImpersonation();

  const [reason, setReason] = useState('');
  const [acknowledged, setAcknowledged] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isReasonValid = reason.trim().length >= MIN_REASON_LENGTH;
  const canSubmit = isReasonValid && acknowledged && !isMutating;

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!canSubmit) return;

      setError(null);

      try {
        await startImpersonation(targetUser.id, reason.trim());
        // Reset form
        setReason('');
        setAcknowledged(false);
        // Navigate to main app to view as user
        onSuccess?.();
        onClose();
        // Redirect to main app
        window.location.href = '/';
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to start impersonation');
      }
    },
    [canSubmit, startImpersonation, targetUser.id, reason, onSuccess, onClose]
  );

  const handleClose = useCallback(() => {
    if (isMutating) return; // Don't close while loading
    setReason('');
    setAcknowledged(false);
    setError(null);
    onClose();
  }, [isMutating, onClose]);

  if (!isOpen) return null;

  return (
    // eslint-disable-next-line jsx-a11y/no-static-element-interactions, jsx-a11y/click-events-have-key-events
    <div className="admin-modal-overlay" onClick={handleClose}>
      {/* eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions, jsx-a11y/click-events-have-key-events */}
      <div
        className="admin-modal admin-modal--impersonate"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-labelledby="impersonate-modal-title"
        aria-modal="true"
      >
        {/* Header */}
        <div className="admin-modal__header admin-modal__header--warning">
          <div className="admin-modal__header-icon">
            <User />
          </div>
          <div className="admin-modal__header-content">
            <h2 id="impersonate-modal-title" className="admin-modal__title">
              Impersonate User
            </h2>
            <p className="admin-modal__subtitle">{targetUser.email}</p>
          </div>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="admin-modal__content">
          {/* Security warning */}
          <div className="admin-modal__alert admin-modal__alert--warning">
            <AlertTriangle className="admin-modal__alert-icon" />
            <div className="admin-modal__alert-content">
              <p className="admin-modal__alert-title">Security Notice</p>
              <ul className="admin-modal__alert-list">
                <li>All actions will be logged for audit purposes</li>
                <li>Session will automatically expire after {SESSION_DURATION_MINUTES} minutes</li>
                <li>You will see the platform exactly as this user sees it</li>
                <li>Do not perform actions the user did not request</li>
              </ul>
            </div>
          </div>

          {/* Session info */}
          <div className="admin-modal__info">
            <Clock className="admin-modal__info-icon" />
            <span>Session duration: {SESSION_DURATION_MINUTES} minutes</span>
          </div>

          {/* Reason input */}
          <div className="admin-modal__field">
            <label htmlFor="impersonate-reason" className="admin-modal__label">
              Reason for impersonation <span className="admin-modal__required">*</span>
            </label>
            <textarea
              id="impersonate-reason"
              className="admin-modal__textarea"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g., Investigating support ticket #1234, user reported issue with..."
              rows={3}
              disabled={isMutating}
              autoFocus
            />
            <p className="admin-modal__hint">
              {reason.length}/{MIN_REASON_LENGTH}+ characters required
            </p>
          </div>

          {/* Acknowledgement checkbox */}
          <label className="admin-modal__checkbox-label">
            <input
              type="checkbox"
              checked={acknowledged}
              onChange={(e) => setAcknowledged(e.target.checked)}
              disabled={isMutating}
              className="admin-modal__checkbox"
            />
            <span>
              I understand this action is logged and I will only perform actions necessary for
              support purposes.
            </span>
          </label>

          {/* Error message */}
          {error && (
            <div className="admin-modal__error">
              <AlertTriangle className="admin-modal__error-icon" />
              <span>{error}</span>
            </div>
          )}

          {/* Actions */}
          <div className="admin-modal__actions">
            <button
              type="button"
              className="admin-btn admin-btn--secondary"
              onClick={handleClose}
              disabled={isMutating}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="admin-btn admin-btn--warning"
              disabled={!canSubmit}
            >
              {isMutating ? (
                <>
                  <Loader2 className="admin-btn__icon animate-spin" />
                  Starting...
                </>
              ) : (
                <>
                  <User className="admin-btn__icon" />
                  Start Impersonation
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export const ImpersonateUserModal = memo(ImpersonateUserModalComponent);
