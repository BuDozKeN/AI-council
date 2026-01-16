/**
 * ViewPlaybookModal - View and edit playbook content
 *
 * Extracted from MyCompany.jsx for better maintainability.
 */

import './ViewPlaybookModal.css';
import '../../ui/Modal.css';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import MarkdownViewer from '../../MarkdownViewer';
import { AppModal } from '../../ui/AppModal';
import { Button } from '../../ui/button';
import { FloatingContextActions } from '../../ui/FloatingContextActions';
import { MultiDepartmentSelect } from '../../ui/MultiDepartmentSelect';
import { toast } from '../../ui/sonner';
import { getDeptColor } from '../../../lib/colors';
import { makeClickable } from '../../../utils/a11y';
import type { Department, Playbook } from '../../../types/business';

type DocType = 'sop' | 'framework' | 'policy';

interface PlaybookVersion {
  content?: string;
}

interface ExtendedPlaybook extends Playbook {
  current_version?: PlaybookVersion;
  additional_departments?: string[];
}

interface PlaybookUpdates {
  title: string;
  content: string;
  additional_departments: string[];
  change_summary: string;
}

interface ViewPlaybookModalProps {
  playbook: ExtendedPlaybook;
  departments?: Department[];
  onClose: () => void;
  onSave?: (id: string, updates: PlaybookUpdates) => Promise<void>;
  startEditing?: boolean;
}

