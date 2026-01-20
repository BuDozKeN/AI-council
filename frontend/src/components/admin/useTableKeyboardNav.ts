/**
 * useTableKeyboardNav - Keyboard navigation hook for admin tables
 *
 * Provides:
 * - Tab through table rows (via tabIndex)
 * - Arrow key navigation (ArrowUp/ArrowDown)
 * - Enter key to trigger row action
 * - Focus management
 */

import { useCallback, useRef, useState } from 'react';

interface UseTableKeyboardNavOptions {
  /** Total number of rows */
  rowCount: number;
  /** Callback when Enter is pressed on a row */
  onRowAction?: (rowIndex: number) => void;
  /** Callback when row selection changes */
  onSelectionChange?: (rowIndex: number | null) => void;
}

interface UseTableKeyboardNavReturn {
  /** Currently selected row index (-1 if none) */
  selectedIndex: number;
  /** Ref to attach to the table body element */
  tableBodyRef: React.RefObject<HTMLTableSectionElement | null>;
  /** Props to spread onto each table row */
  getRowProps: (rowIndex: number) => {
    tabIndex: number;
    'data-selected': string;
    onKeyDown: (e: React.KeyboardEvent) => void;
    onFocus: () => void;
    onClick: () => void;
  };
  /** Focus the table (first row) */
  focusTable: () => void;
  /** Clear selection */
  clearSelection: () => void;
}

export function useTableKeyboardNav({
  rowCount,
  onRowAction,
  onSelectionChange,
}: UseTableKeyboardNavOptions): UseTableKeyboardNavReturn {
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const tableBodyRef = useRef<HTMLTableSectionElement>(null);

  const focusRow = useCallback(
    (index: number) => {
      if (!tableBodyRef.current || index < 0 || index >= rowCount) return;

      const rows = tableBodyRef.current.querySelectorAll('tr');
      const targetRow = rows[index] as HTMLTableRowElement | undefined;
      if (targetRow) {
        targetRow.focus();
        setSelectedIndex(index);
        onSelectionChange?.(index);
      }
    },
    [rowCount, onSelectionChange]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent, rowIndex: number) => {
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          if (rowIndex < rowCount - 1) {
            focusRow(rowIndex + 1);
          }
          break;
        case 'ArrowUp':
          e.preventDefault();
          if (rowIndex > 0) {
            focusRow(rowIndex - 1);
          }
          break;
        case 'Enter':
        case ' ':
          e.preventDefault();
          onRowAction?.(rowIndex);
          break;
        case 'Home':
          e.preventDefault();
          focusRow(0);
          break;
        case 'End':
          e.preventDefault();
          focusRow(rowCount - 1);
          break;
        case 'Escape':
          e.preventDefault();
          setSelectedIndex(-1);
          onSelectionChange?.(null);
          break;
      }
    },
    [rowCount, focusRow, onRowAction, onSelectionChange]
  );

  const getRowProps = useCallback(
    (rowIndex: number) => ({
      tabIndex: 0,
      'data-selected': (selectedIndex === rowIndex).toString(),
      onKeyDown: (e: React.KeyboardEvent) => handleKeyDown(e, rowIndex),
      onFocus: () => {
        setSelectedIndex(rowIndex);
        onSelectionChange?.(rowIndex);
      },
      onClick: () => {
        setSelectedIndex(rowIndex);
        onSelectionChange?.(rowIndex);
      },
    }),
    [selectedIndex, handleKeyDown, onSelectionChange]
  );

  const focusTable = useCallback(() => {
    if (rowCount > 0) {
      focusRow(0);
    }
  }, [rowCount, focusRow]);

  const clearSelection = useCallback(() => {
    setSelectedIndex(-1);
    onSelectionChange?.(null);
  }, [onSelectionChange]);

  return {
    selectedIndex,
    tableBodyRef,
    getRowProps,
    focusTable,
    clearSelection,
  };
}
