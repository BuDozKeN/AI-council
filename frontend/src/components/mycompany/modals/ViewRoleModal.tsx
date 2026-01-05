/**
 * ViewRoleModal - Preview-first UX with clean design
 *
 * Extracted from MyCompany.jsx for better maintainability.
 */

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { AppModal } from '../../ui/AppModal';
import { Button } from '../../ui/button';
import { AIWriteAssist } from '../../ui/AIWriteAssist';
import { FloatingContextActions } from '../../ui/FloatingContextActions';
import MarkdownViewer from '../../MarkdownViewer';
import type { Role } from '../../../types/business';

interface ViewRoleModalProps {
  role: Role;
  onClose: () => void;
  onSave?: ((roleId: string, deptId: string, data: Partial<Role>) => Promise<void>) | undefined;
}

export function ViewRoleModal({ role, onClose, onSave }: ViewRoleModalProps) {
  const { t } = useTranslation();
  const [isEditing, setIsEditing] = useState(false);
  const [editedPrompt, setEditedPrompt] = useState(role.system_prompt || '');
  const [saving, setSaving] = useState(false);

  const content = role.system_prompt || '';

  const handleSave = async () => {
    if (onSave && role.departmentId) {
      setSaving(true);
      try {
        await onSave(role.id, role.departmentId, { system_prompt: editedPrompt });
        setIsEditing(false);
        toast.success(t('modals.roleSaved', { name: role.name }), { duration: 4000 });
      } catch {
        toast.error(t('modals.failedToSaveRole'));
      }
      setSaving(false);
    }
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditedPrompt(content);
  };

  return (
    <AppModal
      isOpen={true}
      onClose={onClose}
      size="lg"
      badge={t('modals.roleBadge')}
      badgeVariant="purple"
      title={role.name}
      titleExtra={role.departmentName}
      description={role.title}
      contentClassName="mc-modal-no-padding"
    >
      <div className="mc-modal-body">
        {/* Content Section - Preview by default, markdown when editing */}
        <div className="mc-content-section">
          {isEditing ? (
            <div className="mc-edit-full">
              <AIWriteAssist
                context="role-prompt"
                value={editedPrompt}
                onSuggestion={setEditedPrompt}
                additionalContext={
                  role.name ? `Role: ${role.name}${role.title ? ` (${role.title})` : ''}` : ''
                }
              >
                <textarea
                  className="mc-edit-textarea-full"
                  value={editedPrompt}
                  onChange={(e) => setEditedPrompt(e.target.value)}
                  rows={15}
                  autoFocus
                  placeholder={t('modals.enterRolePrompt')}
                  enterKeyHint="done"
                />
              </AIWriteAssist>
            </div>
          ) : (
            <FloatingContextActions copyText={content || null} className="no-border">
              {content ? (
                <MarkdownViewer content={content} skipCleanup={true} />
              ) : (
                <p className="mc-no-content">{t('modals.noRolePrompt')}</p>
              )}
            </FloatingContextActions>
          )}
        </div>
      </div>

      <AppModal.Footer>
        {isEditing ? (
          <>
            <Button variant="outline" onClick={handleCancelEdit} disabled={saving}>
              {t('common.cancel')}
            </Button>
            <Button variant="default" onClick={handleSave} disabled={saving}>
              {saving ? t('common.saving') : t('modals.saveChanges')}
            </Button>
          </>
        ) : (
          <>
            {onSave && (
              <Button variant="outline" onClick={() => setIsEditing(true)}>
                <svg viewBox="0 0 20 20" fill="currentColor" className="size-4">
                  <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                </svg>
                {t('common.edit')}
              </Button>
            )}
            <Button variant="default" onClick={onClose}>
              {t('common.done')}
            </Button>
          </>
        )}
      </AppModal.Footer>
    </AppModal>
  );
}
