/**
 * MultiRoleSelect - A multi-select component for roles
 *
 * Uses Radix Popover for the dropdown and checkboxes for multi-select.
 * On mobile/tablet, uses BottomSheet for better UX.
 *
 * Usage:
 * <MultiRoleSelect
 *   value={selectedRoleIds}  // Array of role IDs
 *   onValueChange={setSelectedRoleIds}
 *   roles={roles}
 *   disabled={false}
 *   placeholder="Select roles..."
 * />
 */

import * as React from 'react';
import { useTranslation } from 'react-i18next';
import * as Popover from '@radix-ui/react-popover';
import { User, Check, ChevronDown } from 'lucide-react';
import { cn } from '../../lib/utils';
import { BottomSheet } from './BottomSheet';
import type { Role } from '../../types/business';
import './select.css';
import './MultiRoleSelect.css';

// Check if we're on mobile/tablet for bottom sheet vs dropdown
const isMobileDevice = () => typeof window !== 'undefined' && window.innerWidth <= 768;

interface MultiRoleSelectProps {
  value?: string[] | undefined;
  onValueChange: (ids: string[]) => void;
  roles?: Role[] | undefined;
  disabled?: boolean | undefined;
  placeholder?: string | undefined;
  className?: string | undefined;
}

export function MultiRoleSelect({
  value = [],
  onValueChange,
  roles = [],
  disabled = false,
  placeholder,
  className,
}: MultiRoleSelectProps) {
  const { t } = useTranslation();
  const [open, setOpen] = React.useState(false);
  const actualPlaceholder = placeholder || t('roles.selectRoles');

  // Get selected roles with their data
  const selectedRoles = value
    .map((id) => roles.find((r) => r.id === id))
    .filter((r): r is Role => Boolean(r));

  const toggleRole = (roleId: string) => {
    if (value.includes(roleId)) {
      onValueChange(value.filter((id) => id !== roleId));
    } else {
      onValueChange([...value, roleId]);
    }
  };

  // Shared trigger content - compact format like departments
  const triggerContent = (
    <>
      <User className="h-3.5 w-3.5 shrink-0" />

      {selectedRoles.length === 0 ? (
        <span className="multi-role-placeholder">{actualPlaceholder}</span>
      ) : selectedRoles.length === 1 && selectedRoles[0] ? (
        // Single role: show name
        <span className="multi-role-single">{selectedRoles[0].name}</span>
      ) : (
        // Multiple roles: show count
        <span className="multi-role-count">
          {t('multiSelect.rolesCount', { count: selectedRoles.length })}
        </span>
      )}

      <ChevronDown className="h-4 w-4 opacity-50 shrink-0 ml-auto" />
    </>
  );

  // Shared role list content
  const roleList = (isMobile = false) => (
    <div className={isMobile ? 'multi-role-list-mobile' : 'multi-role-list'}>
      {roles.length === 0 ? (
        <div className="multi-role-empty">{t('context.noRoles')}</div>
      ) : (
        roles.map((role) => {
          const isSelected = value.includes(role.id);

          return (
            <button
              key={role.id}
              className={cn(
                isMobile ? 'multi-role-item-mobile' : 'multi-role-item',
                isSelected && 'selected'
              )}
              onClick={() => toggleRole(role.id)}
              type="button"
            >
              <div className={cn('multi-role-checkbox', isSelected && 'checked')}>
                {isSelected && <Check className="h-3 w-3" />}
              </div>
              <div className="multi-role-item-info">
                <span className="multi-role-item-label">{role.name}</span>
                {role.description && (
                  <span className="multi-role-item-desc">{role.description}</span>
                )}
              </div>
            </button>
          );
        })
      )}
    </div>
  );

  // Mobile: use BottomSheet
  if (isMobileDevice()) {
    return (
      <>
        <button
          className={cn('select-trigger select-trigger--compact multi-role-trigger', className)}
          disabled={disabled}
          onClick={() => setOpen(true)}
          type="button"
        >
          {triggerContent}
        </button>

        <BottomSheet isOpen={open} onClose={() => setOpen(false)} title={t('roles.selectRoles')}>
          {roleList(true)}
        </BottomSheet>
      </>
    );
  }

  // Desktop: use Popover
  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger
        className={cn('select-trigger select-trigger--compact multi-role-trigger', className)}
        disabled={disabled}
      >
        {triggerContent}
      </Popover.Trigger>

      <Popover.Portal>
        <Popover.Content className="multi-role-content" align="start" sideOffset={4}>
          {roleList(false)}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

export default MultiRoleSelect;
