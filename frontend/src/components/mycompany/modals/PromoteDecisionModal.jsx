/**
 * PromoteDecisionModal - Promote a council decision to a playbook
 *
 * Extracted from MyCompany.jsx for better maintainability.
 */

import { useState } from 'react';
import MarkdownViewer from '../../MarkdownViewer';
import { AppModal } from '../../ui/AppModal';
import { DepartmentSelect } from '../../ui/DepartmentSelect';
import { Spinner } from '../../ui/Spinner';
import { Bookmark, ScrollText, Layers, FileText } from 'lucide-react';

const DOC_TYPES = [
  { value: 'sop', label: 'SOP', icon: ScrollText, desc: 'Step-by-step procedures' },
  { value: 'framework', label: 'Framework', icon: Layers, desc: 'Conceptual structure' },
  { value: 'policy', label: 'Policy', icon: FileText, desc: 'Rules & guidelines' }
];

export function PromoteDecisionModal({ decision, departments, onPromote, onClose, saving, onViewSource }) {
  const [docType, setDocType] = useState('sop');
  const [title, setTitle] = useState(decision?.title || '');
  const [departmentId, setDepartmentId] = useState(decision?.department_id || '');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!title.trim()) return;
    onPromote(docType, title.trim(), departmentId || null);
  };

  const hasSource = decision?.source_conversation_id && !decision.source_conversation_id.startsWith('temp-');

  return (
    <AppModal isOpen={true} onClose={onClose} title="Promote to Playbook" size="xl" contentClassName="mc-modal-no-padding">
      <form onSubmit={handleSubmit}>
        <div className="mc-promote-layout-v2">
          {/* LEFT side: Options */}
          <div className="mc-promote-sidebar">
            {/* Title Input */}
            <div className="mc-form-unified">
              <label className="mc-label-unified">Title</label>
              <input
                type="text"
                className="mc-input-unified"
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="e.g., Customer Onboarding Process"
                autoFocus
              />
            </div>

            {/* Department selector */}
            <div className="mc-form-unified">
              <label className="mc-label-unified">Department</label>
              <DepartmentSelect
                value={departmentId || 'all'}
                onValueChange={(val) => setDepartmentId(val === 'all' ? '' : val)}
                departments={departments || []}
                includeAll={true}
                allLabel="All Departments"
                className="mc-dept-select-modal"
              />
            </div>

            {/* Type selector - vertical cards */}
            <div className="mc-form-unified">
              <label className="mc-label-unified">Playbook Type</label>
              <div className="mc-type-cards">
                {DOC_TYPES.map(type => {
                  const Icon = type.icon;
                  const isSelected = docType === type.value;
                  return (
                    <button
                      key={type.value}
                      type="button"
                      className={`mc-type-card ${type.value} ${isSelected ? 'selected' : ''}`}
                      onClick={() => setDocType(type.value)}
                    >
                      <Icon className="mc-type-card-icon" />
                      <div className="mc-type-card-text">
                        <span className="mc-type-card-label">{type.label}</span>
                        <span className="mc-type-card-desc">{type.desc}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Source link - compact inline text */}
            {hasSource && onViewSource && (
              <button
                type="button"
                className="mc-source-link-compact"
                onClick={() => onViewSource(decision.source_conversation_id)}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6M15 3h6v6M10 14L21 3" />
                </svg>
                View source
              </button>
            )}
          </div>

          {/* RIGHT side: Full content rendered */}
          <div className="mc-promote-content-full">
            <label className="mc-label-unified">Content</label>
            <div className="mc-promote-content-rendered">
              {decision?.content ? (
                <MarkdownViewer content={decision.content} />
              ) : (
                <p className="mc-no-content">No content available</p>
              )}
            </div>
          </div>
        </div>

        <AppModal.Footer>
          <button type="button" className="app-modal-btn app-modal-btn-secondary" onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button type="submit" className="app-modal-btn app-modal-btn-primary" disabled={saving || !title.trim()}>
            {saving ? (
              <>
                <Spinner size="sm" variant="muted" />
                Creating...
              </>
            ) : (
              <>
                <Bookmark className="h-4 w-4" />
                Create {DOC_TYPES.find(t => t.value === docType)?.label}
              </>
            )}
          </button>
        </AppModal.Footer>
      </form>
    </AppModal>
  );
}
