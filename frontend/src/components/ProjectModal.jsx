import { useState } from 'react';
import { api } from '../api';
import './ProjectModal.css';

export default function ProjectModal({ companyId, onClose, onProjectCreated }) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  // Guided context fields - we'll assemble these into markdown
  const [clientBackground, setClientBackground] = useState('');
  const [goals, setGoals] = useState('');
  const [constraints, setConstraints] = useState('');
  const [additionalInfo, setAdditionalInfo] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  // Track which field is being polished
  const [polishing, setPolishing] = useState(null);

  // Build markdown from the guided fields
  const buildContextMarkdown = () => {
    const sections = [];

    if (clientBackground.trim()) {
      sections.push(`## Client Background\n${clientBackground.trim()}`);
    }

    if (goals.trim()) {
      sections.push(`## Goals & Objectives\n${goals.trim()}`);
    }

    if (constraints.trim()) {
      sections.push(`## Constraints & Requirements\n${constraints.trim()}`);
    }

    if (additionalInfo.trim()) {
      sections.push(`## Additional Context\n${additionalInfo.trim()}`);
    }

    if (sections.length === 0) {
      return null;
    }

    return `# ${name.trim()}\n\n${sections.join('\n\n')}`;
  };

  // AI polish handler
  const handlePolish = async (fieldType, currentValue, setValue) => {
    if (!currentValue.trim()) return;

    setPolishing(fieldType);
    setError(null);

    try {
      const result = await api.polishText(currentValue, fieldType);
      if (result.polished) {
        setValue(result.polished);
      }
    } catch (err) {
      console.error('Failed to polish text:', err);
      setError('Failed to polish text. Please try again.');
    } finally {
      setPolishing(null);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!name.trim()) {
      setError('Project name is required');
      return;
    }

    try {
      setSaving(true);
      setError(null);

      const contextMd = buildContextMarkdown();

      const result = await api.createProject(companyId, {
        name: name.trim(),
        description: description.trim() || null,
        context_md: contextMd,
      });

      onProjectCreated(result.project);
      onClose();
    } catch (err) {
      console.error('Failed to create project:', err);
      setError(err.message || 'Failed to create project');
      setSaving(false);
    }
  };

  return (
    <div className="project-modal-overlay" onClick={onClose}>
      <div className="project-modal" onClick={(e) => e.stopPropagation()}>
        <div className="project-modal-header">
          <h2>New Project / Client</h2>
          <button className="project-modal-close" onClick={onClose}>&times;</button>
        </div>

        {error && (
          <div className="project-modal-error">{error}</div>
        )}

        <form onSubmit={handleSubmit} className="project-modal-form">
          <div className="form-group">
            <label htmlFor="project-name">Project Name *</label>
            <input
              id="project-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Acme Corp, Q1 Campaign, Website Redesign"
              disabled={saving}
              autoFocus
            />
          </div>

          <div className="form-group">
            <label htmlFor="project-description">Short Description</label>
            <input
              id="project-description"
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="One-line summary (shown in dropdown)"
              disabled={saving}
            />
          </div>

          <div className="form-section-header">
            <span>Context for AI</span>
          </div>

          {/* Client Background */}
          <div className="form-group">
            <div className="label-row">
              <label htmlFor="client-background">About the Client / Project</label>
              {clientBackground.trim() && (
                <button
                  type="button"
                  className="polish-btn"
                  onClick={() => handlePolish('client_background', clientBackground, setClientBackground)}
                  disabled={saving || polishing === 'client_background'}
                  title="Polish with AI"
                >
                  {polishing === 'client_background' ? '...' : '✨'}
                </button>
              )}
            </div>
            <textarea
              id="client-background"
              value={clientBackground}
              onChange={(e) => setClientBackground(e.target.value)}
              placeholder="Who is the client? What industry? Company size? Key people involved?"
              disabled={saving || polishing === 'client_background'}
              rows={3}
            />
          </div>

          {/* Goals */}
          <div className="form-group">
            <div className="label-row">
              <label htmlFor="project-goals">Goals & Objectives</label>
              {goals.trim() && (
                <button
                  type="button"
                  className="polish-btn"
                  onClick={() => handlePolish('goals', goals, setGoals)}
                  disabled={saving || polishing === 'goals'}
                  title="Polish with AI"
                >
                  {polishing === 'goals' ? '...' : '✨'}
                </button>
              )}
            </div>
            <textarea
              id="project-goals"
              value={goals}
              onChange={(e) => setGoals(e.target.value)}
              placeholder="What are you trying to achieve? What does success look like?"
              disabled={saving || polishing === 'goals'}
              rows={3}
            />
          </div>

          {/* Constraints */}
          <div className="form-group">
            <div className="label-row">
              <label htmlFor="project-constraints">Constraints & Requirements</label>
              {constraints.trim() && (
                <button
                  type="button"
                  className="polish-btn"
                  onClick={() => handlePolish('constraints', constraints, setConstraints)}
                  disabled={saving || polishing === 'constraints'}
                  title="Polish with AI"
                >
                  {polishing === 'constraints' ? '...' : '✨'}
                </button>
              )}
            </div>
            <textarea
              id="project-constraints"
              value={constraints}
              onChange={(e) => setConstraints(e.target.value)}
              placeholder="Budget limits? Timeline? Technical requirements? Things to avoid?"
              disabled={saving || polishing === 'constraints'}
              rows={3}
            />
          </div>

          {/* Additional Info */}
          <div className="form-group">
            <div className="label-row">
              <label htmlFor="additional-info">Anything Else the AI Should Know</label>
              {additionalInfo.trim() && (
                <button
                  type="button"
                  className="polish-btn"
                  onClick={() => handlePolish('additional', additionalInfo, setAdditionalInfo)}
                  disabled={saving || polishing === 'additional'}
                  title="Polish with AI"
                >
                  {polishing === 'additional' ? '...' : '✨'}
                </button>
              )}
            </div>
            <textarea
              id="additional-info"
              value={additionalInfo}
              onChange={(e) => setAdditionalInfo(e.target.value)}
              placeholder="Past decisions, preferences, relevant history, important context..."
              disabled={saving || polishing === 'additional'}
              rows={3}
            />
          </div>

          <div className="project-modal-actions">
            <button
              type="button"
              className="btn-cancel"
              onClick={onClose}
              disabled={saving}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn-save"
              disabled={saving || !name.trim()}
            >
              {saving ? 'Creating...' : 'Create Project'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
