import { useEffect, useCallback, useRef } from 'react';

export interface KeyboardShortcutsOptions {
  onFocusSearch?: () => void;
  onNewConversation?: () => void;
  onNavigateUp?: () => void;
  onNavigateDown?: () => void;
  onSelectCurrent?: () => void;
  onDeleteCurrent?: () => void;
  onEscape?: () => void;
  enabled?: boolean;
  disableWhenInputFocused?: string[];
}

interface KeyboardHandlers {
  onFocusSearch?: (() => void) | undefined;
  onNewConversation?: (() => void) | undefined;
  onNavigateUp?: (() => void) | undefined;
  onNavigateDown?: (() => void) | undefined;
  onSelectCurrent?: (() => void) | undefined;
  onDeleteCurrent?: (() => void) | undefined;
  onEscape?: (() => void) | undefined;
}

/**
 * useKeyboardShortcuts - Global keyboard shortcuts for the sidebar
 */
export function useKeyboardShortcuts({
  onFocusSearch,
  onNewConversation,
  onNavigateUp,
  onNavigateDown,
  onSelectCurrent,
  onDeleteCurrent,
  onEscape,
  enabled = true,
  disableWhenInputFocused = ['input', 'textarea'],
}: KeyboardShortcutsOptions = {}): void {
  const handlersRef = useRef<KeyboardHandlers>({
    onFocusSearch,
    onNewConversation,
    onNavigateUp,
    onNavigateDown,
    onSelectCurrent,
    onDeleteCurrent,
    onEscape,
  });

  // Keep handlers fresh without causing re-subscriptions
  useEffect(() => {
    handlersRef.current = {
      onFocusSearch,
      onNewConversation,
      onNavigateUp,
      onNavigateDown,
      onSelectCurrent,
      onDeleteCurrent,
      onEscape,
    };
  });

  const handleKeyDown = useCallback(
    (e: KeyboardEvent): void => {
      if (!enabled) return;

      const handlers = handlersRef.current;
      const activeElement = document.activeElement as HTMLElement | null;
      const tagName = activeElement?.tagName?.toLowerCase() || '';
      const isEditable = activeElement?.isContentEditable;
      const isInputFocused = disableWhenInputFocused.includes(tagName) || isEditable;

      // Meta key (Cmd on Mac, Ctrl on Windows/Linux)
      const isCmdOrCtrl = e.metaKey || e.ctrlKey;

      // Cmd/Ctrl+K - Focus search (works even when input focused)
      if (isCmdOrCtrl && e.key === 'k') {
        e.preventDefault();
        handlers.onFocusSearch?.();
        return;
      }

      // Cmd/Ctrl+N - New conversation (works even when input focused)
      if (isCmdOrCtrl && e.key === 'n') {
        e.preventDefault();
        handlers.onNewConversation?.();
        return;
      }

      // Skip remaining shortcuts if input is focused
      if (isInputFocused) {
        // But allow Escape to blur/clear
        if (e.key === 'Escape') {
          handlers.onEscape?.();
          activeElement?.blur?.();
        }
        return;
      }

      // Arrow navigation
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        handlers.onNavigateUp?.();
        return;
      }

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        handlers.onNavigateDown?.();
        return;
      }

      // Enter - Select current
      if (e.key === 'Enter') {
        e.preventDefault();
        handlers.onSelectCurrent?.();
        return;
      }

      // Delete/Backspace - Delete current (with confirmation)
      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        handlers.onDeleteCurrent?.();
        return;
      }

      // Escape
      if (e.key === 'Escape') {
        handlers.onEscape?.();
        return;
      }
    },
    [enabled, disableWhenInputFocused]
  );

  useEffect(() => {
    if (!enabled) return;

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [enabled, handleKeyDown]);
}

export interface ListItem {
  id: string;
  [key: string]: unknown;
}

export interface ListNavigationOptions {
  items?: ListItem[];
  currentId?: string | null;
  onSelect?: (id: string) => void;
  enabled?: boolean;
}

export interface ListNavigationReturn {
  getFocusedIndex: () => number;
  getFocusedId: () => string | null;
  setFocusedIndex: (index: number) => void;
  navigateUp: () => void;
  navigateDown: () => void;
  selectCurrent: () => void;
}

/**
 * useListNavigation - Manages keyboard navigation state for a list
 */
export function useListNavigation({
  items = [],
  currentId,
  onSelect,
  enabled = true,
}: ListNavigationOptions = {}): ListNavigationReturn {
  const focusedIndexRef = useRef<number>(-1);
  const itemsRef = useRef<ListItem[]>(items);

  // Keep items fresh
  useEffect(() => {
    itemsRef.current = items;
    // Reset focus if items change significantly
    if (focusedIndexRef.current >= items.length) {
      focusedIndexRef.current = items.length - 1;
    }
  }, [items]);

  // Initialize focused index to current item if none set
  useEffect(() => {
    if (focusedIndexRef.current === -1 && currentId && items.length > 0) {
      const index = items.findIndex((item) => item.id === currentId);
      if (index !== -1) {
        focusedIndexRef.current = index;
      }
    }
  }, [currentId, items]);

  const navigateUp = useCallback(() => {
    if (!enabled || itemsRef.current.length === 0) return;

    focusedIndexRef.current = Math.max(0, focusedIndexRef.current - 1);

    // Scroll into view
    const focusedItem = itemsRef.current[focusedIndexRef.current];
    if (focusedItem) {
      const element = document.querySelector(`[data-conversation-id="${focusedItem.id}"]`);
      element?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }, [enabled]);

  const navigateDown = useCallback(() => {
    if (!enabled || itemsRef.current.length === 0) return;

    focusedIndexRef.current = Math.min(itemsRef.current.length - 1, focusedIndexRef.current + 1);

    // Scroll into view
    const focusedItem = itemsRef.current[focusedIndexRef.current];
    if (focusedItem) {
      const element = document.querySelector(`[data-conversation-id="${focusedItem.id}"]`);
      element?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }, [enabled]);

  const selectCurrent = useCallback(() => {
    if (!enabled || itemsRef.current.length === 0) return;

    const focusedItem = itemsRef.current[focusedIndexRef.current];
    if (focusedItem) {
      onSelect?.(focusedItem.id);
    }
  }, [enabled, onSelect]);

  const getFocusedId = useCallback(() => {
    const focusedItem = itemsRef.current[focusedIndexRef.current];
    return focusedItem?.id || null;
  }, []);

  const setFocusedIndex = useCallback((index: number): void => {
    focusedIndexRef.current = index;
  }, []);

  return {
    getFocusedIndex: () => focusedIndexRef.current,
    getFocusedId,
    setFocusedIndex,
    navigateUp,
    navigateDown,
    selectCurrent,
  };
}

export default useKeyboardShortcuts;
