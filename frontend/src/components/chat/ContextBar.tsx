/**
 * ContextBar - Company/department/project selectors for new conversations
 *
 * Shows context selection options when starting a new conversation.
 * Supports multi-select for departments and roles.
 * Extracted from ChatInterface.jsx for better maintainability.
 */

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { MultiDepartmentSelect } from '../ui/MultiDepartmentSelect';
import { MultiRoleSelect } from '../ui/MultiRoleSelect';
import { MultiPlaybookSelect } from '../ui/MultiPlaybookSelect';
import type {
  Business,
  Department,
  Role,
  Channel,
  Style,
  Project,
  Playbook,
} from '../../types/business';

// Extended playbook type expected by MultiPlaybookSelect
type PlaybookType = 'sop' | 'framework' | 'policy';
interface ExtendedPlaybook {
  id: string;
  title: string;
  doc_type: PlaybookType;
}

interface ContextBarProps {
  businesses?: Business[];
  selectedBusiness: string | null;
  onSelectBusiness: (id: string | null) => void;
  departments?: Department[];
  selectedDepartments?: string[];
  onSelectDepartments?: (ids: string[]) => void;
  allRoles?: Role[];
  selectedRoles?: string[];
  onSelectRoles?: (ids: string[]) => void;
  playbooks?: Playbook[];
  selectedPlaybooks?: string[];
  onSelectPlaybooks?: (ids: string[]) => void;
  selectedDepartment?: string | null;
  onSelectDepartment?: (id: string | null) => void;
  roles?: Role[];
  selectedRole?: string | null;
  onSelectRole?: (id: string | null) => void;
  channels?: Channel[];
  selectedChannel?: string | null;
  onSelectChannel?: (id: string | null) => void;
  styles?: Style[];
  selectedStyle?: string | null;
  onSelectStyle?: (id: string | null) => void;
  projects?: Project[];
  selectedProject?: string | null;
  onSelectProject?: (id: string | null) => void;
  onOpenProjectModal?: (context?: unknown) => void;
  useCompanyContext?: boolean;
  onToggleCompanyContext?: (value: boolean) => void;
  useDepartmentContext?: boolean;
  onToggleDepartmentContext?: (value: boolean) => void;
  isLoading?: boolean;
}

export function ContextBar({
  businesses = [],
  selectedBusiness,
  onSelectBusiness,
  departments = [],
  selectedDepartments = [],
  onSelectDepartments,
  allRoles = [],
  selectedRoles = [],
  onSelectRoles,
  playbooks = [],
  selectedPlaybooks = [],
  onSelectPlaybooks,
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
  isLoading,
}: ContextBarProps) {
  // Determine if we're using multi-select mode
  const useMultiSelect = onSelectDepartments && onSelectRoles;
  if (businesses.length === 0) return null;

  // Normalize isLoading to boolean for components that require it
  const disabled = isLoading ?? false;

  // Convert playbooks to extended format expected by MultiPlaybookSelect
  const extendedPlaybooks: ExtendedPlaybook[] = playbooks
    .filter(
      (p): p is Playbook & { doc_type: PlaybookType } =>
        p.doc_type !== undefined && ['sop', 'framework', 'policy'].includes(p.doc_type)
    )
    .map((p) => ({
      id: p.id,
      title: p.title ?? p.name ?? 'Untitled',
      doc_type: p.doc_type,
    }));

  return (
    <div className="context-bar">
      {/* Company selector */}
      <Select
        value={selectedBusiness || '__none__'}
        onValueChange={(v) => onSelectBusiness(v === '__none__' ? null : v)}
        disabled={disabled}
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
            onClick={() => onToggleCompanyContext?.(!useCompanyContext)}
            disabled={disabled}
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
                onValueChange={(v) => onSelectProject?.(v === '__none__' ? null : v)}
                disabled={disabled}
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
              onClick={() => onOpenProjectModal?.()}
              disabled={disabled}
              title="Add a new project or client"
            >
              +
            </button>
          </div>

          {/* Department selector - Multi-select or Single-select based on mode */}
          {departments.length > 0 && (
            <>
              {useMultiSelect ? (
                // Multi-select mode
                <>
                  <MultiDepartmentSelect
                    value={selectedDepartments}
                    onValueChange={onSelectDepartments!}
                    departments={departments}
                    disabled={disabled}
                    placeholder="Select departments..."
                    className="context-multi-select"
                  />

                  {/* Role multi-select - show all roles from company */}
                  {allRoles.length > 0 && (
                    <MultiRoleSelect
                      value={selectedRoles}
                      onValueChange={onSelectRoles!}
                      roles={allRoles}
                      disabled={disabled}
                      placeholder="Select roles..."
                      className="context-multi-select"
                    />
                  )}

                  {/* Playbook multi-select */}
                  {extendedPlaybooks.length > 0 && onSelectPlaybooks && (
                    <MultiPlaybookSelect
                      value={selectedPlaybooks}
                      onValueChange={onSelectPlaybooks}
                      playbooks={extendedPlaybooks}
                      disabled={disabled}
                      placeholder="Select playbooks..."
                      className="context-multi-select"
                    />
                  )}

                  {/* Department Context toggle */}
                  {selectedDepartments.length > 0 && (
                    <button
                      type="button"
                      className={`context-pill ${useDepartmentContext ? 'active' : ''}`}
                      onClick={() => onToggleDepartmentContext?.(!useDepartmentContext)}
                      disabled={disabled}
                      title="Toggle department-specific context (department knowledge)"
                    >
                      <span className="pill-icon">{useDepartmentContext ? '✓' : '○'}</span>
                      <span className="pill-text">Dept Context</span>
                    </button>
                  )}
                </>
              ) : (
                // Legacy single-select mode
                <>
                  <Select
                    value={selectedDepartment || '__none__'}
                    onValueChange={(v) => onSelectDepartment?.(v === '__none__' ? null : v)}
                    disabled={disabled}
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
                      onValueChange={(v) => onSelectRole?.(v === '__none__' ? null : v)}
                      disabled={disabled}
                    >
                      <SelectTrigger className="context-select-trigger role-select-trigger">
                        <SelectValue
                          placeholder={`All ${departments.find((d) => d.id === selectedDepartment)?.name || 'Department'} Roles`}
                        />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">
                          All{' '}
                          {departments.find((d) => d.id === selectedDepartment)?.name ||
                            'Department'}{' '}
                          Roles
                        </SelectItem>
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
                      onClick={() => onToggleDepartmentContext?.(!useDepartmentContext)}
                      disabled={disabled}
                      title="Toggle department-specific context (department knowledge)"
                    >
                      <span className="pill-icon">{useDepartmentContext ? '✓' : '○'}</span>
                      <span className="pill-text">Department</span>
                    </button>
                  )}
                </>
              )}
            </>
          )}

          {/* Channel - only when department has channels */}
          {selectedDepartment && channels.length > 0 && (
            <Select
              value={selectedChannel || '__none__'}
              onValueChange={(v) => onSelectChannel?.(v === '__none__' ? null : v)}
              disabled={disabled}
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
              onValueChange={(v) => onSelectStyle?.(v === '__none__' ? null : v)}
              disabled={disabled}
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
