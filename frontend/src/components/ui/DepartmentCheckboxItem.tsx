/**
 * DepartmentCheckboxItem - Department-specific checkbox item
 *
 * Thin wrapper around ContextSelectItem that adds department-specific
 * colored borders and checkbox fills via getDeptColor().
 *
 * Used by Omnibar (ChatInput/OmniBar) and Stage3 (MultiDepartmentSelect).
 * External API is unchanged — no changes needed in consumers.
 */

import { getDeptColor } from '../../lib/colors';
import type { Department } from '../../types/business';
import { ContextSelectItem } from './ContextSelectItem';

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
    <ContextSelectItem
      label={department.name}
      isSelected={isSelected}
      onToggle={() => {
        // Set timestamp to prevent parent modal from closing when selecting departments
        (window as Window & { __multiDeptSelectClickTime?: number }).__multiDeptSelectClickTime =
          Date.now();
        onToggle(department.id);
      }}
      mode="checkbox"
      isMobile={isMobile}
      accentColor={colors.text}
    />
  );
}

export default DepartmentCheckboxItem;
