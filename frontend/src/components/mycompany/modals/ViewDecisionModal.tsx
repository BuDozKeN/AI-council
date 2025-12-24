/**
 * ViewDecisionModal - View a saved council decision
 *
 * Shows decision content with:
 * - Question summary
 * - Linked project or playbook info
 * - Copy functionality
 * - Navigate to source conversation
 * - Promote to playbook action
 *
 * Extracted from MyCompany.jsx for better maintainability.
 */

import { AppModal } from '../../ui/AppModal';
import { Button } from '../../ui/button';
import { FloatingContextActions } from '../../ui/FloatingContextActions';
import MarkdownViewer from '../../MarkdownViewer';
import { Bookmark, FolderKanban, ExternalLink } from 'lucide-react';
import { getDeptColor } from '../../../lib/colors';
import { formatDate } from '../../../lib/dateUtils';

export function ViewDecisionModal({
  decision,
  departments = [],
  playbooks = [],
  projects = [],
  onClose,
  onPromote,
  onViewProject,
  onNavigateToConversation
}) {
  // Get linked playbook (source of truth for promoted decisions)
  const linkedPlaybook = decision.promoted_to_id && playbooks.length > 0
    ? playbooks.find(p => p.id === decision.promoted_to_id)
    : null;

  // Get linked project (if decision was saved as part of a project)
  const linkedProject = decision.project_id && projects.length > 0
    ? projects.find(p => p.id === decision.project_id)
    : null;

  // Decision is "promoted" if it has promoted_to_id OR is linked to a project
  const isAlreadyPromoted = decision.promoted_to_id || decision.project_id;

  // Get type from linked playbook OR decision's promoted_to_type
  // Decision.promoted_to_type is set when promoted (sop/framework/policy/project)
  const getTypeLabel = () => {
    const typeLabels = {
      sop: 'SOP',
      framework: 'Framework',
      policy: 'Policy'
    };
    // Try linkedPlaybook first, then fall back to decision.promoted_to_type
    const docType = linkedPlaybook?.doc_type || decision.promoted_to_type;
    return typeLabels[docType] || null;
  };

  // Get the actual type value for CSS class
  const getTypeValue = () => {
    return linkedPlaybook?.doc_type || decision.promoted_to_type || null;
  };

  // Get departments from linked playbook (source of truth)
  const getPlaybookDepts = () => {
    if (!linkedPlaybook) return [];

    // Collect all departments the playbook belongs to
    const deptIds = new Set();
    if (linkedPlaybook.department_id) deptIds.add(linkedPlaybook.department_id);
    if (linkedPlaybook.linked_departments) {
      linkedPlaybook.linked_departments.forEach(ld => {
        if (ld.department_id) deptIds.add(ld.department_id);
      });
    }

    // Map to department objects
    return Array.from(deptIds)
      .map(id => departments.find(d => d.id === id))
      .filter(Boolean);
  };

  const typeLabel = getTypeLabel();
  const typeValue = getTypeValue();
  const playbookDepts = getPlaybookDepts();

  return (
    <AppModal isOpen={true} onClose={onClose} title={decision.title} size="lg">
      {/* User question - show AI summary if available, fall back to raw question */}
      {(decision.question_summary || decision.question) && (
        <div className="mc-decision-question">
          <span className="mc-decision-question-label">Question:</span>
          <p className="mc-decision-question-text">{decision.question_summary || decision.question}</p>
        </div>
      )}

      <div className="mc-decision-meta">
        {/* Show project link if decision is linked to a project */}
        {linkedProject ? (
          <div className="mc-promoted-info-row">
            <span className="mc-promoted-label project">
              <FolderKanban size={14} className="icon" />
              Project
            </span>
            <button
              className="mc-project-link-btn"
              onClick={() => onViewProject && onViewProject(linkedProject.id)}
            >
              {linkedProject.name} →
            </button>
          </div>
        ) : decision.promoted_to_id ? (
          <div className="mc-promoted-info-row">
            <span className="mc-promoted-label">
              <span className="icon">✓</span>
              Playbook
            </span>
            {typeLabel && (
              <span className={`mc-type-badge ${typeValue}`}>
                {typeLabel}
              </span>
            )}
            {playbookDepts.length > 0 && playbookDepts.map(dept => {
              const color = getDeptColor(dept.id);
              return (
                <span
                  key={dept.id}
                  className="mc-dept-badge"
                  style={{ background: color.bg, color: color.text, borderColor: color.border }}
                >
                  {dept.name}
                </span>
              );
            })}
            {playbookDepts.length === 0 && (
              <span className="mc-scope-badge company-wide">Company-wide</span>
            )}
          </div>
        ) : (
          <span className="mc-pending-label">Saved decision</span>
        )}
        <span className="mc-date">
          {formatDate(decision.created_at)}
        </span>
      </div>
      {decision.tags && decision.tags.length > 0 && (
        <div className="mc-tags">
          {decision.tags.map(tag => (
            <span key={tag} className="mc-tag">{tag}</span>
          ))}
        </div>
      )}
      <div className="mc-decision-content">
        <FloatingContextActions copyText={decision.content || ''} className="no-border">
          <MarkdownViewer content={decision.content || ''} />

          {/* Source link - at the bottom of the content */}
          {decision.source_conversation_id && !decision.source_conversation_id.startsWith('temp-') && onNavigateToConversation && (
            <button
              className="mc-decision-source-link"
              onClick={() => {
                // Pass response_index to scroll to the correct response in multi-turn conversations
                onNavigateToConversation(decision.source_conversation_id, 'decisions', decision.response_index || 0);
              }}
            >
              <ExternalLink size={14} />
              View original conversation →
            </button>
          )}
        </FloatingContextActions>
      </div>
      <AppModal.Footer>
        {/* Only show Promote to Playbook if NOT already a playbook AND NOT linked to a project */}
        {!isAlreadyPromoted && onPromote && (
          <Button variant="default" onClick={() => onPromote(decision)}>
            <Bookmark size={14} />
            Promote to Playbook
          </Button>
        )}
        <Button variant="outline" onClick={onClose}>
          Close
        </Button>
      </AppModal.Footer>
    </AppModal>
  );
}
