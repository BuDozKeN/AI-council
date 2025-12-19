/**
 * ConversationItem - Individual conversation row with hover actions
 *
 * Extracted from Sidebar.jsx for better maintainability.
 */

import { useRef, useEffect } from 'react';
import { Star, Trash2, Archive, ArchiveRestore, Square, CheckSquare } from 'lucide-react';
import { getRelativeTime } from './hooks';

export function ConversationItem({
  conversation,
  isActive,
  isSelected,
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
  onDelete
}) {
  const editInputRef = useRef(null);

  useEffect(() => {
    if (isEditing && editInputRef.current) {
      editInputRef.current.focus();
      editInputRef.current.select();
    }
  }, [isEditing]);

  const handleEditKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      onSaveEdit();
    } else if (e.key === 'Escape') {
      onCancelEdit();
    }
  };

  return (
    <div
      className={`conversation-item ${isActive ? 'active' : ''} ${conversation.is_archived ? 'archived' : ''} ${conversation.is_starred ? 'starred' : ''} ${isSelected ? 'selected' : ''}`}
      onClick={() => {
        if (!isEditing) {
          onSelect(conversation.id);
        }
      }}
    >
      {/* Main content - title and metadata */}
      <div className="conversation-content">
        {isEditing ? (
          <div className="conversation-title-edit">
            <input
              ref={editInputRef}
              type="text"
              value={editingTitle}
              onChange={(e) => onEditTitleChange(e.target.value)}
              onKeyDown={handleEditKeyDown}
              onBlur={onSaveEdit}
              onClick={(e) => e.stopPropagation()}
              className="title-edit-input"
            />
          </div>
        ) : (
          <div
            className="conversation-title"
            onDoubleClick={(e) => {
              e.stopPropagation();
              onStartEdit(conversation);
            }}
            title="Double-click to rename"
          >
            {conversation.is_starred && <Star size={12} className="title-star" fill="currentColor" />}
            {conversation.is_archived && <span className="archived-badge">Archived</span>}
            {conversation.title || 'New Conversation'}
          </div>
        )}
        <div className="conversation-meta">
          {conversation.message_count} messages
          {conversation.last_updated && (
            <span className="conversation-time"> · {getRelativeTime(conversation.last_updated)}</span>
          )}
        </div>
      </div>

      {/* Hover action bar */}
      <div className="hover-actions">
        <button
          className={`hover-action-btn ${isSelected ? 'active' : ''}`}
          onClick={(e) => onToggleSelection(conversation.id, e)}
          title={isSelected ? 'Deselect' : 'Select'}
        >
          {isSelected ? <CheckSquare size={14} /> : <Square size={14} />}
        </button>
        <button
          className={`hover-action-btn ${conversation.is_starred ? 'starred' : ''}`}
          onClick={(e) => {
            e.stopPropagation();
            onStar(conversation.id, !conversation.is_starred);
          }}
          title={conversation.is_starred ? 'Unstar' : 'Star'}
        >
          <Star size={14} fill={conversation.is_starred ? 'currentColor' : 'none'} />
        </button>
        <button
          className="hover-action-btn"
          onClick={(e) => {
            e.stopPropagation();
            onArchive(conversation.id, !conversation.is_archived);
          }}
          title={conversation.is_archived ? 'Unarchive' : 'Archive'}
        >
          {conversation.is_archived ? <ArchiveRestore size={14} /> : <Archive size={14} />}
        </button>
        <button
          className="hover-action-btn danger"
          onClick={(e) => {
            e.stopPropagation();
            onDelete(conversation.id);
          }}
          title="Delete"
        >
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  );
}
