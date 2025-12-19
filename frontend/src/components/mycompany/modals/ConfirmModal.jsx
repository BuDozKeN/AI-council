/**
 * ConfirmModal - Unified confirmation dialog for archive/delete actions
 *
 * Extracted from MyCompany.jsx for reusability.
 */

import { AppModal } from '../../ui/AppModal';
import { Spinner } from '../../ui/Spinner';

export function ConfirmModal({
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  variant = 'warning', // 'warning' (amber), 'danger' (red), 'info' (purple/brand)
  onConfirm,
  onCancel,
  processing = false
}) {
  const isDanger = variant === 'danger';
  const isInfo = variant === 'info';

  // Icon based on variant
  const renderIcon = () => {
    if (isDanger) {
      // Trash icon for danger
      return (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2M10 11v6M14 11v6" />
        </svg>
      );
    } else if (isInfo) {
      // Sparkles icon for AI/info
      return (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M12 3v1m0 16v1m-9-9h1m16 0h1m-2.636-6.364l-.707.707M6.343 17.657l-.707.707m0-12.728l.707.707m11.314 11.314l.707.707M12 8a4 4 0 100 8 4 4 0 000-8z" />
        </svg>
      );
    } else {
      // Warning triangle for warning
      return (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
      );
    }
  };

  const iconClass = isDanger ? 'danger' : isInfo ? 'info' : 'warning';
  const buttonClass = isDanger ? 'danger' : isInfo ? 'primary' : 'warning';

  return (
    <AppModal isOpen={true} onClose={onCancel} title={title} size="sm">
      <div className={`mc-confirm-icon ${iconClass}`}>
        {renderIcon()}
      </div>
      <p className="mc-confirm-message">{message}</p>
      <AppModal.Footer>
        <button
          type="button"
          className="app-modal-btn app-modal-btn-secondary"
          onClick={onCancel}
          disabled={processing}
        >
          {cancelText}
        </button>
        <button
          type="button"
          className={`app-modal-btn ${buttonClass === 'danger' ? 'app-modal-btn-danger-sm' : buttonClass === 'warning' ? 'app-modal-btn-primary' : 'app-modal-btn-primary'}`}
          onClick={onConfirm}
          disabled={processing}
        >
          {processing ? (
            <>
              <Spinner size="sm" variant="muted" />
              Processing...
            </>
          ) : (
            confirmText
          )}
        </button>
      </AppModal.Footer>
    </AppModal>
  );
}
