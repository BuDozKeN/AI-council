/**
 * DepartmentSelect - A Select component with department color support
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
import './DepartmentSelect.css';

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
          style={{
            borderRadius: '12px',
            border: '1px solid #e5e7eb',
            background: 'white',
            boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
            overflow: 'hidden',
          }}
        >
          <SelectPrimitive.Viewport className="dept-select-viewport" style={{ padding: '8px' }}>
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
