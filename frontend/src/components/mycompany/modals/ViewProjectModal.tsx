/**
 * ViewProjectModal - View and edit project details including context and decisions timeline
 *
 * Extracted from MyCompany.jsx for better maintainability.
 */

import { useState, useEffect, useMemo, useRef } from 'react';
import { api } from '../../../api';
import MarkdownViewer from '../../MarkdownViewer';
import { AppModal } from '../../ui/AppModal';
import { AlertModal } from '../../ui/AlertModal';
import { Button } from '../../ui/button';
import { MultiDepartmentSelect } from '../../ui/MultiDepartmentSelect';
import { Spinner } from '../../ui/Spinner';
import { AIWriteAssist } from '../../ui/AIWriteAssist';
import { FloatingContextActions } from '../../ui/FloatingContextActions';
import { toast } from '../../ui/sonner';
import { Bookmark, CheckCircle, Archive, RotateCcw, ExternalLink, Trash2, Sparkles, PenLine } from 'lucide-react';
import { getDeptColor } from '../../../lib/colors';
import { truncateText } from '../../../lib/utils';
import { formatDateShort, formatDateCompact } from '../../../lib/dateUtils';
import { logger } from '../../../utils/logger';
import type { Department, Project } from '../../../types/business';

const log = logger.scope('ViewProjectModal');

type ProjectStatus = 'active' | 'completed' | 'archived';
type ConfirmAction = 'complete' | 'archive' | 'restore' | 'delete' | null;
type TabType = 'context' | 'decisions';

interface ExtendedProject extends Project {
  context_md?: string;
  source?: string;
  source_conversation_id?: string;
  decision_count?: number;
  department_names?: string[];
  last_accessed_at?: string;
}

interface ProjectDecision {
  id: string;
  title: string;
  content?: string;
  content_summary?: string;
  question?: string;
  department_ids?: string[];
  department_names?: string[];
  source_conversation_id?: string;
  response_index?: number | null;
  created_at: string;
}

interface DecisionGroup {
  type: 'single' | 'group';
  conversationId?: string;
  decisions: ProjectDecision[];
}

interface AlertModalData {
  title: string;
  message: string;
  variant: 'success' | 'error' | 'warning' | 'info';
}

interface ViewProjectModalProps {
  project: ExtendedProject;
  companyId: string;
  departments?: Department[];
  initialExpandedDecisionId?: string | null;
  onConsumeInitialDecision?: () => void;
  onClose: () => void;
  onSave?: (id: string, updates: Partial<ExtendedProject>) => Promise<ExtendedProject | undefined>;
  isNew?: boolean;
  onNavigateToConversation?: (conversationId: string, source: string, responseIndex?: number, projectId?: string, decisionId?: string) => void;
  onProjectUpdate?: (projectId: string, updates: Partial<ExtendedProject>) => void;
  onStatusChange?: (projectId: string, newStatus: ProjectStatus) => Promise<void>;
  onDelete?: (projectId: string) => Promise<void>;
}

