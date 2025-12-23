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
  // Drag and drop props
  dropHandlers,
  isDropTarget,
  getDragHandlers,
  draggedItemId,
}) {
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
