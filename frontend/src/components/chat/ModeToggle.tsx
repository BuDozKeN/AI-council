/**
 * ModeToggle - Chat/council mode selector with department, role, and playbook selection
 *
 * Shows mode toggle and multi-select components for Full Council mode.
 * Matches the context selection available in the landing page for consistency.
 */

import { useState, useEffect } from 'react';
import { MultiDepartmentSelect } from '../ui/MultiDepartmentSelect';
import { MultiRoleSelect } from '../ui/MultiRoleSelect';
import { MultiPlaybookSelect } from '../ui/MultiPlaybookSelect';

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
  // Multi-select props (primary)
  departments = [],
  selectedDepartments = [],
  onSelectDepartments,
  allRoles = [],
  selectedRoles = [],
  onSelectRoles,
  playbooks = [],
  selectedPlaybooks = [],
  onSelectPlaybooks,
  // Legacy single-select props (fallback)
  selectedDepartment,
  onSelectDepartment,
  roles = [],
  selectedRole,
  onSelectRole,
  selectedBusiness,
  isLoading
}) {
  const isMobile = useIsMobile();

  // Determine if we're using multi-select mode
  const useMultiSelect = onSelectDepartments && onSelectRoles;

  return (
    <div className={`mode-toggle-bar ${isMobile ? 'mobile' : ''} ${isLoading ? 'disabled' : ''}`}>
      {/* Mode toggle buttons */}
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
          <span className="mode-label">Full Council</span>
        </button>
      </div>

      {/* Context selectors - only show for Full Council mode */}
      {chatMode === 'council' && selectedBusiness && (
        <div className="mode-toggle-selectors">
          {/* Multi-select mode */}
          {useMultiSelect ? (
            <>
              {/* Department multi-select */}
              {departments.length > 0 && (
                <MultiDepartmentSelect
                  value={selectedDepartments}
                  onValueChange={onSelectDepartments}
                  departments={departments}
                  disabled={isLoading}
                  placeholder="Departments..."
                  className="mode-toggle-select"
                />
              )}

              {/* Role multi-select */}
              {allRoles.length > 0 && (
                <MultiRoleSelect
                  value={selectedRoles}
                  onValueChange={onSelectRoles}
                  roles={allRoles}
                  disabled={isLoading}
                  placeholder="Roles..."
                  className="mode-toggle-select"
                />
              )}

              {/* Playbook multi-select */}
              {playbooks.length > 0 && onSelectPlaybooks && (
                <MultiPlaybookSelect
                  value={selectedPlaybooks}
                  onValueChange={onSelectPlaybooks}
                  playbooks={playbooks}
                  disabled={isLoading}
                  placeholder="Playbooks..."
                  className="mode-toggle-select"
                />
              )}
            </>
          ) : (
            // Legacy single-select mode (fallback)
            <>
              {departments.length > 0 && (
                <MultiDepartmentSelect
                  value={selectedDepartment ? [selectedDepartment] : []}
                  onValueChange={(vals) => onSelectDepartment(vals[0] || null)}
                  departments={departments}
                  disabled={isLoading}
                  placeholder="Department..."
                  className="mode-toggle-select"
                />
              )}

              {selectedDepartment && roles.length > 0 && (
                <MultiRoleSelect
                  value={selectedRole ? [selectedRole] : []}
                  onValueChange={(vals) => onSelectRole(vals[0] || null)}
                  roles={roles}
                  disabled={isLoading}
                  placeholder="Role..."
                  className="mode-toggle-select"
                />
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
