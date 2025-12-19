/**
 * ContextIndicator - Shows current context during conversation
 *
 * Displays company, project, department, and role context as pills.
 * Extracted from ChatInterface.jsx for better maintainability.
 */

export function ContextIndicator({
  businesses = [],
  selectedBusiness,
  projects = [],
  selectedProject,
  departments = [],
  selectedDepartment,
  roles = [],
  selectedRole
}) {
  if (!selectedBusiness) return null;

  return (
    <div className="context-indicator">
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
  );
}
