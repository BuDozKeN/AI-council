/**
 * SortSelect - A Select component for sorting options
 *
 * Uses Radix Select for desktop and BottomSheet for mobile.
 * Matches the DepartmentSelect/StatusSelect design system.
 */

import * as React from 'react';
import * as SelectPrimitive from '@radix-ui/react-select';
import { Check, ChevronDown, ArrowUpDown } from 'lucide-react';
import { cn } from '../../lib/utils';
import { BottomSheet } from './BottomSheet';
import './SortSelect.css';

// Check if we're on mobile/tablet for bottom sheet vs dropdown
const isMobileDevice = () => typeof window !== 'undefined' && window.innerWidth <= 768;

interface SortOption {
  value: string;
  label: string;
}

// Sort option definitions - compact labels for filters
const defaultSortOptions: SortOption[] = [
  { value: 'updated', label: 'Latest' },
  { value: 'created', label: 'Newest' },
  { value: 'name', label: 'A-Z' },
  { value: 'decisions', label: 'Decisions' },
];

// Custom SelectItem
const SortSelectItem = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Item>
>(({
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

interface SortSelectProps {
  value: string;
  onValueChange: (value: string) => void;
  disabled?: boolean | undefined;
  className?: string | undefined;
  options?: SortOption[] | undefined;
}

export function SortSelect({
  value,
  onValueChange,
  disabled = false,
  className,
  options = defaultSortOptions,
}: SortSelectProps) {
  const [open, setOpen] = React.useState(false);
  const selectedOption = options.find(o => o.value === value) ?? options[0] ?? { value: '', label: '' };

  const handleSelect = (optionValue: string) => {
    onValueChange(optionValue);
    setOpen(false);
  };

  // Mobile: use BottomSheet
  if (isMobileDevice()) {
    return (
      <>
        <button
          className={cn("sort-select-trigger", className)}
          disabled={disabled}
          onClick={() => setOpen(true)}
          type="button"
        >
          <ArrowUpDown className="h-3.5 w-3.5" />
          <span>{selectedOption.label}</span>
          <ChevronDown className="h-4 w-4 opacity-50 shrink-0" />
        </button>

        <BottomSheet
          isOpen={open}
          onClose={() => setOpen(false)}
          title="Sort By"
        >
          <div className="sort-select-list-mobile">
            {options.map(option => {
              const isSelected = option.value === value;
              return (
                <button
                  key={option.value}
                  className={cn("sort-select-item-mobile", isSelected && "selected")}
                  onClick={() => handleSelect(option.value)}
                  type="button"
                >
                  <div className={cn("sort-select-radio", isSelected && "checked")}>
                    {isSelected && <Check className="h-3 w-3" />}
                  </div>
                  <span className="sort-select-item-label">{option.label}</span>
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
