/**
 * DeleteModal - Confirmation modal for deleting conversations
 *
 * Extracted from Sidebar.jsx for better maintainability.
 */

import { AppModal } from '../ui/AppModal';
import { Button } from '../ui/button';

interface DeleteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export function DeleteModal({ isOpen, onClose, onConfirm }: DeleteModalProps) {
  return (
    <AppModal isOpen={isOpen} onClose={onClose} title="Delete Conversation?" size="sm">
      <p className="delete-modal-body">
        This action cannot be undone. The conversation will be permanently deleted.
      </p>
      <AppModal.Footer>
        <Button variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button variant="destructive" onClick={onConfirm}>
          Delete
        </Button>
      </AppModal.Footer>
    </AppModal>
  );
}
