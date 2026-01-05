/**
 * DepartmentCheckboxItem - Shared department checkbox item for dropdowns
 *
 * SINGLE SOURCE OF TRUTH for department selection UI.
 * Used by both Omnibar (ChatInput) and Stage3 (MultiDepartmentSelect).
 *
 * Features:
 * - Colored left border when selected (department-specific color)
 * - Colored checkbox when checked (department-specific color)
 * - Consistent sizing across desktop and mobile
 */

import { Check } from 'lucide-react';
import { getDeptColor } from '../../lib/colors';
import { cn } from '../../lib/utils';
import type { Department } from '../../types/business';
import './DepartmentCheckboxItem.css';

interface DepartmentCheckboxItemProps {
  department: Department;
  isSelected: boolean;
  onToggle: (id: string) => void;
  /** Use mobile variant with larger touch targets */
  isMobile?: boolean;
}

export function DepartmentCheckboxItem({
  department,
  isSelected,
  onToggle,
  isMobile = false,
}: DepartmentCheckboxItemProps) {
  const colors = getDeptColor(department.id);

  return (
    <button
      type="button"
      className={cn('dept-checkbox-item', isMobile && 'mobile', isSelected && 'selected')}
      onClick={(e) => {
        e.stopPropagation();
        e.preventDefault();
        // Set timestamp to prevent parent modal from closing when selecting departments
        (window as Window & { __multiDeptSelectClickTime?: number }).__multiDeptSelectClickTime =
          Date.now();
        onToggle(department.id);
      }}
      style={
        {
          '--dept-color': colors.text,
          '--dept-bg': colors.bg,
        } as React.CSSProperties
      }
    >
      <div className={cn('dept-checkbox', isSelected && 'checked')}>
        {isSelected && <Check className="dept-checkbox-icon" />}
      </div>
      <span className="dept-checkbox-label">{department.name}</span>
    </button>
  );
}

export default DepartmentCheckboxItem;
