/**
 * DeleteModal - Confirmation modal for deleting conversations
 *
 * Extracted from Sidebar.jsx for better maintainability.
 */

import { useTranslation } from 'react-i18next';
import { AppModal } from '../ui/AppModal';
import { Button } from '../ui/button';

interface DeleteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export function DeleteModal({ isOpen, onClose, onConfirm }: DeleteModalProps) {
  const { t } = useTranslation();

  return (
    <AppModal isOpen={isOpen} onClose={onClose} title={t('modals.deleteConversationConfirm')} size="sm">
      <p className="delete-modal-body">
        {t('modals.deleteConversationWarning')}
      </p>
      <AppModal.Footer>
        <Button variant="outline" onClick={onClose}>
          {t('common.cancel')}
        </Button>
        <Button variant="destructive" onClick={onConfirm}>
          {t('common.delete')}
        </Button>
      </AppModal.Footer>
    </AppModal>
  );
}
