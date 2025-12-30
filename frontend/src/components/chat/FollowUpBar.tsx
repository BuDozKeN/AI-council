/**
 * FollowUpBar - Minimal context controls for follow-up messages
 *
 * Uses icon buttons with popovers - same pattern as Perplexity.
 * Icons show selection state via colored badges.
 * Reuses existing popover patterns from ui components.
 */

import { useState } from 'react';
import * as Popover from '@radix-ui/react-popover';
import { Building2, Users, BookOpen, Zap, Check } from 'lucide-react';
import { cn } from '../../lib/utils';
import { getDeptColor } from '../../lib/colors';
import { BottomSheet } from '../ui/BottomSheet';
import type { Department, Role, Playbook } from '../../types/business';

// Check if we're on mobile/tablet for bottom sheet vs popover
const isMobileDevice = () => typeof window !== 'undefined' && window.innerWidth <= 768;

interface FollowUpBarProps {
  chatMode: 'chat' | 'council';
  onChatModeChange: (mode: 'chat' | 'council') => void;
  departments?: Department[];
  selectedDepartments?: string[];
  onSelectDepartments?: (ids: string[]) => void;
  roles?: Role[];
  selectedRoles?: string[];
  onSelectRoles?: (ids: string[]) => void;
  playbooks?: Playbook[];
  selectedPlaybooks?: string[];
  onSelectPlaybooks?: (ids: string[]) => void;
  isLoading?: boolean;
}

