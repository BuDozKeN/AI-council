/**
 * VirtualizedConversationList - Efficiently renders large conversation lists
 *
 * Uses react-window for virtualization to only render visible items.
 * Handles both group headers and conversation items in a flat list.
 * Features:
 * - ARIA roles for accessibility
 * - Keyboard navigation support via focusedConversationId
 */

import { memo, useMemo, type CSSProperties, type ReactElement } from 'react';
import { List, type RowComponentProps } from 'react-window';
import { ConversationItem } from './ConversationItem';
import type { Conversation } from '../../types/conversation';

// Row heights in pixels
const GROUP_HEADER_HEIGHT = 32;
const CONVERSATION_ITEM_HEIGHT = 52; // padding (16) + content (~32) + margin (4)

interface ConversationGroup {
  name: string;
  conversations: Conversation[];
}

interface HeaderItem {
  type: 'header';
  groupId: string;
  groupName: string;
  count: number;
  isExpanded: boolean;
}

interface ConversationListItem {
  type: 'conversation';
  groupId: string;
  conversation: Conversation;
}

type FlatListItem = HeaderItem | ConversationListItem;

interface GroupHeaderProps {
  groupId: string;
  groupName: string;
  count: number;
  isExpanded: boolean;
  onToggle: (groupId: string) => void;
  style: CSSProperties;
}

interface RowProps {
  items: FlatListItem[];
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
  onToggleGroup: (groupId: string) => void;
  onContextMenu?: ((e: React.MouseEvent, conv: Conversation) => void) | undefined;
}

interface VirtualizedConversationListProps {
  filteredGroups: Record<string, ConversationGroup | undefined>;
  expandedGroups: Record<string, boolean>;
  groupedConversations: Record<string, ConversationGroup>;
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
  onToggleGroup: (groupId: string) => void;
  onContextMenu?: ((e: React.MouseEvent, conv: Conversation) => void) | undefined;
  height?: number | undefined;
  width?: number | string | undefined;
}

/**
 * Flatten grouped conversations into a single list with type markers
 */
function flattenGroups(
  filteredGroups: Record<string, ConversationGroup | undefined>,
  expandedGroups: Record<string, boolean>,
  groupedConversations: Record<string, ConversationGroup>
): FlatListItem[] {
  const items: FlatListItem[] = [];

  Object.entries(filteredGroups).forEach(([groupId, group]) => {
    if (!group?.conversations?.length) return;

    // Check if group is expanded - default to true if undefined
    const isExpanded =
      expandedGroups[groupId] !== undefined
        ? expandedGroups[groupId]
        : (groupedConversations[groupId]?.conversations?.length ?? 0) > 0;

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
      group.conversations.forEach((conv) => {
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
const GroupHeader = memo(function GroupHeader({
  groupId,
  groupName,
  count,
  isExpanded,
  onToggle,
  style,
}: GroupHeaderProps) {
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
      <span className={`chevron ${isExpanded ? 'expanded' : ''}`} aria-hidden="true">
        ›
      </span>
      <span className="group-name">{groupName}</span>
      <span className="group-count" aria-label={`${count} conversations`}>
        {count}
      </span>
    </div>
  );
});

/**
 * Row renderer for the virtualized list (react-window v2 API)
 */
function Row({
  index,
  style,
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
}: RowComponentProps<RowProps>): ReactElement {
  const item = items[index];

  if (!item) {
    return <div style={style} />;
  }

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

  // Build optional props conditionally to satisfy exactOptionalPropertyTypes
  const optionalProps: {
    onStar?: (id: string, starred?: boolean) => void;
    onArchive?: (id: string, archived?: boolean) => void;
    onContextMenu?: (e: React.MouseEvent, conv: Conversation) => void;
  } = {};
  if (onStarConversation) optionalProps.onStar = onStarConversation;
  if (onArchiveConversation) optionalProps.onArchive = onArchiveConversation;
  if (onContextMenu) optionalProps.onContextMenu = onContextMenu;

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
        onDelete={onDeleteConversation}
        {...optionalProps}
      />
    </div>
  );
}

/**
 * Memoized Row component for non-virtualized rendering
 */
const MemoizedRow = memo(Row);

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
}: VirtualizedConversationListProps) {
  // Flatten groups into a single list
  const items = useMemo(
    () => flattenGroups(filteredGroups, expandedGroups, groupedConversations),
    [filteredGroups, expandedGroups, groupedConversations]
  );

  // If fewer than 20 items, don't virtualize (overhead not worth it)
  const shouldVirtualize = items.length > 20;

  // Row props for the list component (react-window v2 API)
  const rowProps: RowProps = useMemo(
    () => ({
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
    }),
    [
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
    ]
  );

  // For small lists, render without virtualization
  if (!shouldVirtualize) {
    return (
      <div className="conversation-list-inner">
        {items.map((item, index) => (
          <MemoizedRow
            key={item.type === 'header' ? `h-${item.groupId}` : item.conversation.id}
            index={index}
            style={{}}
            ariaAttributes={{
              'aria-posinset': index + 1,
              'aria-setsize': items.length,
              role: 'listitem',
            }}
            {...rowProps}
          />
        ))}
      </div>
    );
  }

  // Calculate average item height for the list
  // Since we have mixed heights, use a weighted average
  const headerCount = items.filter((i) => i.type === 'header').length;
  const convCount = items.length - headerCount;
  const avgHeight =
    items.length > 0
      ? (headerCount * GROUP_HEADER_HEIGHT + convCount * CONVERSATION_ITEM_HEIGHT) / items.length
      : CONVERSATION_ITEM_HEIGHT;

  return (
    <List
      style={{ height, width: typeof width === 'number' ? width : undefined }}
      rowCount={items.length}
      rowHeight={avgHeight}
      rowProps={rowProps}
      rowComponent={Row}
      overscanCount={5}
    />
  );
}
