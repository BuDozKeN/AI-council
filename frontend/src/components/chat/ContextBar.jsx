/**
 * ContextBar - Company/department/project selectors for new conversations
 *
 * Shows context selection options when starting a new conversation.
 * Extracted from ChatInterface.jsx for better maintainability.
 */

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';

export function ContextBar({
  businesses = [],
  selectedBusiness,
  onSelectBusiness,
  departments = [],
  selectedDepartment,
  onSelectDepartment,
  roles = [],
  selectedRole,
  onSelectRole,
  channels = [],
  selectedChannel,
  onSelectChannel,
  styles = [],
  selectedStyle,
  onSelectStyle,
  projects = [],
  selectedProject,
  onSelectProject,
  onOpenProjectModal,
  useCompanyContext,
  onToggleCompanyContext,
  useDepartmentContext,
  onToggleDepartmentContext,
  isLoading
}) {
  if (businesses.length === 0) return null;

  return (
    <div className="context-bar">
      {/* Company selector */}
      <Select
        value={selectedBusiness || '__none__'}
        onValueChange={(v) => onSelectBusiness(v === '__none__' ? null : v)}
        disabled={isLoading}
      >
        <SelectTrigger className="context-select-trigger company-select-trigger">
          <SelectValue placeholder="No company" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="__none__">No company</SelectItem>
          {businesses.map((biz) => (
            <SelectItem key={biz.id} value={biz.id}>
              {biz.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* When company selected: show company context toggle and department options */}
      {selectedBusiness && (
        <>
          {/* Company Context toggle */}
          <button
            type="button"
            className={`context-pill ${useCompanyContext ? 'active' : ''}`}
            onClick={() => onToggleCompanyContext(!useCompanyContext)}
            disabled={isLoading}
            title="Toggle company-wide context (main company knowledge)"
          >
            <span className="pill-icon">{useCompanyContext ? '✓' : '○'}</span>
            <span className="pill-text">Company</span>
          </button>

          {/* Project selector with add button */}
          <div className="project-selector-group">
            {projects.length > 0 ? (
              <Select
                value={selectedProject || '__none__'}
                onValueChange={(v) => onSelectProject(v === '__none__' ? null : v)}
                disabled={isLoading}
              >
                <SelectTrigger className="context-select-trigger project-select-trigger">
                  <SelectValue placeholder="Company-wide" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Company-wide</SelectItem>
                  {projects.map((proj) => (
                    <SelectItem key={proj.id} value={proj.id}>
                      {proj.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <span className="no-projects-hint">No projects</span>
            )}
            <button
              type="button"
              className="add-project-btn"
              onClick={onOpenProjectModal}
              disabled={isLoading}
              title="Add a new project or client"
            >
              +
            </button>
          </div>

          {/* Department selector */}
          {departments.length > 0 && (
            <>
              <Select
                value={selectedDepartment || '__none__'}
                onValueChange={(v) => onSelectDepartment(v === '__none__' ? null : v)}
                disabled={isLoading}
              >
                <SelectTrigger className="context-select-trigger department-select-trigger">
                  <SelectValue placeholder="General Council" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">General Council</SelectItem>
                  {departments.map((dept) => (
                    <SelectItem key={dept.id} value={dept.id}>
                      {dept.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Role selector - show when department has roles */}
              {selectedDepartment && roles.length > 0 && (
                <Select
                  value={selectedRole || '__none__'}
                  onValueChange={(v) => onSelectRole(v === '__none__' ? null : v)}
                  disabled={isLoading}
                >
                  <SelectTrigger className="context-select-trigger role-select-trigger">
                    <SelectValue placeholder={`All ${departments.find(d => d.id === selectedDepartment)?.name || 'Department'} Roles`} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">All {departments.find(d => d.id === selectedDepartment)?.name || 'Department'} Roles</SelectItem>
                    {roles.map((role) => (
                      <SelectItem key={role.id} value={role.id}>
                        {role.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}

              {/* Department Context toggle */}
              {selectedDepartment && (
                <button
                  type="button"
                  className={`context-pill ${useDepartmentContext ? 'active' : ''}`}
                  onClick={() => onToggleDepartmentContext(!useDepartmentContext)}
                  disabled={isLoading}
                  title="Toggle department-specific context (department knowledge)"
                >
                  <span className="pill-icon">{useDepartmentContext ? '✓' : '○'}</span>
                  <span className="pill-text">Department</span>
                </button>
              )}
            </>
          )}

          {/* Channel - only when department has channels */}
          {selectedDepartment && channels.length > 0 && (
            <Select
              value={selectedChannel || '__none__'}
              onValueChange={(v) => onSelectChannel(v === '__none__' ? null : v)}
              disabled={isLoading}
            >
              <SelectTrigger className="context-select-trigger channel-select-trigger">
                <SelectValue placeholder="Any channel" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">Any channel</SelectItem>
                {channels.map((channel) => (
                  <SelectItem key={channel.id} value={channel.id}>
                    {channel.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {/* Style - only when company has styles */}
          {styles.length > 0 && (
            <Select
              value={selectedStyle || '__none__'}
              onValueChange={(v) => onSelectStyle(v === '__none__' ? null : v)}
              disabled={isLoading}
            >
              <SelectTrigger className="context-select-trigger style-select-trigger">
                <SelectValue placeholder="Default style" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">Default style</SelectItem>
                {styles.map((style) => (
                  <SelectItem key={style.id} value={style.id}>
                    {style.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </>
      )}
    </div>
  );
}
