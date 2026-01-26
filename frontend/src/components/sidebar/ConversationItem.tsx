/**
 * ConversationItem - Individual conversation row with hover actions
 *
 * Extracted from Sidebar.jsx for better maintainability.
 * Features:
 * - Keyboard navigation support (data-conversation-id for scroll-into-view)
 * - ARIA roles for accessibility
 * - Pencil icon for rename (replaces hidden double-click)
 * - Memoized for performance
 */

import { useRef, useEffect, memo, useCallback, useState } from 'react';
import {
  Star,
  Trash2,
  Archive,
  ArchiveRestore,
  Square,
  CheckSquare,
  Pencil,
  GripVertical,
} from 'lucide-react';
import { getRelativeTime } from './hooks';
import { formatDateTime } from '../../lib/dateUtils';
import { SwipeableRow } from '../ui/SwipeableRow';
import { BREAKPOINTS } from '../../constants';
import type { Conversation } from '../../types/conversation';

/** Hook to detect mobile viewport */
function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState(
    typeof window !== 'undefined' && window.innerWidth <= BREAKPOINTS.MOBILE
  );
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= BREAKPOINTS.MOBILE);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  return isMobile;
}

// Long-press duration in ms (industry standard is ~500ms)
const LONG_PRESS_DURATION = 500;

interface DragHandlers {
  onDragStart?: (e: React.DragEvent) => void;
  onDragEnd?: (e: React.DragEvent) => void;
  draggable?: boolean;
}

interface ConversationItemProps {
  conversation: Conversation;
  isActive: boolean;
  isSelected: boolean;
  isFocused: boolean;
  isEditing: boolean;
  editingTitle: string;
  onSelect: (id: string) => void;
  onStartEdit: (conv: Conversation, e?: React.MouseEvent) => void;
  onEditTitleChange: (title: string) => void;
  onSaveEdit: () => void;
  onCancelEdit: () => void;
  onToggleSelection: (id: string, e: React.MouseEvent) => void;
  onStar?: ((id: string, starred?: boolean) => void) | undefined;
  onArchive?: ((id: string, archived?: boolean) => void) | undefined;
  onDelete: (id: string) => void;
  onContextMenu?: ((e: React.MouseEvent, conv: Conversation) => void) | undefined;
  dragHandlers?: DragHandlers | undefined;
  isDragging?: boolean | undefined;
}

interface TouchPosition {
  x: number;
  y: number;
}

