/**
 * RoleSelect - A Select component for single role selection
 *
 * Usage:
 * <RoleSelect
 *   value={selectedRoleId}
 *   onValueChange={setSelectedRoleId}
 *   roles={roles}
 *   includeAll={true}
 *   allLabel="All Roles"
 *   disabled={false}
 * />
 */

import * as React from 'react';
import * as SelectPrimitive from '@radix-ui/react-select';
import { User, Check, ChevronDown } from 'lucide-react';
import { cn } from '../../lib/utils';
import './RoleSelect.css';

// Custom SelectItem for roles
const RoleSelectItem = React.forwardRef(({
  className,
  children,
  ...props
}, ref) => {
  return (
    <SelectPrimitive.Item
      ref={ref}
      className={cn("role-select-item", className)}
      {...props}
    >
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

export function RoleSelect({
  value,
  onValueChange,
  roles = [],
  includeAll = true,
  allLabel = 'All Roles',
  disabled = false,
  className,
  showIcon = true,
  compact = false,
}) {
  // Get display name for current value
  const selectedRole = value && value !== 'all' ? roles.find(r => r.id === value) : null;

  const getDisplayName = () => {
    if (value === 'all' || !value) {
      return compact ? 'All' : allLabel;
    }
    if (!selectedRole) return compact ? 'All' : allLabel;
    return compact ? selectedRole.name.split(' ')[0] : selectedRole.name;
  };

  return (
    <SelectPrimitive.Root value={value || 'all'} onValueChange={onValueChange} disabled={disabled}>
      <SelectPrimitive.Trigger
        className={cn("role-select-trigger", selectedRole && "has-selection", className)}
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
            {includeAll && (
              <RoleSelectItem value="all">
                {allLabel}
              </RoleSelectItem>
            )}
            {roles.map(role => (
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
