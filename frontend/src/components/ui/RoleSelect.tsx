/**
 * RoleSelect - A Select component for single role selection
 *
 * Uses Radix Select for desktop and BottomSheet for mobile.
 */

import * as React from 'react';
import { useTranslation } from 'react-i18next';
import * as SelectPrimitive from '@radix-ui/react-select';
import { User, Check, ChevronDown } from 'lucide-react';
import { cn } from '../../lib/utils';
import { BottomSheet } from './BottomSheet';
import type { Role } from '../../types/business';
import './RoleSelect.css';

// Check if we're on mobile/tablet for bottom sheet vs dropdown
const isMobileDevice = () => typeof window !== 'undefined' && window.innerWidth <= 768;

interface RoleSelectItemProps extends React.ComponentPropsWithoutRef<typeof SelectPrimitive.Item> {
  className?: string;
  children?: React.ReactNode;
}

// Custom SelectItem for roles
const RoleSelectItem = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Item>,
  RoleSelectItemProps
>(({ className, children, ...props }, ref) => {
  return (
    <SelectPrimitive.Item ref={ref} className={cn('role-select-item', className)} {...props}>
      <span className="role-select-item-indicator">
        <SelectPrimitive.ItemIndicator>
          <Check className="h-4 w-4" />
        </SelectPrimitive.ItemIndicator>
      </span>
      <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
    </SelectPrimitive.Item>
  );
});
RoleSelectItem.displayName = 'RoleSelectItem';

interface RoleItem {
  id: string;
  name: string;
}

interface RoleSelectProps {
  value?: string | null;
  onValueChange: (value: string) => void;
  roles?: Role[];
  includeAll?: boolean;
  allLabel?: string;
  disabled?: boolean;
  className?: string;
  showIcon?: boolean;
  compact?: boolean;
}

export function RoleSelect({
  value,
  onValueChange,
  roles = [],
  includeAll = true,
  allLabel,
  disabled = false,
  className,
  showIcon = true,
  compact = false,
}: RoleSelectProps) {
  const { t } = useTranslation();
  const [open, setOpen] = React.useState<boolean>(false);
  const actualAllLabel = allLabel || t('roles.allRoles');

  // Get display name for current value
  const selectedRole = value && value !== 'all' ? roles.find((r) => r.id === value) : null;

  const getDisplayName = (): string => {
    if (value === 'all' || !value) {
      return compact ? t('common.all') : actualAllLabel;
    }
    if (!selectedRole) return compact ? t('common.all') : actualAllLabel;
    const firstName = selectedRole.name.split(' ')[0];
    return compact ? (firstName ?? selectedRole.name) : selectedRole.name;
  };

  const handleSelect = (roleValue: string) => {
    onValueChange(roleValue);
    setOpen(false);
  };

  // Build items list for mobile
  const allItems: RoleItem[] = [
    ...(includeAll ? [{ id: 'all', name: actualAllLabel }] : []),
    ...roles.map((r) => ({ id: r.id, name: r.name })),
  ];

  // Mobile: use BottomSheet
  if (isMobileDevice()) {
    return (
      <>
        <button
          className={cn('role-select-trigger', selectedRole && 'has-selection', className)}
          disabled={disabled}
          onClick={() => setOpen(true)}
          type="button"
        >
          {showIcon && <User className="h-3.5 w-3.5" />}
          <span>{getDisplayName()}</span>
          <ChevronDown className="h-4 w-4 opacity-50 shrink-0" />
        </button>

        <BottomSheet isOpen={open} onClose={() => setOpen(false)} title={t('roles.selectRoles')}>
          <div className="role-select-list-mobile">
            {allItems.map((role) => {
              const isSelected =
                (role.id === 'all' && (!value || value === 'all')) || role.id === value;
              return (
                <button
                  key={role.id}
                  className={cn('role-select-item-mobile', isSelected && 'selected')}
                  onClick={() => handleSelect(role.id)}
                  type="button"
                >
                  <div className={cn('role-select-radio', isSelected && 'checked')}>
                    {isSelected && <Check className="h-3 w-3" />}
                  </div>
                  <span className="role-select-item-label">{role.name}</span>
                </button>
              );
            })}
          </div>
        </BottomSheet>
      </>
    );
  }

  // Desktop: use Radix Select
  return (
    <SelectPrimitive.Root value={value || 'all'} onValueChange={onValueChange} disabled={disabled}>
      <SelectPrimitive.Trigger
        className={cn('role-select-trigger', selectedRole && 'has-selection', className)}
      >
        {showIcon && <User className="h-3.5 w-3.5" />}
        <SelectPrimitive.Value>{getDisplayName()}</SelectPrimitive.Value>
        <SelectPrimitive.Icon asChild>
          <ChevronDown className="h-4 w-4 opacity-50 shrink-0" />
        </SelectPrimitive.Icon>
      </SelectPrimitive.Trigger>
      <SelectPrimitive.Portal>
        <SelectPrimitive.Content
          className="role-select-content"
          position="popper"
          side="bottom"
          align="start"
          sideOffset={4}
        >
          <SelectPrimitive.Viewport className="role-select-viewport">
            {includeAll && <RoleSelectItem value="all">{actualAllLabel}</RoleSelectItem>}
            {roles.map((role) => (
              <RoleSelectItem key={role.id} value={role.id}>
                {role.name}
              </RoleSelectItem>
            ))}
          </SelectPrimitive.Viewport>
        </SelectPrimitive.Content>
      </SelectPrimitive.Portal>
    </SelectPrimitive.Root>
  );
}

export default RoleSelect;
