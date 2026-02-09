/**
 * ContextIndicator - Shows current context and question during conversation
 *
 * Displays the user's question (AI-summarized) and context pills.
 * Always visible sticky header - NOT collapsible.
 * Department pills use standardized colors from getDeptColor().
 *
 * Uses StickyHeader wrapper for proper sticky positioning.
 */

import { MessageCircleQuestion } from 'lucide-react';
import { getDeptColor } from '../../lib/colors';
import { StickyHeader } from './StickyHeader';

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

interface Playbook {
  id: string;
  name?: string;
  title?: string;
  type?: 'sop' | 'framework' | 'policy';
  doc_type?: 'sop' | 'framework' | 'policy';
}

interface ContextIndicatorProps {
  businesses?: Business[];
  selectedBusiness?: string | undefined;
  projects?: Project[];
  selectedProject?: string | undefined;
  departments?: Department[];
  selectedDepartment?: string | undefined;
  selectedDepartments?: string[]; // Multi-select support
  roles?: Role[];
  selectedRole?: string | undefined;
  selectedRoles?: string[]; // Multi-select support
  playbooks?: Playbook[];
  selectedPlaybooks?: string[]; // Selected playbook IDs
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
  playbooks = [],
  selectedPlaybooks = [],
  question,
  conversationTitle,
}: ContextIndicatorProps) {
  if (!selectedBusiness && !question && !conversationTitle) return null;

  const displayQuestion = conversationTitle || summarizeQuestion(question);

  // Get department data with IDs for color lookup (support both single and multi-select)
  const departmentItems: { id: string; name: string }[] = [];
  if (selectedDepartment) {
    const dept = departments.find((d) => d.id === selectedDepartment);
    if (dept) departmentItems.push({ id: dept.id, name: dept.name });
  }
  selectedDepartments.forEach((id) => {
    if (id !== selectedDepartment) {
      // Avoid duplicates
      const dept = departments.find((d) => d.id === id);
      if (dept) departmentItems.push({ id: dept.id, name: dept.name });
    }
  });

  // Get role names (support both single and multi-select)
  const roleNames: string[] = [];
  if (selectedRole) {
    const role = roles.find((r) => r.id === selectedRole);
    if (role) roleNames.push(role.name);
  }
  selectedRoles.forEach((id) => {
    if (id !== selectedRole) {
      // Avoid duplicates
      const role = roles.find((r) => r.id === id);
      if (role) roleNames.push(role.name);
    }
  });

  // Get playbook names with type info
  type PlaybookType = 'sop' | 'framework' | 'policy';
  const playbookItems: { name: string; type: PlaybookType }[] = selectedPlaybooks
    .map((id) => {
      const playbook = playbooks.find((p) => p.id === id);
      if (!playbook) return null;
      const name = playbook.title || playbook.name || 'Playbook';
      const type: PlaybookType = playbook.doc_type || playbook.type || 'framework';
      return { name, type };
    })
    .filter((item): item is { name: string; type: PlaybookType } => item !== null);

  return (
    <StickyHeader>
      <div className="context-indicator" data-stage="question">
        {/* Question line - ISS-163: aria-hidden since ChatInterface has sr-only h1 for page title */}
        <div className="context-indicator-question" aria-hidden="true">
          <MessageCircleQuestion className="context-question-icon" size={14} />
          <span className="context-question-text">{displayQuestion || 'Question'}</span>
        </div>

        {/* Context pills - company, project, departments, roles */}
        {/* ISS-172: Properly structured context for accessibility */}
        {selectedBusiness && (
          <div className="context-indicator-pills" role="group" aria-label="Context settings">
            <span className="context-indicator-label" aria-hidden="true">
              Context:
            </span>
            <span className="context-indicator-item company">
              {businesses.find((b) => b.id === selectedBusiness)?.name || 'Company'}
            </span>
            {selectedProject && (
              <span className="context-indicator-item project">
                {projects.find((p) => p.id === selectedProject)?.name || 'Project'}
              </span>
            )}
            {departmentItems.map((dept) => {
              const colors = getDeptColor(dept.id);
              return (
                <span
                  key={dept.id}
                  className="context-indicator-item department"
                  style={
                    {
                      '--dept-bg': colors.bg,
                      '--dept-text': colors.text,
                    } as React.CSSProperties
                  }
                >
                  {dept.name}
                </span>
              );
            })}
            {roleNames.map((name, idx) => (
              <span key={`role-${idx}`} className="context-indicator-item role">
                {name}
              </span>
            ))}
            {playbookItems.map((item, idx) => (
              <span
                key={`playbook-${idx}`}
                className={`context-indicator-item playbook ${item.type}`}
              >
                {item.name}
              </span>
            ))}
          </div>
        )}
      </div>
    </StickyHeader>
  );
}
