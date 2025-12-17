/**
 * SortSelect - A Select component for sorting options
 *
 * Matches the DepartmentSelect/StatusSelect design system.
 */

import * as React from 'react';
import * as SelectPrimitive from '@radix-ui/react-select';
import { Check, ChevronDown, ArrowUpDown } from 'lucide-react';
import { cn } from '../../lib/utils';
import './SortSelect.css';

// Sort option definitions
const sortOptions = [
  { value: 'updated', label: 'Last Updated' },
  { value: 'created', label: 'Date Created' },
  { value: 'name', label: 'Name' },
  { value: 'decisions', label: 'Most Decisions' },
];

// Custom SelectItem
const SortSelectItem = React.forwardRef(({
  className,
  children,
  ...props
}, ref) => (
  <SelectPrimitive.Item
    ref={ref}
    className={cn("sort-select-item", className)}
    {...props}
  >
    <span className="sort-select-item-indicator">
      <SelectPrimitive.ItemIndicator>
        <Check className="h-4 w-4" />
      </SelectPrimitive.ItemIndicator>
    </span>
    <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
  </SelectPrimitive.Item>
));
SortSelectItem.displayName = 'SortSelectItem';

export function SortSelect({
  value,
  onValueChange,
  disabled = false,
  className,
  options = sortOptions,
}) {
  const selectedOption = options.find(o => o.value === value) || options[0];

  return (
    <SelectPrimitive.Root value={value} onValueChange={onValueChange} disabled={disabled}>
      <SelectPrimitive.Trigger
        className={cn("sort-select-trigger", className)}
      >
        <ArrowUpDown className="h-3.5 w-3.5" />
        <SelectPrimitive.Value>{selectedOption.label}</SelectPrimitive.Value>
        <SelectPrimitive.Icon asChild>
          <ChevronDown className="h-4 w-4 opacity-50 shrink-0" />
        </SelectPrimitive.Icon>
      </SelectPrimitive.Trigger>
      <SelectPrimitive.Portal>
        <SelectPrimitive.Content
          className="sort-select-content"
          position="popper"
          side="bottom"
          align="start"
          sideOffset={4}
        >
          <SelectPrimitive.Viewport className="sort-select-viewport">
            {options.map(option => (
              <SortSelectItem key={option.value} value={option.value}>
                {option.label}
              </SortSelectItem>
            ))}
          </SelectPrimitive.Viewport>
        </SelectPrimitive.Content>
      </SelectPrimitive.Portal>
    </SelectPrimitive.Root>
  );
}

export default SortSelect;
