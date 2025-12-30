/**
 * ViewDepartmentModal - Preview-first UX with clean design
 *
 * Extracted from MyCompany.jsx for better maintainability.
 */

import { useState } from 'react';
import { toast } from 'sonner';
import { AppModal } from '../../ui/AppModal';
import { Button } from '../../ui/button';
import { AIWriteAssist } from '../../ui/AIWriteAssist';
import { FloatingContextActions } from '../../ui/FloatingContextActions';
import MarkdownViewer from '../../MarkdownViewer';
import { getDeptColor } from '../../../lib/colors';
import type { Role } from '../../../types/business';

interface DepartmentWithContext {
  id: string;
  name: string;
  description?: string;
  context_md?: string;
  roles?: Role[];
}

interface ViewDepartmentModalProps {
  department: DepartmentWithContext;
  onClose: () => void;
  onSave?: (id: string, data: { context_md: string }) => Promise<void>;
}

export function ViewDepartmentModal({ department, onClose, onSave }: ViewDepartmentModalProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedContext, setEditedContext] = useState(department.context_md || '');
  const [saving, setSaving] = useState(false);

  const content = department.context_md || '';
  const deptColor = getDeptColor(department.id);

  const handleSave = async () => {
    if (onSave) {
      setSaving(true);
      try {
        await onSave(department.id, { context_md: editedContext });
        setIsEditing(false);
        toast.success(`Department "${department.name}" context saved`, { duration: 4000 });
      } catch {
        toast.error('Failed to save department');
      }
      setSaving(false);
    }
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditedContext(content);
  };

  return (
    <AppModal
      isOpen={true}
      onClose={onClose}
      size="lg"
      badge="DEPARTMENT"
      badgeStyle={{ background: deptColor.bg, color: deptColor.text }}
      title={department.name}
      titleExtra={`${department.roles?.length || 0} roles`}
      {...(department.description ? { description: department.description } : {})}
      contentClassName="mc-modal-no-padding"
    >
      <div className="mc-modal-body">

        {/* Content Section - Preview by default, markdown when editing */}
        <div className="mc-content-section">
          {isEditing ? (
            <div className="mc-edit-full">
              <AIWriteAssist
                context="department-description"
                value={editedContext}
                onSuggestion={setEditedContext}
                additionalContext={department.name ? `Department: ${department.name}` : ''}
              >
                <textarea
                  className="mc-edit-textarea-full"
                  value={editedContext}
                  onChange={(e) => setEditedContext(e.target.value)}
                  rows={15}
                  autoFocus
                  placeholder="Enter the context documentation for this department..."
                  enterKeyHint="done"
                />
              </AIWriteAssist>
            </div>
          ) : (
            <FloatingContextActions copyText={content || null} className="no-border">
              {content ? (
                <MarkdownViewer content={content} skipCleanup={true} />
              ) : (
                <p className="mc-no-content">No department context yet. Click Edit to add context.</p>
              )}
            </FloatingContextActions>
          )}
        </div>
      </div>

      <AppModal.Footer>
        {isEditing ? (
          <>
            <Button variant="outline" onClick={handleCancelEdit} disabled={saving}>
              Cancel
            </Button>
            <Button variant="default" onClick={handleSave} disabled={saving}>
              {saving ? 'Saving...' : 'Save Changes'}
            </Button>
          </>
        ) : (
          <>
            {onSave && (
              <Button variant="outline" onClick={() => setIsEditing(true)}>
                <svg viewBox="0 0 20 20" fill="currentColor" className="size-4">
                  <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                </svg>
                Edit
              </Button>
            )}
            <Button variant="default" onClick={onClose}>Done</Button>
          </>
        )}
      </AppModal.Footer>
    </AppModal>
  );
}
