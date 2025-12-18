import { useState, useEffect, useRef } from 'react';
import { api } from '../api';
import { AppModal } from './ui/AppModal';
import { MultiDepartmentSelect } from './ui/MultiDepartmentSelect';
import MarkdownViewer from './MarkdownViewer';
import { Spinner } from './ui/Spinner';
import { AIWriteAssist } from './ui/AIWriteAssist';
import { getDeptColor } from '../lib/colors';
import { Sparkles, FolderKanban, Check, RefreshCw, Edit3, FileText } from 'lucide-react';
import './ProjectModal.css';

/**
 * New Project Modal - Flexible creation flow:
 * Option A: AI-assisted - describe project, AI structures it, review/edit, confirm
 * Option B: Manual - skip AI and enter everything directly
 * Option C: From council session - auto-populate with council Q&A and process
 *
 * @param {Object} initialContext - Optional context from council session
 * @param {string} initialContext.userQuestion - The question user asked the council
 * @param {string} initialContext.councilResponse - The council's response
 */
export default function ProjectModal({ companyId, departments = [], onClose, onProjectCreated, initialContext }) {
  // Step state: 'input', 'review', or 'manual'
  const [step, setStep] = useState('input');
  const hasAutoProcessed = useRef(false);

  // Input state
  const [freeText, setFreeText] = useState('');
  const [selectedDeptIds, setSelectedDeptIds] = useState([]);

  // AI result state / editable fields
  const [editedName, setEditedName] = useState('');
  const [editedDescription, setEditedDescription] = useState('');
  const [editedContext, setEditedContext] = useState(''); // Editable context markdown

  // UI state
  const [structuring, setStructuring] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [editingContext, setEditingContext] = useState(false); // Toggle context edit mode
  const [isAIGenerated, setIsAIGenerated] = useState(false); // Track if AI was used

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
  }, [initialContext]);

  // Process with AI (can be called with custom text for auto-processing)
  const processWithAI = async (text) => {
    const inputText = text || freeText;
    if (!inputText.trim()) {
      setError('Please describe your project');
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
        setError('AI could not structure the content. Please try again or add more detail.');
      }
    } catch (err) {
      console.error('Failed to structure context:', err);
      setError('Failed to process with AI. Please try again.');
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
      setError('Project name is required');
      return;
    }

    try {
      setSaving(true);
      setError(null);

      // Use edited context if available, otherwise generate basic context
      const contextMd = editedContext.trim() || `# ${editedName.trim()}\n\n${editedDescription.trim() || 'No description provided.'}`;

      const result = await api.createProject(companyId, {
        name: editedName.trim(),
        description: editedDescription.trim() || null,
        context_md: contextMd,
        department_ids: selectedDeptIds.length > 0 ? selectedDeptIds : null,
        source: isAIGenerated ? 'ai' : 'manual',
      });

      onProjectCreated(result.project);
      onClose();
    } catch (err) {
      console.error('Failed to create project:', err);
      setError(err.message || 'Failed to create project');
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
    return 'Review & Edit';
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
              <button
                type="button"
                className="pm-btn-cancel"
                onClick={onClose}
                disabled={structuring}
              >
                Cancel
              </button>
              <button
                type="button"
                className="pm-btn-skip"
                onClick={handleSkipAI}
                disabled={structuring}
              >
                <FileText className="pm-btn-icon-small" />
                <span>Skip AI</span>
              </button>
              <button
                type="button"
                className="pm-btn-create"
                onClick={handleProcessWithAI}
                disabled={structuring || !freeText.trim()}
              >
                {structuring ? (
                  <>
                    <Spinner size="sm" variant="muted" />
                    <span>AI Processing...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="pm-btn-icon" />
                    <span>Create with AI</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* STEP 2: Review AI output */}
        {step === 'review' && (
          <div className="pm-form">
            {/* AI Success badge */}
            <div className="pm-ai-success">
              <Check className="pm-ai-success-icon" />
              <span>AI structured your project! Review and edit below.</span>
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
              <AIWriteAssist
                context="project-description"
                value={editedDescription}
                onSuggestion={setEditedDescription}
                additionalContext={editedName ? `Project: ${editedName}` : ''}
              >
                <textarea
                  id="project-desc"
                  value={editedDescription}
                  onChange={(e) => setEditedDescription(e.target.value)}
                  placeholder="Brief description..."
                  disabled={saving}
                  rows={3}
                />
              </AIWriteAssist>
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

            {/* Editable context - toggle between preview and edit */}
            <div className="pm-field">
              <div className="pm-context-header">
                <label>Project Context</label>
                <button
                  type="button"
                  className="pm-context-toggle"
                  onClick={() => setEditingContext(!editingContext)}
                  disabled={saving}
                >
                  {editingContext ? (
                    <>
                      <Sparkles className="pm-btn-icon-tiny" />
                      <span>Preview</span>
                    </>
                  ) : (
                    <>
                      <Edit3 className="pm-btn-icon-tiny" />
                      <span>Edit</span>
                    </>
                  )}
                </button>
              </div>
              {editingContext ? (
                <textarea
                  value={editedContext}
                  onChange={(e) => setEditedContext(e.target.value)}
                  placeholder="# Project Context\n\nAdd background info, goals, constraints..."
                  disabled={saving}
                  rows={10}
                  className="pm-context-editor"
                />
              ) : (
                <div className="pm-preview">
                  <div className="pm-preview-header">
                    <Sparkles className="pm-preview-icon" />
                    <span>Context injected when this project is selected</span>
                  </div>
                  <div className="pm-preview-content">
                    {editedContext ? (
                      <MarkdownViewer content={editedContext} />
                    ) : (
                      <p className="pm-no-context">No context yet. Click Edit to add.</p>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="pm-actions pm-actions-review">
              <button
                type="button"
                className="pm-btn-back"
                onClick={handleBackToEdit}
                disabled={saving}
              >
                <Edit3 className="pm-btn-icon-small" />
                <span>Edit Input</span>
              </button>
              <button
                type="button"
                className="pm-btn-regen"
                onClick={handleRegenerate}
                disabled={saving || structuring}
              >
                <RefreshCw className={`pm-btn-icon-small ${structuring ? 'pm-spinning' : ''}`} />
                <span>Regenerate</span>
              </button>
              <button
                type="button"
                className="pm-btn-create"
                onClick={handleSave}
                disabled={saving || !editedName.trim()}
              >
                {saving ? (
                  <>
                    <Spinner size="sm" variant="muted" />
                    <span>Creating...</span>
                  </>
                ) : (
                  <>
                    <Check className="pm-btn-icon" />
                    <span>Confirm & Create</span>
                  </>
                )}
              </button>
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
              <label htmlFor="manual-context">Project Context <span className="pm-optional">(optional)</span></label>
              <textarea
                id="manual-context"
                value={editedContext}
                onChange={(e) => setEditedContext(e.target.value)}
                placeholder="# Project Context&#10;&#10;Add background info, goals, constraints, technical requirements..."
                disabled={saving}
                rows={8}
                className="pm-context-editor"
              />
              <p className="pm-field-hint">Supports Markdown formatting. This context will be injected into AI council sessions.</p>
            </div>

            {/* Actions */}
            <div className="pm-actions">
              <button
                type="button"
                className="pm-btn-cancel"
                onClick={onClose}
                disabled={saving}
              >
                Cancel
              </button>
              <button
                type="button"
                className="pm-btn-back"
                onClick={() => setStep('input')}
                disabled={saving}
              >
                <Sparkles className="pm-btn-icon-small" />
                <span>Use AI</span>
              </button>
              <button
                type="button"
                className="pm-btn-create"
                onClick={handleSave}
                disabled={saving || !editedName.trim()}
              >
                {saving ? (
                  <>
                    <Spinner size="sm" variant="muted" />
                    <span>Creating...</span>
                  </>
                ) : (
                  <>
                    <Check className="pm-btn-icon" />
                    <span>Create Project</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}
    </AppModal>
  );
}
