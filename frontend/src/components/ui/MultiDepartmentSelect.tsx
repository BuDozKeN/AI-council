/**
 * MultiDepartmentSelect - A multi-select component for departments
 *
 * Uses Radix Popover for the dropdown and DepartmentCheckboxItem for items.
 * DepartmentCheckboxItem is the SINGLE SOURCE OF TRUTH for department
 * checkbox styling - shared with Omnibar for consistency.
 *
 * Usage:
 * <MultiDepartmentSelect
 *   value={selectedDeptIds}  // Array of department IDs
 *   onValueChange={setSelectedDeptIds}
 *   departments={departments}
 *   disabled={false}
 *   placeholder="Select departments..."
 * />
 */

import * as React from 'react';
import { useTranslation } from 'react-i18next';
import * as Popover from '@radix-ui/react-popover';
import { Building2, ChevronDown } from 'lucide-react';
import { getDeptColor } from '../../lib/colors';
import { cn } from '../../lib/utils';
import { BottomSheet } from './BottomSheet';
import { DepartmentCheckboxItem } from './DepartmentCheckboxItem';
import type { Department } from '../../types/business';
import './MultiDepartmentSelect.css';

// Check if we're on mobile/tablet for bottom sheet vs dropdown
// Use 768px to include tablets like iPad Mini
const isMobileDevice = () => typeof window !== 'undefined' && window.innerWidth <= 768;

interface MultiDepartmentSelectProps {
  value?: string[] | undefined;
  onValueChange: (ids: string[]) => void;
  departments?: Department[] | undefined;
  disabled?: boolean | undefined;
  placeholder?: string | undefined;
  className?: string | undefined;
  title?: string | undefined;
}

export function MultiDepartmentSelect({
  value = [],
  onValueChange,
  departments = [],
  disabled = false,
  placeholder,
  className,
}: MultiDepartmentSelectProps) {
  const { t } = useTranslation();
  const [open, setOpen] = React.useState(false);
  const actualPlaceholder = placeholder || t('departments.selectDepartments');

  // Get selected departments with their data
  const selectedDepts = value
    .map((id) => departments.find((d) => d.id === id))
    .filter((d): d is Department => Boolean(d));

  // Build tooltip text showing all selected departments
  const tooltipText =
    selectedDepts.length === 0
      ? placeholder
      : selectedDepts.length === 1
        ? selectedDepts[0]?.name
        : `Selected departments:\n${selectedDepts.map((d) => `• ${d.name}`).join('\n')}`;

  const toggleDepartment = (deptId: string) => {
    if (value.includes(deptId)) {
      onValueChange(value.filter((id) => id !== deptId));
    } else {
      onValueChange([...value, deptId]);
    }
  };

  // Compact trigger content - shows count or single dept name
  const triggerContent = (
    <>
      <Building2 className="h-3.5 w-3.5 shrink-0" />

      {selectedDepts.length === 0 ? (
        <span className="multi-dept-placeholder">{actualPlaceholder}</span>
      ) : selectedDepts.length === 1 && selectedDepts[0] ? (
        // Single department: show name with color dot
        <span className="multi-dept-single">
          <span
            className="multi-dept-dot"
            style={{ background: getDeptColor(selectedDepts[0].id).text }}
          />
          {selectedDepts[0].name}
        </span>
      ) : (
        // Multiple departments: show count with color dots
        <span className="multi-dept-count">
          <span className="multi-dept-dots">
            {selectedDepts.slice(0, 3).map((dept) => (
              <span
                key={dept.id}
                className="multi-dept-dot"
                style={{ background: getDeptColor(dept.id).text }}
              />
            ))}
          </span>
          {t('multiSelect.deptsCount', { count: selectedDepts.length })}
        </span>
      )}

      <ChevronDown className="h-4 w-4 opacity-50 shrink-0 ml-auto" />
    </>
  );

  // Shared department list content - uses DepartmentCheckboxItem for consistency
  const departmentList = (isMobile: boolean = false) => (
    <div className={isMobile ? 'multi-dept-list-mobile' : 'multi-dept-list'}>
      {departments.length === 0 ? (
        <div className="multi-dept-empty">{t('context.noDepartments')}</div>
      ) : (
        departments.map((dept) => (
          <DepartmentCheckboxItem
            key={dept.id}
            department={dept}
            isSelected={value.includes(dept.id)}
            onToggle={toggleDepartment}
            isMobile={isMobile}
          />
        ))
      )}
    </div>
  );

  // Mobile: use BottomSheet
  if (isMobileDevice()) {
    return (
      <>
        <button
          className={cn('multi-dept-trigger', className)}
          disabled={disabled}
          onClick={() => setOpen(true)}
          type="button"
          title={tooltipText}
        >
          {triggerContent}
        </button>

        <BottomSheet
          isOpen={open}
          onClose={() => setOpen(false)}
          title={t('departments.selectDepartments')}
        >
          {departmentList(true)}
        </BottomSheet>
      </>
    );
  }

  // Desktop: use Popover
  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger
        className={cn('multi-dept-trigger', className)}
        disabled={disabled}
        title={tooltipText}
      >
        {triggerContent}
      </Popover.Trigger>

      <Popover.Portal>
        <Popover.Content className="multi-dept-content" align="start" sideOffset={4}>
          {departmentList(false)}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

export default MultiDepartmentSelect;
