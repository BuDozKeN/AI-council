/**
 * DeleteModal - Confirmation modal for deleting conversations
 *
 * Extracted from Sidebar.jsx for better maintainability.
 */

import { AppModal } from '../ui/AppModal';

export function DeleteModal({
  isOpen,
  onClose,
  onConfirm
}) {
  return (
    <AppModal
      isOpen={isOpen}
      onClose={onClose}
      title="Delete Conversation?"
      size="sm"
    >
      <p className="delete-modal-body">
        This action cannot be undone. The conversation will be permanently deleted.
      </p>
      <AppModal.Footer>
        <button
          className="app-modal-btn app-modal-btn-secondary"
          onClick={onClose}
        >
          Cancel
        </button>
        <button
          className="app-modal-btn app-modal-btn-danger-sm"
          onClick={onConfirm}
        >
          Delete
        </button>
      </AppModal.Footer>
    </AppModal>
  );
}
