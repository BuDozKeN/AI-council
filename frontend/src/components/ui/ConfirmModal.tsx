import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { AppModal } from './AppModal';
import { Button } from './button';
import { Spinner } from './Spinner';
import './ConfirmModal.css';

type ConfirmModalVariant = 'danger' | 'warning' | 'info' | 'error';

interface ConfirmModalProps {
  title?: string;
  message?: React.ReactNode;
  variant?: ConfirmModalVariant;
  confirmText?: string;
  cancelText?: string;
  onConfirm?: () => void | Promise<void>;
  onCancel?: () => void;
  isLoading?: boolean;
  processing?: boolean;
}

/**
 * ConfirmModal - Replaces browser confirm() with a styled modal
 *
 * Usage:
 * const [confirmModal, setConfirmModal] = useState(null)
 *
 * // Show confirm
 * setConfirmModal({
 *   title: 'Delete Item',
 *   message: 'Are you sure you want to delete this item?',
 *   variant: 'danger',
 *   confirmText: 'Delete',
 *   onConfirm: () => handleDelete()
 * })
 *
 * // In JSX
 * {confirmModal && (
 *   <ConfirmModal
 *     {...confirmModal}
 *     onCancel={() => setConfirmModal(null)}
 *   />
 * )}
 *
 * Variants: 'danger', 'warning', 'info'
 */
function ConfirmModal({
  title,
  variant = 'warning',
  confirmText,
  cancelText,
  onConfirm,
  onCancel,
  isLoading = false,
  processing = false, // Alias for isLoading (backwards compat)
}: ConfirmModalProps) {
  const { t } = useTranslation();
  const loading = isLoading || processing;

  const handleConfirm = async () => {
    if (onConfirm) {
      await onConfirm();
    }
    onCancel?.();
  };

  return (
    <AppModal
      isOpen={true}
      size="sm"
      closeOnOverlayClick={!loading}
      title={title}
      {...(onCancel !== undefined && { onClose: onCancel })}
    >
      <AppModal.Footer>
        <Button type="button" variant="outline" onClick={onCancel} disabled={loading}>
          {cancelText || t('common.cancel')}
        </Button>
        <Button
          type="button"
          variant={variant === 'danger' ? 'destructive' : 'default'}
          onClick={handleConfirm}
          disabled={loading}
          autoFocus
        >
          {loading ? (
            <>
              <Spinner size="sm" variant="muted" />
              {t('modals.processing')}
            </>
          ) : (
            confirmText || t('common.confirm')
          )}
        </Button>
      </AppModal.Footer>
    </AppModal>
  );
}

export { ConfirmModal };
export type { ConfirmModalProps, ConfirmModalVariant };
