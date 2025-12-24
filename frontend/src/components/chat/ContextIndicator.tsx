/**
 * ContextIndicator - Shows current context and question during conversation
 *
 * Displays the user's question (AI-summarized) and context pills.
 * Always visible sticky header - NOT collapsible.
 */

import { MessageCircleQuestion } from 'lucide-react';

/**
 * Truncate and clean up a question for display
 */
function summarizeQuestion(question: string | undefined, maxLength = 80): string | null {
  if (!question) return null;
  const cleaned = question.trim().replace(/\s+/g, ' ');
  if (cleaned.length <= maxLength) return cleaned;
  const truncated = cleaned.substring(0, maxLength);
  const lastSpace = truncated.lastIndexOf(' ');
  return (lastSpace > maxLength * 0.7 ? truncated.substring(0, lastSpace) : truncated) + '...';
}

interface Business {
  id: string;
  name: string;
}

interface Project {
  id: string;
  name: string;
}

interface Department {
  id: string;
  name: string;
}

interface Role {
  id: string;
  name: string;
}

interface ContextIndicatorProps {
  businesses?: Business[];
  selectedBusiness?: string;
  projects?: Project[];
  selectedProject?: string;
  departments?: Department[];
  selectedDepartment?: string;
  roles?: Role[];
  selectedRole?: string;
  question?: string;
  conversationTitle?: string;
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
  question,
  conversationTitle,
}: ContextIndicatorProps) {
  if (!selectedBusiness && !question && !conversationTitle) return null;

  const displayQuestion = conversationTitle || summarizeQuestion(question);

  return (
    <div className="context-indicator" data-stage="question">
      {/* Question line */}
      <div className="context-indicator-question">
        <MessageCircleQuestion className="context-question-icon" size={14} />
        <span className="context-question-text">{displayQuestion || 'Question'}</span>
      </div>

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
