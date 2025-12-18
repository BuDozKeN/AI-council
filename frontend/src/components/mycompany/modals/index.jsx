/**
 * MyCompany Modal Components
 *
 * Extracted from MyCompany.jsx for better maintainability.
 * These modals handle CRUD operations for company entities.
 */

import { useState } from 'react';
import { AppModal } from '../../ui/AppModal';
import { DepartmentSelect } from '../../ui/DepartmentSelect';
import { AIWriteAssist } from '../../ui/AIWriteAssist';
import { Spinner } from '../../ui/Spinner';
import { Bookmark } from 'lucide-react';
import { getPlaybookTypeColor } from '../../../lib/colors';
import { DOC_TYPES } from '../constants';

// Re-export modals from their own files
export { ViewProjectModal } from './ViewProjectModal';
export { ViewPlaybookModal } from './ViewPlaybookModal';
export { PromoteDecisionModal } from './PromoteDecisionModal';

/**
 * Modal for adding a new department
 */
export function AddDepartmentModal({ onSave, onClose, saving }) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    onSave(name.trim(), description.trim());
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
            onChange={e => setName(e.target.value)}
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
              onChange={e => setDescription(e.target.value)}
              rows={3}
            />
          </AIWriteAssist>
        </div>
        <AppModal.Footer>
          <button type="button" className="app-modal-btn app-modal-btn-secondary" onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button type="submit" className="app-modal-btn app-modal-btn-primary" disabled={saving || !name.trim()}>
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

/**
 * Modal for adding a new role to a department
 */
export function AddRoleModal({ deptId, onSave, onClose, saving }) {
  const [name, setName] = useState('');
  const [title, setTitle] = useState('');

  const handleSubmit = (e) => {
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
            onChange={e => setName(e.target.value)}
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
            onChange={e => setTitle(e.target.value)}
          />
        </div>
        <AppModal.Footer>
          <button type="button" className="app-modal-btn app-modal-btn-secondary" onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button type="submit" className="app-modal-btn app-modal-btn-primary" disabled={saving || !name.trim()}>
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

/**
 * Modal for creating a new playbook (SOP, Framework, or Policy)
 */
export function AddPlaybookModal({ onSave, onClose, saving, departments = [] }) {
  const [title, setTitle] = useState('');
  const [docType, setDocType] = useState('sop');
  const [content, setContent] = useState('');
  const [departmentId, setDepartmentId] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!title.trim() || !content.trim()) return;
    onSave(title.trim(), docType, content.trim(), departmentId || null);
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
            onChange={e => setTitle(e.target.value)}
            autoFocus
          />
        </div>
        <div className="mc-form-unified">
          <label className="mc-label-unified">Department</label>
          <DepartmentSelect
            value={departmentId || 'all'}
            onValueChange={(val) => setDepartmentId(val === 'all' ? '' : val)}
            departments={departments}
            includeAll={true}
            allLabel="Company-wide (All Departments)"
            className="mc-dept-select-modal"
          />
        </div>
        <div className="mc-form-unified">
          <label className="mc-label-unified">Type *</label>
          <div className="mc-type-pills-unified">
            {DOC_TYPES.map(type => {
              const Icon = type.icon;
              const isSelected = docType === type.value;
              const colors = getPlaybookTypeColor(type.value);
              return (
                <button
                  key={type.value}
                  type="button"
                  className={`mc-type-pill-unified ${type.value} ${isSelected ? 'selected' : ''}`}
                  style={isSelected ? {
                    background: colors.bg,
                    color: colors.text,
                    boxShadow: `0 1px 2px ${colors.shadowColor}`
                  } : {}}
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
            additionalContext={title ? `Playbook: ${title}` : ''}
            playbookType={docType}
          >
            <textarea
              className="mc-input-unified mc-textarea-unified"
              placeholder="Write your playbook content..."
              value={content}
              onChange={e => setContent(e.target.value)}
              rows={10}
            />
          </AIWriteAssist>
        </div>
        <AppModal.Footer>
          <button type="button" className="app-modal-btn app-modal-btn-secondary" onClick={onClose} disabled={saving}>
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
                Create Playbook
              </>
            )}
          </button>
        </AppModal.Footer>
      </form>
    </AppModal>
  );
}
