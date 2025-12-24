/**
 * AlertModal - For success/error/info messages (replaces browser alert())
 *
 * Extracted from MyCompany.jsx for reusability.
 */

import { AppModal } from '../../ui/AppModal';
import { Button } from '../../ui/button';

export function AlertModal({
  title,
  message,
  variant = 'success', // 'success', 'error', 'info'
  onClose
}) {
  const iconMap = {
    success: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
        <polyline points="22 4 12 14.01 9 11.01" />
      </svg>
    ),
    error: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="8" x2="12" y2="12" />
        <line x1="12" y1="16" x2="12.01" y2="16" />
      </svg>
    ),
    info: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="16" x2="12" y2="12" />
        <line x1="12" y1="8" x2="12.01" y2="8" />
      </svg>
    )
  };

  return (
    <AppModal isOpen={true} onClose={onClose} title={title} size="sm">
      <div className={`mc-alert-icon ${variant}`}>
        {iconMap[variant]}
      </div>
      <p className="mc-alert-message">{message}</p>
      <AppModal.Footer>
        <Button
          type="button"
          variant={variant === 'error' ? 'destructive' : 'default'}
          onClick={onClose}
        >
          OK
        </Button>
      </AppModal.Footer>
    </AppModal>
  );
}
