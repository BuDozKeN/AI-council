/**
 * ViewDepartmentModal - Preview-first UX with clean design
 *
 * Extracted from MyCompany.jsx for better maintainability.
 * Now includes LLM Preset selector for configuring response style per department.
 */

import './ViewDepartmentModal.css';
import '../../ui/Modal.css';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from '../../ui/sonner';
import { AppModal } from '../../ui/AppModal';
import { Button } from '../../ui/button';
import { AIWriteAssist } from '../../ui/AIWriteAssist';
import { FloatingContextActions } from '../../ui/FloatingContextActions';
import { LLMPresetSelect } from '../../ui/LLMPresetSelect';
import MarkdownViewer from '../../MarkdownViewer';
import { getDeptColor } from '../../../lib/colors';
import type { Role, LLMPresetId } from '../../../types/business';

interface DepartmentWithContext {
  id: string;
  name: string;
  description?: string;
  context_md?: string;
  llm_preset?: LLMPresetId;
  roles?: Role[];
}

interface ViewDepartmentModalProps {
  department: DepartmentWithContext;
  onClose: () => void;
  onSave?: (
    id: string,
    data: { context_md?: string; llm_preset?: LLMPresetId },
    options?: { keepOpen?: boolean }
  ) => Promise<void>;
  /** Callback to open LLM Hub settings */
  onOpenLLMHub?: (() => void) | undefined;
}

export function ViewDepartmentModal({
  department,
  onClose,
  onSave,
  onOpenLLMHub,
}: ViewDepartmentModalProps) {
  const { t } = useTranslation();
  const [isEditing, setIsEditing] = useState(false);
  const [editedContext, setEditedContext] = useState(department.context_md || '');
  const [selectedPreset, setSelectedPreset] = useState<LLMPresetId>(
    department.llm_preset || 'balanced'
  );
  const [saving, setSaving] = useState(false);

  const content = department.context_md || '';
  const deptColor = getDeptColor(department.id);

  const handleSave = async () => {
    if (onSave) {
      setSaving(true);
      try {
        await onSave(department.id, {
          context_md: editedContext,
          llm_preset: selectedPreset,
        });
        setIsEditing(false);
        toast.success(t('modals.departmentSaved', { name: department.name }), { duration: 4000 });
      } catch {
        toast.error(t('modals.failedToSaveDepartment'));
      }
      setSaving(false);
    }
  };

  // Save just the preset without entering edit mode
  const handlePresetChange = async (newPreset: LLMPresetId) => {
    setSelectedPreset(newPreset);
    if (onSave && !isEditing) {
      // Auto-save preset change
      try {
        await onSave(department.id, { llm_preset: newPreset }, { keepOpen: true });
        toast.success(t('modals.presetSaved', 'Response style updated'), { duration: 2000 });
      } catch {
        toast.error(t('modals.failedToSavePreset', 'Failed to update response style'));
        // Revert on failure
        setSelectedPreset(department.llm_preset || 'balanced');
      }
    }
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditedContext(content);
    setSelectedPreset(department.llm_preset || 'balanced');
  };

  return (
    <AppModal
      isOpen={true}
      onClose={onClose}
      size="lg"
      badge={t('modals.departmentBadge')}
      badgeStyle={{ background: deptColor.bg, color: deptColor.text }}
      title={department.name}
      titleExtra={t('modals.rolesCount', { count: department.roles?.length || 0 })}
      {...(department.description ? { description: department.description } : {})}
      contentClassName="mc-modal-no-padding"
    >
      <div className="mc-modal-body">
        {/* Response Style Section */}
        <div className="mc-settings-section">
          <div className="mc-settings-row">
            <div className="mc-settings-label">
              <span className="mc-settings-title">
                {t('modals.responseStyle', 'Response Style')}
              </span>
              <span className="mc-settings-desc">
                {t(
                  'modals.responseStyleDesc',
                  'Controls AI behavior when this department is selected'
                )}
              </span>
            </div>
            <LLMPresetSelect
              value={selectedPreset}
              onValueChange={handlePresetChange}
              disabled={saving}
              showDescription={false}
              onOpenLLMHub={onOpenLLMHub}
            />
          </div>
        </div>

        {/* Guidelines Section - Preview by default, markdown when editing */}
        <div className="mc-content-section">
          <div className="mc-section-header">
            <span className="mc-section-title">{t('modals.guidelinesTitle', 'Guidelines')}</span>
          </div>
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
                  placeholder={t('modals.enterDepartmentContext')}
                  enterKeyHint="done"
                />
              </AIWriteAssist>
            </div>
          ) : (
            <FloatingContextActions copyText={content || null} className="no-border">
              {content ? (
                <MarkdownViewer content={content} skipCleanup={true} />
              ) : (
                <p className="mc-no-content">{t('modals.noDepartmentContext')}</p>
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
                {t('modals.editGuidelines', 'Edit Guidelines')}
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
