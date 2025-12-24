/**
 * BulkActionBar - Multi-select action bar
 *
 * Extracted from Sidebar.jsx for better maintainability.
 * Features:
 * - ARIA live region for screen reader announcements
 * - Touch-friendly button sizes
 */

import { Trash2 } from 'lucide-react';
import { Button } from '../ui/button';

export function BulkActionBar({
  selectedCount,
  isDeleting,
  onClearSelection,
  onBulkDelete
}) {
  if (selectedCount === 0) return null;

  return (
    <div
      className="bulk-action-bar"
      role="region"
      aria-label="Bulk actions"
    >
      <span
        className="bulk-count"
        role="status"
        aria-live="polite"
      >
        {selectedCount} conversation{selectedCount !== 1 ? 's' : ''} selected
      </span>
      <Button
        variant="ghost"
        size="sm"
        onClick={onClearSelection}
        aria-label="Cancel selection"
        className="bulk-cancel-btn"
      >
        Cancel
      </Button>
      <Button
        variant="destructive"
        size="sm"
        onClick={onBulkDelete}
        disabled={isDeleting}
        aria-label={isDeleting ? 'Deleting conversations' : `Delete ${selectedCount} conversation${selectedCount !== 1 ? 's' : ''}`}
        className="bulk-delete-btn"
      >
        <Trash2 size={14} aria-hidden="true" />
        {isDeleting ? 'Deleting...' : 'Delete'}
      </Button>
    </div>
  );
}
