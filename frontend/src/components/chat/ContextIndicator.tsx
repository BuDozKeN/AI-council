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
  selectedBusiness?: string | undefined;
  projects?: Project[];
  selectedProject?: string | undefined;
  departments?: Department[];
  selectedDepartment?: string | undefined;
  selectedDepartments?: string[];  // Multi-select support
  roles?: Role[];
  selectedRole?: string | undefined;
  selectedRoles?: string[];  // Multi-select support
  question?: string | undefined;
  conversationTitle?: string;
}

export function ContextIndicator({
  businesses = [],
  selectedBusiness,
  projects = [],
  selectedProject,
  departments = [],
  selectedDepartment,
  selectedDepartments = [],
  roles = [],
  selectedRole,
  selectedRoles = [],
  question,
  conversationTitle,
}: ContextIndicatorProps) {
  if (!selectedBusiness && !question && !conversationTitle) return null;

  const displayQuestion = conversationTitle || summarizeQuestion(question);

  // Get department names (support both single and multi-select)
  const departmentNames: string[] = [];
  if (selectedDepartment) {
    const dept = departments.find(d => d.id === selectedDepartment);
    if (dept) departmentNames.push(dept.name);
  }
  selectedDepartments.forEach(id => {
    if (id !== selectedDepartment) { // Avoid duplicates
      const dept = departments.find(d => d.id === id);
      if (dept) departmentNames.push(dept.name);
    }
  });

  // Get role names (support both single and multi-select)
  const roleNames: string[] = [];
  if (selectedRole) {
    const role = roles.find(r => r.id === selectedRole);
    if (role) roleNames.push(role.name);
  }
  selectedRoles.forEach(id => {
    if (id !== selectedRole) { // Avoid duplicates
      const role = roles.find(r => r.id === id);
      if (role) roleNames.push(role.name);
    }
  });

  return (
    <div className="context-indicator" data-stage="question">
      {/* Question line */}
      <div className="context-indicator-question">
        <MessageCircleQuestion className="context-question-icon" size={14} />
        <span className="context-question-text">{displayQuestion || 'Question'}</span>
      </div>

      {/* Context pills - company, project, departments, roles */}
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
          {departmentNames.map((name, idx) => (
            <span key={`dept-${idx}`} className="context-indicator-item department">
              {name}
            </span>
          ))}
          {roleNames.map((name, idx) => (
            <span key={`role-${idx}`} className="context-indicator-item role">
              {name}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
