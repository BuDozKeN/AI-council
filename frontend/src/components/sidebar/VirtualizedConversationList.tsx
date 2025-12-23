/**
 * VirtualizedConversationList - Efficiently renders large conversation lists
 *
 * Uses react-window for virtualization to only render visible items.
 * Handles both group headers and conversation items in a flat list.
 * Features:
 * - ARIA roles for accessibility
 * - Keyboard navigation support via focusedConversationId
 */

import { memo, useMemo } from 'react';
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
 * Memoized group header component with ARIA support
 */
const GroupHeader = memo(function GroupHeader({ groupId, groupName, count, isExpanded, onToggle, style }) {
  const regionId = `group-${groupId}`;

  return (
    <div
      className="group-header"
      role="button"
      tabIndex={0}
      aria-expanded={isExpanded}
      aria-controls={regionId}
      onClick={() => onToggle(groupId)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onToggle(groupId);
        }
      }}
      style={style}
    >
      <span className={`chevron ${isExpanded ? 'expanded' : ''}`} aria-hidden="true">›</span>
      <span className="group-name">{groupName}</span>
      <span className="group-count" aria-label={`${count} conversations`}>{count}</span>
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
    onToggleGroup,
    onContextMenu,
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
      />
    </div>
  );
});

/**
 * Calculate item size based on type
 */
function _getItemSize(index, items) {
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
  onToggleGroup,
  onContextMenu,
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
    onToggleGroup,
    onContextMenu,
  }), [
    items,
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
    onToggleGroup,
    onContextMenu,
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
