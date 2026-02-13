/**
 * ContextSelectItem - Unified selectable list item for context panels
 *
 * SINGLE SOURCE OF TRUTH for checkbox/radio item rendering in:
 * - OmniBar (Company, Project, Role, Playbook sections)
 * - ChatInput (Project, Role, Playbook sections)
 * - DepartmentCheckboxItem (wrapper that adds department colors)
 *
 * Supports two visual modes:
 * - checkbox: square indicator, indigo when checked (multi-select)
 * - radio: round indicator, emerald when checked (single-select)
 *
 * Optional accentColor enables a colored left border (for departments).
 */

import { Check } from 'lucide-react';
import { cn } from '../../lib/utils';
import './ContextSelectItem.css';

interface ContextSelectItemProps {
  label: string;
  isSelected: boolean;
  onToggle: () => void;
  /** checkbox = square/indigo (multi-select), radio = round/emerald (single-select) */
  mode?: 'checkbox' | 'radio';
  /** Use mobile variant with larger touch targets */
  isMobile?: boolean;
  /** Optional accent color for left border + indicator fill when selected */
  accentColor?: string;
}

export function ContextSelectItem({
  label,
  isSelected,
  onToggle,
  mode = 'checkbox',
  isMobile = false,
  accentColor,
}: ContextSelectItemProps) {
  return (
    <label
      className={cn(
        'ctx-select-item',
        isMobile && 'mobile',
        isSelected && 'selected',
        accentColor && 'has-accent'
      )}
      style={accentColor ? ({ '--accent-color': accentColor } as React.CSSProperties) : undefined}
    >
      <input
        type="checkbox"
        checked={isSelected}
        onChange={() => onToggle()}
        className="ctx-select-input"
        aria-label={label}
        onMouseDown={(e) => e.preventDefault()}
      />
      <div
        className={cn('ctx-select-indicator', mode === 'radio' && 'radio', isSelected && 'checked')}
        aria-hidden="true"
      >
        {isSelected && <Check className="ctx-select-icon" />}
      </div>
      <span className="ctx-select-label">{label}</span>
    </label>
  );
}
