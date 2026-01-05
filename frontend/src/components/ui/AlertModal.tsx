import { useTranslation } from 'react-i18next';
import { AppModal } from './AppModal';
import { Button } from './button';
import { CheckCircle, AlertCircle, Info, AlertTriangle } from 'lucide-react';
import './AlertModal.css';

type AlertVariant = 'success' | 'error' | 'info' | 'warning';

interface AlertModalProps {
  title?: string;
  message: string;
  variant?: AlertVariant;
  onClose: () => void;
  buttonText?: string;
}

/**
 * AlertModal - Replaces browser alert() with a styled modal
 *
 * Usage:
 * const [alert, setAlert] = useState(null)
 *
 * // Show alert
 * setAlert({ title: 'Success', message: 'Item saved!', variant: 'success' })
 *
 * // In JSX
 * {alert && (
 *   <AlertModal
 *     title={alert.title}
 *     message={alert.message}
 *     variant={alert.variant}
 *     onClose={() => setAlert(null)}
 *   />
 * )}
 *
 * Variants: 'success', 'error', 'info', 'warning'
 */
function AlertModal({
  title,
  message,
  variant = 'info',
  onClose,
  buttonText,
}: AlertModalProps) {
  const { t } = useTranslation();
  const iconMap = {
    success: <CheckCircle size={28} />,
    error: <AlertCircle size={28} />,
    info: <Info size={28} />,
    warning: <AlertTriangle size={28} />,
  };

  return (
    <AppModal isOpen={true} onClose={onClose} title={title || ''} size="sm">
      <div className="alert-modal-content">
        <div className={`alert-modal-icon alert-modal-icon-${variant}`}>{iconMap[variant]}</div>
        {title && <h3 className="alert-modal-title">{title}</h3>}
        <p className="alert-modal-message">{message}</p>
      </div>
      <AppModal.Footer>
        <Button
          type="button"
          variant={variant === 'error' ? 'destructive' : 'default'}
          onClick={onClose}
          autoFocus
        >
          {buttonText || t('modals.ok')}
        </Button>
      </AppModal.Footer>
    </AppModal>
  );
}

export { AlertModal };
export type { AlertModalProps, AlertVariant };