export const ConversationItem = memo(function ConversationItem({
  conversation,
  isActive,
  isSelected,
  isFocused,
  isEditing,
  editingTitle,
  onSelect,
  onStartEdit,
  onEditTitleChange,
  onSaveEdit,
  onCancelEdit,
  onToggleSelection,
  onStar,
  onArchive,
  onDelete,
  onContextMenu,
  dragHandlers,
  isDragging,
}: ConversationItemProps) {
  const editInputRef = useRef<HTMLInputElement | null>(null);
  const itemRef = useRef<HTMLDivElement | null>(null);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const touchStartPos = useRef<TouchPosition | null>(null);
  const longPressTriggered = useRef<boolean>(false);
  const isMobile = useIsMobile();

  // Swipe actions for mobile
  const swipeActions = [
    {
      label: conversation.is_starred ? 'Unstar conversation' : 'Star conversation',
      icon: <Star size={18} fill={conversation.is_starred ? 'currentColor' : 'none'} />,
      onClick: () => onStar?.(conversation.id, !conversation.is_starred),
      variant: 'warning' as const,
    },
    {
      label: conversation.is_archived ? 'Unarchive conversation' : 'Archive conversation',
      icon: conversation.is_archived ? <ArchiveRestore size={18} /> : <Archive size={18} />,
      onClick: () => onArchive?.(conversation.id, !conversation.is_archived),
      variant: 'archive' as const,
    },
    {
      label: 'Delete conversation',
      icon: <Trash2 size={18} />,
      onClick: () => onDelete(conversation.id),
      variant: 'danger' as const,
    },
  ];

  useEffect(() => {
    if (isEditing && editInputRef.current) {
      editInputRef.current.focus();
      editInputRef.current.select();
    }
  }, [isEditing]);

  // Long-press handlers for mobile context menu
  const handleTouchStart = useCallback(
    (e: React.TouchEvent) => {
      // Reset flag
      longPressTriggered.current = false;

      // Capture touch position immediately (before the event object is recycled)
      const firstTouch = e.touches[0];
      if (!firstTouch) return;
      const touchX = firstTouch.clientX;
      const touchY = firstTouch.clientY;
      const target = e.target;

      // Store initial touch position to detect scrolling
      touchStartPos.current = { x: touchX, y: touchY };

      longPressTimer.current = setTimeout(() => {
        longPressTriggered.current = true;
        if (onContextMenu) {
          // Create a synthetic event with captured touch position
          const syntheticEvent = {
            preventDefault: () => {},
            stopPropagation: () => {},
            clientX: touchX,
            clientY: touchY,
            target: target,
          } as React.MouseEvent;
          onContextMenu(syntheticEvent, conversation);
          // Vibrate on supported devices for haptic feedback
          if (navigator.vibrate) {
            navigator.vibrate(50);
          }
        }
        longPressTimer.current = null;
      }, LONG_PRESS_DURATION);
    },
    [conversation, onContextMenu]
  );

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    // Cancel long-press if user is scrolling (moved more than 10px)
    if (longPressTimer.current && touchStartPos.current) {
      const touch = e.touches[0];
      if (!touch) return;
      const deltaX = Math.abs(touch.clientX - touchStartPos.current.x);
      const deltaY = Math.abs(touch.clientY - touchStartPos.current.y);
      if (deltaX > 10 || deltaY > 10) {
        clearTimeout(longPressTimer.current);
        longPressTimer.current = null;
      }
    }
  }, []);

  const handleTouchEnd = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }, []);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (longPressTimer.current) {
        clearTimeout(longPressTimer.current);
      }
    };
  }, []);

  // Scroll into view when focused via keyboard
  useEffect(() => {
    if (isFocused && itemRef.current) {
      itemRef.current.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }, [isFocused]);

  const handleEditKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      onSaveEdit();
    } else if (e.key === 'Escape') {
      onCancelEdit();
    }
  };

  const relativeTime = conversation.last_updated
    ? getRelativeTime(conversation.last_updated)
    : null;
  const absoluteTime = conversation.last_updated ? formatDateTime(conversation.last_updated) : null;

  // Shared content for mobile and desktop
  const itemContent = (
    <>
      {dragHandlers && !isMobile && (
        <div className="drag-handle" aria-hidden="true">
          <GripVertical size={14} />
        </div>
      )}
      <div className="conversation-content">
        {isEditing ? (
          <div className="conversation-title-edit">
            <input
              ref={editInputRef}
              id={`edit-conversation-${conversation.id}`}
              name="conversation-title"
              type="text"
              value={editingTitle}
              onChange={(e) => onEditTitleChange(e.target.value)}
              onKeyDown={handleEditKeyDown}
              onBlur={onSaveEdit}
              onClick={(e) => e.stopPropagation()}
              className="title-edit-input"
              aria-label="Edit conversation title"
            />
          </div>
        ) : (
          <div className="conversation-title">
            {conversation.is_starred && (
              <Star size={12} className="title-star" fill="currentColor" />
            )}
            {conversation.is_archived && <span className="archived-badge">Archived</span>}
            {conversation.title || 'New Conversation'}
          </div>
        )}
        <div className="conversation-meta">
          {conversation.message_count} messages
          {relativeTime && (
            <span className="conversation-time" title={absoluteTime ?? undefined}>
              {' '}
              · {relativeTime}
            </span>
          )}
        </div>
      </div>
    </>
  );

  // Mobile: SwipeableRow with swipe actions
  if (isMobile) {
    return (
      <SwipeableRow
        actions={swipeActions}
        onClick={() => {
          if (!isEditing && !longPressTriggered.current) {
            onSelect(conversation.id);
          }
          longPressTriggered.current = false;
        }}
        className={`conversation-item-swipeable ${isActive ? 'active' : ''} ${conversation.is_archived ? 'archived' : ''} ${conversation.is_starred ? 'starred' : ''} ${isSelected ? 'selected' : ''}`}
      >
        <div
          ref={itemRef}
          role="option"
          aria-selected={isActive}
          aria-label={`${conversation.title || 'New Conversation'}${conversation.is_starred ? ', starred' : ''}${conversation.is_archived ? ', archived' : ''}`}
          data-conversation-id={conversation.id}
          tabIndex={isFocused ? 0 : -1}
          className="conversation-item-inner"
          onContextMenu={(e) => onContextMenu?.(e, conversation)}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onTouchCancel={handleTouchEnd}
        >
          {itemContent}
        </div>
      </SwipeableRow>
    );
  }

  // Desktop: Standard layout with hover actions
  return (
    <div
      ref={itemRef}
      role="option"
      aria-selected={isActive}
      aria-label={`${conversation.title || 'New Conversation'}${conversation.is_starred ? ', starred' : ''}${conversation.is_archived ? ', archived' : ''}`}
      data-conversation-id={conversation.id}
      tabIndex={isFocused ? 0 : -1}
      className={`conversation-item ${isActive ? 'active' : ''} ${conversation.is_archived ? 'archived' : ''} ${conversation.is_starred ? 'starred' : ''} ${isSelected ? 'selected' : ''} ${isFocused ? 'focused' : ''} ${isDragging ? 'dragging' : ''}`}
      onClick={() => {
        if (!isEditing && !longPressTriggered.current) {
          onSelect(conversation.id);
        }
        longPressTriggered.current = false;
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter' && !isEditing) {
          e.preventDefault();
          onSelect(conversation.id);
        }
      }}
      onContextMenu={(e) => onContextMenu?.(e, conversation)}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchEnd}
      {...dragHandlers}
    >
      {itemContent}
      <div className="hover-actions" role="group" aria-label="Conversation actions">
        <button
          className={`hover-action-btn touch-target ${isSelected ? 'active' : ''}`}
          onClick={(e) => onToggleSelection(conversation.id, e)}
          aria-label={isSelected ? 'Deselect conversation' : 'Select conversation'}
          aria-pressed={isSelected}
        >
          {isSelected ? <CheckSquare size={14} /> : <Square size={14} />}
        </button>
        <button
          className="hover-action-btn touch-target"
          onClick={(e) => {
            e.stopPropagation();
            onStartEdit(conversation, e);
          }}
          aria-label="Rename conversation"
        >
          <Pencil size={14} />
        </button>
        <button
          className={`hover-action-btn touch-target ${conversation.is_starred ? 'starred' : ''}`}
          onClick={(e) => {
            e.stopPropagation();
            onStar?.(conversation.id, !conversation.is_starred);
          }}
          aria-label={conversation.is_starred ? 'Remove star' : 'Add star'}
          aria-pressed={conversation.is_starred}
        >
          <Star size={14} fill={conversation.is_starred ? 'currentColor' : 'none'} />
        </button>
        <button
          className="hover-action-btn touch-target"
          onClick={(e) => {
            e.stopPropagation();
            onArchive?.(conversation.id, !conversation.is_archived);
          }}
          aria-label={conversation.is_archived ? 'Unarchive conversation' : 'Archive conversation'}
        >
          {conversation.is_archived ? <ArchiveRestore size={14} /> : <Archive size={14} />}
        </button>
        <button
          className="hover-action-btn touch-target danger"
          onClick={(e) => {
            e.stopPropagation();
            onDelete(conversation.id);
          }}
          aria-label="Delete conversation"
        >
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  );
});
