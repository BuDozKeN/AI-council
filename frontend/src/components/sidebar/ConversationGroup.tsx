/**
 * ConversationGroup - Expandable group of conversations by department
 *
 * Extracted from Sidebar.jsx for better maintainability.
 * Features:
 * - ARIA roles for accessibility (button, region, expanded state)
 * - Keyboard navigation support
 * - Drop target for drag-and-drop conversation reordering
 */

import { ConversationItem } from './ConversationItem';
import type { Conversation } from '../../types/conversation';

interface DragHandlers {
  onDragStart?: (e: React.DragEvent) => void;
  onDragEnd?: (e: React.DragEvent) => void;
  draggable?: boolean;
}

interface DropHandlers {
  onDragOver?: (e: React.DragEvent) => void;
  onDragLeave?: (e: React.DragEvent) => void;
  onDrop?: (e: React.DragEvent) => void;
}

interface ConversationGroupProps {
  groupId: string;
  groupName: string;
  conversations?: Conversation[] | undefined;
  isExpanded: boolean;
  onToggleExpand: (groupId: string) => void;
  currentConversationId: string | null;
  focusedConversationId: string | null;
  selectedIds: Set<string>;
  editingId: string | null;
  editingTitle: string;
  onSelectConversation: (id: string) => void;
  onStartEdit: (conv: Conversation, e?: React.MouseEvent) => void;
  onEditTitleChange: (title: string) => void;
  onSaveEdit: () => void;
  onCancelEdit: () => void;
  onToggleSelection: (id: string, e: React.MouseEvent) => void;
  onStarConversation?: ((id: string, starred?: boolean) => void) | undefined;
  onArchiveConversation?: ((id: string, archived?: boolean) => void) | undefined;
  onDeleteConversation: (id: string) => void;
  onContextMenu: (e: React.MouseEvent, conv: Conversation) => void;
  dropHandlers?: DropHandlers | undefined;
  isDropTarget?: boolean | undefined;
  getDragHandlers?: ((conv: Conversation) => DragHandlers) | undefined;
  draggedItemId?: string | null | undefined;
}

export function ConversationGroup({
  groupId,
  groupName,
  conversations = [],
  isExpanded,
  onToggleExpand,
  currentConversationId,
  focusedConversationId,
  selectedIds,
  editingId,
  editingTitle,
  onSelectConversation,
  onStartEdit,
  onEditTitleChange,
  onSaveEdit,
  onCancelEdit,
  onToggleSelection,
  onStarConversation,
  onArchiveConversation,
  onDeleteConversation,
  onContextMenu,
  dropHandlers,
  isDropTarget,
  getDragHandlers,
  draggedItemId,
}: ConversationGroupProps) {
  // Show empty groups when they're drop targets (so user can drop into empty groups)
  if (conversations.length === 0 && !isDropTarget) return null;

  const regionId = `group-${groupId}`;

  return (
    <div
      className={`conversation-group ${isDropTarget ? 'drop-target' : ''}`}
      {...dropHandlers}
    >
      <div
        className="group-header"
        role="button"
        tabIndex={0}
        aria-expanded={isExpanded}
        aria-controls={regionId}
        onClick={() => onToggleExpand(groupId)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onToggleExpand(groupId);
          }
        }}
      >
        <span className={`chevron ${isExpanded ? 'expanded' : ''}`} aria-hidden="true">
          ›
        </span>
        <span className="group-name">{groupName}</span>
        <span className="group-count" aria-label={`${conversations.length} conversations`}>
          {conversations.length}
        </span>
      </div>

      {isExpanded && (
        <div
          id={regionId}
          className="group-conversations"
          role="listbox"
          aria-label={`${groupName} conversations`}
        >
          {conversations.map((conv) => (
            <ConversationItem
              key={conv.id}
              conversation={conv}
              isActive={conv.id === currentConversationId}
              isFocused={conv.id === focusedConversationId}
              isSelected={selectedIds.has(conv.id)}
              isEditing={editingId === conv.id}
              editingTitle={editingTitle}
              onSelect={onSelectConversation}
              onStartEdit={onStartEdit}
              onEditTitleChange={onEditTitleChange}
              onSaveEdit={onSaveEdit}
              onCancelEdit={onCancelEdit}
              onToggleSelection={onToggleSelection}
              onStar={onStarConversation}
              onArchive={onArchiveConversation}
              onDelete={onDeleteConversation}
              onContextMenu={onContextMenu}
              dragHandlers={getDragHandlers ? getDragHandlers(conv) : undefined}
              isDragging={draggedItemId === conv.id}
            />
          ))}
        </div>
      )}
    </div>
  );
}
