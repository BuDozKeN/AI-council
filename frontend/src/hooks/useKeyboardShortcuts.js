import { useEffect, useCallback, useRef } from 'react';

/**
 * useKeyboardShortcuts - Global keyboard shortcuts for the sidebar
 *
 * Supports:
 * - Cmd/Ctrl+K: Focus search
 * - Cmd/Ctrl+N: New conversation
 * - Arrow keys: Navigate conversation list
 * - Enter: Select focused conversation
 * - Delete/Backspace: Delete focused conversation
 * - Escape: Clear search / close panels
 *
 * @param {Object} options - Configuration options
 * @param {Function} options.onFocusSearch - Callback when Cmd+K pressed
 * @param {Function} options.onNewConversation - Callback when Cmd+N pressed
 * @param {Function} options.onNavigateUp - Callback when Arrow Up pressed
 * @param {Function} options.onNavigateDown - Callback when Arrow Down pressed
 * @param {Function} options.onSelectCurrent - Callback when Enter pressed
 * @param {Function} options.onDeleteCurrent - Callback when Delete pressed
 * @param {Function} options.onEscape - Callback when Escape pressed
 * @param {boolean} options.enabled - Whether shortcuts are active (default: true)
 * @param {Array} options.disableWhenInputFocused - List of input types to ignore (default: ['input', 'textarea'])
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
} = {}) {
  const handlersRef = useRef({
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

  const handleKeyDown = useCallback((e) => {
    if (!enabled) return;

    const handlers = handlersRef.current;
    const activeElement = document.activeElement;
    const tagName = activeElement?.tagName?.toLowerCase();
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
  }, [enabled, disableWhenInputFocused]);

  useEffect(() => {
    if (!enabled) return;

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [enabled, handleKeyDown]);
}

/**
 * useListNavigation - Manages keyboard navigation state for a list
 *
 * @param {Array} items - List of items to navigate
 * @param {string} currentId - Currently selected item ID
 * @param {Function} onSelect - Callback when item is selected
 * @param {boolean} enabled - Whether navigation is active
 * @returns {Object} - { focusedIndex, focusedId, setFocusedIndex, navigateUp, navigateDown, selectCurrent }
 */
export function useListNavigation({
  items = [],
  currentId,
  onSelect,
  enabled = true,
}) {
  const focusedIndexRef = useRef(-1);
  const itemsRef = useRef(items);

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
      const index = items.findIndex(item => item.id === currentId);
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

    focusedIndexRef.current = Math.min(
      itemsRef.current.length - 1,
      focusedIndexRef.current + 1
    );

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

  const setFocusedIndex = useCallback((index) => {
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
