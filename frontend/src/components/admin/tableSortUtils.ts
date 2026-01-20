/**
 * tableSortUtils - Sorting utilities for admin tables
 * Separated from SortableTableHeader to satisfy react-refresh/only-export-components
 */

import { useState, useCallback } from 'react';

export type SortDirection = 'asc' | 'desc' | null;

export interface SortState<T extends string> {
  column: T | null;
  direction: SortDirection;
}

/**
 * Hook to manage sort state with toggle logic
 */
export function useSortState<T extends string>(
  defaultColumn: T | null = null,
  defaultDirection: SortDirection = 'desc'
): [SortState<T>, (column: T) => void] {
  const [sortState, setSortState] = useState<SortState<T>>({
    column: defaultColumn,
    direction: defaultDirection,
  });

  const handleSort = useCallback((column: T) => {
    setSortState((prev) => {
      if (prev.column === column) {
        // Toggle direction
        if (prev.direction === 'desc') {
          return { column, direction: 'asc' };
        } else if (prev.direction === 'asc') {
          // Return to default (desc) on third click
          return { column, direction: 'desc' };
        }
      }
      // New column, start with desc
      return { column, direction: 'desc' };
    });
  }, []);

  return [sortState, handleSort];
}

/**
 * Generic sort function for arrays
 */
export function sortData<T>(
  data: T[],
  sortState: SortState<string>,
  getters: Record<string, (item: T) => string | number | Date | null | undefined>
): T[] {
  if (!sortState.column || !sortState.direction) {
    return data;
  }

  const getter = getters[sortState.column];
  if (!getter) {
    return data;
  }

  return [...data].sort((a, b) => {
    const aVal = getter(a);
    const bVal = getter(b);

    // Handle nulls - always sort to end
    if (aVal == null && bVal == null) return 0;
    if (aVal == null) return 1;
    if (bVal == null) return -1;

    let comparison = 0;

    if (typeof aVal === 'string' && typeof bVal === 'string') {
      comparison = aVal.localeCompare(bVal, undefined, { sensitivity: 'base' });
    } else if (aVal instanceof Date && bVal instanceof Date) {
      comparison = aVal.getTime() - bVal.getTime();
    } else {
      comparison = aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
    }

    return sortState.direction === 'asc' ? comparison : -comparison;
  });
}
