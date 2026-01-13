/**
 * ViewCompanyContextModal - Edit Company Context Modal
 *
 * Starts in edit mode when triggered from Edit button.
 * Extracted from MyCompany.jsx for better maintainability.
 */

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from '../../ui/sonner';
import { AppModal } from '../../ui/AppModal';
import { AIWriteAssist } from '../../ui/AIWriteAssist';
import { FloatingContextActions } from '../../ui/FloatingContextActions';
import MarkdownViewer from '../../MarkdownViewer';

interface CompanyContextData {
  context_md?: string;
  industry?: string;
  size?: string;
}

interface ViewCompanyContextModalProps {
  data: CompanyContextData;
  companyName?: string | undefined;
  onClose: () => void;
  onSave?: ((data: { context_md: string }) => Promise<void>) | undefined;
  initialEditing?: boolean | undefined;
  fullscreen?: boolean | undefined;
}

export function ViewCompanyContextModal({
  data,
  companyName,
  onClose,
  onSave,
  initialEditing = true,
  fullscreen = false,
}: ViewCompanyContextModalProps) {
  const { t } = useTranslation();
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
        toast.success(
          t('modals.companyContextSaved', { name: companyName || t('modals.company') }),
          { duration: 4000 }
        );
      } catch {
        toast.error(t('modals.failedToSaveCompanyContext'));
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
      title={t('modals.companyContext')}
      description={t('modals.companyContextDesc')}
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
                  placeholder={t('modals.companyContextPlaceholder')}
                  enterKeyHint="done"
                />
              </AIWriteAssist>
            </div>
          ) : (
            <FloatingContextActions copyText={content || null} className="no-border">
              {content ? (
                <MarkdownViewer content={content} skipCleanup={true} />
              ) : (
                <p className="mc-no-content">{t('modals.noCompanyContext')}</p>
              )}
            </FloatingContextActions>
          )}
        </div>
      </div>

      <AppModal.Footer>
        {isEditing ? (
          <>
            <button
              className="app-modal-btn app-modal-btn-secondary"
              onClick={handleCancelEdit}
              disabled={saving}
            >
              {t('common.cancel')}
            </button>
            <button
              className="app-modal-btn app-modal-btn-primary"
              onClick={handleSave}
              disabled={saving}
            >
              {saving ? t('common.saving') : t('modals.saveChanges')}
            </button>
          </>
        ) : (
          <>
            {onSave && (
              <button
                className="app-modal-btn app-modal-btn-secondary"
                onClick={() => setIsEditing(true)}
              >
                <svg viewBox="0 0 20 20" fill="currentColor">
                  <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                </svg>
                {t('common.edit')}
              </button>
            )}
            <button className="app-modal-btn app-modal-btn-primary" onClick={onClose}>
              {t('common.done')}
            </button>
          </>
        )}
      </AppModal.Footer>
    </AppModal>
  );
}
