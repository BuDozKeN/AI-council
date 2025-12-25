/**
 * ViewPlaybookModal - View and edit playbook content
 *
 * Extracted from MyCompany.jsx for better maintainability.
 */

import { useState } from 'react';
import MarkdownViewer from '../../MarkdownViewer';
import { AppModal } from '../../ui/AppModal';
import { Button } from '../../ui/button';
import { FloatingContextActions } from '../../ui/FloatingContextActions';
import { getDeptColor } from '../../../lib/colors';
import smartTextToMarkdown from '../../../lib/smartTextToMarkdown';

export function ViewPlaybookModal({ playbook, departments = [], onClose, onSave, startEditing = false }) {
  const [isEditing, setIsEditing] = useState(startEditing);
  const [editedContent, setEditedContent] = useState(playbook.content || playbook.current_version?.content || '');
  const [editedTitle, setEditedTitle] = useState(playbook.title || '');
  const [selectedDepts, setSelectedDepts] = useState(playbook.additional_departments || []);
  const [saving, setSaving] = useState(false);
  const [formatting, setFormatting] = useState(false);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [deptSearch, setDeptSearch] = useState('');

  // Format content using local smart converter (no AI needed)
  const handleFormatWithAI = () => {
    if (!editedContent.trim()) return;
    setFormatting(true);

    // Use the local smart text-to-markdown converter
    // Pass forceConvert=true to always process, even if content looks like markdown
    const formatted = smartTextToMarkdown(editedContent, true);
    setEditedContent(formatted);
    setFormatting(false);
  };

  // API returns content directly, not nested in current_version
  const content = playbook.content || playbook.current_version?.content || '';

  // Find owner department name
  const ownerDept = departments.find(d => d.id === playbook.department_id);

  // Get names of linked departments
  const linkedDeptNames = selectedDepts
    .map(id => departments.find(d => d.id === id))
    .filter(Boolean);

  // Filter departments by search
  const filteredDepts = departments.filter(dept =>
    dept.name.toLowerCase().includes(deptSearch.toLowerCase())
  );

  const handleToggleDept = (deptId) => {
    setSelectedDepts(prev =>
      prev.includes(deptId)
        ? prev.filter(id => id !== deptId)
        : [...prev, deptId]
    );
  };

  const handleSave = async () => {
    if (onSave) {
      setSaving(true);
      try {
        await onSave(playbook.id, {
          title: editedTitle,
          content: editedContent,
          additional_departments: selectedDepts,
          change_summary: 'Updated via My Company interface'
        });
        setIsEditing(false);
        setIsEditingTitle(false);
      } catch {
        // Error handled by parent
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
    setDeptSearch('');
  };

  // Type badge styling
  const typeStyles = {
    sop: { bg: '#dbeafe', color: '#1d4ed8' },
    framework: { bg: '#fef3c7', color: '#b45309' },
    policy: { bg: '#ede9fe', color: '#6d28d9' }
  };
  const typeStyle = typeStyles[playbook.doc_type] || typeStyles.sop;

  return (
    <AppModal isOpen={true} onClose={onClose} size="lg" showCloseButton={false} contentClassName="mc-modal-no-padding">
      {/* Clean header with title and close */}
      <div className="mc-modal-header-clean">
        <div className="mc-header-title-row">
          {/* Title with pencil on hover - always editable */}
          {isEditingTitle ? (
            <input
              type="text"
              className="mc-title-inline-edit"
              value={editedTitle}
              onChange={(e) => setEditedTitle(e.target.value)}
              onBlur={() => setIsEditingTitle(false)}
              onKeyDown={(e) => e.key === 'Enter' && setIsEditingTitle(false)}
              autoFocus
            />
          ) : (
            <h2
              className="mc-title-display editable"
              onClick={() => setIsEditingTitle(true)}
              title="Click to edit title"
            >
              {editedTitle || playbook.title}
              <svg className="mc-pencil-icon" viewBox="0 0 20 20" fill="currentColor">
                <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
              </svg>
            </h2>
          )}
        </div>
        <button className="mc-modal-close-clean" onClick={onClose} aria-label="Close">
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
            {playbook.doc_type.toUpperCase()}
          </span>

          {/* Department badges - inline with type */}
          {isEditing ? (
            <div className="mc-dept-edit-inline">
              <span className="mc-dept-label">Departments:</span>
              {filteredDepts.slice(0, 5).map(dept => {
                const isOwner = dept.id === playbook.department_id;
                const isSelected = selectedDepts.includes(dept.id);
                const color = getDeptColor(dept.id);
                return (
                  <button
                    key={dept.id}
                    type="button"
                    className={`mc-dept-chip-mini ${isOwner || isSelected ? 'selected' : ''}`}
                    style={isOwner || isSelected ? {
                      background: color.bg,
                      color: color.text,
                      borderColor: color.border
                    } : {}}
                    onClick={() => !isOwner && handleToggleDept(dept.id)}
                    disabled={isOwner}
                  >
                    {dept.name.split(' ')[0]}
                    {isOwner && <span className="mc-owner-star">*</span>}
                  </button>
                );
              })}
            </div>
          ) : (
            <>
              {ownerDept && (() => {
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
              {linkedDeptNames.map(d => {
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
                <span className="mc-scope-badge company-wide">Company-wide</span>
              )}
            </>
          )}
        </div>

        {/* Content Section - Preview by default, markdown when editing */}
        <div className="mc-content-section">
          {isEditing ? (
            <div className="mc-edit-full">
              <div className="mc-editor-toolbar">
                <button
                  className="mc-btn-format-ai"
                  onClick={handleFormatWithAI}
                  disabled={formatting || !editedContent.trim()}
                  title="Convert plain text to formatted Markdown"
                >
                  {formatting ? (
                    <>
                      <svg className="mc-btn-icon spinning" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M12 2v4m0 12v4m-8-10h4m12 0h4m-5.66-5.66l-2.83 2.83m-5.02 5.02l-2.83 2.83m0-11.32l2.83 2.83m5.02 5.02l2.83 2.83"/>
                      </svg>
                      Formatting...
                    </>
                  ) : (
                    <>
                      <svg className="mc-btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
                      </svg>
                      Smart Format
                    </>
                  )}
                </button>
                <span className="mc-editor-hint">Converts tables, headers, and lists to Markdown</span>
              </div>
              <textarea
                className="mc-edit-textarea-full"
                value={editedContent}
                onChange={(e) => setEditedContent(e.target.value)}
                rows={18}
                placeholder="Paste any text here... then click Smart Format to convert to Markdown"
                autoFocus={!startEditing}
                enterKeyHint="done"
              />
            </div>
          ) : (
            <FloatingContextActions copyText={content || null} className="no-border">
              {content ? (
                <MarkdownViewer content={content} skipCleanup={true} />
              ) : (
                <p className="mc-no-content">No content yet. Click Edit to add content.</p>
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
