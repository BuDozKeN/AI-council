/**
 * ViewCompanyContextModal - Edit Company Context Modal
 *
 * Starts in edit mode when triggered from Edit button.
 * Extracted from MyCompany.jsx for better maintainability.
 */

import { useState } from 'react';
import { AppModal } from '../../ui/AppModal';
import { AIWriteAssist } from '../../ui/AIWriteAssist';
import { FloatingContextActions } from '../../ui/FloatingContextActions';
import MarkdownViewer from '../../MarkdownViewer';

export function ViewCompanyContextModal({ data, companyName, onClose, onSave, initialEditing = true, fullscreen = false }) {
  const [isEditing, setIsEditing] = useState(initialEditing);
  const [editedContext, setEditedContext] = useState(data.context_md || '');
  const [saving, setSaving] = useState(false);

  const content = data.context_md || '';

  const handleSave = async () => {
    if (onSave) {
      setSaving(true);
      try {
        await onSave({ context_md: editedContext });
        setIsEditing(false);
      } catch (err) {
        // Error handled by parent
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
      size={fullscreen ? 'full' : 'lg'}
      title="Company Context"
      description="This context is injected into every AI Council conversation."
      contentClassName="mc-modal-no-padding"
    >
      <div className="mc-modal-body">

        {/* Content Section - Preview by default, markdown when editing */}
        <div className="mc-content-section">
          {isEditing ? (
            <div className="mc-edit-full">
              <AIWriteAssist
                context="company-context"
                value={editedContext}
                onSuggestion={setEditedContext}
                additionalContext={companyName ? `Company: ${companyName}` : ''}
              >
                <textarea
                  className="mc-edit-textarea-full"
                  value={editedContext}
                  onChange={(e) => setEditedContext(e.target.value)}
                  rows={20}
                  autoFocus
                  placeholder="Enter your company context here...

Include:
- Mission and vision
- Company stage and goals
- Budget and constraints
- Key decisions and policies
- Team structure
- Any other important context for the AI Council"
                />
              </AIWriteAssist>
            </div>
          ) : (
            <FloatingContextActions copyText={content || null} className="no-border">
              {content ? (
                <MarkdownViewer content={content} skipCleanup={true} />
              ) : (
                <p className="mc-no-content">No company context yet. Click Edit to add context.</p>
              )}
            </FloatingContextActions>
          )}
        </div>
      </div>

      <AppModal.Footer>
        {isEditing ? (
          <>
            <button className="app-modal-btn app-modal-btn-secondary" onClick={handleCancelEdit} disabled={saving}>
              Cancel
            </button>
            <button className="app-modal-btn app-modal-btn-primary" onClick={handleSave} disabled={saving}>
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </>
        ) : (
          <>
            {onSave && (
              <button className="app-modal-btn app-modal-btn-secondary" onClick={() => setIsEditing(true)}>
                <svg viewBox="0 0 20 20" fill="currentColor">
                  <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                </svg>
                Edit
              </button>
            )}
            <button className="app-modal-btn app-modal-btn-primary" onClick={onClose}>Done</button>
          </>
        )}
      </AppModal.Footer>
    </AppModal>
  );
}
