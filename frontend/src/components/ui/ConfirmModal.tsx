import * as React from "react"
import { AppModal } from "./AppModal"
import { Button } from "./button"
import { Spinner } from "./Spinner"
import { AlertTriangle, Trash2, Info, AlertCircle } from "lucide-react"
import "./ConfirmModal.css"

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
  message,
  variant = 'warning',
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  onConfirm,
  onCancel,
  isLoading = false,
  processing = false, // Alias for isLoading (backwards compat)
}) {
  const loading = isLoading || processing;
  const iconMap = {
    danger: <Trash2 size={24} />,
    warning: <AlertTriangle size={24} />,
    info: <Info size={24} />,
    error: <AlertCircle size={24} />
  }

  const handleConfirm = async () => {
    if (onConfirm) {
      await onConfirm()
    }
    onCancel?.()
  }

  return (
    <AppModal
      isOpen={true}
      onClose={onCancel}
      title={title}
      size="sm"
      closeOnOverlayClick={!loading}
    >
      <div className="confirm-modal-content">
        <div className={`confirm-modal-icon confirm-modal-icon-${variant}`}>
          {iconMap[variant] || iconMap.warning}
        </div>
        {title && <h3 className="confirm-modal-title">{title}</h3>}
        <p className="confirm-modal-message">{message}</p>
      </div>
      <AppModal.Footer>
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          disabled={loading}
        >
          {cancelText}
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
              Processing...
            </>
          ) : confirmText}
        </Button>
      </AppModal.Footer>
    </AppModal>
  )
}

export { ConfirmModal }