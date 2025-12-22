/**
 * useDragAndDrop - Hook for drag-and-drop conversation reordering
 *
 * Uses native HTML5 Drag and Drop API for cross-browser compatibility.
 * Supports dragging conversations between department groups.
 */

import { useState, useCallback, useRef } from 'react';

/**
 * Hook to manage drag and drop state for conversations.
 * @param {Object} options
 * @param {function} options.onDrop - Callback when a conversation is dropped on a new department
 * @returns {Object} Drag and drop state and handlers
 */
export function useDragAndDrop({ onDrop }) {
  const [draggedItem, setDraggedItem] = useState(null);
  const [dragOverTarget, setDragOverTarget] = useState(null);
  const dragCounter = useRef(0);

  // Called when drag starts on a conversation
  const handleDragStart = useCallback((e, conversation) => {
    setDraggedItem(conversation);

    // Set drag data for transfer
    e.dataTransfer.setData('text/plain', conversation.id);
    e.dataTransfer.effectAllowed = 'move';

    // Add dragging class to element for styling
    if (e.target.classList) {
      e.target.classList.add('dragging');
    }
  }, []);

  // Called when drag ends (regardless of drop success)
  const handleDragEnd = useCallback((e) => {
    setDraggedItem(null);
    setDragOverTarget(null);
    dragCounter.current = 0;

    // Remove dragging class
    if (e.target.classList) {
      e.target.classList.remove('dragging');
    }
  }, []);

  // Called when dragging over a drop target (department group)
  const handleDragOver = useCallback((e) => {
    e.preventDefault(); // Required to allow drop
    e.dataTransfer.dropEffect = 'move';
  }, []);

  // Called when entering a drop target
  const handleDragEnter = useCallback((e, targetDepartment) => {
    e.preventDefault();
    dragCounter.current++;

    // Only update if we have a dragged item and target is different
    if (draggedItem && targetDepartment !== draggedItem.department) {
      setDragOverTarget(targetDepartment);
    }
  }, [draggedItem]);

  // Called when leaving a drop target
  const handleDragLeave = useCallback((e) => {
    dragCounter.current--;

    // Only clear if we've left all child elements
    if (dragCounter.current === 0) {
      setDragOverTarget(null);
    }
  }, []);

  // Called when dropping on a target
  const handleDrop = useCallback((e, targetDepartment) => {
    e.preventDefault();
    dragCounter.current = 0;

    const conversationId = e.dataTransfer.getData('text/plain');

    // Only trigger if actually moving to a different department
    if (draggedItem && targetDepartment !== draggedItem.department) {
      onDrop(conversationId, targetDepartment, draggedItem);
    }

    setDraggedItem(null);
    setDragOverTarget(null);
  }, [draggedItem, onDrop]);

  return {
    // State
    draggedItem,
    dragOverTarget,
    isDragging: draggedItem !== null,

    // Handlers for draggable items (ConversationItem)
    getDragHandlers: useCallback((conversation) => ({
      draggable: true,
      onDragStart: (e) => handleDragStart(e, conversation),
      onDragEnd: handleDragEnd,
    }), [handleDragStart, handleDragEnd]),

    // Handlers for drop targets (ConversationGroup)
    getDropHandlers: useCallback((departmentId) => ({
      onDragOver: handleDragOver,
      onDragEnter: (e) => handleDragEnter(e, departmentId),
      onDragLeave: handleDragLeave,
      onDrop: (e) => handleDrop(e, departmentId),
    }), [handleDragOver, handleDragEnter, handleDragLeave, handleDrop]),
  };
}
