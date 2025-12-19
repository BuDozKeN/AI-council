/**
 * ModeToggle - Chat/council mode selector with department/role pills
 *
 * Shows mode toggle for follow-up messages and context toggles.
 * Extracted from ChatInterface.jsx for better maintainability.
 */

export function ModeToggle({
  chatMode,
  onChatModeChange,
  departments = [],
  selectedDepartment,
  onSelectDepartment,
  roles = [],
  selectedRole,
  onSelectRole,
  selectedBusiness,
  useCompanyContext,
  onToggleCompanyContext,
  useDepartmentContext,
  onToggleDepartmentContext,
  isLoading
}) {
  return (
    <div className={`mode-toggle-bar ${isLoading ? 'disabled' : ''}`}>
      <span className="mode-label">Reply mode:</span>
      <div className="mode-buttons">
        <button
          type="button"
          className={`mode-btn ${chatMode === 'chat' ? 'active' : ''}`}
          onClick={() => !isLoading && onChatModeChange('chat')}
          disabled={isLoading}
          title="Quick follow-up with the Chairman (faster)"
        >
          <span className="mode-btn-icon">💬</span>
          Quick Chat
        </button>
        <button
          type="button"
          className={`mode-btn ${chatMode === 'council' ? 'active' : ''}`}
          onClick={() => !isLoading && onChatModeChange('council')}
          disabled={isLoading}
          title="Full council deliberation with all 5 AI models"
        >
          <span className="mode-btn-icon">👥</span>
          Full Council
        </button>
      </div>

      {/* Department pills - only show when Full Council is selected and company has departments */}
      {chatMode === 'council' && selectedBusiness && departments.length > 0 && (
        <div className="department-pills">
          <button
            type="button"
            className={`dept-pill ${!selectedDepartment ? 'active' : ''}`}
            onClick={() => !isLoading && onSelectDepartment(null)}
            disabled={isLoading}
            title="Consult the general council"
          >
            General
          </button>
          {departments.map((dept) => (
            <button
              key={dept.id}
              type="button"
              className={`dept-pill ${selectedDepartment === dept.id ? 'active' : ''}`}
              onClick={() => !isLoading && onSelectDepartment(dept.id)}
              disabled={isLoading}
              title={`Consult the ${dept.name} council`}
            >
              {dept.name}
            </button>
          ))}
        </div>
      )}

      {/* Role pills - only show when Full Council, department is selected, and department has roles */}
      {chatMode === 'council' && selectedDepartment && roles.length > 0 && (
        <div className="role-pills">
          <button
            type="button"
            className={`role-pill ${!selectedRole ? 'active' : ''}`}
            onClick={() => !isLoading && onSelectRole(null)}
            disabled={isLoading}
            title={`Consult all ${departments.find(d => d.id === selectedDepartment)?.name || 'department'} roles`}
          >
            All Roles
          </button>
          {roles.map((role) => (
            <button
              key={role.id}
              type="button"
              className={`role-pill ${selectedRole === role.id ? 'active' : ''}`}
              onClick={() => !isLoading && onSelectRole(role.id)}
              disabled={isLoading}
              title={`Consult the ${role.name} council`}
            >
              {role.name}
            </button>
          ))}
        </div>
      )}

      {/* Context toggles - show when Full Council mode is selected and a business is selected */}
      {chatMode === 'council' && selectedBusiness && (
        <div className="context-toggles-row">
          <span className="context-label">Context:</span>
          <button
            type="button"
            className={`context-toggle-btn ${useCompanyContext ? 'active' : ''}`}
            onClick={() => !isLoading && onToggleCompanyContext(!useCompanyContext)}
            disabled={isLoading}
            title="Toggle company-wide context (main company knowledge)"
          >
            <span className="toggle-icon">{useCompanyContext ? '✓' : '○'}</span>
            Company
          </button>
          {selectedDepartment && (
            <button
              type="button"
              className={`context-toggle-btn ${useDepartmentContext ? 'active' : ''}`}
              onClick={() => !isLoading && onToggleDepartmentContext(!useDepartmentContext)}
              disabled={isLoading}
              title="Toggle department-specific context (department knowledge)"
            >
              <span className="toggle-icon">{useDepartmentContext ? '✓' : '○'}</span>
              {departments.find(d => d.id === selectedDepartment)?.name || 'Department'}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
