import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../api';
import { AppModal } from './ui/AppModal';
import { Button } from './ui/button';
import { MultiDepartmentSelect } from './ui/MultiDepartmentSelect';
import MarkdownViewer from './MarkdownViewer';
import { Spinner } from './ui/Spinner';
import { AIWriteAssist } from './ui/AIWriteAssist';
import { Sparkles, Check, RefreshCw, Edit3, FileText, CheckCircle2 } from 'lucide-react';
import { logger } from '../utils/logger';
import { hapticSuccess } from '../lib/haptics';
import { CELEBRATION } from '../lib/animation-constants';
import type { Department, Project } from '../types/business';
import './project-modal/index.css';

interface InitialContext {
  userQuestion?: string;
  councilResponse?: string;
  departmentIds?: string[];
}

interface ExtendedProject extends Project {
  context_md?: string;
}

interface ProjectModalProps {
  companyId: string;
  departments?: Department[];
  onClose: () => void;
  onProjectCreated?: (project: ExtendedProject) => void;
  initialContext?: InitialContext;
}

/**
 * New Project Modal - Flexible creation flow:
 * Option A: AI-assisted - describe project, AI structures it, review/edit, confirm
 * Option B: Manual - skip AI and enter everything directly
 * Option C: From council session - auto-populate with council Q&A and process
 *
 * @param {Object} initialContext - Optional context from council session
 * @param {string} initialContext.userQuestion - The question user asked the council
 * @param {string} initialContext.councilResponse - The council's response
 * @param {string[]} initialContext.departmentIds - Pre-selected department IDs from Stage3
 */
