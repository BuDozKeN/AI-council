/**
 * ConversationGroup - Expandable group of conversations by department
 *
 * Extracted from Sidebar.jsx for better maintainability.
 */

import { ConversationItem } from './ConversationItem';

export function ConversationGroup({
  groupId,
  groupName,
  conversations = [],
  isExpanded,
  onToggleExpand,
  currentConversationId,
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
  onDeleteConversation
}) {
  if (conversations.length === 0) return null;

  return (
    <div className="conversation-group">
      <div
        className="group-header"
        onClick={() => onToggleExpand(groupId)}
      >
        <span className={`chevron ${isExpanded ? 'expanded' : ''}`}>
          ›
        </span>
        <span className="group-name">{groupName}</span>
        <span className="group-count">{conversations.length}</span>
      </div>

      {isExpanded && (
        <div className="group-conversations">
          {conversations.map((conv) => (
            <ConversationItem
              key={conv.id}
              conversation={conv}
              isActive={conv.id === currentConversationId}
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
            />
          ))}
        </div>
      )}
    </div>
  );
}
