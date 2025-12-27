/**
 * PromoteDecisionModal - Promote a council decision to a playbook or project
 *
 * Extracted from MyCompany.jsx for better maintainability.
 */

import { useState, useEffect } from 'react';
import MarkdownViewer from '../../MarkdownViewer';
import { AppModal } from '../../ui/AppModal';
import { Button } from '../../ui/button';
import { MultiDepartmentSelect } from '../../ui/MultiDepartmentSelect';
import { ProjectSelect } from '../../ui/ProjectSelect';
import { Spinner } from '../../ui/Spinner';
import { Bookmark, ScrollText, Layers, FileText, FolderKanban, RefreshCw, LucideIcon } from 'lucide-react';
import { api } from '../../../api';
import { logger } from '../../../utils/logger';
import type { Department, Project } from '../../../types/business';

interface Decision {
  id: string;
  title?: string;
  content?: string;
  content_summary?: string;
  question?: string;
  department_ids?: string[];
  project_id?: string;
  source_conversation_id?: string;
}

interface DocType {
  value: string;
  label: string;
  icon: LucideIcon;
  desc: string;
}

const DOC_TYPES: DocType[] = [
  { value: 'sop', label: 'SOP', icon: ScrollText, desc: 'Step-by-step procedures' },
  { value: 'framework', label: 'Framework', icon: Layers, desc: 'Conceptual structure' },
  { value: 'policy', label: 'Policy', icon: FileText, desc: 'Rules & guidelines' },
  { value: 'project', label: 'Project', icon: FolderKanban, desc: 'Track as a project' }
];

interface PromoteDecisionModalProps {
  decision: Decision;
  departments: Department[];
  projects?: Project[];
  companyId: string;
  onPromote: (docType: string, title: string, departmentIds: string[], projectId: string | null) => void;
  onClose: () => void;
  saving: boolean;
  onViewSource?: (conversationId: string) => void;
}

