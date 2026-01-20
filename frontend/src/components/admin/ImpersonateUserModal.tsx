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
import { useTranslation } from 'react-i18next';
import { AlertTriangle, User, Loader2 } from 'lucide-react';
import { useImpersonation } from '../../hooks';
import { AIWriteAssist } from '../ui/AIWriteAssist';
import './AdminModals.css';
import './AdminButtons.css';

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
  const { t } = useTranslation();
  const { startImpersonation, isMutating } = useImpersonation();

  const [reason, setReason] = useState('');
  const [acknowledged, setAcknowledged] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isReasonValid = reason.trim().length >= MIN_REASON_LENGTH;
  const canSubmit = isReasonValid && acknowledged && !isMutating;

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();

      // Compute canSubmit fresh inside handler to avoid stale closure
      const freshIsReasonValid = reason.trim().length >= MIN_REASON_LENGTH;
      const freshCanSubmit = freshIsReasonValid && acknowledged && !isMutating;

      if (!freshCanSubmit) {
        return;
      }

      setError(null);

      try {
        await startImpersonation(targetUser.id, reason.trim());

        // Reset form
        setReason('');
        setAcknowledged(false);
        // Navigate to main app to view as user
        onSuccess?.();
        onClose();

        // Use the session ID from storage to ensure it persists
        const sessionForRedirect = sessionStorage.getItem('axcouncil_impersonation_session');
        const sessionIdForUrl = sessionForRedirect
          ? JSON.parse(sessionForRedirect).session_id
          : null;

        // Redirect with session ID in URL as backup (will be picked up by useImpersonation)
        if (sessionIdForUrl) {
          window.location.href = `/?imp_session=${encodeURIComponent(sessionIdForUrl)}`;
        } else {
          window.location.href = '/';
        }
      } catch (err) {
        console.error('[ImpersonateUserModal] Error:', err);
        setError(err instanceof Error ? err.message : t('admin.impersonation.failed', 'Failed to start impersonation'));
      }
    },
    [
      canSubmit,
      startImpersonation,
      targetUser.id,
      reason,
      acknowledged,
      isMutating,
      onSuccess,
      onClose,
    ]
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
              {t('admin.impersonation.title', 'Impersonate User')}
            </h2>
            <p className="admin-modal__subtitle">{targetUser.email}</p>
          </div>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="admin-modal__content">
          {/* Compact security notice */}
          <div className="admin-modal__alert admin-modal__alert--warning">
            <AlertTriangle className="admin-modal__alert-icon" />
            <p className="admin-modal__alert-text">
              {t('admin.impersonation.securityNotice', 'All actions are logged. Session expires in {{minutes}} minutes.', { minutes: SESSION_DURATION_MINUTES })}
            </p>
          </div>

          {/* Reason input with AI assist */}
          <div className="admin-modal__field">
            <label htmlFor="impersonate-reason" className="admin-modal__label">
              {t('admin.impersonation.reason', 'Reason')} <span className="admin-modal__required">*</span>
            </label>
            <AIWriteAssist
              context="impersonation-reason"
              value={reason}
              onSuggestion={setReason}
              additionalContext={`Target user: ${targetUser.email}`}
              disabled={isMutating}
            >
              <textarea
                id="impersonate-reason"
                className="admin-modal__textarea"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder={t('admin.impersonation.reasonPlaceholder', 'e.g., Support ticket #1234 - user reports payment issue')}
                rows={2}
                disabled={isMutating}
              />
            </AIWriteAssist>
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
            <span>{t('admin.impersonation.acknowledgement', 'User has granted permission for this support session')}</span>
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
              className="admin-action-btn admin-action-btn--secondary"
              onClick={handleClose}
              disabled={isMutating}
            >
              {t('common.cancel', 'Cancel')}
            </button>
            <button
              type="submit"
              className="admin-action-btn admin-action-btn--warning"
              disabled={!canSubmit}
            >
              {isMutating ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {t('admin.impersonation.starting', 'Starting...')}
                </>
              ) : (
                <>
                  <User className="h-4 w-4" />
                  {t('admin.impersonation.start', 'Start Impersonation')}
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
