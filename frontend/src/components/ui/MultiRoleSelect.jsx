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
import * as Popover from '@radix-ui/react-popover';
import { User, Check, ChevronDown, X } from 'lucide-react';
import { cn } from '../../lib/utils';
import { BottomSheet } from './BottomSheet';
import './MultiRoleSelect.css';

// Check if we're on mobile/tablet for bottom sheet vs dropdown
const isMobileDevice = () => typeof window !== 'undefined' && window.innerWidth <= 768;

export function MultiRoleSelect({
  value = [],
  onValueChange,
  roles = [],
  disabled = false,
  placeholder = 'Select roles...',
  className,
}) {
  const [open, setOpen] = React.useState(false);

  // Get selected roles with their data
  const selectedRoles = value
    .map(id => roles.find(r => r.id === id))
    .filter(Boolean);

  const toggleRole = (roleId) => {
    if (value.includes(roleId)) {
      onValueChange(value.filter(id => id !== roleId));
    } else {
      onValueChange([...value, roleId]);
    }
  };

  const removeRole = (e, roleId) => {
    e.stopPropagation();
    onValueChange(value.filter(id => id !== roleId));
  };

  // Shared trigger content
  const triggerContent = (
    <>
      <User className="h-3.5 w-3.5 shrink-0" />

      {selectedRoles.length === 0 ? (
        <span className="multi-role-placeholder">{placeholder}</span>
      ) : (
        <div className="multi-role-badges">
          {selectedRoles.map(role => (
            <span
              key={role.id}
              className="multi-role-badge"
            >
              {role.name}
              <span
                className="multi-role-badge-remove"
                onClick={(e) => removeRole(e, role.id)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => e.key === 'Enter' && removeRole(e, role.id)}
              >
                <X className="h-3 w-3" />
              </span>
            </span>
          ))}
        </div>
      )}

      <ChevronDown className="h-4 w-4 opacity-50 shrink-0 ml-auto" />
    </>
  );

  // Shared role list content
  const roleList = (isMobile = false) => (
    <div className={isMobile ? "multi-role-list-mobile" : "multi-role-list"}>
      {roles.length === 0 ? (
        <div className="multi-role-empty">No roles available</div>
      ) : (
        roles.map(role => {
          const isSelected = value.includes(role.id);

          return (
            <button
              key={role.id}
              className={cn(
                isMobile ? "multi-role-item-mobile" : "multi-role-item",
                isSelected && "selected"
              )}
              onClick={() => toggleRole(role.id)}
              type="button"
            >
              <div className={cn("multi-role-checkbox", isSelected && "checked")}>
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
          className={cn("multi-role-trigger", className)}
          disabled={disabled}
          onClick={() => setOpen(true)}
          type="button"
        >
          {triggerContent}
        </button>

        <BottomSheet
          isOpen={open}
          onClose={() => setOpen(false)}
          title="Select Roles"
        >
          {roleList(true)}
        </BottomSheet>
      </>
    );
  }

  // Desktop: use Popover
  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger
        className={cn("multi-role-trigger", className)}
        disabled={disabled}
      >
        {triggerContent}
      </Popover.Trigger>

      <Popover.Portal>
        <Popover.Content
          className="multi-role-content"
          align="start"
          sideOffset={4}
          style={{
            borderRadius: '12px',
            border: '1px solid #e5e7eb',
            background: 'white',
            boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
            overflow: 'hidden',
            zIndex: 9999,
          }}
        >
          {roleList(false)}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

export default MultiRoleSelect;
