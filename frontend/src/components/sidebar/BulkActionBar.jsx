/**
 * BulkActionBar - Multi-select action bar
 *
 * Extracted from Sidebar.jsx for better maintainability.
 */

import { Trash2 } from 'lucide-react';

export function BulkActionBar({
  selectedCount,
  isDeleting,
  onClearSelection,
  onBulkDelete
}) {
  if (selectedCount === 0) return null;

  return (
    <div className="bulk-action-bar">
      <span className="bulk-count">{selectedCount} selected</span>
      <button
        className="bulk-cancel-btn"
        onClick={onClearSelection}
      >
        Cancel
      </button>
      <button
        className="bulk-delete-btn"
        onClick={onBulkDelete}
        disabled={isDeleting}
      >
        <Trash2 size={14} />
        {isDeleting ? 'Deleting...' : 'Delete'}
      </button>
    </div>
  );
}
