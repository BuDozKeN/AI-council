/**
 * DepartmentSelect - A Select component with department color support
 *
 * Uses Radix Select for desktop and BottomSheet for mobile.
 *
 * This component wraps the base Select and adds:
 * - Department-specific colors on hover
 * - Consistent styling across the app
 *
 * Usage:
 * <DepartmentSelect
 *   value={selectedDeptId}
 *   onValueChange={setSelectedDeptId}
 *   departments={departments}
 *   includeAll={true}
 *   allLabel="All Departments"
 *   disabled={false}
 *   className="custom-trigger-class"
 * />
 */

import * as React from 'react';
import * as SelectPrimitive from '@radix-ui/react-select';
import { Building2, Check, ChevronDown } from 'lucide-react';
import { getDeptColor } from '../../lib/colors';
import { cn } from '../../lib/utils';
import { BottomSheet } from './BottomSheet';
import './DepartmentSelect.css';

// Check if we're on mobile/tablet for bottom sheet vs dropdown
const isMobileDevice = () => typeof window !== 'undefined' && window.innerWidth <= 768;

// Custom SelectItem with department color support
const DepartmentSelectItem = React.forwardRef(({
  className,
  children,
  deptId,
  ...props
}, ref) => {
  const colors = getDeptColor(deptId);

  return (
    <SelectPrimitive.Item
      ref={ref}
      className={cn(
        "dept-select-item",
        className
      )}
      style={{
        '--dept-hover-bg': colors.hoverBg,
        '--dept-checked-bg': colors.bg,
        '--dept-checked-text': colors.text,
      }}
      {...props}
    >
      <span className="dept-select-item-indicator">
        <SelectPrimitive.ItemIndicator>
          <Check className="h-4 w-4" />
        </SelectPrimitive.ItemIndicator>
      </span>
      <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
    </SelectPrimitive.Item>
  );
});
DepartmentSelectItem.displayName = 'DepartmentSelectItem';

export function DepartmentSelect({
  value,
  onValueChange,
  departments = [],
  includeAll = true,
  allLabel = 'All Departments',
  disabled = false,
  className,
  showIcon = true,
  compact = false,
}) {
  const [open, setOpen] = React.useState(false);

  // Get display name and color for current value
  const selectedDept = value && value !== 'all' ? departments.find(d => d.id === value) : null;
  const selectedColor = selectedDept ? getDeptColor(selectedDept.id) : null;

  const getDisplayName = () => {
    if (value === 'all' || !value) {
      return compact ? 'All' : allLabel;
    }
    if (!selectedDept) return compact ? 'All' : allLabel;
    return compact ? selectedDept.name.split(' ')[0] : selectedDept.name;
  };

  // Style for trigger when a department is selected
  const triggerStyle = selectedColor ? {
    background: selectedColor.bg,
    color: selectedColor.text,
    borderColor: selectedColor.border,
  } : {};

  const handleSelect = (deptValue) => {
    onValueChange(deptValue);
    setOpen(false);
  };

  // Build items list for mobile
  const allItems = [
    ...(includeAll ? [{ id: 'all', name: allLabel }] : []),
    ...departments
  ];

  // Mobile: use BottomSheet
  if (isMobileDevice()) {
    return (
      <>
        <button
          className={cn("dept-select-trigger", selectedColor && "has-selection", className)}
          disabled={disabled}
          onClick={() => setOpen(true)}
          style={triggerStyle}
          type="button"
        >
          {showIcon && <Building2 className="h-3.5 w-3.5" />}
          <span>{getDisplayName()}</span>
          <ChevronDown className="h-4 w-4 opacity-50 shrink-0" />
        </button>

        <BottomSheet
          isOpen={open}
          onClose={() => setOpen(false)}
          title="Select Department"
        >
          <div className="dept-select-list-mobile">
            {allItems.map(dept => {
              const isSelected = (dept.id === 'all' && (!value || value === 'all')) ||
                               (dept.id === value);
              const colors = getDeptColor(dept.id === 'all' ? null : dept.id);
              return (
                <button
                  key={dept.id}
                  className={cn("dept-select-item-mobile", isSelected && "selected")}
                  onClick={() => handleSelect(dept.id)}
                  style={{
                    '--dept-bg': colors.bg,
                    '--dept-text': colors.text,
                    '--radio-checked-bg': colors.text,
                    '--radio-checked-border': colors.text
                  }}
                  type="button"
                >
                  <div className={cn("dept-select-radio", isSelected && "checked")}>
                    {isSelected && <Check className="h-3 w-3" />}
                  </div>
                  <span className="dept-select-item-label">{dept.name}</span>
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
        className={cn("dept-select-trigger", selectedColor && "has-selection", className)}
        style={triggerStyle}
      >
        {showIcon && <Building2 className="h-3.5 w-3.5" />}
        <SelectPrimitive.Value>{getDisplayName()}</SelectPrimitive.Value>
        <SelectPrimitive.Icon asChild>
          <ChevronDown className="h-4 w-4 opacity-50 shrink-0" />
        </SelectPrimitive.Icon>
      </SelectPrimitive.Trigger>
      <SelectPrimitive.Portal>
        <SelectPrimitive.Content
          className="dept-select-content"
          position="popper"
          side="bottom"
          align="start"
          sideOffset={4}
        >
          <SelectPrimitive.Viewport className="dept-select-viewport">
            {includeAll && (
              <DepartmentSelectItem value="all" deptId={null}>
                {allLabel}
              </DepartmentSelectItem>
            )}
            {departments.map(dept => (
              <DepartmentSelectItem key={dept.id} value={dept.id} deptId={dept.id}>
                {dept.name}
              </DepartmentSelectItem>
            ))}
          </SelectPrimitive.Viewport>
        </SelectPrimitive.Content>
      </SelectPrimitive.Portal>
    </SelectPrimitive.Root>
  );
}

export default DepartmentSelect;