export function FollowUpBar({
  chatMode,
  onChatModeChange,
  departments = [],
  selectedDepartments = [],
  onSelectDepartments,
  roles = [],
  selectedRoles = [],
  onSelectRoles,
  playbooks = [],
  selectedPlaybooks = [],
  onSelectPlaybooks,
  isLoading = false,
}: FollowUpBarProps) {
  const [deptOpen, setDeptOpen] = useState(false);
  const [roleOpen, setRoleOpen] = useState(false);
  const [playbookOpen, setPlaybookOpen] = useState(false);

  const disabled = isLoading;
  const isMobile = isMobileDevice();

  // Toggle helpers
  const toggleDepartment = (id: string) => {
    if (!onSelectDepartments) return;
    const newSelection = selectedDepartments.includes(id)
      ? selectedDepartments.filter(d => d !== id)
      : [...selectedDepartments, id];
    onSelectDepartments(newSelection);
  };

  const toggleRole = (id: string) => {
    if (!onSelectRoles) return;
    const newSelection = selectedRoles.includes(id)
      ? selectedRoles.filter(r => r !== id)
      : [...selectedRoles, id];
    onSelectRoles(newSelection);
  };

  const togglePlaybook = (id: string) => {
    if (!onSelectPlaybooks) return;
    const newSelection = selectedPlaybooks.includes(id)
      ? selectedPlaybooks.filter(p => p !== id)
      : [...selectedPlaybooks, id];
    onSelectPlaybooks(newSelection);
  };

  // Department list content (reusable for popover and bottom sheet)
  const departmentList = (
    <div className="context-popover-list">
      {departments.length === 0 ? (
        <div className="context-popover-empty">No departments</div>
      ) : (
        departments.map(dept => {
          const isSelected = selectedDepartments.includes(dept.id);
          const colors = getDeptColor(dept.id);
          return (
            <button
              key={dept.id}
              className={cn("context-popover-item", isSelected && "selected")}
              onClick={() => toggleDepartment(dept.id)}
              type="button"
              style={{
                '--item-color': colors.text,
                '--item-bg': colors.bg,
              } as React.CSSProperties}
            >
              <div className={cn("context-popover-checkbox", isSelected && "checked")}>
                {isSelected && <Check size={12} />}
              </div>
              <span>{dept.name}</span>
            </button>
          );
        })
      )}
    </div>
  );

  // Role list content
  const roleList = (
    <div className="context-popover-list">
      {roles.length === 0 ? (
        <div className="context-popover-empty">No roles</div>
      ) : (
        roles.map(role => {
          const isSelected = selectedRoles.includes(role.id);
          return (
            <button
              key={role.id}
              className={cn("context-popover-item", isSelected && "selected")}
              onClick={() => toggleRole(role.id)}
              type="button"
            >
              <div className={cn("context-popover-checkbox", isSelected && "checked")}>
                {isSelected && <Check size={12} />}
              </div>
              <span>{role.name}</span>
            </button>
          );
        })
      )}
    </div>
  );

  // Playbook list content
  const playbookList = (
    <div className="context-popover-list">
      {playbooks.length === 0 ? (
        <div className="context-popover-empty">No playbooks</div>
      ) : (
        playbooks.map(pb => {
          const isSelected = selectedPlaybooks.includes(pb.id);
          return (
            <button
              key={pb.id}
              className={cn("context-popover-item", isSelected && "selected")}
              onClick={() => togglePlaybook(pb.id)}
              type="button"
            >
              <div className={cn("context-popover-checkbox", isSelected && "checked")}>
                {isSelected && <Check size={12} />}
              </div>
              <span>{pb.title || pb.name}</span>
            </button>
          );
        })
      )}
    </div>
  );

  // Render icon button with popover or bottom sheet
  const renderContextButton = (
    icon: React.ReactNode,
    label: string,
    count: number,
    open: boolean,
    setOpen: (open: boolean) => void,
    content: React.ReactNode,
    colorClass?: string
  ) => {
    if (isMobile) {
      return (
        <>
          <button
            type="button"
            className={cn("context-icon-btn", count > 0 && "has-selection", colorClass)}
            onClick={() => setOpen(true)}
            disabled={disabled}
            aria-label={label}
            title={label}
          >
            {icon}
            {count > 0 && <span className="context-icon-badge">{count}</span>}
          </button>
          <BottomSheet
            isOpen={open}
            onClose={() => setOpen(false)}
            title={label}
          >
            {content}
          </BottomSheet>
        </>
      );
    }

    return (
      <Popover.Root open={open} onOpenChange={setOpen}>
        <Popover.Trigger asChild>
          <button
            type="button"
            className={cn("context-icon-btn", count > 0 && "has-selection", colorClass)}
            disabled={disabled}
            aria-label={label}
            title={label}
          >
            {icon}
            {count > 0 && <span className="context-icon-badge">{count}</span>}
          </button>
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Content
            className="context-popover-content"
            align="start"
            sideOffset={8}
          >
            <div className="context-popover-header">{label}</div>
            {content}
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
    );
  };

  const hasDepartments = departments.length > 0 && onSelectDepartments;
  const hasRoles = roles.length > 0 && onSelectRoles;
  const hasPlaybooks = playbooks.length > 0 && onSelectPlaybooks;

  return (
    <div className="followup-bar">
      {/* Left side: Context icon buttons */}
      <div className="followup-context-icons">
        {hasDepartments && renderContextButton(
          <Building2 size={16} />,
          "Departments",
          selectedDepartments.length,
          deptOpen,
          setDeptOpen,
          departmentList,
          "dept"
        )}
        {hasRoles && renderContextButton(
          <Users size={16} />,
          "Roles",
          selectedRoles.length,
          roleOpen,
          setRoleOpen,
          roleList,
          "role"
        )}
        {hasPlaybooks && renderContextButton(
          <BookOpen size={16} />,
          "Playbooks",
          selectedPlaybooks.length,
          playbookOpen,
          setPlaybookOpen,
          playbookList,
          "playbook"
        )}

        {/* Mode toggle - subtle icon */}
        <button
          type="button"
          className={cn("context-icon-btn mode-toggle", chatMode === 'council' && "council")}
          onClick={() => !disabled && onChatModeChange(chatMode === 'chat' ? 'council' : 'chat')}
          disabled={disabled}
          aria-label={chatMode === 'chat' ? 'Switch to full council' : 'Switch to quick chat'}
          title={chatMode === 'chat' ? 'Quick mode (click for council)' : 'Council mode (click for quick)'}
        >
          <Zap size={16} />
        </button>
      </div>
    </div>
  );
}