export default function ProjectModal({
  companyId,
  departments = [],
  onClose,
  onProjectCreated,
  initialContext,
}: ProjectModalProps) {
  const { t } = useTranslation();
  // Step state: 'input', 'review', 'manual', or 'success'
  const [step, setStep] = useState('input');
  const hasAutoProcessed = useRef(false);
  const createdProjectRef = useRef(null);

  // Input state
  const [freeText, setFreeText] = useState('');
  // Initialize with departments from initialContext if provided (from Stage3 selection)
  const [selectedDeptIds, setSelectedDeptIds] = useState(initialContext?.departmentIds || []);

  // AI result state / editable fields
  const [editedName, setEditedName] = useState('');
  const [editedDescription, setEditedDescription] = useState('');
  const [editedContext, setEditedContext] = useState(''); // Editable context markdown

  // UI state
  const [structuring, setStructuring] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isAIGenerated, setIsAIGenerated] = useState(false); // Track if AI was used
  const [isEditingDetails, setIsEditingDetails] = useState(false); // Toggle between view/edit for project details

  // Auto-process when initialContext is provided (from council session)
  useEffect(() => {
    if (initialContext && !hasAutoProcessed.current) {
      hasAutoProcessed.current = true;

      // Build the context text from council Q&A
      const contextText = [
        initialContext.userQuestion && `Question: ${initialContext.userQuestion}`,
        initialContext.councilResponse && `Council Response:\n${initialContext.councilResponse}`,
      ]
        .filter(Boolean)
        .join('\n\n');

      if (contextText) {
        setFreeText(contextText);
        // Auto-trigger AI processing
        processWithAI(contextText);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- Only run once on mount with initial context
  }, [initialContext]);

  // Process with AI (can be called with custom text for auto-processing)
  const processWithAI = async (text?: string) => {
    const inputText = text || freeText;
    if (!inputText.trim()) {
      setError(t('modals.tellUsAboutProject'));
      return;
    }

    setStructuring(true);
    setError(null);

    try {
      // Pass companyId for usage tracking
      const result = await api.structureProjectContext(inputText, '', companyId);
      if (result?.structured) {
        setEditedName(result.structured.suggested_name || '');
        setEditedDescription(result.structured.description || '');
        setEditedContext(result.structured.context_md || '');
        setIsAIGenerated(true);
        setStep('review');
      } else {
        setError(t('modals.couldntUnderstand'));
      }
    } catch (err) {
      logger.error('Failed to structure context:', err);
      setError(t('modals.aiWentWrong'));
    } finally {
      setStructuring(false);
    }
  };

  // Step 1: Process with AI and move to review (wrapper for button click)
  const handleProcessWithAI = () => processWithAI();

  // Skip AI - go directly to manual entry
  const handleSkipAI = () => {
    setEditedName('');
    setEditedDescription('');
    setEditedContext('');
    setIsAIGenerated(false);
    setStep('manual');
  };

  // Save the project (works for both AI-assisted and manual)
  const handleSave = async () => {
    if (!editedName.trim()) {
      setError(t('modals.projectNeedsName'));
      return;
    }

    try {
      setSaving(true);
      setError(null);

      // Use edited context if available, otherwise generate basic context
      const contextMd =
        editedContext.trim() ||
        `# ${editedName.trim()}\n\n${editedDescription.trim() || 'No description provided.'}`;

      // Build project data, only including optional fields if they have values
      // (required by exactOptionalPropertyTypes)
      const projectData: {
        name: string;
        description?: string;
        context_md?: string;
        department_ids?: string[];
        source?: 'ai' | 'manual';
      } = {
        name: editedName.trim(),
        context_md: contextMd,
        source: isAIGenerated ? 'ai' : 'manual',
      };
      if (editedDescription.trim()) {
        projectData.description = editedDescription.trim();
      }
      if (selectedDeptIds.length > 0) {
        projectData.department_ids = selectedDeptIds;
      }

      const result = await api.createProject(companyId, projectData);

      // Store the created project and show success state
      createdProjectRef.current = result.project;
      setSaving(false);
      setStep('success');
      hapticSuccess();

      // Auto-close after celebration - give user time to read success message
      setTimeout(() => {
        onProjectCreated?.(result.project);
        onClose();
      }, CELEBRATION.PROJECT_SUCCESS);
    } catch (err) {
      logger.error('Failed to create project:', err);
      setError(err instanceof Error ? err.message : t('modals.couldntCreateProject'));
      setSaving(false);
    }
  };

  // Go back to edit the input
  const handleBackToEdit = () => {
    setStep('input');
    setError(null);
  };

  // Regenerate AI output
  const handleRegenerate = () => {
    handleProcessWithAI();
  };

  // Get title based on step
  const getTitle = () => {
    if (step === 'input') return t('modals.newProject');
    if (step === 'manual') return t('modals.createProject');
    if (step === 'success') return t('modals.projectCreated');
    return t('modals.reviewProject');
  };

  return (
    <AppModal
      isOpen={true}
      onClose={onClose}
      title={getTitle()}
      size="md"
      contentClassName="pm-modal-body"
    >
      {/* Error */}
      {error && (
        <div className="pm-error">
          <span>⚠️</span>
          <span>{error}</span>
        </div>
      )}

      {/* STEP 1: Input */}
      {step === 'input' && (
        <div className="pm-form">
          {/* AI Intro */}
          <div className="pm-field pm-context-field">
            <div className="pm-ai-intro">
              <Sparkles className="pm-ai-intro-icon" />
              <span>{t('modals.aiIntro')}</span>
            </div>
            <textarea
              id="project-context"
              value={freeText}
              onChange={(e) => setFreeText(e.target.value)}
              placeholder={t('modals.projectPlaceholder')}
              disabled={structuring}
              rows={5}
              autoFocus
              enterKeyHint="done"
            />
            {structuring && (
              <div className="pm-ai-structuring">
                <Spinner size="sm" variant="brand" />
                <span>{t('modals.aiStructuring')}</span>
              </div>
            )}
          </div>

          {/* Departments - multi-select */}
          <div className="pm-field">
            <label>
              {t('modals.department')} <span className="pm-optional">({t('common.optional')})</span>
            </label>
            <MultiDepartmentSelect
              value={selectedDeptIds}
              onValueChange={setSelectedDeptIds}
              departments={departments}
              placeholder={t('modals.department')}
              disabled={structuring}
            />
          </div>

          {/* Actions */}
          <div className="pm-actions">
            <Button type="button" variant="outline" onClick={onClose} disabled={structuring}>
              {t('common.cancel')}
            </Button>
            <Button type="button" variant="ghost" onClick={handleSkipAI} disabled={structuring}>
              <FileText size={16} />
              {t('modals.skipAI')}
            </Button>
            <Button
              type="button"
              variant="default"
              onClick={handleProcessWithAI}
              disabled={structuring || !freeText.trim()}
            >
              {structuring ? (
                <>
                  <Spinner size="sm" variant="muted" />
                  {t('modals.aiProcessing')}
                </>
              ) : (
                <>
                  <Sparkles size={16} />
                  {t('modals.createWithAI')}
                </>
              )}
            </Button>
          </div>
        </div>
      )}

      {/* STEP 2: Review AI output */}
      {step === 'review' && (
        <div className="pm-form">
          {/* AI Success badge */}
          <div className="pm-ai-success">
            <Check className="pm-ai-success-icon" />
            <span>{t('modals.aiCreatedProject')}</span>
          </div>

          {/* Editable Name */}
          <div className="pm-field">
            <label htmlFor="project-name">{t('modals.projectName')}</label>
            <input
              id="project-name"
              type="text"
              value={editedName}
              onChange={(e) => setEditedName(e.target.value)}
              placeholder={t('modals.projectName')}
              disabled={saving}
              autoFocus
            />
          </div>

          {/* Editable Description */}
          <div className="pm-field">
            <label htmlFor="project-desc">{t('modals.projectDescription')}</label>
            <textarea
              id="project-desc"
              value={editedDescription}
              onChange={(e) => setEditedDescription(e.target.value)}
              placeholder={t('modals.briefDescription')}
              disabled={saving}
              rows={2}
              enterKeyHint="next"
            />
          </div>

          {/* Departments - always show selector, no toggle needed */}
          <div className="pm-field">
            <label>{t('modals.department')}</label>
            <MultiDepartmentSelect
              value={selectedDeptIds}
              onValueChange={setSelectedDeptIds}
              departments={departments}
              placeholder={t('modals.department')}
              disabled={saving}
            />
          </div>

          {/* Project Details - show formatted, click to edit */}
          <div className="pm-field">
            <div className="pm-context-header">
              <label>{t('modals.projectDetails')}</label>
              {!isEditingDetails ? (
                <button
                  type="button"
                  className="pm-context-toggle"
                  onClick={() => setIsEditingDetails(true)}
                  disabled={saving}
                >
                  <Edit3 className="pm-btn-icon-tiny" />
                  <span>{t('common.edit')}</span>
                </button>
              ) : (
                <button
                  type="button"
                  className="pm-context-toggle"
                  onClick={() => setIsEditingDetails(false)}
                  disabled={saving}
                >
                  <Check className="pm-btn-icon-tiny" />
                  <span>{t('common.done')}</span>
                </button>
              )}
            </div>
            {isEditingDetails ? (
              <AIWriteAssist
                context="project-context"
                value={editedContext}
                onSuggestion={setEditedContext}
                additionalContext={
                  editedName
                    ? `Project: ${editedName}\nDescription: ${editedDescription || 'None'}`
                    : ''
                }
              >
                <textarea
                  value={editedContext}
                  onChange={(e) => setEditedContext(e.target.value)}
                  placeholder={t('modals.addProjectDetails')}
                  disabled={saving}
                  rows={8}
                  className="pm-context-editor"
                  autoFocus
                />
              </AIWriteAssist>
            ) : (
              <div className="pm-preview" onClick={() => setIsEditingDetails(true)}>
                <div className="pm-preview-content clickable">
                  {editedContext ? (
                    <MarkdownViewer content={editedContext} />
                  ) : (
                    <p className="pm-no-context">{t('modals.clickToAddDetails')}</p>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="pm-actions pm-actions-review">
            <Button type="button" variant="ghost" onClick={handleBackToEdit} disabled={saving}>
              <Edit3 size={16} />
              {t('modals.startOver')}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={handleRegenerate}
              disabled={saving || structuring}
            >
              <RefreshCw size={16} className={structuring ? 'pm-spinning' : ''} />
              {t('modals.tryAgain')}
            </Button>
            <Button
              type="button"
              variant="default"
              onClick={handleSave}
              disabled={saving || !editedName.trim()}
            >
              {saving ? (
                <>
                  <Spinner size="sm" variant="muted" />
                  {t('common.saving')}
                </>
              ) : (
                <>
                  <Check size={16} />
                  {t('common.save')}
                </>
              )}
            </Button>
          </div>
        </div>
      )}

      {/* MANUAL: Direct entry without AI */}
      {step === 'manual' && (
        <div className="pm-form">
          {/* Manual mode badge */}
          <div className="pm-manual-badge">
            <FileText className="pm-manual-badge-icon" />
            <span>{t('modals.manualEntry')}</span>
          </div>

          {/* Project Name */}
          <div className="pm-field">
            <label htmlFor="manual-name">
              {t('modals.projectName')} <span className="pm-required">*</span>
            </label>
            <input
              id="manual-name"
              type="text"
              value={editedName}
              onChange={(e) => setEditedName(e.target.value)}
              placeholder={t('modals.enterProjectName')}
              disabled={saving}
              autoFocus
            />
          </div>

          {/* Description */}
          <div className="pm-field">
            <label htmlFor="manual-desc">
              {t('modals.projectDescription')}{' '}
              <span className="pm-optional">({t('common.optional')})</span>
            </label>
            <textarea
              id="manual-desc"
              value={editedDescription}
              onChange={(e) => setEditedDescription(e.target.value)}
              placeholder={t('modals.briefDescription')}
              disabled={saving}
              rows={3}
              enterKeyHint="next"
            />
          </div>

          {/* Departments */}
          <div className="pm-field">
            <label>
              {t('modals.department')} <span className="pm-optional">({t('common.optional')})</span>
            </label>
            <MultiDepartmentSelect
              value={selectedDeptIds}
              onValueChange={setSelectedDeptIds}
              departments={departments}
              placeholder={t('modals.department')}
              disabled={saving}
            />
          </div>

          {/* Context */}
          <div className="pm-field">
            <label htmlFor="manual-context">
              {t('modals.projectDetails')}{' '}
              <span className="pm-optional">({t('common.optional')})</span>
            </label>
            <AIWriteAssist
              context="project-context"
              value={editedContext}
              onSuggestion={setEditedContext}
              additionalContext={
                editedName
                  ? `Project: ${editedName}\nDescription: ${editedDescription || 'None'}`
                  : ''
              }
            >
              <textarea
                id="manual-context"
                value={editedContext}
                onChange={(e) => setEditedContext(e.target.value)}
                placeholder={t('modals.addProjectDetails')}
                disabled={saving}
                rows={8}
                className="pm-context-editor"
                enterKeyHint="done"
              />
            </AIWriteAssist>
            <p className="pm-field-hint">{t('modals.aiUsesInfo')}</p>
          </div>

          {/* Actions */}
          <div className="pm-actions">
            <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
              {t('common.cancel')}
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setStep('input')}
              disabled={saving}
            >
              <Sparkles size={16} />
              {t('modals.useAI')}
            </Button>
            <Button
              type="button"
              variant="default"
              onClick={handleSave}
              disabled={saving || !editedName.trim()}
            >
              {saving ? (
                <>
                  <Spinner size="sm" variant="muted" />
                  {t('modals.creating')}
                </>
              ) : (
                <>
                  <Check size={16} />
                  {t('modals.createProject')}
                </>
              )}
            </Button>
          </div>
        </div>
      )}

      {/* SUCCESS: Celebration moment */}
      {step === 'success' && (
        <div className="pm-success-state">
          <div className="pm-success-icon-wrapper">
            <CheckCircle2 className="pm-success-icon animate-success-pop" />
          </div>
          <h3 className="pm-success-title">
            {editedName || t('modals.projectName')} {t('modals.projectCreated').replace('!', '')}!
          </h3>
          <p className="pm-success-message">{t('modals.projectReady')}</p>
        </div>
      )}
    </AppModal>
  );
}
