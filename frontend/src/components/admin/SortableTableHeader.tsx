/**
 * SortableTableHeader - Reusable sortable table header component
 * Provides column sorting with visual indicators (arrows)
 */

import { ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react';
import type { SortState } from './tableSortUtils';

interface SortableTableHeaderProps<T extends string> {
  /** Column key for sorting */
  column: T;
  /** Display label for the header */
  label: string;
  /** Current sort state */
  sortState: SortState<T>;
  /** Callback when header is clicked */
  onSort: (column: T) => void;
  /** Whether this column is sortable (default: true) */
  sortable?: boolean;
  /** Additional class name */
  className?: string;
}

export function SortableTableHeader<T extends string>({
  column,
  label,
  sortState,
  onSort,
  sortable = true,
  className = '',
}: SortableTableHeaderProps<T>) {
  const isActive = sortState.column === column;
  const direction = isActive ? sortState.direction : null;

  const handleClick = () => {
    if (sortable) {
      onSort(column);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (sortable && (e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault();
      onSort(column);
    }
  };

  if (!sortable) {
    return <th className={className}>{label}</th>;
  }

  return (
    <th
      className={`admin-sortable-header ${isActive ? 'admin-sortable-header--active' : ''} ${className}`}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      tabIndex={0}
      role="columnheader"
      aria-sort={direction === 'asc' ? 'ascending' : direction === 'desc' ? 'descending' : 'none'}
    >
      <span className="admin-sortable-header-content">
        <span className="admin-sortable-header-label">{label}</span>
        <span className="admin-sortable-header-icon">
          {direction === 'asc' ? (
            <ChevronUp className="h-4 w-4" aria-hidden="true" />
          ) : direction === 'desc' ? (
            <ChevronDown className="h-4 w-4" aria-hidden="true" />
          ) : (
            <ChevronsUpDown className="h-4 w-4" aria-hidden="true" />
          )}
        </span>
      </span>
    </th>
  );
}
