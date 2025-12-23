/**
 * StatusSelect - A Select component for project status selection
 *
 * Uses Radix Select for desktop and BottomSheet for mobile.
 *
 * This component matches the DepartmentSelect design system:
 * - 12px border-radius on dropdown
 * - 8px border-radius on items
 * - Orange checkmark for selected item
 * - Status-specific colors
 *
 * Usage:
 * <StatusSelect
 *   value={status}
 *   onValueChange={setStatus}
 *   disabled={false}
 *   className="custom-class"
 * />
 */

import * as React from 'react';
import * as SelectPrimitive from '@radix-ui/react-select';
import { Check, ChevronDown, Circle, CheckCircle2, Archive, Layers } from 'lucide-react';
import { cn } from '../../lib/utils';
import { BottomSheet } from './BottomSheet';
import './StatusSelect.css';

// Check if we're on mobile/tablet for bottom sheet vs dropdown
const isMobileDevice = () => typeof window !== 'undefined' && window.innerWidth <= 768;

// Status color definitions
const statusColors = {
  all: {
    bg: '#f3f4f6',
    text: '#374151',
    border: '#d1d5db',
    hoverBg: '#e5e7eb',
  },
  active: {
    bg: '#dcfce7',
    text: '#166534',
    border: '#86efac',
    hoverBg: '#f0fdf4',
  },
  completed: {
    bg: '#dbeafe',
    text: '#1e40af',
    border: '#93c5fd',
    hoverBg: '#eff6ff',
  },
  archived: {
    bg: '#f3f4f6',
    text: '#4b5563',
    border: '#d1d5db',
    hoverBg: '#f9fafb',
  },
};

const statusIcons = {
  all: Layers,
  active: Circle,
  completed: CheckCircle2,
  archived: Archive,
};

const statusLabels = {
  all: 'All Statuses',
  active: 'Active',
  completed: 'Completed',
  archived: 'Archived',
};

const statusOptions = ['all', 'active', 'completed', 'archived'];

// Custom SelectItem matching DepartmentSelectItem pattern
const StatusSelectItem = React.forwardRef(({
  className,
  children,
  status,
  ...props
}, ref) => {
  const colors = statusColors[status] || statusColors.active;
  const Icon = statusIcons[status] || Circle;

  return (
    <SelectPrimitive.Item
      ref={ref}
      className={cn("status-select-item", className)}
      style={{
        '--status-hover-bg': colors.hoverBg,
        '--status-checked-bg': colors.bg,
        '--status-checked-text': colors.text,
      }}
      {...props}
    >
      <span className="status-select-item-indicator">
        <SelectPrimitive.ItemIndicator>
          <Check className="h-4 w-4" />
        </SelectPrimitive.ItemIndicator>
      </span>
      <Icon className="h-3.5 w-3.5" style={{ color: colors.text }} />
      <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
    </SelectPrimitive.Item>
  );
});
StatusSelectItem.displayName = 'StatusSelectItem';

export function StatusSelect({
  value,
  onValueChange,
  disabled = false,
  className,
}) {
  const [open, setOpen] = React.useState(false);
  const colors = statusColors[value] || statusColors.active;
  const Icon = statusIcons[value] || Circle;

  // Style for trigger - colored based on current status
  const triggerStyle = {
    background: colors.bg,
    color: colors.text,
    borderColor: colors.border,
  };

  const handleSelect = (statusValue) => {
    onValueChange(statusValue);
    setOpen(false);
  };

  // Mobile: use BottomSheet
  if (isMobileDevice()) {
    return (
      <>
        <button
          className={cn("status-select-trigger", className)}
          disabled={disabled}
          onClick={() => setOpen(true)}
          style={triggerStyle}
          type="button"
        >
          <Icon className="h-3.5 w-3.5" />
          <span>{statusLabels[value] || value}</span>
          <ChevronDown className="h-4 w-4 opacity-50 shrink-0" />
        </button>

        <BottomSheet
          isOpen={open}
          onClose={() => setOpen(false)}
          title="Filter by Status"
        >
          <div className="status-select-list-mobile">
            {statusOptions.map(status => {
              const isSelected = status === value;
              const statusColor = statusColors[status];
              const StatusIcon = statusIcons[status];
              return (
                <button
                  key={status}
                  className={cn("status-select-item-mobile", isSelected && "selected")}
                  onClick={() => handleSelect(status)}
                  style={{
                    '--status-bg': statusColor.bg,
                    '--status-text': statusColor.text,
                  }}
                  type="button"
                >
                  <div
                    className={cn("status-select-radio", isSelected && "checked")}
                    style={{
                      '--radio-checked-bg': statusColor.text,
                      '--radio-checked-border': statusColor.text
                    }}
                  >
                    {isSelected && <Check className="h-3 w-3" />}
                  </div>
                  <StatusIcon className="h-4 w-4" style={{ color: statusColor.text }} />
                  <span className="status-select-item-label">{statusLabels[status]}</span>
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
        className={cn("status-select-trigger", className)}
        style={triggerStyle}
      >
        <Icon className="h-3.5 w-3.5" />
        <SelectPrimitive.Value>{statusLabels[value] || value}</SelectPrimitive.Value>
        <SelectPrimitive.Icon asChild>
          <ChevronDown className="h-4 w-4 opacity-50 shrink-0" />
        </SelectPrimitive.Icon>
      </SelectPrimitive.Trigger>
      <SelectPrimitive.Portal>
        <SelectPrimitive.Content
          className="status-select-content"
          position="popper"
          side="bottom"
          align="start"
          sideOffset={4}
        >
          <SelectPrimitive.Viewport className="status-select-viewport">
            <StatusSelectItem value="all" status="all">
              All Statuses
            </StatusSelectItem>
            <StatusSelectItem value="active" status="active">
              Active
            </StatusSelectItem>
            <StatusSelectItem value="completed" status="completed">
              Completed
            </StatusSelectItem>
            <StatusSelectItem value="archived" status="archived">
              Archived
            </StatusSelectItem>
          </SelectPrimitive.Viewport>
        </SelectPrimitive.Content>
      </SelectPrimitive.Portal>
    </SelectPrimitive.Root>
  );
}

export default StatusSelect;
