/**
 * ModeToggle - Chat/council mode selector with department and role selection
 *
 * Shows mode toggle, color-coded department pills, and role pills for Full Council.
 * On mobile, departments and roles use Radix Select components for cleaner UX.
 */

import { useState, useEffect } from 'react';
import { DepartmentSelect } from '../ui/DepartmentSelect';
import { RoleSelect } from '../ui/RoleSelect';
import { getDeptColor } from '../../lib/colors';

// Check if we're on mobile
const useIsMobile = () => {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 640);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  return isMobile;
};

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
  isLoading
}) {
  const isMobile = useIsMobile();

  // Get selected department name for display (used in desktop pills)
  const selectedDeptName = departments.find(d => d.id === selectedDepartment)?.name || 'General';

  // Mobile: use Radix Select components for departments and roles
  if (isMobile) {
    return (
      <div className={`mode-toggle-bar mobile ${isLoading ? 'disabled' : ''}`}>
        <div className="mode-toggle-compact">
          <button
            type="button"
            className={`mode-btn-compact ${chatMode === 'chat' ? 'active' : ''}`}
            onClick={() => !isLoading && onChatModeChange('chat')}
            disabled={isLoading}
            title="Quick response from one AI"
          >
            <span className="mode-label">Quick</span>
          </button>
          <button
            type="button"
            className={`mode-btn-compact ${chatMode === 'council' ? 'active' : ''}`}
            onClick={() => !isLoading && onChatModeChange('council')}
            disabled={isLoading}
            title="Full council deliberation with 5 AI models"
          >
            <span className="mode-label">Council</span>
          </button>
        </div>

        {/* Mobile: Radix Select components for council mode */}
        {chatMode === 'council' && selectedBusiness && departments.length > 0 && (
          <div className="mobile-selectors">
            {/* Department selector - color-coded with Radix */}
            <DepartmentSelect
              value={selectedDepartment || 'all'}
              onValueChange={(val) => onSelectDepartment(val === 'all' ? null : val)}
              departments={departments}
              includeAll={true}
              allLabel="General"
              disabled={isLoading}
              compact={true}
              className="mobile-dept-select"
            />

            {/* Role selector - only when department selected */}
            {selectedDepartment && roles.length > 0 && (
              <RoleSelect
                value={selectedRole || 'all'}
                onValueChange={(val) => onSelectRole(val === 'all' ? null : val)}
                roles={roles}
                includeAll={true}
                allLabel="All Roles"
                disabled={isLoading}
                compact={true}
                className="mobile-role-select"
              />
            )}
          </div>
        )}
      </div>
    );
  }

  // Desktop: use pills
  return (
    <div className={`mode-toggle-bar ${isLoading ? 'disabled' : ''}`}>
      <div className="mode-toggle-compact">
        <button
          type="button"
          className={`mode-btn-compact ${chatMode === 'chat' ? 'active' : ''}`}
          onClick={() => !isLoading && onChatModeChange('chat')}
          disabled={isLoading}
          title="Quick follow-up with the Chairman"
        >
          <span className="mode-label">Quick</span>
        </button>
        <button
          type="button"
          className={`mode-btn-compact ${chatMode === 'council' ? 'active' : ''}`}
          onClick={() => !isLoading && onChatModeChange('council')}
          disabled={isLoading}
          title="Full council deliberation with all 5 AI models"
        >
          <span className="mode-label">Full Council</span>
        </button>
      </div>

      {/* Department pills - color-coded */}
      {chatMode === 'council' && selectedBusiness && departments.length > 0 && (
        <div className="department-pills-compact">
          <button
            type="button"
            className={`dept-pill-compact ${!selectedDepartment ? 'active' : ''}`}
            onClick={() => !isLoading && onSelectDepartment(null)}
            disabled={isLoading}
            title="Consult the general council"
            style={!selectedDepartment ? {
              background: getDeptColor('General').bg,
              borderColor: getDeptColor('General').border,
              color: getDeptColor('General').text,
            } : undefined}
          >
            General
          </button>
          {departments.map((dept) => {
            const colors = getDeptColor(dept.name);
            const isActive = selectedDepartment === dept.id;
            return (
              <button
                key={dept.id}
                type="button"
                className={`dept-pill-compact ${isActive ? 'active' : ''}`}
                onClick={() => !isLoading && onSelectDepartment(dept.id)}
                disabled={isLoading}
                title={`Consult the ${dept.name} council`}
                style={isActive ? {
                  background: colors.bg,
                  borderColor: colors.border,
                  color: colors.text,
                } : undefined}
              >
                {dept.name}
              </button>
            );
          })}
        </div>
      )}

      {/* Role pills - show when department is selected and has roles */}
      {chatMode === 'council' && selectedDepartment && roles.length > 0 && (
        <div className="role-pills-compact">
          <button
            type="button"
            className={`role-pill-compact ${!selectedRole ? 'active' : ''}`}
            onClick={() => !isLoading && onSelectRole(null)}
            disabled={isLoading}
            title={`Consult all ${selectedDeptName || 'department'} roles`}
          >
            All Roles
          </button>
          {roles.map((role) => (
            <button
              key={role.id}
              type="button"
              className={`role-pill-compact ${selectedRole === role.id ? 'active' : ''}`}
              onClick={() => !isLoading && onSelectRole(role.id)}
              disabled={isLoading}
              title={`Consult the ${role.name}`}
            >
              {role.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
