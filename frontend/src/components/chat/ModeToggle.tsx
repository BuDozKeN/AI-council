/**
 * ModeToggle - Chat/council mode selector with department, role, and playbook selection
 *
 * Shows mode toggle and multi-select components for Full Council mode.
 * Matches the context selection available in the landing page for consistency.
 */

import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { MultiDepartmentSelect } from '../ui/MultiDepartmentSelect';
import { MultiRoleSelect } from '../ui/MultiRoleSelect';
import { MultiPlaybookSelect } from '../ui/MultiPlaybookSelect';

import type { Department, Role, Playbook } from '../../types/business';

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

interface ModeToggleProps {
  chatMode: 'chat' | 'council';
  onChatModeChange: (mode: 'chat' | 'council') => void;
  // Multi-select props (primary)
  departments?: Department[] | undefined;
  selectedDepartments?: string[] | undefined;
  onSelectDepartments?: ((ids: string[]) => void) | undefined;
  allRoles?: Role[] | undefined;
  selectedRoles?: string[] | undefined;
  onSelectRoles?: ((ids: string[]) => void) | undefined;
  playbooks?: Playbook[] | undefined;
  selectedPlaybooks?: string[] | undefined;
  onSelectPlaybooks?: ((ids: string[]) => void) | undefined;
  // Legacy single-select props (fallback)
  selectedDepartment?: string | null | undefined;
  onSelectDepartment?: ((id: string | null) => void) | undefined;
  roles?: Role[] | undefined;
  selectedRole?: string | null | undefined;
  onSelectRole?: ((id: string | null) => void) | undefined;
  selectedBusiness?: string | null | undefined;
  isLoading?: boolean | undefined;
}

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
  isLoading,
}: ModeToggleProps) {
  const { t } = useTranslation();
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
          title={t('chat.tooltips.chatMode')}
        >
          <span className="mode-label">{t('modeToggle.quick')}</span>
        </button>
        <button
          type="button"
          className={`mode-btn-compact ${chatMode === 'council' ? 'active' : ''}`}
          onClick={() => !isLoading && onChatModeChange('council')}
          disabled={isLoading}
          title={t('chat.tooltips.councilMode')}
        >
          <span className="mode-label">{t('modeToggle.fullCouncil')}</span>
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
                  placeholder={t('departments.selectDepartments')}
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
                  placeholder={t('roles.selectRoles')}
                  className="mode-toggle-select"
                />
              )}

              {/* Playbook multi-select */}
              {playbooks.length > 0 && onSelectPlaybooks && (
                <MultiPlaybookSelect
                  value={selectedPlaybooks}
                  onValueChange={onSelectPlaybooks}
                  playbooks={playbooks.map((p) => ({
                    id: p.id,
                    title: p.title ?? p.name ?? t('common.unknown'),
                    doc_type: p.doc_type ?? p.type ?? 'sop',
                  }))}
                  disabled={isLoading ?? false}
                  placeholder={t('playbooks.selectPlaybooks')}
                  className="mode-toggle-select"
                />
              )}
            </>
          ) : (
            // Legacy single-select mode (fallback)
            <>
              {departments.length > 0 && onSelectDepartment && (
                <MultiDepartmentSelect
                  value={selectedDepartment ? [selectedDepartment] : []}
                  onValueChange={(vals: string[]) => onSelectDepartment(vals[0] ?? null)}
                  departments={departments}
                  disabled={isLoading}
                  placeholder={t('context.department')}
                  className="mode-toggle-select"
                />
              )}

              {selectedDepartment && roles.length > 0 && onSelectRole && (
                <MultiRoleSelect
                  value={selectedRole ? [selectedRole] : []}
                  onValueChange={(vals: string[]) => onSelectRole(vals[0] ?? null)}
                  roles={roles}
                  disabled={isLoading}
                  placeholder={t('modals.roleName')}
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
