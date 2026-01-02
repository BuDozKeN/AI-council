/**
 * MyCompany Modal Components
 *
 * Extracted from MyCompany.jsx for better maintainability.
 * These modals handle CRUD operations for company entities.
 */

import { useState } from 'react';
import { AppModal } from '../../ui/AppModal';
import { AIWriteAssist } from '../../ui/AIWriteAssist';
import { MultiDepartmentSelect } from '../../ui/MultiDepartmentSelect';
import { Spinner } from '../../ui/Spinner';
import { Bookmark } from 'lucide-react';
import { getPlaybookTypeColor } from '../../../lib/colors';
import { DOC_TYPES } from '../constants';

// Re-export modals from their own files
export { ViewProjectModal } from './ViewProjectModal';
export { ViewPlaybookModal } from './ViewPlaybookModal';
export { PromoteDecisionModal } from './PromoteDecisionModal';
export { ViewDepartmentModal } from './ViewDepartmentModal';
export { ViewRoleModal } from './ViewRoleModal';
export { ViewCompanyContextModal } from './ViewCompanyContextModal';
export { ViewDecisionModal } from './ViewDecisionModal';

// Re-export shared UI modals for convenience
export { AlertModal } from '../../ui/AlertModal';
export { ConfirmModal } from '../../ui/ConfirmModal';

import type { Department } from '../../../types/business';

interface AddDepartmentModalProps {
  onSave: (name: string, description?: string) => Promise<void>;
  onClose: () => void;
  saving: boolean;
}

/**
 * Modal for adding a new department
 */
export function AddDepartmentModal({ onSave, onClose, saving }: AddDepartmentModalProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    onSave(name.trim(), description.trim() || undefined);
  };

  return (
    <AppModal isOpen={true} onClose={onClose} title="Add Department" size="sm">
      <form onSubmit={handleSubmit}>
        <div className="mc-form-unified">
          <label className="mc-label-unified">Department Name *</label>
          <input
            type="text"
            className="mc-input-unified"
            placeholder="e.g., Human Resources"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
          />
        </div>
        <div className="mc-form-unified">
          <label className="mc-label-unified">Description</label>
          <AIWriteAssist
            context="department-description"
            value={description}
            onSuggestion={setDescription}
            additionalContext={name ? `Department: ${name}` : ''}
          >
            <textarea
              className="mc-input-unified mc-textarea-unified"
              placeholder="What does this department do?"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              enterKeyHint="done"
            />
          </AIWriteAssist>
        </div>
        <AppModal.Footer>
          <button
            type="button"
            className="app-modal-btn app-modal-btn-secondary"
            onClick={onClose}
            disabled={saving}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="app-modal-btn app-modal-btn-primary"
            disabled={saving || !name.trim()}
          >
            {saving ? (
              <>
                <Spinner size="sm" variant="muted" />
                Creating...
              </>
            ) : (
              'Create Department'
            )}
          </button>
        </AppModal.Footer>
      </form>
    </AppModal>
  );
}

interface AddRoleModalProps {
  deptId: string;
  onSave: (deptId: string, name: string, title: string) => Promise<void>;
  onClose: () => void;
  saving: boolean;
}

/**
 * Modal for adding a new role to a department
 */
export function AddRoleModal({ deptId, onSave, onClose, saving }: AddRoleModalProps) {
  const [name, setName] = useState('');
  const [title, setTitle] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    onSave(deptId, name.trim(), title.trim());
  };

  return (
    <AppModal isOpen={true} onClose={onClose} title="Add Role" size="sm">
      <form onSubmit={handleSubmit}>
        <div className="mc-form-unified">
          <label className="mc-label-unified">Role Name *</label>
          <input
            type="text"
            className="mc-input-unified"
            placeholder="e.g., CTO"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
          />
        </div>
        <div className="mc-form-unified">
          <label className="mc-label-unified">Title</label>
          <input
            type="text"
            className="mc-input-unified"
            placeholder="e.g., Chief Technology Officer"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </div>
        <AppModal.Footer>
          <button
            type="button"
            className="app-modal-btn app-modal-btn-secondary"
            onClick={onClose}
            disabled={saving}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="app-modal-btn app-modal-btn-primary"
            disabled={saving || !name.trim()}
          >
            {saving ? (
              <>
                <Spinner size="sm" variant="muted" />
                Creating...
              </>
            ) : (
              'Create Role'
            )}
          </button>
        </AppModal.Footer>
      </form>
    </AppModal>
  );
}

