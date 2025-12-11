import { useState, useEffect } from 'react';
import { api } from '../api';
import './SaveKnowledgeModal.css';

/**
 * SaveKnowledgeModal - Save decisions to the knowledge base
 *
 * IMPORTANT: All extraction and sanitization is done by the backend.
 * The frontend is intentionally "dumb" - it sends data to the API and displays results.
 * This prevents garbage text (SQL, code snippets) from appearing in the UI.
 */

const CATEGORIES = [
  { id: 'technical_decision', label: 'Technical Decision', description: 'Architecture choices, tech stack decisions' },
  { id: 'ux_pattern', label: 'UX Pattern', description: 'UI/UX decisions and best practices' },
  { id: 'feature', label: 'Feature', description: 'New features and functionality' },
  { id: 'policy', label: 'Policy', description: 'Business rules and policies' },
  { id: 'process', label: 'Process', description: 'Workflows and procedures' },
  { id: 'general', label: 'General', description: 'General knowledge and guidance' },
];

const DEPARTMENTS = [
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
function truncateForDisplay(text, maxLength = 150) {
  if (!text) return '';
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - 3) + '...';
}

export default function SaveKnowledgeModal({
  isOpen,
  onClose,
  suggestedTitle,
  suggestedSummary,
  fullResponseText,  // The chairman's full response
  companyId,
  departmentId,
  conversationId,
  userQuestion,  // The original user question
  projects = [],
  currentProjectId = null,
  onProjectCreated,  // Callback when a new project is created
}) {
  const [title, setTitle] = useState('');
  const [summary, setSummary] = useState('');
  const [category, setCategory] = useState('technical_decision');
  const [categoryReason, setCategoryReason] = useState('');
  const [originalCategory, setOriginalCategory] = useState(null);
  const [department, setDepartment] = useState(departmentId || 'technology');
  const [departmentReason, setDepartmentReason] = useState('');
  const [originalDepartment, setOriginalDepartment] = useState(null);
  const [projectId, setProjectId] = useState(currentProjectId);
  const [saving, setSaving] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const [showFullQuestion, setShowFullQuestion] = useState(false);
  const [contextSummary, setContextSummary] = useState('');
  // Structured decision fields
  const [problemStatement, setProblemStatement] = useState('');
  const [decisionText, setDecisionText] = useState('');
  const [reasoning, setReasoning] = useState('');
  // Project creation
  const [showProjectPreview, setShowProjectPreview] = useState(false);
  const [extractingProject, setExtractingProject] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectDescription, setNewProjectDescription] = useState('');
  const [creatingProject, setCreatingProject] = useState(false);
  const [availableProjects, setAvailableProjects] = useState(projects);

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
      api.extractDecision(userQuestion, fullResponseText || '')
        .then(result => {
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
            setDepartmentReason(extracted.used_ai
              ? 'AI extracted based on content analysis'
              : 'Auto-detected from content keywords');

            // Set category
            const cat = extracted.category || 'technical_decision';
            setCategory(cat);
            setOriginalCategory(cat);
            setCategoryReason(extracted.used_ai
              ? 'AI extracted based on decision type'
              : 'Auto-detected from content keywords');

            // Build summary from structured fields
            setSummary([extracted.problem_statement, extracted.decision_text, extracted.reasoning]
              .filter(Boolean).join(' | '));
          } else {
            // API call succeeded but extraction failed - show editable placeholders
            console.warn('Extraction failed:', result.error);
            setTitle(suggestedTitle || 'Council Discussion');
            setContextSummary('');
            setProblemStatement('• Unable to extract automatically\n• Please edit manually');
            setDecisionText('• Review the council discussion\n• Enter the key decision');
            setReasoning('');
            setDepartment(departmentId || 'technology');
            setCategory('technical_decision');
          }
        })
        .catch(err => {
          console.error('Extraction error:', err);
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
      const result = await api.extractProject(userQuestion, fullResponseText || '');

      if (result.success && result.extracted) {
        setNewProjectName(result.extracted.name || 'New Project');
        setNewProjectDescription(result.extracted.description || '');
      } else {
        // Fallback - editable placeholders
        setNewProjectName(title || 'New Project');
        setNewProjectDescription('Project created from council discussion.\n\nUse this project to track related decisions.');
      }
    } catch (err) {
      console.error('Project extraction error:', err);
      setNewProjectName(title || 'New Project');
      setNewProjectDescription('Project created from council discussion.\n\nUse this project to track related decisions.');
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
      setError('Project name is required');
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
        setAvailableProjects(prev => [...prev, result.project]);
        setProjectId(result.project.id);
        setShowProjectPreview(false);
        setNewProjectName('');
        setNewProjectDescription('');
        // Notify parent so project appears in main dropdown
        if (onProjectCreated) {
          onProjectCreated(result.project);
        }
      }
    } catch (err) {
      setError(err.message || 'Failed to create project');
    } finally {
      setCreatingProject(false);
    }
  };

  if (!isOpen) return null;

  const handleSave = async () => {
    if (!title.trim()) {
      setError('Title is required');
      return;
    }
    if (!decisionText.trim()) {
      setError('Decision is required - what was decided?');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const effectiveSummary = summary.trim() ||
        [problemStatement, decisionText, reasoning].filter(Boolean).join(' | ');

      const payload = {
        company_id: companyId,
        title: title.trim(),
        summary: effectiveSummary,
        category,
        department_id: department,
        project_id: projectId || null,
        source_conversation_id: conversationId || null,
        problem_statement: problemStatement.trim() || null,
        decision_text: decisionText.trim(),
        reasoning: reasoning.trim() || null,
        status: 'active',
      };

      console.log('[SaveKnowledge] Saving with payload:', payload);
      const result = await api.createKnowledgeEntry(payload);
      console.log('[SaveKnowledge] Save successful:', result);

      // Show success - user clicks "Done" to dismiss
      setSuccess(true);
    } catch (err) {
      console.error('[SaveKnowledge] Save failed:', err);
      setError(err.message || 'Failed to save knowledge entry');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="save-knowledge-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Save to Knowledge Base</h2>
          <button className="close-btn" onClick={onClose}>&times;</button>
        </div>

        {success ? (
          <div className="success-message">
            <span className="success-icon">&#10003;</span>
            <p className="success-title">Saved to Knowledge Base</p>
            <p className="success-detail">This decision will now inform future council discussions.</p>
            <div className="success-location">
              <div className="success-location-row">
                <span className="success-location-label">Department</span>
                <span className="success-location-value">
                  {DEPARTMENTS.find(d => d.id === department)?.label || department}
                </span>
              </div>
              {projectId && (
                <div className="success-location-row">
                  <span className="success-location-label">Project</span>
                  <span className="success-location-value">
                    {availableProjects.find(p => p.id === projectId)?.name || 'Selected Project'}
                  </span>
                </div>
              )}
              <div className="success-location-row">
                <span className="success-location-label">Category</span>
                <span className="success-location-value">
                  {CATEGORIES.find(c => c.id === category)?.label || category}
                </span>
              </div>
            </div>
            <button className="success-dismiss-btn" onClick={() => onClose(true)}>
              Done
            </button>
          </div>
        ) : extracting ? (
          <div className="extracting-message">
            <div className="extracting-spinner"></div>
            <p>AI is extracting key insights...</p>
            <p className="extracting-hint">Analyzing the council response to identify the important decision</p>
          </div>
        ) : (
          <>
            <div className="modal-body">
              {/* Show context: AI-cleaned summary of what was asked */}
              {(contextSummary || userQuestion) && (
                <div className="context-info">
                  <div className="context-header">
                    <span className="context-label">Context</span>
                    {!contextSummary && userQuestion && userQuestion.length > 150 && (
                      <button
                        type="button"
                        className="expand-btn"
                        onClick={() => setShowFullQuestion(!showFullQuestion)}
                      >
                        {showFullQuestion ? 'Show less' : 'Show full'}
                      </button>
                    )}
                  </div>
                  <p className="context-text">
                    {contextSummary || (showFullQuestion ? userQuestion : truncateForDisplay(userQuestion, 150))}
                  </p>
                </div>
              )}

              <div className="form-group">
                <label htmlFor="knowledge-title">Title</label>
                <input
                  id="knowledge-title"
                  type="text"
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  placeholder="e.g., Supabase-based Context Storage Decision"
                  maxLength={200}
                />
                <p className="hint">A clear, searchable title for this decision or pattern</p>
              </div>

              <div className="form-row">
                <div className="form-group form-group-half">
                  <label htmlFor="knowledge-department">Department</label>
                  <div className="field-with-tooltip">
                    <select
                      id="knowledge-department"
                      value={department}
                      onChange={e => setDepartment(e.target.value)}
                    >
                      {DEPARTMENTS.map(dept => (
                        <option key={dept.id} value={dept.id}>
                          {dept.label}{dept.id === originalDepartment ? ' *' : ''}
                        </option>
                      ))}
                    </select>
                    {departmentReason && (
                      <span className="detection-tooltip" title={departmentReason}>
                        <span className="tooltip-icon">?</span>
                        <span className="tooltip-text">
                          <strong>Suggested:</strong> {DEPARTMENTS.find(d => d.id === originalDepartment)?.label || originalDepartment}
                          <br /><br />
                          <strong>Why:</strong> {departmentReason}
                          {department !== originalDepartment && (
                            <>
                              <br /><br />
                              <em className="tooltip-changed">You changed this from the suggestion</em>
                            </>
                          )}
                        </span>
                      </span>
                    )}
                  </div>
                </div>

                <div className="form-group form-group-half">
                  <label htmlFor="knowledge-category">Category</label>
                  <div className="field-with-tooltip">
                    <select
                      id="knowledge-category"
                      value={category}
                      onChange={e => setCategory(e.target.value)}
                    >
                      {CATEGORIES.map(cat => (
                        <option key={cat.id} value={cat.id}>
                          {cat.label}{cat.id === originalCategory ? ' *' : ''}
                        </option>
                      ))}
                    </select>
                    {categoryReason && (
                      <span className="detection-tooltip" title={categoryReason}>
                        <span className="tooltip-icon">?</span>
                        <span className="tooltip-text">
                          <strong>Suggested:</strong> {CATEGORIES.find(c => c.id === originalCategory)?.label || originalCategory}
                          <br /><br />
                          <strong>Why:</strong> {categoryReason}
                          {category !== originalCategory && (
                            <>
                              <br /><br />
                              <em className="tooltip-changed">You changed this from the suggestion</em>
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
                  Project {currentProjectId ? '' : '(optional)'}
                </label>
                <select
                  id="knowledge-project"
                  value={projectId || ''}
                  onChange={e => {
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
                  {currentProjectId && availableProjects.find(p => p.id === currentProjectId) && (
                    <option value={currentProjectId}>
                      {availableProjects.find(p => p.id === currentProjectId)?.name}
                    </option>
                  )}
                  {availableProjects
                    .filter(p => p.id !== currentProjectId)
                    .map(proj => (
                      <option key={proj.id} value={proj.id}>
                        {proj.name}
                      </option>
                    ))}
                  <option value="">No Project (company-wide)</option>
                  <option value="__new__">
                    {creatingProject ? 'Creating project...' : '+ Create New Project'}
                  </option>
                </select>

                {/* Project preview/edit form */}
                {showProjectPreview ? (
                  <div className="project-preview-form">
                    {extractingProject ? (
                      <div className="project-extracting">
                        <div className="project-extracting-spinner"></div>
                        <p>AI is generating project details...</p>
                        <span className="project-extracting-hint">Creating a clear name and description</span>
                      </div>
                    ) : (
                      <>
                        <div className="project-preview-header">
                          <span className="project-preview-label">New Project Details</span>
                          <span className="project-preview-hint">Review and edit before creating</span>
                        </div>
                        <div className="project-preview-field">
                          <label htmlFor="new-project-name">Project Name</label>
                          <input
                            id="new-project-name"
                            type="text"
                            value={newProjectName}
                            onChange={e => setNewProjectName(e.target.value)}
                            placeholder="Enter project name"
                            disabled={creatingProject}
                            autoFocus
                          />
                        </div>
                        <div className="project-preview-field">
                          <label htmlFor="new-project-description">Description</label>
                          <textarea
                            id="new-project-description"
                            value={newProjectDescription}
                            onChange={e => setNewProjectDescription(e.target.value)}
                            placeholder="Project description"
                            rows={4}
                            disabled={creatingProject}
                          />
                          <span className="field-hint">This description helps anyone understand what this project is about</span>
                        </div>
                        <div className="project-preview-actions">
                          <button
                            type="button"
                            className="project-cancel-btn"
                            onClick={handleCancelProjectPreview}
                            disabled={creatingProject}
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            className="project-create-btn"
                            onClick={handleConfirmCreateProject}
                            disabled={creatingProject || !newProjectName.trim()}
                          >
                            {creatingProject ? 'Creating...' : 'Create Project'}
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                ) : (
                  <p className="hint">
                    {creatingProject
                      ? 'Creating project...'
                      : projectId
                        ? 'This will be saved to your project for client reports.'
                        : 'Select a project or create one from this discussion.'}
                  </p>
                )}
              </div>

              {/* Structured Decision Fields - compact layout */}
              <div className="form-group">
                <label htmlFor="knowledge-problem">Problem / Question (optional)</label>
                <textarea
                  id="knowledge-problem"
                  value={problemStatement}
                  onChange={e => setProblemStatement(e.target.value)}
                  placeholder="What problem or question led to this decision?"
                  rows={2}
                />
              </div>

              <div className="form-group">
                <label htmlFor="knowledge-decision">Decision *</label>
                <textarea
                  id="knowledge-decision"
                  value={decisionText}
                  onChange={e => setDecisionText(e.target.value)}
                  placeholder="What was decided? Be specific and actionable."
                  rows={2}
                />
              </div>

              <div className="form-group">
                <label htmlFor="knowledge-reasoning">Reasoning (optional)</label>
                <textarea
                  id="knowledge-reasoning"
                  value={reasoning}
                  onChange={e => setReasoning(e.target.value)}
                  placeholder="Why was this decision made?"
                  rows={2}
                />
              </div>

              {error && <div className="error-message">{error}</div>}
            </div>

            <div className="modal-footer">
              <button className="cancel-btn" onClick={onClose} disabled={saving}>
                Cancel
              </button>
              <button className="save-btn" onClick={handleSave} disabled={saving}>
                {saving ? 'Saving...' : 'Save to Knowledge Base'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
