/**
 * ConfirmDialog - Consistent confirmation dialog using Radix Dialog
 *
 * Replaces native browser confirm() dialogs with styled UI
 */

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from './dialog';
import { Button } from './button';
import { AlertTriangle, Trash2, Info } from 'lucide-react';
import './ConfirmDialog.css';

export type ConfirmDialogVariant = 'danger' | 'warning' | 'info';

interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel?: () => void;
  variant?: ConfirmDialogVariant;
  loading?: boolean;
}

const variantIcons = {
  danger: Trash2,
  warning: AlertTriangle,
  info: Info,
};

const variantColors = {
  danger: 'confirm-dialog-icon--danger',
  warning: 'confirm-dialog-icon--warning',
  info: 'confirm-dialog-icon--info',
};

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  onConfirm,
  onCancel,
  variant = 'danger',
  loading = false,
}: ConfirmDialogProps) {
  const Icon = variantIcons[variant];

  const handleConfirm = () => {
    onConfirm();
  };

  const handleCancel = () => {
    onCancel?.();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="confirm-dialog-content">
        <DialogHeader className="confirm-dialog-header">
          <div className={`confirm-dialog-icon ${variantColors[variant]}`}>
            <Icon className="h-6 w-6" />
          </div>
          <DialogTitle className="confirm-dialog-title">{title}</DialogTitle>
          <DialogDescription className="confirm-dialog-description">
            {description}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="confirm-dialog-footer">
          <Button
            variant="outline"
            onClick={handleCancel}
            disabled={loading}
            className="confirm-dialog-cancel"
          >
            {cancelLabel}
          </Button>
          <Button
            variant={variant === 'danger' ? 'destructive' : 'default'}
            onClick={handleConfirm}
            disabled={loading}
            className="confirm-dialog-confirm"
          >
            {loading ? 'Processing...' : confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
