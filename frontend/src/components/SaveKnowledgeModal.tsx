import { useState, useEffect, KeyboardEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../api';
import { logger } from '../utils/logger';
import { AppModal } from './ui/AppModal';
import { Button } from './ui/button';
import { Spinner } from './ui/Spinner';
import { AIWriteAssist } from './ui/AIWriteAssist';
import { toast } from './ui/sonner';
import type { Project } from '../types/business';
import './SaveKnowledgeModal.css';

/**
 * SaveKnowledgeModal - Save decisions to the knowledge base
 *
 * IMPORTANT: All extraction and sanitization is done by the backend.
 * The frontend is intentionally "dumb" - it sends data to the API and displays results.
 * This prevents garbage text (SQL, code snippets) from appearing in the UI.
 */

const log = logger.scope('SaveKnowledgeModal');

interface CategoryOption {
  id: string;
  label: string;
  description: string;
}

interface SaveModeOption {
  id: string;
  label: string;
  icon: string;
  description: string;
}

interface ScopeOption {
  id: string;
  label: string;
  description: string;
}

interface DepartmentOption {
  id: string;
  label: string;
}

interface SaveKnowledgeModalProps {
  isOpen: boolean;
  onClose: (saved?: boolean | undefined) => void;
  suggestedTitle?: string | undefined;
  suggestedSummary?: string | undefined;
  fullResponseText?: string | undefined;
  companyId: string;
  departmentId?: string | undefined;
  conversationId?: string | undefined;
  userQuestion?: string | undefined;
  projects?: Project[] | undefined;
  currentProjectId?: string | null | undefined;
  onProjectCreated?: ((project: Project) => void) | undefined;
}

const CATEGORIES: CategoryOption[] = [
  {
    id: 'technical_decision',
    label: 'Technical Decision',
    description: 'Architecture choices, tech stack decisions',
  },
  { id: 'ux_pattern', label: 'UX Pattern', description: 'UI/UX decisions and best practices' },
  { id: 'feature', label: 'Feature', description: 'New features and functionality' },
  { id: 'policy', label: 'Policy', description: 'Business rules and policies' },
  { id: 'process', label: 'Process', description: 'Workflows and procedures' },
  { id: 'general', label: 'General', description: 'General knowledge and guidance' },
];

// Save modes for progressive disclosure
const SAVE_MODES: SaveModeOption[] = [
  {
    id: 'just_save',
    label: 'Just Save',
    icon: '📄',
    description: "Save for reference, won't auto-inject into future councils",
  },
  {
    id: 'remember',
    label: 'Remember This',
    icon: '🧠',
    description: 'Auto-inject into future council sessions for this project/department',
  },
  {
    id: 'playbook',
    label: 'Make Playbook',
    icon: '📋',
    description: 'Promote to SOP/Framework/Policy for formal documentation',
  },
];

// Scope options
const SCOPES: ScopeOption[] = [
  { id: 'department', label: 'Department', description: 'Visible to this department only' },
  { id: 'company', label: 'Company-wide', description: 'Visible to all departments' },
  { id: 'project', label: 'Project Only', description: 'Visible only within this project' },
];

const DEPARTMENTS: DepartmentOption[] = [
  { id: 'technology', label: 'Technology' },
  { id: 'marketing', label: 'Marketing' },
  { id: 'operations', label: 'Operations' },
  { id: 'executive', label: 'Executive' },
  { id: 'ux', label: 'UX/Design' },
  { id: 'general', label: 'General' },
];

/**
 * Truncate text for display (simple, no regex extraction)
 */
function truncateForDisplay(text: string | undefined | null, maxLength = 150): string {
  if (!text) return '';
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - 3) + '...';
}