export function ViewProjectModal({ project: initialProject, companyId, departments = [], initialExpandedDecisionId = null, onConsumeInitialDecision, onClose, onSave, isNew = false, onNavigateToConversation, onProjectUpdate, onStatusChange, onDelete }: ViewProjectModalProps) {
  // Local project state that can be updated after save
  const [project, setProject] = useState(initialProject);

  // State for action confirmations
  const [confirmingAction, setConfirmingAction] = useState<ConfirmAction>(null);
  const [actionLoading, setActionLoading] = useState(false);

  // Alert modal state (local to this component)
  const [alertModal, setAlertModal] = useState<AlertModalData | null>(null);

  const [isEditing, setIsEditing] = useState(isNew);
  const [editedName, setEditedName] = useState(project.name || '');
  const [editedDescription, setEditedDescription] = useState(project.description || '');
  const [editedContext, setEditedContext] = useState(project.context_md || '');
  const [editedStatus, setEditedStatus] = useState<ProjectStatus>(project.status || 'active');
  // Use department_ids array
  const [editedDepartmentIds, setEditedDepartmentIds] = useState<string[]>(
    project.department_ids || []
  );
  const [saving, setSaving] = useState(false);
  const [isEditingName, setIsEditingName] = useState(isNew);

  // Tab state for Context vs Decisions - default to decisions if returning to a specific decision
  const [activeTab, setActiveTab] = useState<TabType>(initialExpandedDecisionId ? 'decisions' : 'context');

  // Decisions timeline state
  const [projectDecisions, setProjectDecisions] = useState<ProjectDecision[]>([]);
  const [loadingDecisions, setLoadingDecisions] = useState(false);
  const [expandedDecisionId, setExpandedDecisionId] = useState<string | null>(null);
  const hasExpandedInitialDecision = useRef(false); // Track if we've auto-expanded the initial decision
  const [generatingSummaryId, setGeneratingSummaryId] = useState<string | null>(null);

  // Regenerate context state
  const [regenerating, setRegenerating] = useState(false);

  // Scroll ref for modal body
  const modalBodyRef = useRef<HTMLDivElement | null>(null);

  // Track which project we've synced departments for (prevent multiple syncs causing flicker)
  const syncedProjectId = useRef<string | null>(null);

  // Check if a summary is garbage and needs regeneration
  // NOTE: New decisions get summaries at save time (in merge endpoint).
  // This check is only for LEGACY decisions saved before that feature was added.
  const isGarbageSummary = (summary: string | null | undefined): boolean => {
    if (!summary) return true;
    const garbageTexts = [
      'added council decision to project',
      'decision merged into project',
      'added new council decision section'
    ];
    const lowerSummary = summary.toLowerCase().trim();
    return garbageTexts.includes(lowerSummary) || summary.length < 50;
  };

  // Handle expanding a decision - only regenerate summaries for legacy decisions without one
  // New decisions should already have summaries (generated at save time)
  const handleExpandDecision = async (decisionId: string) => {
    if (expandedDecisionId === decisionId) {
      // Collapsing
      setExpandedDecisionId(null);
      return;
    }

    // Expanding
    setExpandedDecisionId(decisionId);

    // LEGACY FALLBACK: Only regenerate for old decisions without proper summaries
    // New decisions get summaries at save time, so this should rarely trigger
    const decision = projectDecisions.find(d => d.id === decisionId);
    const needsRegeneration = decision && decision.question && isGarbageSummary(decision.content_summary);

    if (needsRegeneration) {
      log.debug('Legacy decision needs summary', { decisionId, current: decision.content_summary });
      setGeneratingSummaryId(decisionId);
      try {
        const result = await api.generateDecisionSummary(companyId, decisionId);
        log.debug('Generated summary result', { result });
        if (result && !result.cached) {
          // Update the decision in state with both new summary and title
          setProjectDecisions(prev => prev.map(d =>
            d.id === decisionId ? {
              ...d,
              content_summary: result.summary || d.content_summary,
              title: result.title || d.title
            } : d
          ));
        }
      } catch {
        log.error('Failed to generate summary', { error: "unknown" });
      } finally {
        setGeneratingSummaryId(null);
      }
    }
  };

  // Group decisions by conversation for visual linking
  const groupedDecisions = useMemo((): DecisionGroup[] => {
    if (!projectDecisions.length) return [];

    // Create groups - decisions with same source_conversation_id are grouped together
    const groups: DecisionGroup[] = [];
    let currentGroup: DecisionGroup | null = null;

    // Sort by created_at to ensure chronological order
    const sorted = [...projectDecisions].sort((a, b) =>
      new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );

    sorted.forEach((decision: ProjectDecision) => {
      const convId = decision.source_conversation_id;

      if (!convId) {
        // No conversation - standalone decision
        groups.push({ type: 'single', decisions: [decision] });
        currentGroup = null;
      } else if (currentGroup && currentGroup.conversationId === convId) {
        // Same conversation as current group
        currentGroup.decisions.push(decision);
      } else {
        // New conversation group
        currentGroup = {
          type: 'group',
          conversationId: convId,
          decisions: [decision]
        };
        groups.push(currentGroup);
      }
    });

    return groups;
  }, [projectDecisions]);

  const content = project.context_md || '';

  // Get department names for display
  const getDepartmentNames = (): string[] | null => {
    if (!editedDepartmentIds || editedDepartmentIds.length === 0) return null;
    return editedDepartmentIds
      .map((id: string) => departments.find((d: Department) => d.id === id)?.name)
      .filter((name): name is string => Boolean(name));
  };

  // Handle regenerating project context from all decisions
  const [regenCountdown, setRegenCountdown] = useState<number | null>(null); // null = not counting, 3/2/1 = counting down
  const countdownRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleRegenerateContext = () => {
    if (!project.id || regenerating) return;
    // Start 3-second countdown
    setRegenCountdown(3);
  };

  const cancelCountdown = () => {
    if (countdownRef.current) {
      clearInterval(countdownRef.current);
      countdownRef.current = null;
    }
    setRegenCountdown(null);
  };

  // Countdown effect
  useEffect(() => {
    if (regenCountdown === null) return;

    if (regenCountdown === 0) {
      // Time's up - execute
      countdownRef.current = null;
      setRegenCountdown(null);
      executeRegenerateContext();
      return;
    }

    // Tick down every second
    countdownRef.current = setTimeout(() => {
      setRegenCountdown(prev => prev !== null ? prev - 1 : null);
    }, 1000);

    return () => {
      if (countdownRef.current) {
        clearTimeout(countdownRef.current);
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps -- executeRegenerateContext is stable
  }, [regenCountdown]);

  const executeRegenerateContext = async () => {
    setRegenerating(true);
    try {
      log.info('Calling regenerateProjectContext', { projectId: project.id });
      const result = await api.regenerateProjectContext(project.id);
      log.info('Result received', { result });
      if (result.success && result.context_md) {
        // Update local state - user sees context update immediately, no modal needed
        setProject(prev => ({ ...prev, context_md: result.context_md }));
        setEditedContext(result.context_md);
        // Silent success - the updated context appearing is feedback enough
      } else {
        setAlertModal({
          title: 'Regeneration Failed',
          message: result.message || 'Unknown error occurred.',
          variant: 'error'
        });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'An unexpected error occurred.';
      log.error('Failed to regenerate context', { error: message });
      setAlertModal({
        title: 'Regeneration Failed',
        message,
        variant: 'error'
      });
    } finally {
      setRegenerating(false);
    }
  };

  // Sync project departments from all decisions when modal opens
  // This ensures the department badges are up-to-date from all decisions
  useEffect(() => {
    // Only sync once per project to prevent flicker from multiple re-renders
    // Uses project ID as key so different projects get synced, but same project doesn't re-sync
    if (companyId && project.id && !isEditing && syncedProjectId.current !== project.id) {
      syncedProjectId.current = project.id;
      api.syncProjectDepartments(companyId, project.id)
        .then(syncResult => {
          // Only update if departments actually changed (use spread to avoid mutating)
          if (syncResult?.department_ids) {
            const currentIds = JSON.stringify([...editedDepartmentIds].sort());
            const newIds = JSON.stringify([...syncResult.department_ids].sort());
            if (currentIds !== newIds) {
              // Batch updates to minimize re-renders
              setProject(prev => ({
                ...prev,
                department_ids: syncResult.department_ids
              }));
              setEditedDepartmentIds(syncResult.department_ids);
              // Also update parent projects list so dashboard shows correct departments
              if (onProjectUpdate) {
                onProjectUpdate(project.id, { department_ids: syncResult.department_ids });
              }
            }
          }
        })
        .catch(() => {
          // Silent fail - departments will just show what's already there
        });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId, project.id]); // Only run once on modal open, not on tab change

  // Load decisions when switching to decisions tab (only if not already loaded)
  useEffect(() => {
    if (activeTab === 'decisions' && companyId && project.id && projectDecisions.length === 0) {
      setLoadingDecisions(true);
      api.getProjectDecisions(companyId, project.id)
        .then(data => {
          setProjectDecisions(data.decisions || []);
        })
        .catch(() => {
          log.error('Failed to load project decisions', { error: "unknown" });
        })
        .finally(() => {
          setLoadingDecisions(false);
        });
    }
  }, [activeTab, companyId, project.id, projectDecisions.length]);

  // Auto-expand the initial decision when returning from source conversation
  useEffect(() => {
    if (
      initialExpandedDecisionId &&
      !hasExpandedInitialDecision.current &&
      projectDecisions.length > 0 &&
      !loadingDecisions
    ) {
      // Find the decision to expand
      const decisionExists = projectDecisions.some(d => d.id === initialExpandedDecisionId);
      if (decisionExists) {
        log.debug('Auto-expanding decision', { decisionId: initialExpandedDecisionId });
        setExpandedDecisionId(initialExpandedDecisionId);
        hasExpandedInitialDecision.current = true;
        // Consume the initial decision ID so it won't re-expand on future opens
        if (onConsumeInitialDecision) {
          onConsumeInitialDecision();
        }
      }
    }
  }, [initialExpandedDecisionId, projectDecisions, loadingDecisions, onConsumeInitialDecision]);

  const getStatusColor = (status: ProjectStatus): { bg: string; text: string } => {
    switch (status) {
      case 'active': return { bg: 'var(--color-blue-100)', text: 'var(--color-blue-700)' };
      case 'completed': return { bg: 'var(--color-green-100)', text: 'var(--color-green-700)' };
      case 'archived': return { bg: 'var(--color-gray-100)', text: 'var(--color-gray-500)' };
      default: return { bg: 'var(--color-gray-100)', text: 'var(--color-gray-500)' };
    }
  };

  const handleSave = async () => {
    if (onSave) {
      if (!editedName.trim()) {
        setAlertModal({ title: 'Validation Error', message: 'Project name is required', variant: 'warning' });
        return;
      }
      setSaving(true);
      try {
        // onSave now returns the updated project data
        const updates: Partial<ExtendedProject> = {
          name: editedName,
          description: editedDescription,
          context_md: editedContext,
          status: editedStatus
        };
        if (editedDepartmentIds.length > 0) {
          updates.department_ids = editedDepartmentIds;
        }
        const updatedProject = await onSave(project.id, updates);
        // Update local project state with returned data (stay on view, don't close)
        if (updatedProject) {
          setProject(updatedProject);
        }
        setIsEditing(false);
        setIsEditingName(false);

        // Build descriptive success message
        const deptNames = editedDepartmentIds
          .map(id => departments.find(d => d.id === id)?.name)
          .filter(Boolean);

        let message = `Project "${editedName}" saved`;
        if (deptNames.length > 0) {
          message += ` for ${deptNames.join(', ')}`;
        }

        toast.success(message, { duration: 4000 });
      } catch {
        toast.error('Failed to save project');
      }
      setSaving(false);
    }
  };

  const handleCancelEdit = () => {
    if (isNew) {
      onClose(); // Close modal for new project cancel
      return;
    }
    setIsEditing(false);
    setIsEditingName(false);
    setEditedName(project.name || '');
    setEditedDescription(project.description || '');
    setEditedContext(project.context_md || '');
    setEditedStatus(project.status || 'active');
    setEditedDepartmentIds(project.department_ids || []);
  };

  return (
    <AppModal
      isOpen={true}
      onClose={onClose}
      size="lg"
      showCloseButton={false}
      contentClassName="mc-modal-no-padding"
    >
        {/* Header with title */}
        <div className="mc-modal-header-clean">
          <div className="mc-header-title-row">
            {isEditingName || isNew ? (
              <input
                id="project-name-edit"
                name="project-name"
                type="text"
                className="mc-title-inline-edit"
                value={editedName}
                onChange={(e) => setEditedName(e.target.value)}
                onBlur={() => !isNew && setIsEditingName(false)}
                onKeyDown={(e) => e.key === 'Enter' && !isNew && setIsEditingName(false)}
                placeholder={isNew ? "Enter project name..." : ""}
                autoFocus
              />
            ) : (
              <h2
                className="mc-title-display editable"
                onClick={() => setIsEditingName(true)}
                title="Click to edit name"
              >
                {editedName || project.name}
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

        <div className="mc-modal-body" ref={modalBodyRef}>
          {/* Status, Department and info row */}
          <div className="mc-project-meta-row">
            {/* Status badge - shown in both view and edit modes (status changed via footer actions) */}
            {!isNew && (
              <span
                className="mc-status-badge"
                style={{
                  background: getStatusColor(editedStatus).bg,
                  color: getStatusColor(editedStatus).text
                }}
              >
                {editedStatus}
              </span>
            )}

            {/* Source indicator - how was this project created */}
            {!isNew && !isEditing && project.source && project.source !== 'manual' && (
              <span className={`mc-source-badge ${project.source}`}>
                {project.source === 'council' ? 'From Council' : project.source === 'import' ? 'Imported' : project.source}
              </span>
            )}

            {/* Departments - using multi-select when editing */}
            {isEditing ? (
              <MultiDepartmentSelect
                value={editedDepartmentIds}
                onValueChange={setEditedDepartmentIds}
                departments={departments}
                placeholder="Select departments..."
              />
            ) : (
              <>
                {/* Show multiple department badges */}
                {getDepartmentNames()?.map((name, idx) => {
                  const deptId = editedDepartmentIds[idx];
                  return (
                    <span
                      key={deptId || idx}
                      className="mc-dept-badge"
                      style={{
                        background: getDeptColor(deptId)?.bg || 'var(--color-violet-50)',
                        color: getDeptColor(deptId)?.text || 'var(--color-violet-600)',
                        borderColor: getDeptColor(deptId)?.border || 'var(--color-violet-200)'
                      }}
                    >
                      {name}
                    </span>
                  );
                })}
              </>
            )}

            {/* Timestamps inline - small and subtle */}
            {!isNew && !isEditing && (project.created_at || project.updated_at) && (
              <div className="mc-project-timestamps">
                {project.created_at && (
                  <span className="mc-timestamp">
                    {formatDateShort(project.created_at)}
                  </span>
                )}
                {project.updated_at && project.updated_at !== project.created_at && (
                  <span className="mc-timestamp">
                    Updated {formatDateCompact(project.updated_at)}
                  </span>
                )}
              </div>
            )}

            {/* View original conversation link - subtle, on the right */}
            {!isNew && !isEditing && project.source_conversation_id && onNavigateToConversation && (
              <button
                className="mc-source-link"
                onClick={() => {
                  onClose();
                  onNavigateToConversation(project.source_conversation_id!, 'projects');
                }}
                title="View the original conversation that created this project"
              >
                <ExternalLink size={12} />
                <span>View source</span>
              </button>
            )}
          </div>

          {/* Description - stripped of markdown for clean display */}
          {isEditing ? (
            <div className="mc-field-group">
              <label htmlFor="project-description" className="mc-field-label">Description</label>
              <AIWriteAssist
                context="project-description"
                value={editedDescription}
                onSuggestion={setEditedDescription}
                additionalContext={editedName ? `Project: ${editedName}` : ''}
                inline
              >
                <input
                  id="project-description"
                  name="project-description"
                  type="text"
                  className="mc-input-unified"
                  value={editedDescription}
                  onChange={(e) => setEditedDescription(e.target.value)}
                  placeholder="Brief description of the project..."
                />
              </AIWriteAssist>
            </div>
          ) : project.description && (
            <p className="mc-project-description">
              {truncateText(project.description, 200)}
            </p>
          )}

          {/* Tab navigation - only show when not editing and not new */}
          {!isEditing && !isNew && (
            <div className="mc-project-tabs">
              <button
                className={`mc-project-tab ${activeTab === 'context' ? 'active' : ''}`}
                onClick={() => setActiveTab('context')}
              >
                <svg className="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M4 4a2 2 0 012-2h8a2 2 0 012 2v12a1 1 0 110 2H4a1 1 0 010-2zm3 1h6v4H7V5zm6 6H7v2h6v-2z" clipRule="evenodd" />
                </svg>
                Context
              </button>
              <button
                className={`mc-project-tab ${activeTab === 'decisions' ? 'active' : ''}`}
                onClick={() => setActiveTab('decisions')}
              >
                <Bookmark size={14} />
                Decisions
                {(project.decision_count ?? 0) > 0 && (
                  <span className="mc-tab-badge">{project.decision_count}</span>
                )}
              </button>
            </div>
          )}

          {/* Context Tab Content */}
          {(activeTab === 'context' || isEditing || isNew) && (
            <>
              {/* Context section header with Edit/Save actions */}
              <div className="mc-context-header-row">
                <div className="mc-context-header-left">
                  <label className="mc-section-label">Project Context</label>
                  <span className="mc-section-hint">
                    Injected into council sessions when this project is selected
                  </span>
                </div>
                {/* Right side: AI Enhance + Edit/Save buttons */}
                <div className="mc-context-header-actions">
                  {/* AI Enhance - always available (not for new projects) */}
                  {!isNew && (
                    regenCountdown !== null ? (
                      <button
                        className="mc-ai-synthesize-btn countdown"
                        onClick={cancelCountdown}
                        title="Cancel AI Enhance"
                      >
                        <span className="mc-countdown-num">{regenCountdown}</span>
                        <span>Cancel</span>
                      </button>
                    ) : (
                      <button
                        className="mc-ai-synthesize-btn"
                        onClick={handleRegenerateContext}
                        disabled={regenerating}
                        title={isEditing
                          ? "AI will enhance your current content"
                          : ((project.decision_count ?? 0) > 0 || projectDecisions.length > 0)
                            ? "AI will synthesize all decisions into organized project context"
                            : "AI will enhance and structure your project context"
                        }
                      >
                        {regenerating ? (
                          <>
                            <Spinner size="sm" variant="brand" />
                            <span>Processing...</span>
                          </>
                        ) : (
                          <>
                            <Sparkles size={14} />
                            <span>AI Enhance</span>
                          </>
                        )}
                      </button>
                    )
                  )}
                  {isEditing ? (
                    /* When editing: Cancel and Save buttons */
                    <>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleCancelEdit}
                        disabled={saving}
                      >
                        Cancel
                      </Button>
                      <Button
                        variant="default"
                        size="sm"
                        onClick={handleSave}
                        disabled={saving}
                      >
                        {saving ? 'Saving...' : 'Save'}
                      </Button>
                    </>
                  ) : (
                    /* When viewing: Edit button (AI Enhance is always shown above) */
                    <>
                      {/* Edit button */}
                      {onSave && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setIsEditing(true)}
                          title="Edit project context"
                        >
                          <PenLine size={14} />
                          <span>Edit</span>
                        </Button>
                      )}
                    </>
                  )}
                </div>
              </div>

              {/* Context Section - Preview by default, textarea when editing */}
              <div className="mc-content-section">
                {isEditing ? (
                  <div className="mc-edit-full">
                    <AIWriteAssist
                      context="project-context"
                      value={editedContext}
                      onSuggestion={setEditedContext}
                      additionalContext={editedName ? `Project: ${editedName}` : ''}
                    >
                      <textarea
                        id="project-context-edit"
                        name="project-context"
                        className="mc-edit-textarea-full"
                        value={editedContext}
                        onChange={(e) => setEditedContext(e.target.value)}
                        rows={15}
                        autoFocus
                        placeholder="Add project context here..."
                        enterKeyHint="done"
                      />
                    </AIWriteAssist>
                  </div>
                ) : (
                  <FloatingContextActions copyText={content || undefined} className="no-border">
                    {content ? (
                      <MarkdownViewer content={content} skipCleanup={true} />
                    ) : (
                      <p className="mc-no-content">No project context yet. Click Edit to add context that will be included in all council sessions for this project.</p>
                    )}
                  </FloatingContextActions>
                )}
              </div>
            </>
          )}

          {/* Decisions Tab Content - Timeline View */}
          {activeTab === 'decisions' && !isEditing && !isNew && (
            <div className="mc-project-decisions">
              {loadingDecisions ? (
                <div className="mc-decisions-loading">
                  <Spinner size="md" variant="brand" />
                  <span>Loading decisions...</span>
                </div>
              ) : projectDecisions.length === 0 ? (
                <div className="mc-empty-decisions">
                  <Bookmark size={32} className="mc-empty-icon text-slate-300 mb-3" />
                  <p className="mc-empty-title">No decisions yet</p>
                  <p className="mc-empty-hint">
                    Save council responses to this project to build a decision timeline.
                  </p>
                </div>
              ) : (
                <div className="mc-decisions-timeline">
                  {groupedDecisions.map((group, groupIndex) => (
                    <div
                      key={group.conversationId || `single-${groupIndex}`}
                      className={`mc-timeline-group ${group.type === 'group' && group.decisions.length > 1 ? 'linked' : ''}`}
                    >
                      {group.decisions.map((decision, decisionIndex) => (
                        <div
                          key={decision.id}
                          className={`mc-timeline-item ${expandedDecisionId === decision.id ? 'expanded' : ''}`}
                        >
                          {/* Decision card - clean, no dots/lines */}
                          <div className="mc-timeline-content">
                            <div
                              className="mc-timeline-header"
                              onClick={() => handleExpandDecision(decision.id)}
                            >
                              {/* Single row: Title | Dept Badge | #N | Date | Chevron */}
                              <div className="mc-timeline-title-row">
                                <h4 className="mc-timeline-title">{decision.title}</h4>
                                <div className="mc-timeline-title-badges">
                                  {/* Show multiple department badges if available */}
                                  {(decision.department_names || []).map((deptName, idx) => {
                                    const deptId = decision.department_ids?.[idx];
                                    return (
                                      <span
                                        key={deptId || idx}
                                        className="mc-timeline-dept-badge"
                                        style={{
                                          background: getDeptColor(deptId)?.bg || 'var(--color-gray-100)',
                                          color: getDeptColor(deptId)?.text || 'var(--color-gray-700)',
                                          borderColor: getDeptColor(deptId)?.border || 'var(--color-gray-200)'
                                        }}
                                      >
                                        {deptName}
                                      </span>
                                    );
                                  })}
                                  {/* Show iteration badge for multi-turn conversations */}
                                  {group.type === 'group' && group.decisions.length > 1 && (
                                    <span className="mc-timeline-iteration-badge">
                                      #{decisionIndex + 1}
                                    </span>
                                  )}
                                  <span className="mc-timeline-date">
                                    {formatDateShort(decision.created_at)}
                                  </span>
                                  <svg
                                    className={`mc-timeline-chevron ${expandedDecisionId === decision.id ? 'expanded' : ''}`}
                                    viewBox="0 0 20 20"
                                    fill="currentColor"
                                  >
                                    <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                                  </svg>
                                </div>
                              </div>
                            </div>

                            {/* Expanded content */}
                            {expandedDecisionId === decision.id && (
                              <div className="mc-timeline-body">
                                {/* Clean AI-generated summary */}
                                {generatingSummaryId === decision.id ? (
                                  <div className="mc-timeline-summary-loading">
                                    <Spinner size="sm" variant="brand" />
                                    <span>Generating summary...</span>
                                  </div>
                                ) : decision.content_summary ? (
                                  <div className="mc-timeline-summary">
                                    <MarkdownViewer content={decision.content_summary} skipCleanup={true} />
                                  </div>
                                ) : null}

                                {/* Council's response with copy button */}
                                <div className="mc-timeline-answer">
                                  <div className="mc-timeline-copy-container">
                                    <button
                                      className="mc-timeline-copy-btn"
                                    onClick={async (e: React.MouseEvent<HTMLButtonElement>) => {
                                      e.stopPropagation();
                                      const btn = (e.target as HTMLElement).closest('.mc-timeline-copy-btn') as HTMLElement | null;
                                      try {
                                        await navigator.clipboard.writeText(decision.content || '');
                                        // Brief visual feedback - swap icon
                                        if (btn) {
                                          btn.classList.add('copied');
                                          const copyIcon = btn.querySelector('.copy-icon') as HTMLElement | null;
                                          const checkIcon = btn.querySelector('.check-icon') as HTMLElement | null;
                                          if (copyIcon) copyIcon.style.display = 'none';
                                          if (checkIcon) checkIcon.style.display = 'block';
                                          setTimeout(() => {
                                            btn.classList.remove('copied');
                                            if (copyIcon) copyIcon.style.display = 'block';
                                            if (checkIcon) checkIcon.style.display = 'none';
                                          }, 2000);
                                        }
                                      } catch {
                                        log.error('Failed to copy', { error: "unknown" });
                                      }
                                    }}
                                    title="Copy council response"
                                  >
                                    <svg className="copy-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                                      <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
                                    </svg>
                                      <svg className="check-icon hidden" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                        <polyline points="20 6 9 17 4 12" />
                                      </svg>
                                    </button>
                                  </div>
                                  <MarkdownViewer content={decision.content || ''} skipCleanup={true} />
                                </div>

                                {decision.source_conversation_id && onNavigateToConversation && (
                                  <button
                                    className="mc-timeline-source-link"
                                    onClick={() => {
                                      onClose();
                                      // Pass response_index to scroll to the correct response in multi-turn conversations
                                      // If response_index is null (legacy decision), infer from position in group
                                      // Council responses are at odd indices: 1, 3, 5, 7...
                                      // So decisionIndex 0 → response_index 1, decisionIndex 1 → response_index 3, etc.
                                      const inferredIndex = decision.response_index ?? (decisionIndex * 2 + 1);
                                      log.debug('Navigating to conversation', {
                                        conversationId: decision.source_conversation_id,
                                        responseIndex: inferredIndex,
                                        stored: decision.response_index,
                                        inferredFrom: decisionIndex
                                      });
                                      // Pass project ID and decision ID so "Back to Project" returns to this exact decision
                                      onNavigateToConversation(decision.source_conversation_id!, 'projects', inferredIndex, project.id, decision.id);
                                    }}
                                  >
                                    View original conversation →
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

        </div>

        <div className="app-modal-footer-with-actions">
          {/* Left side: Status actions (always visible for existing projects) */}
          {!isNew && onStatusChange && (
            <div className="app-modal-footer-left">
              {confirmingAction === 'delete' ? (
                <div className="app-modal-confirm-inline">
                  <span>Delete this project?</span>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={async () => {
                      setActionLoading(true);
                      try {
                        if (onDelete) await onDelete(project.id);
                      } catch {
                        log.error('Failed to delete', { error: "unknown" });
                        setActionLoading(false);
                        setConfirmingAction(null);
                      }
                    }}
                    disabled={actionLoading}
                  >
                    {actionLoading ? 'Deleting...' : 'Yes, Delete'}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setConfirmingAction(null)}
                    disabled={actionLoading}
                  >
                    Cancel
                  </Button>
                </div>
              ) : (
                <>
                  {/* Complete button - only for active projects */}
                  {editedStatus === 'active' && (
                    <Button
                      variant="success"
                      size="sm"
                      onClick={async () => {
                        setActionLoading(true);
                        try {
                          await onStatusChange(project.id, 'completed');
                        } catch {
                          log.error('Failed to complete', { error: "unknown" });
                          setActionLoading(false);
                        }
                      }}
                      disabled={actionLoading || saving}
                      title="Mark project as completed"
                    >
                      <CheckCircle size={14} />
                      <span>Complete</span>
                    </Button>
                  )}
                  {/* Archive/Restore button */}
                  {editedStatus === 'archived' ? (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={async () => {
                        setActionLoading(true);
                        try {
                          await onStatusChange(project.id, 'active');
                        } catch {
                          log.error('Failed to restore', { error: "unknown" });
                          setActionLoading(false);
                        }
                      }}
                      disabled={actionLoading || saving}
                      title="Restore project to active"
                    >
                      <RotateCcw size={14} />
                      <span>Restore</span>
                    </Button>
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={async () => {
                        setActionLoading(true);
                        try {
                          await onStatusChange(project.id, 'archived');
                        } catch {
                          log.error('Failed to archive', { error: "unknown" });
                          setActionLoading(false);
                        }
                      }}
                      disabled={actionLoading || saving}
                      title="Archive this project"
                    >
                      <Archive size={14} />
                      <span>Archive</span>
                    </Button>
                  )}
                  {/* Delete button */}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setConfirmingAction('delete')}
                    disabled={actionLoading || saving}
                    title="Delete this project"
                    className="text-[var(--color-error)] hover:bg-[var(--color-error)]/10"
                  >
                    <Trash2 size={14} />
                    <span>Delete</span>
                  </Button>
                </>
              )}
            </div>
          )}

        </div>

      {/* Alert Modal for success/error messages */}
      {alertModal && (
        <AlertModal
          title={alertModal.title}
          message={alertModal.message}
          variant={alertModal.variant}
          onClose={() => setAlertModal(null)}
        />
      )}
    </AppModal>
  );
}
