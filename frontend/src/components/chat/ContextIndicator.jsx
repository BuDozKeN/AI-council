/**
 * ContextIndicator - Shows current context and question during conversation
 *
 * Displays the user's question (AI-summarized) and context pills.
 * Sticky header so user always knows what they're looking at.
 * Extracted from ChatInterface.jsx for better maintainability.
 */

/**
 * Truncate and clean up a question for display
 * @param {string} question - The original question
 * @param {number} maxLength - Maximum length before truncation
 */
function summarizeQuestion(question, maxLength = 80) {
  if (!question) return null;
  // Clean up whitespace
  const cleaned = question.trim().replace(/\s+/g, ' ');
  if (cleaned.length <= maxLength) return cleaned;
  // Truncate at word boundary
  const truncated = cleaned.substring(0, maxLength);
  const lastSpace = truncated.lastIndexOf(' ');
  return (lastSpace > maxLength * 0.7 ? truncated.substring(0, lastSpace) : truncated) + '...';
}

export function ContextIndicator({
  businesses = [],
  selectedBusiness,
  projects = [],
  selectedProject,
  departments = [],
  selectedDepartment,
  roles = [],
  selectedRole,
  // New: the user's question
  question,
  // Conversation title (AI-generated summary) - preferred over raw question
  conversationTitle
}) {
  if (!selectedBusiness && !question && !conversationTitle) return null;

  // Prefer the AI-generated conversation title over the raw question
  // The title is what shows in the sidebar and is more concise
  const displayQuestion = conversationTitle || summarizeQuestion(question);

  return (
    <div className="context-indicator">
      {/* Question line - what the user asked */}
      {displayQuestion && (
        <div className="context-indicator-question">
          <span className="context-question-icon">Q</span>
          <span className="context-question-text">{displayQuestion}</span>
        </div>
      )}

      {/* Context pills - company, project, department, role */}
      {selectedBusiness && (
        <div className="context-indicator-pills">
          <span className="context-indicator-label">Context:</span>
          <span className="context-indicator-item company">
            {businesses.find(b => b.id === selectedBusiness)?.name || 'Company'}
          </span>
          {selectedProject && (
            <span className="context-indicator-item project">
              {projects.find(p => p.id === selectedProject)?.name || 'Project'}
            </span>
          )}
          {selectedDepartment && (
            <span className="context-indicator-item department">
              {departments.find(d => d.id === selectedDepartment)?.name || 'Department'}
            </span>
          )}
          {selectedRole && (
            <span className="context-indicator-item role">
              {roles.find(r => r.id === selectedRole)?.name || 'Role'}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
