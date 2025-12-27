/**
 * useDragAndDrop - Hook for drag-and-drop conversation reordering
 *
 * Uses native HTML5 Drag and Drop API for cross-browser compatibility.
 * Supports dragging conversations between department groups.
 */

import { useState, useCallback, useRef } from 'react';

export interface DraggableConversation {
  id: string;
  department?: string | null;
  [key: string]: unknown;
}

export interface UseDragAndDropOptions {
  onDrop: (conversationId: string, targetDepartment: string, item: DraggableConversation) => void | Promise<void>;
}

export interface DragHandlers {
  draggable: boolean;
  onDragStart: (e: React.DragEvent) => void;
  onDragEnd: (e: React.DragEvent) => void;
}

export interface DropHandlers {
  onDragOver: (e: React.DragEvent) => void;
  onDragEnter: (e: React.DragEvent) => void;
  onDragLeave: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent) => void;
}

export interface UseDragAndDropReturn {
  draggedItem: DraggableConversation | null;
  dragOverTarget: string | null;
  isDragging: boolean;
  getDragHandlers: (conversation: DraggableConversation) => DragHandlers;
  getDropHandlers: (departmentId: string) => DropHandlers;
}

/**
 * Hook to manage drag and drop state for conversations.
 */
export function useDragAndDrop({ onDrop }: UseDragAndDropOptions): UseDragAndDropReturn {
  const [draggedItem, setDraggedItem] = useState<DraggableConversation | null>(null);
  const [dragOverTarget, setDragOverTarget] = useState<string | null>(null);
  const dragCounter = useRef<number>(0);

  // Called when drag starts on a conversation
  const handleDragStart = useCallback((e: React.DragEvent, conversation: DraggableConversation): void => {
    setDraggedItem(conversation);

    // Set drag data for transfer
    e.dataTransfer.setData('text/plain', conversation.id);
    e.dataTransfer.effectAllowed = 'move';

    // Add dragging class to element for styling
    const target = e.target as HTMLElement;
    if (target.classList) {
      target.classList.add('dragging');
    }
  }, []);

  // Called when drag ends (regardless of drop success)
  const handleDragEnd = useCallback((e: React.DragEvent): void => {
    setDraggedItem(null);
    setDragOverTarget(null);
    dragCounter.current = 0;

    // Remove dragging class
    const target = e.target as HTMLElement;
    if (target.classList) {
      target.classList.remove('dragging');
    }
  }, []);

  // Called when dragging over a drop target (department group)
  const handleDragOver = useCallback((e: React.DragEvent): void => {
    e.preventDefault(); // Required to allow drop
    e.dataTransfer.dropEffect = 'move';
  }, []);

  // Called when entering a drop target
  const handleDragEnter = useCallback((e: React.DragEvent, targetDepartment: string): void => {
    e.preventDefault();
    dragCounter.current++;

    // Only update if we have a dragged item and target is different
    if (draggedItem && targetDepartment !== draggedItem.department) {
      setDragOverTarget(targetDepartment);
    }
  }, [draggedItem]);

  // Called when leaving a drop target
  const handleDragLeave = useCallback((_e: React.DragEvent): void => {
    dragCounter.current--;

    // Only clear if we've left all child elements
    if (dragCounter.current === 0) {
      setDragOverTarget(null);
    }
  }, []);

  // Called when dropping on a target
  const handleDrop = useCallback((e: React.DragEvent, targetDepartment: string): void => {
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
    getDragHandlers: useCallback((conversation: DraggableConversation): DragHandlers => ({
      draggable: true,
      onDragStart: (e: React.DragEvent) => handleDragStart(e, conversation),
      onDragEnd: handleDragEnd,
    }), [handleDragStart, handleDragEnd]),

    // Handlers for drop targets (ConversationGroup)
    getDropHandlers: useCallback((departmentId: string): DropHandlers => ({
      onDragOver: handleDragOver,
      onDragEnter: (e: React.DragEvent) => handleDragEnter(e, departmentId),
      onDragLeave: handleDragLeave,
      onDrop: (e: React.DragEvent) => handleDrop(e, departmentId),
    }), [handleDragOver, handleDragEnter, handleDragLeave, handleDrop]),
  };
}