interface AddPlaybookModalProps {
  onSave: (
    title: string,
    docType: string,
    content?: string,
    departmentId?: string | null,
    additionalDepartments?: string[]
  ) => Promise<void>;
  onClose: () => void;
  saving: boolean;
  departments?: Department[] | undefined;
}

/**
 * Modal for creating a new playbook (SOP, Framework, or Policy)
 */
type PlaybookType = 'sop' | 'framework' | 'policy';

export function AddPlaybookModal({
  onSave,
  onClose,
  saving,
  departments = [],
}: AddPlaybookModalProps) {
  const [title, setTitle] = useState('');
  const [docType, setDocType] = useState<PlaybookType>('sop');
  const [content, setContent] = useState('');
  const [selectedDepts, setSelectedDepts] = useState<string[]>([]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !content.trim()) return;
    // First selected department becomes owner, rest are additional
    const [primaryDept, ...additionalDepts] = selectedDepts;
    onSave(title.trim(), docType, content.trim(), primaryDept || null, additionalDepts);
  };

  return (
    <AppModal isOpen={true} onClose={onClose} title="Create Playbook" size="lg">
      <form onSubmit={handleSubmit}>
        <div className="mc-form-unified">
          <label className="mc-label-unified">Title *</label>
          <input
            type="text"
            className="mc-input-unified"
            placeholder="e.g., Customer Onboarding Process"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            autoFocus
          />
        </div>
        <div className="mc-form-unified">
          <label className="mc-label-unified">Departments</label>
          <MultiDepartmentSelect
            value={selectedDepts}
            onValueChange={setSelectedDepts}
            departments={departments}
            placeholder="Company-wide (all departments)"
          />
        </div>
        <div className="mc-form-unified">
          <label className="mc-label-unified">Type *</label>
          <div className="mc-type-pills-unified">
            {DOC_TYPES.map((type) => {
              const Icon = type.icon;
              const isSelected = docType === type.value;
              const colors = getPlaybookTypeColor(type.value);
              return (
                <button
                  key={type.value}
                  type="button"
                  className={`mc-type-pill-unified ${type.value} ${isSelected ? 'selected' : ''}`}
                  style={
                    isSelected
                      ? {
                          background: colors.bg,
                          color: colors.text,
                          boxShadow: `0 1px 2px ${colors.shadowColor}`,
                        }
                      : {}
                  }
                  onClick={() => setDocType(type.value)}
                >
                  <Icon className="h-3.5 w-3.5" />
                  <span>{type.label}</span>
                </button>
              );
            })}
          </div>
        </div>
        <div className="mc-form-unified">
          <label className="mc-label-unified">Content *</label>
          <AIWriteAssist
            context="playbook-content"
            value={content}
            onSuggestion={setContent}
            onTitleSuggestion={(suggestedTitle) => {
              // eslint-disable-next-line no-console
              console.log('[AddPlaybookModal] onTitleSuggestion called with:', suggestedTitle);
              // Only set title if user hasn't entered one
              if (!title.trim()) {
                // eslint-disable-next-line no-console
                console.log('[AddPlaybookModal] Setting title to:', suggestedTitle);
                setTitle(suggestedTitle);
              }
            }}
            additionalContext={title ? `Playbook: ${title}` : ''}
            playbookType={docType}
          >
            <textarea
              className="mc-input-unified mc-textarea-unified"
              placeholder='Describe what you need (e.g., "how we onboard customers") - AI will write the full document for you...'
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={10}
              enterKeyHint="done"
            />
          </AIWriteAssist>
        </div>
        <AppModal.Footer>
          <button
            type="button"
            className="app-modal-btn app-modal-btn-secondary"
            onClick={onClose}
            disabled={saving}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="app-modal-btn app-modal-btn-primary"
            disabled={saving || !title.trim() || !content.trim()}
          >
            {saving ? (
              <>
                <Spinner size="sm" variant="muted" />
                Creating...
              </>
            ) : (
              <>
                <Bookmark className="h-4 w-4" />
                Create {DOC_TYPES.find((t) => t.value === docType)?.label || 'Playbook'}
              </>
            )}
          </button>
        </AppModal.Footer>
      </form>
    </AppModal>
  );
}