export function PromoteDecisionModal({ decision, departments, projects = [], companyId, onPromote, onClose, saving, onViewSource }: PromoteDecisionModalProps) {
  // If decision already belongs to a project, default to 'project' type
  const hasExistingProject = !!decision?.project_id;
  const [docType, setDocType] = useState(hasExistingProject ? 'project' : 'sop');
  const [title, setTitle] = useState(decision?.title || '');
  // Initialize with decision's department_ids
  const [departmentIds, setDepartmentIds] = useState(decision?.department_ids || []);
  // For project selection - pre-select if decision already has a project
  const [selectedProjectId, setSelectedProjectId] = useState(decision?.project_id || '');

  // Summary state - use content_summary (AI summary) if available
  const [summary, setSummary] = useState(decision?.content_summary || '');
  const [generatingSummary, setGeneratingSummary] = useState(false);
  const [summaryExpanded, setSummaryExpanded] = useState(false);

  // Generate summary on-demand if missing
  const handleGenerateSummary = async () => {
    if (!companyId || !decision?.id) return;
    setGeneratingSummary(true);
    try {
      const result = await api.generateDecisionSummary(companyId, decision.id);
      if (result.summary) {
        setSummary(result.summary);
      }
    } catch (err) {
      logger.error('Failed to generate summary:', err);
    }
    setGeneratingSummary(false);
  };

  // Auto-generate summary if missing and we have companyId
  useEffect(() => {
    if (!summary && decision?.question && companyId && decision?.id) {
      // Don't auto-generate - let user trigger it if they want
      // This avoids unnecessary API calls
    }
  }, [summary, decision, companyId]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    if (docType === 'project') {
      // Promote to project
      onPromote('project', title.trim(), departmentIds, selectedProjectId || null);
    } else {
      // Promote to playbook
      onPromote(docType, title.trim(), departmentIds, null);
    }
  };

  const hasSource = decision?.source_conversation_id && !decision.source_conversation_id.startsWith('temp-');

  // Filter to only show active projects
  const activeProjects = (projects || []).filter(p => p.status === 'active');

  // Find existing project name if decision belongs to one
  const existingProject = hasExistingProject
    ? activeProjects.find(p => p.id === decision.project_id)
    : null;

  return (
    <AppModal isOpen={true} onClose={onClose} title="Promote Decision" size="xl" contentClassName="mc-modal-no-padding">
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
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setTitle(e.target.value)}
                placeholder="e.g., Customer Onboarding Process"
                autoFocus
              />
            </div>

            {/* Department selector - multi-select */}
            <div className="mc-form-unified">
              <label className="mc-label-unified">Departments</label>
              <MultiDepartmentSelect
                value={departmentIds}
                onValueChange={setDepartmentIds}
                departments={departments || []}
                placeholder="Select departments"
                className="mc-dept-select-modal"
              />
            </div>

            {/* Type selector - vertical cards */}
            <div className="mc-form-unified">
              <label className="mc-label-unified">Promote To</label>
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

            {/* Project selector - only shown when docType is 'project' */}
            {docType === 'project' && (
              <div className="mc-form-unified">
                <label className="mc-label-unified">Add to Project</label>
                <ProjectSelect
                  value={selectedProjectId || null}
                  onValueChange={setSelectedProjectId}
                  projects={activeProjects}
                  includeCreate={true}
                  createLabel="New Project"
                  currentProjectId={decision?.project_id ?? null}
                />
                {existingProject && (
                  <p className="mc-existing-project-hint">
                    This decision is already part of "{existingProject.name}"
                  </p>
                )}
              </div>
            )}

            {/* Source link - compact inline text */}
            {hasSource && onViewSource && (
              <button
                type="button"
                className="mc-source-link-compact"
                onClick={() => onViewSource(decision.source_conversation_id!)}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6M15 3h6v6M10 14L21 3" />
                </svg>
                View source
              </button>
            )}
          </div>

          {/* RIGHT side: Summary + council response */}
          <div className="mc-promote-content-full">
            {/* AI Summary - what this conversation is about */}
            <div className={`mc-promote-question ${summaryExpanded ? 'expanded' : ''}`}>
              <div className="mc-promote-question-header">
                <label className="mc-label-unified">Summary</label>
                <div className="mc-summary-actions">
                  {summary && (
                    <button
                      type="button"
                      className="mc-expand-btn"
                      onClick={() => setSummaryExpanded(!summaryExpanded)}
                      title={summaryExpanded ? 'Collapse' : 'Expand'}
                    >
                      {summaryExpanded ? (
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <polyline points="4 14 10 14 10 20" />
                          <polyline points="20 10 14 10 14 4" />
                          <line x1="14" y1="10" x2="21" y2="3" />
                          <line x1="3" y1="21" x2="10" y2="14" />
                        </svg>
                      ) : (
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <polyline points="15 3 21 3 21 9" />
                          <polyline points="9 21 3 21 3 15" />
                          <line x1="21" y1="3" x2="14" y2="10" />
                          <line x1="3" y1="21" x2="10" y2="14" />
                        </svg>
                      )}
                    </button>
                  )}
                  {!summary && companyId && decision?.id && (
                    <button
                      type="button"
                      className="mc-generate-summary-btn"
                      onClick={handleGenerateSummary}
                      disabled={generatingSummary}
                    >
                      {generatingSummary ? (
                        <>
                          <Spinner size="xs" variant="muted" />
                          Generating...
                        </>
                      ) : (
                        <>
                          <RefreshCw size={12} />
                          Generate
                        </>
                      )}
                    </button>
                  )}
                </div>
              </div>
              <div className={`mc-promote-question-text ${summaryExpanded ? 'expanded' : ''}`}>
                {generatingSummary ? (
                  <span className="mc-generating-text">Generating AI summary...</span>
                ) : summary ? (
                  <MarkdownViewer content={summary} />
                ) : (
                  <span className="mc-no-summary">No summary available. Click "Generate" to create one.</span>
                )}
              </div>
            </div>

            {/* Council response */}
            <label className="mc-label-unified">Council Decision</label>
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
          <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" variant="default" disabled={saving || !title.trim()}>
            {saving ? (
              <>
                <Spinner size="sm" variant="muted" />
                Creating...
              </>
            ) : (
              <>
                {docType === 'project' ? (
                  <>
                    <FolderKanban className="h-4 w-4" />
                    {selectedProjectId ? 'Add to Project' : 'Create Project'}
                  </>
                ) : (
                  <>
                    <Bookmark className="h-4 w-4" />
                    Create {DOC_TYPES.find(t => t.value === docType)?.label}
                  </>
                )}
              </>
            )}
          </Button>
        </AppModal.Footer>
      </form>
    </AppModal>
  );
}