export function ViewPlaybookModal({
  playbook,
  departments = [],
  onClose,
  onSave,
  startEditing = false,
}: ViewPlaybookModalProps) {
  const { t } = useTranslation();
  const [isEditing, setIsEditing] = useState(startEditing);
  const [editedContent, setEditedContent] = useState(
    playbook.content || playbook.current_version?.content || ''
  );
  const [editedTitle, setEditedTitle] = useState(playbook.title || '');
  const [selectedDepts, setSelectedDepts] = useState<string[]>(
    playbook.additional_departments || []
  );
  const [saving, setSaving] = useState(false);
  const [isEditingTitle, setIsEditingTitle] = useState(false);

  // API returns content directly, not nested in current_version
  const content = playbook.content || playbook.current_version?.content || '';

  // Find owner department name
  const ownerDept = departments.find((d) => d.id === playbook.department_id);

  // Get names of linked departments for display in view mode
  const linkedDeptNames = selectedDepts
    .map((id) => departments.find((d) => d.id === id))
    .filter((d): d is Department => Boolean(d));

  const handleSave = async () => {
    if (onSave) {
      setSaving(true);
      try {
        await onSave(playbook.id, {
          title: editedTitle,
          content: editedContent,
          additional_departments: selectedDepts,
          change_summary: 'Updated via My Company interface',
        });
        setIsEditing(false);
        setIsEditingTitle(false);

        // Build descriptive success message
        const docTypeLabel = t(`mycompany.typeShort_${docType}`, {
          defaultValue: docType.toUpperCase(),
        });
        const title = editedTitle || playbook.title;
        const deptNames = selectedDepts
          .map((id) => departments.find((d) => d.id === id)?.name)
          .filter(Boolean);

        let message = t('modals.playbookSaved', { type: docTypeLabel, title });
        if (deptNames.length > 0) {
          message += ` ${t('modals.forDepartments', { departments: deptNames.join(', ') })}`;
        } else {
          message += ` ${t('modals.asCompanyWide')}`;
        }

        toast.success(message, { duration: 4000 });
      } catch {
        toast.error(t('modals.failedToSaveChanges'));
      }
      setSaving(false);
    }
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setIsEditingTitle(false);
    setEditedContent(content);
    setEditedTitle(playbook.title || '');
    setSelectedDepts(playbook.additional_departments || []);
  };

  // Type badge styling - uses CSS variables for theming
  const typeStyles: Record<DocType, { bg: string; color: string }> = {
    sop: { bg: 'var(--color-blue-100)', color: 'var(--color-blue-700)' },
    framework: { bg: 'var(--color-amber-100)', color: 'var(--color-amber-700)' },
    policy: { bg: 'var(--color-violet-100)', color: 'var(--color-violet-700)' },
  };
  const docType: DocType = playbook.doc_type ?? 'sop';
  const typeStyle = typeStyles[docType];

  return (
    <AppModal
      isOpen={true}
      onClose={onClose}
      size="lg"
      showCloseButton={false}
      contentClassName="mc-modal-no-padding"
    >
      {/* Clean header with title and close */}
      <div className="mc-modal-header-clean">
        <div className="mc-header-title-row">
          {/* Title with pencil on hover - always editable */}
          {isEditingTitle ? (
            <input
              id="playbook-title-edit"
              name="playbook-title"
              type="text"
              className="mc-title-inline-edit"
              value={editedTitle}
              onChange={(e) => setEditedTitle(e.target.value)}
              onBlur={() => setIsEditingTitle(false)}
              onKeyDown={(e) => e.key === 'Enter' && setIsEditingTitle(false)}
              autoFocus
            />
          ) : (
            <h1
              className="mc-title-display editable"
              {...makeClickable(() => setIsEditingTitle(true))}
              title={t('modals.clickToEditTitle')}
            >
              {editedTitle || playbook.title}
              <svg className="mc-pencil-icon" viewBox="0 0 20 20" fill="currentColor">
                <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
              </svg>
            </h1>
          )}
        </div>
        <button className="mc-modal-close-clean" onClick={onClose} aria-label={t('common.close')}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div className="mc-modal-body">
        {/* Metadata row: Type badge + Department badges together */}
        <div className="mc-playbook-meta-row">
          {/* Type badge */}
          <span
            className="mc-type-badge"
            style={{ background: typeStyle.bg, color: typeStyle.color }}
          >
            {t(`mycompany.typeShort_${docType}`, { defaultValue: docType.toUpperCase() })}
          </span>

          {/* Department selection - dropdown in edit mode, badges in view mode */}
          {isEditing ? (
            <MultiDepartmentSelect
              value={selectedDepts}
              onValueChange={setSelectedDepts}
              departments={departments}
              placeholder={t('modals.companyWideAllDepts')}
            />
          ) : (
            <div className="mc-dept-badges-view">
              {ownerDept &&
                (() => {
                  const color = getDeptColor(ownerDept.id);
                  return (
                    <span
                      className="mc-dept-badge"
                      style={{ background: color.bg, color: color.text, borderColor: color.border }}
                    >
                      {ownerDept.name}
                    </span>
                  );
                })()}
              {linkedDeptNames.map((d) => {
                const color = getDeptColor(d.id);
                return (
                  <span
                    key={d.id}
                    className="mc-dept-badge"
                    style={{ background: color.bg, color: color.text, borderColor: color.border }}
                  >
                    {d.name}
                  </span>
                );
              })}
              {!ownerDept && linkedDeptNames.length === 0 && (
                <span className="mc-scope-badge company-wide">{t('mycompany.companyWide')}</span>
              )}
            </div>
          )}
        </div>

        {/* Content Section - Preview by default, textarea when editing */}
        <div className="mc-content-section">
          {isEditing ? (
            <div className="mc-edit-full">
              <textarea
                id="playbook-content-edit"
                name="playbook-content"
                className="mc-edit-textarea-full"
                value={editedContent}
                onChange={(e) => setEditedContent(e.target.value)}
                rows={18}
                placeholder={t('modals.enterContentMarkdown')}
                autoFocus={!startEditing}
              />
            </div>
          ) : (
            <FloatingContextActions copyText={content || null} className="no-border">
              {content ? (
                <MarkdownViewer content={content} skipCleanup={true} />
              ) : (
                <p className="mc-no-content">{t('modals.noContentClickEdit')}</p>
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
