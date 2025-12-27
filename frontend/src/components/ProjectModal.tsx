import { useState, useEffect, useRef } from 'react';
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
import type { Department, Project } from '../types/business';
import './ProjectModal.css';

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
export default function ProjectModal({ companyId, departments = [], onClose, onProjectCreated, initialContext }: ProjectModalProps) {
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
        initialContext.councilResponse && `Council Response:\n${initialContext.councilResponse}`
      ].filter(Boolean).join('\n\n');

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
      setError('Tell us a bit about your project first');
      return;
    }

    setStructuring(true);
    setError(null);

    try {
      const result = await api.structureProjectContext(inputText);
      if (result?.structured) {
        setEditedName(result.structured.suggested_name || '');
        setEditedDescription(result.structured.description || '');
        setEditedContext(result.structured.context_md || '');
        setIsAIGenerated(true);
        setStep('review');
      } else {
        setError("We couldn't quite understand that. Try adding more detail, or skip AI and enter it manually.");
      }
    } catch (err) {
      logger.error('Failed to structure context:', err);
      setError("Something went wrong with AI. You can try again or skip to manual entry.");
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
      setError('Your project needs a name');
      return;
    }

    try {
      setSaving(true);
      setError(null);

      // Use edited context if available, otherwise generate basic context
      const contextMd = editedContext.trim() || `# ${editedName.trim()}\n\n${editedDescription.trim() || 'No description provided.'}`;

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

      // Auto-close after celebration
      setTimeout(() => {
        onProjectCreated?.(result.project);
        onClose();
      }, 1200);
    } catch (err) {
      logger.error('Failed to create project:', err);
      setError(err instanceof Error ? err.message : "Couldn't create your project. Please try again.");
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
    if (step === 'input') return 'New Project';
    if (step === 'manual') return 'Create Project';
    if (step === 'success') return 'Project Created';
    return 'Review Your Project';
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
                <span>Just describe your project - AI will structure it beautifully</span>
              </div>
              <textarea
                id="project-context"
                value={freeText}
                onChange={(e) => setFreeText(e.target.value)}
                placeholder="What's this project about? Goals, constraints, background... just type whatever comes to mind"
                disabled={structuring}
                rows={5}
                autoFocus
                enterKeyHint="done"
              />
              {structuring && (
                <div className="pm-ai-structuring">
                  <Spinner size="sm" variant="brand" />
                  <span>AI is structuring your project...</span>
                </div>
              )}
            </div>

            {/* Departments - multi-select */}
            <div className="pm-field">
              <label>Departments <span className="pm-optional">(optional)</span></label>
              <MultiDepartmentSelect
                value={selectedDeptIds}
                onValueChange={setSelectedDeptIds}
                departments={departments}
                placeholder="Select departments"
                disabled={structuring}
              />
            </div>

            {/* Actions */}
            <div className="pm-actions">
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                disabled={structuring}
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={handleSkipAI}
                disabled={structuring}
              >
                <FileText size={16} />
                Skip AI
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
                    AI Processing...
                  </>
                ) : (
                  <>
                    <Sparkles size={16} />
                    Create with AI
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
              <span>AI created your project. Make any changes you want, then save.</span>
            </div>

            {/* Editable Name */}
            <div className="pm-field">
              <label htmlFor="project-name">Project Name</label>
              <input
                id="project-name"
                type="text"
                value={editedName}
                onChange={(e) => setEditedName(e.target.value)}
                placeholder="Project name"
                disabled={saving}
                autoFocus
              />
            </div>

            {/* Editable Description */}
            <div className="pm-field">
              <label htmlFor="project-desc">Description</label>
              <textarea
                id="project-desc"
                value={editedDescription}
                onChange={(e) => setEditedDescription(e.target.value)}
                placeholder="One or two sentences about what this project is for..."
                disabled={saving}
                rows={2}
                enterKeyHint="next"
              />
            </div>

            {/* Departments - always show selector, no toggle needed */}
            <div className="pm-field">
              <label>Departments</label>
              <MultiDepartmentSelect
                value={selectedDeptIds}
                onValueChange={setSelectedDeptIds}
                departments={departments}
                placeholder="Select departments"
                disabled={saving}
              />
            </div>

            {/* Project Details - show formatted, click to edit */}
            <div className="pm-field">
              <div className="pm-context-header">
                <label>Project Details</label>
                {!isEditingDetails ? (
                  <button
                    type="button"
                    className="pm-context-toggle"
                    onClick={() => setIsEditingDetails(true)}
                    disabled={saving}
                  >
                    <Edit3 className="pm-btn-icon-tiny" />
                    <span>Edit</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    className="pm-context-toggle"
                    onClick={() => setIsEditingDetails(false)}
                    disabled={saving}
                  >
                    <Check className="pm-btn-icon-tiny" />
                    <span>Done</span>
                  </button>
                )}
              </div>
              {isEditingDetails ? (
                <AIWriteAssist
                  context="project-context"
                  value={editedContext}
                  onSuggestion={setEditedContext}
                  additionalContext={editedName ? `Project: ${editedName}\nDescription: ${editedDescription || 'None'}` : ''}
                >
                  <textarea
                    value={editedContext}
                    onChange={(e) => setEditedContext(e.target.value)}
                    placeholder="Add any details about your project - goals, background, constraints, requirements..."
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
                      <p className="pm-no-context">Click to add project details...</p>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="pm-actions pm-actions-review">
              <Button
                type="button"
                variant="ghost"
                onClick={handleBackToEdit}
                disabled={saving}
                title="Go back and change your original description"
              >
                <Edit3 size={16} />
                Start Over
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={handleRegenerate}
                disabled={saving || structuring}
                title="Ask AI to write this differently"
              >
                <RefreshCw size={16} className={structuring ? 'pm-spinning' : ''} />
                Try Again
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
                    Saving...
                  </>
                ) : (
                  <>
                    <Check size={16} />
                    Save
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
              <span>Manual entry - create your project from scratch</span>
            </div>

            {/* Project Name */}
            <div className="pm-field">
              <label htmlFor="manual-name">Project Name <span className="pm-required">*</span></label>
              <input
                id="manual-name"
                type="text"
                value={editedName}
                onChange={(e) => setEditedName(e.target.value)}
                placeholder="Enter project name"
                disabled={saving}
                autoFocus
              />
            </div>

            {/* Description */}
            <div className="pm-field">
              <label htmlFor="manual-desc">Description <span className="pm-optional">(optional)</span></label>
              <textarea
                id="manual-desc"
                value={editedDescription}
                onChange={(e) => setEditedDescription(e.target.value)}
                placeholder="Brief description of the project..."
                disabled={saving}
                rows={3}
                enterKeyHint="next"
              />
            </div>

            {/* Departments */}
            <div className="pm-field">
              <label>Departments <span className="pm-optional">(optional)</span></label>
              <MultiDepartmentSelect
                value={selectedDeptIds}
                onValueChange={setSelectedDeptIds}
                departments={departments}
                placeholder="Select departments"
                disabled={saving}
              />
            </div>

            {/* Context */}
            <div className="pm-field">
              <label htmlFor="manual-context">Project Details <span className="pm-optional">(optional)</span></label>
              <AIWriteAssist
                context="project-context"
                value={editedContext}
                onSuggestion={setEditedContext}
                additionalContext={editedName ? `Project: ${editedName}\nDescription: ${editedDescription || 'None'}` : ''}
              >
                <textarea
                  id="manual-context"
                  value={editedContext}
                  onChange={(e) => setEditedContext(e.target.value)}
                  placeholder="What should the AI know about this project? Add goals, background, constraints, technical details..."
                  disabled={saving}
                  rows={8}
                  className="pm-context-editor"
                  enterKeyHint="done"
                />
              </AIWriteAssist>
              <p className="pm-field-hint">AI will use this info when you ask questions about this project.</p>
            </div>

            {/* Actions */}
            <div className="pm-actions">
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                disabled={saving}
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => setStep('input')}
                disabled={saving}
              >
                <Sparkles size={16} />
                Use AI
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
                    Creating...
                  </>
                ) : (
                  <>
                    <Check size={16} />
                    Create Project
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
            <h3 className="pm-success-title">{editedName || 'Project'} Created!</h3>
            <p className="pm-success-message">Your project is ready. Redirecting...</p>
          </div>
        )}
    </AppModal>
  );
}
