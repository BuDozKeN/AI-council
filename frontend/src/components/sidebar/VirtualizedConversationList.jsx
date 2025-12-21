/**
 * VirtualizedConversationList - Efficiently renders large conversation lists
 *
 * Uses react-window for virtualization to only render visible items.
 * Handles both group headers and conversation items in a flat list.
 */

import { memo, useMemo, useCallback } from 'react';
import { List } from 'react-window';
import { ConversationItem } from './ConversationItem';

// Row heights in pixels
const GROUP_HEADER_HEIGHT = 32;
const CONVERSATION_ITEM_HEIGHT = 52; // padding (16) + content (~32) + margin (4)

/**
 * Flatten grouped conversations into a single list with type markers
 */
function flattenGroups(filteredGroups, expandedGroups, groupedConversations) {
  const items = [];

  Object.entries(filteredGroups).forEach(([groupId, group]) => {
    if (!group?.conversations?.length) return;

    // Check if group is expanded
    const isExpanded = expandedGroups[groupId] !== undefined
      ? expandedGroups[groupId]
      : groupedConversations[groupId]?.conversations.length > 0;

    // Add group header
    items.push({
      type: 'header',
      groupId,
      groupName: group.name,
      count: group.conversations.length,
      isExpanded,
    });

    // Add conversations if expanded
    if (isExpanded) {
      group.conversations.forEach(conv => {
        items.push({
          type: 'conversation',
          groupId,
          conversation: conv,
        });
      });
    }
  });

  return items;
}

/**
 * Memoized group header component
 */
const GroupHeader = memo(function GroupHeader({ groupId, groupName, count, isExpanded, onToggle, style }) {
  return (
    <div
      className="group-header"
      onClick={() => onToggle(groupId)}
      style={style}
    >
      <span className={`chevron ${isExpanded ? 'expanded' : ''}`}>›</span>
      <span className="group-name">{groupName}</span>
      <span className="group-count">{count}</span>
    </div>
  );
});

/**
 * Row renderer for the virtualized list
 */
const Row = memo(function Row({ index, style, data }) {
  const {
    items,
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
    onDeleteConversation,
    onToggleGroup,
  } = data;

  const item = items[index];

  if (item.type === 'header') {
    return (
      <GroupHeader
        groupId={item.groupId}
        groupName={item.groupName}
        count={item.count}
        isExpanded={item.isExpanded}
        onToggle={onToggleGroup}
        style={style}
      />
    );
  }

  // Conversation item
  const conv = item.conversation;
  return (
    <div style={style}>
      <ConversationItem
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
    </div>
  );
});

/**
 * Calculate item size based on type
 */
function getItemSize(index, items) {
  const item = items[index];
  return item.type === 'header' ? GROUP_HEADER_HEIGHT : CONVERSATION_ITEM_HEIGHT;
}

/**
 * VirtualizedConversationList component
 */
export function VirtualizedConversationList({
  filteredGroups,
  expandedGroups,
  groupedConversations,
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
  onDeleteConversation,
  onToggleGroup,
  height = 400,
  width = '100%',
}) {
  // Flatten groups into a single list
  const items = useMemo(
    () => flattenGroups(filteredGroups, expandedGroups, groupedConversations),
    [filteredGroups, expandedGroups, groupedConversations]
  );

  // If fewer than 20 items, don't virtualize (overhead not worth it)
  const shouldVirtualize = items.length > 20;

  // Item data for row renderer
  const itemData = useMemo(() => ({
    items,
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
    onDeleteConversation,
    onToggleGroup,
  }), [
    items,
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
    onDeleteConversation,
    onToggleGroup,
  ]);

  // For small lists, render without virtualization
  if (!shouldVirtualize) {
    return (
      <div className="conversation-list-inner">
        {items.map((item, index) => (
          <Row key={item.type === 'header' ? `h-${item.groupId}` : item.conversation.id} index={index} style={{}} data={itemData} />
        ))}
      </div>
    );
  }

  // Calculate average item height for the list
  // Since we have mixed heights, use a weighted average
  const headerCount = items.filter(i => i.type === 'header').length;
  const convCount = items.length - headerCount;
  const avgHeight = items.length > 0
    ? (headerCount * GROUP_HEADER_HEIGHT + convCount * CONVERSATION_ITEM_HEIGHT) / items.length
    : CONVERSATION_ITEM_HEIGHT;

  return (
    <List
      height={height}
      width={width}
      itemCount={items.length}
      itemSize={avgHeight}
      itemData={itemData}
      overscanCount={5}
    >
      {Row}
    </List>
  );
}