export default function SaveKnowledgeModal({
  isOpen,
  onClose,
  suggestedTitle,
  suggestedSummary: _suggestedSummary, // Reserved for future use
  fullResponseText, // The chairman's full response
  companyId,
  departmentId,
  conversationId,
  userQuestion, // The original user question
  projects = [],
  currentProjectId = null,
  onProjectCreated, // Callback when a new project is created
}: SaveKnowledgeModalProps) {
  const { t } = useTranslation();
  const [title, setTitle] = useState<string>('');
  const [summary, setSummary] = useState<string>('');
  const [category, setCategory] = useState<string>('technical_decision');
  const [categoryReason, setCategoryReason] = useState<string>('');
  const [originalCategory, setOriginalCategory] = useState<string | null>(null);
  const [department, setDepartment] = useState<string>(departmentId || 'technology');
  const [departmentReason, setDepartmentReason] = useState<string>('');
  const [originalDepartment, setOriginalDepartment] = useState<string | null>(null);
  const [projectId, setProjectId] = useState<string | null>(currentProjectId ?? null);
  const [saving, setSaving] = useState<boolean>(false);
  const [extracting, setExtracting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<boolean>(false);
  const [showFullQuestion, setShowFullQuestion] = useState<boolean>(false);
  const [contextSummary, setContextSummary] = useState<string>('');
  // Structured decision fields
  const [problemStatement, setProblemStatement] = useState<string>('');
  const [decisionText, setDecisionText] = useState<string>('');
  const [reasoning, setReasoning] = useState<string>('');
  // NEW: Knowledge consolidation fields
  const [saveMode, setSaveMode] = useState<string>('just_save'); // just_save, remember, playbook
  const [scope, setScope] = useState<string>('department'); // department, company, project
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState<string>('');
  // Project creation
  const [showProjectPreview, setShowProjectPreview] = useState<boolean>(false);
  const [extractingProject, setExtractingProject] = useState<boolean>(false);
  const [newProjectName, setNewProjectName] = useState<string>('');
  const [newProjectDescription, setNewProjectDescription] = useState<string>('');
  const [creatingProject, setCreatingProject] = useState<boolean>(false);
  const [availableProjects, setAvailableProjects] = useState<Project[]>(projects);

  // Sync projects prop
  useEffect(() => {
    setAvailableProjects(projects);
  }, [projects]);

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setError(null);
      setSuccess(false);
      setShowProjectPreview(false);
      setExtractingProject(false);
      setNewProjectName('');
      setNewProjectDescription('');
      // Reset knowledge consolidation fields
      setSaveMode('just_save');
      setScope('department');
      setTags([]);
      setTagInput('');
    }
  }, [isOpen]);

  // AI-powered extraction when modal opens
  // CRITICAL: Only send user question and chairman answer to backend
  // Backend handles all sanitization - frontend is intentionally dumb
  useEffect(() => {
    if (isOpen && userQuestion) {
      setProjectId(currentProjectId);
      setExtracting(true);
      setError(null);

      // Call backend extraction API
      // Backend will use AI if available, or sanitized fallback if not
      api
        .extractDecision(userQuestion, fullResponseText || '')
        .then((result) => {
          if (result.success && result.extracted) {
            const extracted = result.extracted;

            // Apply extracted values - backend guarantees clean, readable text
            setTitle(extracted.title || suggestedTitle || 'Council Discussion');
            setContextSummary(extracted.context_summary || '');
            setProblemStatement(extracted.problem_statement || '');
            setDecisionText(extracted.decision_text || '');
            setReasoning(extracted.reasoning || '');

            // Set department
            const dept = extracted.department || departmentId || 'technology';
            setDepartment(dept);
            setOriginalDepartment(dept);
            setDepartmentReason(
              extracted.used_ai
                ? 'AI extracted based on content analysis'
                : 'Auto-detected from content keywords'
            );

            // Set category
            const cat = extracted.category || 'technical_decision';
            setCategory(cat);
            setOriginalCategory(cat);
            setCategoryReason(
              extracted.used_ai
                ? 'AI extracted based on decision type'
                : 'Auto-detected from content keywords'
            );

            // Build summary from structured fields
            setSummary(
              [extracted.problem_statement, extracted.decision_text, extracted.reasoning]
                .filter(Boolean)
                .join(' | ')
            );
          } else {
            // API call succeeded but extraction failed - show editable placeholders
            log.warn('Extraction failed:', result.error);
            setTitle(suggestedTitle || 'Council Discussion');
            setContextSummary('');
            setProblemStatement('• Unable to extract automatically\n• Please edit manually');
            setDecisionText('• Review the council discussion\n• Enter the key decision');
            setReasoning('');
            setDepartment(departmentId || 'technology');
            setCategory('technical_decision');
          }
        })
        .catch((err) => {
          log.error('Extraction error:', err);
          // Network/API error - show editable placeholders
          setTitle(suggestedTitle || 'Council Discussion');
          setContextSummary('');
          setProblemStatement('• Unable to extract automatically\n• Please edit manually');
          setDecisionText('• Review the council discussion\n• Enter the key decision');
          setReasoning('');
          setDepartment(departmentId || 'technology');
          setCategory('technical_decision');
        })
        .finally(() => {
          setExtracting(false);
        });
    }
  }, [isOpen, fullResponseText, suggestedTitle, departmentId, currentProjectId, userQuestion]);

  // Show project preview form with AI-extracted data
  const handleShowProjectPreview = async () => {
    setShowProjectPreview(true);
    setExtractingProject(true);
    setError(null);

    try {
      // Call backend to extract project details
      // Backend handles sanitization - no garbage will come through
      // Pass companyId for usage tracking
      const result = await api.extractProject(
        userQuestion ?? '',
        fullResponseText ?? '',
        companyId
      );

      if (result.success && result.extracted) {
        setNewProjectName(result.extracted.name || 'New Project');
        setNewProjectDescription(result.extracted.description || '');
      } else {
        // Fallback - editable placeholders
        setNewProjectName(title || 'New Project');
        setNewProjectDescription(
          'Project created from council discussion.\n\nUse this project to track related decisions.'
        );
      }
    } catch (err) {
      log.error('Project extraction error:', err);
      setNewProjectName(title || 'New Project');
      setNewProjectDescription(
        'Project created from council discussion.\n\nUse this project to track related decisions.'
      );
    } finally {
      setExtractingProject(false);
    }
  };

  const handleCancelProjectPreview = () => {
    setShowProjectPreview(false);
    setNewProjectName('');
    setNewProjectDescription('');
  };

  const handleConfirmCreateProject = async () => {
    if (!newProjectName.trim()) {
      setError(t('modals.projectNameRequired'));
      return;
    }

    setCreatingProject(true);
    setError(null);

    try {
      const result = await api.createProject(companyId, {
        name: newProjectName.trim(),
        description: newProjectDescription.trim() || 'Project created from council discussion.',
      });

      if (result.project) {
        setAvailableProjects((prev) => [...prev, result.project]);
        setProjectId(result.project.id);
        setShowProjectPreview(false);
        toast.success(`"${newProjectName.trim()}" project created`, { duration: 3000 });
        setNewProjectName('');
        setNewProjectDescription('');
        // Notify parent so project appears in main dropdown
        if (onProjectCreated) {
          onProjectCreated(result.project);
        }
      }
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : t('modals.couldntCreateProjectRetry');
      setError(errorMessage);
    } finally {
      setCreatingProject(false);
    }
  };

  if (!isOpen) return null;

  // Add a tag
  const handleAddTag = () => {
    const tag = tagInput.trim().toLowerCase().replace(/\s+/g, '-');
    if (tag && !tags.includes(tag)) {
      setTags([...tags, tag]);
      setTagInput('');
    }
  };

  // Remove a tag
  const handleRemoveTag = (tagToRemove: string) => {
    setTags(tags.filter((t) => t !== tagToRemove));
  };

  // Handle tag input keypress
  const handleTagKeyPress = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      handleAddTag();
    }
  };

  const handleSave = async () => {
    if (!title.trim()) {
      setError(t('modals.titleRequired'));
      return;
    }
    if (!decisionText.trim()) {
      setError(t('modals.decisionRequiredError'));
      return;
    }

    // If playbook mode, we need to redirect to playbook creation (future enhancement)
    if (saveMode === 'playbook') {
      setError(t('modals.playbookComingSoon'));
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const effectiveSummary =
        summary.trim() || [problemStatement, decisionText, reasoning].filter(Boolean).join(' | ');

      // Determine auto_inject based on save mode
      const autoInject = saveMode === 'remember';

      // Use the user's selected scope - respect their choice from the dropdown
      // Only applies when saveMode === 'remember', otherwise default to 'department'
      const effectiveScope = saveMode === 'remember' ? scope : 'department';

      const payload = {
        company_id: companyId,
        title: title.trim(),
        content: effectiveSummary, // Use canonical content field
        category,
        department_ids: department ? [department] : [], // Use canonical array field
        project_id: projectId || null,
        source_conversation_id: conversationId || null,
        problem_statement: problemStatement.trim() || null,
        decision_text: decisionText.trim(),
        reasoning: reasoning.trim() || null,
        status: 'active',
        // Knowledge consolidation fields
        auto_inject: autoInject,
        scope: effectiveScope,
        tags: tags.length > 0 ? tags : null,
      };

      log.debug('Saving with payload:', payload);
      const result = await api.createKnowledgeEntry(payload);
      log.debug('Save successful:', result);

      // Show success toast and close modal
      const modeText =
        saveMode === 'remember'
          ? t('modals.decisionSavedRemembered')
          : t('modals.decisionSavedRef');
      toast.success(`"${title.trim()}" - ${modeText}`, { duration: 4000 });
      onClose(true); // Close modal immediately with saved=true
    } catch (err) {
      log.error('Save failed:', err);
      const errorMessage = err instanceof Error ? err.message : t('errors.saveFailed');
      setError(errorMessage);
    } finally {
      setSaving(false);
    }
  };

  return (
    <AppModal
      isOpen={isOpen}
      onClose={onClose}
      title={t('modals.saveToKnowledgeBase')}
      size="lg"
      contentClassName="save-knowledge-modal-body"
    >
      {success ? (
        <div className="success-message">
          <span className="success-icon">&#10003;</span>
          <p className="success-title">
            {saveMode === 'remember'
              ? t('modals.savedAndRemembered')
              : t('modals.savedToKnowledgeBase')}
          </p>
          <p className="success-detail">
            {saveMode === 'remember' ? t('modals.willAutoInject') : t('modals.savedForReference')}
          </p>
          <div className="success-location">
            <div className="success-location-row">
              <span className="success-location-label">{t('modals.department')}</span>
              <span className="success-location-value">
                {t(`knowledge.departments.${department}`, { defaultValue: department })}
              </span>
            </div>
            {projectId && (
              <div className="success-location-row">
                <span className="success-location-label">{t('company.projects')}</span>
                <span className="success-location-value">
                  {availableProjects.find((p) => p.id === projectId)?.name || t('company.projects')}
                </span>
              </div>
            )}
            <div className="success-location-row">
              <span className="success-location-label">{t('modals.category')}</span>
              <span className="success-location-value">
                {t(`knowledge.categories.${category.replace('_', '')}`, { defaultValue: category })}
              </span>
            </div>
          </div>
          <Button variant="default" onClick={() => onClose(true)}>
            {t('common.done')}
          </Button>
        </div>
      ) : extracting ? (
        <div className="extracting-message">
          <Spinner size="xl" variant="brand" />
          <p>{t('modals.aiExtractingInsights')}</p>
          <p className="extracting-hint">{t('modals.analyzingResponse')}</p>
        </div>
      ) : (
        <>
          <div className="modal-body">
            {/* Save Mode Selector - Progressive Disclosure */}
            <div className="save-mode-selector">
              <label className="save-mode-label">{t('modals.whatWouldYouDo')}</label>
              <div className="save-mode-options">
                {SAVE_MODES.map((mode) => (
                  <button
                    key={mode.id}
                    type="button"
                    className={`save-mode-option ${saveMode === mode.id ? 'selected' : ''}`}
                    onClick={() => setSaveMode(mode.id)}
                  >
                    <span className="save-mode-icon">{mode.icon}</span>
                    <span className="save-mode-text">
                      <span className="save-mode-name">
                        {mode.id === 'just_save'
                          ? t('modals.justSave')
                          : mode.id === 'remember'
                            ? t('modals.rememberThis')
                            : t('modals.makePlaybook')}
                      </span>
                      <span className="save-mode-desc">
                        {mode.id === 'just_save'
                          ? t('modals.justSaveDesc')
                          : mode.id === 'remember'
                            ? t('modals.rememberThisDesc')
                            : t('modals.makePlaybookDesc')}
                      </span>
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Show context: AI-cleaned summary of what was asked */}
            {(contextSummary || userQuestion) && (
              <div className="context-info">
                <div className="context-header">
                  <span className="context-label">{t('modals.context')}</span>
                  {!contextSummary && userQuestion && userQuestion.length > 150 && (
                    <button
                      type="button"
                      className="expand-btn"
                      onClick={() => setShowFullQuestion(!showFullQuestion)}
                    >
                      {showFullQuestion ? t('modals.showLess') : t('modals.showFull')}
                    </button>
                  )}
                </div>
                <p className="context-text">
                  {contextSummary ||
                    (showFullQuestion ? userQuestion : truncateForDisplay(userQuestion, 150))}
                </p>
              </div>
            )}

            <div className="form-group">
              <label htmlFor="knowledge-title">{t('modals.title')}</label>
              <AIWriteAssist
                context="decision-title"
                value={title}
                onSuggestion={setTitle}
                additionalContext={userQuestion ? `Question: ${userQuestion.slice(0, 200)}` : ''}
                inline
              >
                <input
                  id="knowledge-title"
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder={t('modals.titlePlaceholder')}
                  maxLength={200}
                />
              </AIWriteAssist>
              <p className="hint">{t('modals.titleHint')}</p>
            </div>

            <div className="form-row">
              <div className="form-group form-group-half">
                <label htmlFor="knowledge-department">{t('modals.department')}</label>
                <div className="field-with-tooltip">
                  <select
                    id="knowledge-department"
                    value={department}
                    onChange={(e) => setDepartment(e.target.value)}
                  >
                    {DEPARTMENTS.map((dept) => (
                      <option key={dept.id} value={dept.id}>
                        {t(`knowledge.departments.${dept.id}`, { defaultValue: dept.label })}
                        {dept.id === originalDepartment ? ' *' : ''}
                      </option>
                    ))}
                  </select>
                  {departmentReason && (
                    <span className="detection-tooltip" title={departmentReason}>
                      <span className="tooltip-icon">?</span>
                      <span className="tooltip-text">
                        <strong>{t('modals.suggested')}:</strong>{' '}
                        {t(
                          `knowledge.departments.${originalDepartment}` as 'knowledge.departments.executive',
                          { defaultValue: originalDepartment }
                        )}
                        <br />
                        <br />
                        <strong>{t('modals.why')}:</strong> {departmentReason}
                        {department !== originalDepartment && (
                          <>
                            <br />
                            <br />
                            <em className="tooltip-changed">{t('modals.changedFromSuggestion')}</em>
                          </>
                        )}
                      </span>
                    </span>
                  )}
                </div>
              </div>

              <div className="form-group form-group-half">
                <label htmlFor="knowledge-category">{t('modals.category')}</label>
                <div className="field-with-tooltip">
                  <select
                    id="knowledge-category"
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                  >
                    {CATEGORIES.map((cat) => (
                      <option key={cat.id} value={cat.id}>
                        {t(`knowledge.categories.${cat.id.replace('_', '')}`, {
                          defaultValue: cat.label,
                        })}
                        {cat.id === originalCategory ? ' *' : ''}
                      </option>
                    ))}
                  </select>
                  {categoryReason && (
                    <span className="detection-tooltip" title={categoryReason}>
                      <span className="tooltip-icon">?</span>
                      <span className="tooltip-text">
                        <strong>{t('modals.suggested')}:</strong>{' '}
                        {t(
                          `knowledge.categories.${originalCategory?.replace('_', '')}` as 'knowledge.categories.bestPractices',
                          { defaultValue: originalCategory ?? '' }
                        )}
                        <br />
                        <br />
                        <strong>{t('modals.why')}:</strong> {categoryReason}
                        {category !== originalCategory && (
                          <>
                            <br />
                            <br />
                            <em className="tooltip-changed">{t('modals.changedFromSuggestion')}</em>
                          </>
                        )}
                      </span>
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Project selector */}
            <div className="form-group">
              <label htmlFor="knowledge-project">
                {t('company.projects')} {currentProjectId ? '' : `(${t('common.optional')})`}
              </label>
              <select
                id="knowledge-project"
                value={projectId || ''}
                onChange={(e) => {
                  const val = e.target.value;
                  if (val === '__new__') {
                    handleShowProjectPreview();
                  } else if (val === '') {
                    setProjectId(null);
                  } else {
                    setProjectId(val);
                  }
                }}
                disabled={creatingProject || showProjectPreview}
              >
                {currentProjectId && availableProjects.find((p) => p.id === currentProjectId) && (
                  <option value={currentProjectId}>
                    {availableProjects.find((p) => p.id === currentProjectId)?.name}
                  </option>
                )}
                {availableProjects
                  .filter((p) => p.id !== currentProjectId)
                  .map((proj) => (
                    <option key={proj.id} value={proj.id}>
                      {proj.name}
                    </option>
                  ))}
                <option value="">{t('modals.noProjectCompanyWide')}</option>
                <option value="__new__">
                  {creatingProject ? t('modals.creatingOption') : t('modals.newProjectOption')}
                </option>
              </select>

              {/* Project preview/edit form */}
              {showProjectPreview ? (
                <div className="project-preview-form">
                  {extractingProject ? (
                    <div className="project-extracting">
                      <Spinner size="lg" variant="brand" />
                      <p>{t('modals.aiGeneratingDetails')}</p>
                      <span className="project-extracting-hint">
                        {t('modals.creatingClearName')}
                      </span>
                    </div>
                  ) : (
                    <>
                      <div className="project-preview-header">
                        <span className="project-preview-label">
                          {t('modals.newProjectDetails')}
                        </span>
                        <span className="project-preview-hint">
                          {t('modals.reviewEditBeforeCreating')}
                        </span>
                      </div>
                      <div className="project-preview-field">
                        <label htmlFor="new-project-name">{t('modals.projectName')}</label>
                        <input
                          id="new-project-name"
                          type="text"
                          value={newProjectName}
                          onChange={(e) => setNewProjectName(e.target.value)}
                          placeholder={t('modals.enterProjectName')}
                          disabled={creatingProject}
                          autoFocus
                        />
                      </div>
                      <div className="project-preview-field">
                        <label htmlFor="new-project-description">
                          {t('modals.projectDescription')}
                        </label>
                        <textarea
                          id="new-project-description"
                          value={newProjectDescription}
                          onChange={(e) => setNewProjectDescription(e.target.value)}
                          placeholder={t('modals.projectDescription')}
                          rows={4}
                          disabled={creatingProject}
                        />
                        <span className="field-hint">{t('modals.projectDescHelp')}</span>
                      </div>
                      <div className="project-preview-actions">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={handleCancelProjectPreview}
                          disabled={creatingProject}
                        >
                          {t('common.cancel')}
                        </Button>
                        <Button
                          type="button"
                          variant="default"
                          onClick={handleConfirmCreateProject}
                          disabled={creatingProject || !newProjectName.trim()}
                        >
                          {creatingProject ? t('modals.creating') : t('modals.createProject')}
                        </Button>
                      </div>
                    </>
                  )}
                </div>
              ) : (
                <p className="hint">
                  {creatingProject
                    ? t('modals.creatingProject')
                    : projectId
                      ? t('modals.savedToProject')
                      : t('modals.projectHint')}
                </p>
              )}
            </div>

            {/* Structured Decision Fields - compact layout */}
            <div className="form-group">
              <label htmlFor="knowledge-problem">{t('modals.problemQuestion')}</label>
              <textarea
                id="knowledge-problem"
                value={problemStatement}
                onChange={(e) => setProblemStatement(e.target.value)}
                placeholder={t('modals.problemPlaceholder')}
                rows={2}
                enterKeyHint="next"
              />
            </div>

            <div className="form-group">
              <label htmlFor="knowledge-decision">{t('modals.decisionRequired')}</label>
              <textarea
                id="knowledge-decision"
                value={decisionText}
                onChange={(e) => setDecisionText(e.target.value)}
                placeholder={t('modals.decisionPlaceholder')}
                rows={2}
                enterKeyHint="next"
              />
            </div>

            <div className="form-group">
              <label htmlFor="knowledge-reasoning">{t('modals.reasoning')}</label>
              <textarea
                id="knowledge-reasoning"
                value={reasoning}
                onChange={(e) => setReasoning(e.target.value)}
                placeholder={t('modals.reasoningPlaceholder')}
                rows={2}
                enterKeyHint="next"
              />
            </div>

            {/* Scope selector - only show for "Remember This" mode */}
            {saveMode === 'remember' && (
              <div className="form-group">
                <label htmlFor="knowledge-scope">{t('modals.visibilityScope')}</label>
                <select
                  id="knowledge-scope"
                  value={scope}
                  onChange={(e) => setScope(e.target.value)}
                >
                  {SCOPES.map((s) => (
                    <option key={s.id} value={s.id}>
                      {t(`knowledge.scopes.${s.id}`, { defaultValue: s.label })} -{' '}
                      {t(`knowledge.scopes.${s.id}Desc`, { defaultValue: s.description })}
                    </option>
                  ))}
                </select>
                <p className="hint">
                  {scope === 'company' && t('modals.scopeCompanyHint')}
                  {scope === 'department' && t('modals.scopeDepartmentHint')}
                  {scope === 'project' && t('modals.scopeProjectHint')}
                </p>
              </div>
            )}

            {/* Tags input */}
            <div className="form-group">
              <label htmlFor="knowledge-tags">{t('modals.tagsOptional')}</label>
              <div className="tags-input-container">
                <div className="tags-list">
                  {tags.map((tag) => (
                    <span key={tag} className="tag-chip">
                      {tag}
                      <button
                        type="button"
                        className="tag-remove"
                        onClick={() => handleRemoveTag(tag)}
                      >
                        &times;
                      </button>
                    </span>
                  ))}
                </div>
                <input
                  id="knowledge-tags"
                  type="text"
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={handleTagKeyPress}
                  onBlur={handleAddTag}
                  placeholder={t('modals.addTagsPlaceholder')}
                  enterKeyHint="enter"
                />
              </div>
              <p className="hint">{t('modals.tagsHint')}</p>
            </div>

            {error && <div className="error-message">{error}</div>}
          </div>

          <AppModal.Footer>
            <Button variant="outline" onClick={() => onClose()} disabled={saving}>
              {t('common.cancel')}
            </Button>
            <Button variant="default" onClick={handleSave} disabled={saving}>
              {saving
                ? t('common.saving')
                : saveMode === 'just_save'
                  ? t('common.save')
                  : saveMode === 'remember'
                    ? t('modals.saveAndRemember')
                    : t('modals.createPlaybook')}
            </Button>
          </AppModal.Footer>
        </>
      )}
    </AppModal>
  );
}
