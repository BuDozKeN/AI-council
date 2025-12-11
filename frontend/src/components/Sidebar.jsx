import { useState, useMemo, useRef, useEffect } from 'react';
import { api } from '../api';
import { Button } from './ui/button';
import { Plus, Trophy, Briefcase, ChevronRight, Star, Trash2, Archive, ArchiveRestore, Square, CheckSquare } from 'lucide-react';
import './Sidebar.css';

// Hook to fetch and manage mock mode state
function useMockMode() {
  const [mockMode, setMockMode] = useState(null); // null = loading
  const [isToggling, setIsToggling] = useState(false);

  useEffect(() => {
    // Load initial mock mode status
    api.getMockMode()
      .then(result => setMockMode(result.enabled))
      .catch(err => {
        console.error('Failed to get mock mode:', err);
        setMockMode(false); // Default to production mode on error
      });
  }, []);

  const toggle = async () => {
    if (isToggling || mockMode === null) return;
    setIsToggling(true);
    try {
      const result = await api.setMockMode(!mockMode);
      setMockMode(result.enabled);
    } catch (err) {
      console.error('Failed to toggle mock mode:', err);
    } finally {
      setIsToggling(false);
    }
  };

  return { mockMode, isToggling, toggle };
}

/**
 * Convert an ISO timestamp to a human-readable relative time string.
 * e.g., "2 hours", "a day", "3 days"
 */
function getRelativeTime(isoTimestamp) {
  if (!isoTimestamp) return '';

  const now = new Date();
  const then = new Date(isoTimestamp);
  const diffMs = now - then;
  const diffSeconds = Math.floor(diffMs / 1000);
  const diffMinutes = Math.floor(diffSeconds / 60);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMinutes < 1) {
    return 'just now';
  } else if (diffMinutes < 60) {
    return diffMinutes === 1 ? '1 minute' : `${diffMinutes} minutes`;
  } else if (diffHours < 24) {
    return diffHours === 1 ? '1 hour' : `${diffHours} hours`;
  } else {
    return diffDays === 1 ? 'a day' : `${diffDays} days`;
  }
}

export default function Sidebar({
  conversations,
  currentConversationId,
  onSelectConversation,
  onNewConversation,
  onOpenLeaderboard,
  onOpenSettings,
  onOpenMyCompany,
  onExportConversation,
  onArchiveConversation,
  onStarConversation,
  onDeleteConversation,
  onBulkDeleteConversations,
  onRenameConversation,
  onLoadMore,
  onSearch,
  hasMoreConversations = true,
  departments = [],
  user,
  onSignOut
}) {
  const [filter, setFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedGroups, setExpandedGroups] = useState({});
  const [showAllInGroup, setShowAllInGroup] = useState({});
  const [deleteConfirm, setDeleteConfirm] = useState(null); // conversation id to confirm delete
  const [editingId, setEditingId] = useState(null); // conversation id being renamed
  const [editingTitle, setEditingTitle] = useState(''); // current edit value
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedIds, setSelectedIds] = useState(new Set()); // Multi-select
  const [isDeleting, setIsDeleting] = useState(false); // Bulk delete in progress
  const searchTimeoutRef = useRef(null);
  const editInputRef = useRef(null);
  const searchInputRef = useRef(null);

  // Mock mode toggle
  const { mockMode, isToggling, toggle: toggleMockMode } = useMockMode();

  // Focus the input when editing starts
  useEffect(() => {
    if (editingId && editInputRef.current) {
      editInputRef.current.focus();
      editInputRef.current.select();
    }
  }, [editingId]);

  const handleStartEdit = (conv, e) => {
    if (e) e.stopPropagation();
    setEditingId(conv.id);
    setEditingTitle(conv.title || 'New Conversation');
  };

  const handleSaveEdit = async () => {
    if (editingId && editingTitle.trim()) {
      await onRenameConversation(editingId, editingTitle.trim());
    }
    setEditingId(null);
    setEditingTitle('');
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditingTitle('');
  };

  const handleEditKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSaveEdit();
    } else if (e.key === 'Escape') {
      handleCancelEdit();
    }
  };

  // Handle search with debouncing for backend search
  const handleSearchChange = (e) => {
    const value = e.target.value;
    setSearchQuery(value);

    // Clear any pending search
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    // Debounce backend search (only trigger after 500ms of no typing)
    if (onSearch && value.trim()) {
      setIsSearching(true);
      searchTimeoutRef.current = setTimeout(async () => {
        await onSearch(value.trim());
        setIsSearching(false);
      }, 500);
    } else if (onSearch && !value.trim()) {
      // Clear search - reload without filter
      onSearch('');
    }
  };

  // Handle Load More click
  const handleLoadMore = async () => {
    if (!onLoadMore || isLoadingMore) return;
    setIsLoadingMore(true);
    try {
      await onLoadMore(conversations.length, searchQuery);
    } finally {
      setIsLoadingMore(false);
    }
  };

  // Multi-select handlers
  const toggleSelection = (convId, e) => {
    e.stopPropagation();
    setSelectedIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(convId)) {
        newSet.delete(convId);
      } else {
        newSet.add(convId);
      }
      return newSet;
    });
  };

  const clearSelection = () => {
    setSelectedIds(new Set());
  };

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0 || isDeleting) return;
    setIsDeleting(true);
    try {
      await onBulkDeleteConversations(Array.from(selectedIds));
      setSelectedIds(new Set());
    } catch (error) {
      console.error('Bulk delete failed:', error);
    } finally {
      setIsDeleting(false);
    }
  };

  // Separate active and archived conversations
  const { activeConversations, archivedConversations } = useMemo(() => {
    const active = conversations.filter(conv => !conv.is_archived);
    const archived = conversations.filter(conv => conv.is_archived);
    return { activeConversations: active, archivedConversations: archived };
  }, [conversations]);

  // Filter conversations by search query
  const filteredBySearch = useMemo(() => {
    if (!searchQuery.trim()) {
      return { active: activeConversations, archived: archivedConversations };
    }
    const query = searchQuery.toLowerCase();
    const matchesSearch = (conv) =>
      conv.title?.toLowerCase().includes(query) ||
      conv.department?.toLowerCase().includes(query);
    return {
      active: activeConversations.filter(matchesSearch),
      archived: archivedConversations.filter(matchesSearch),
    };
  }, [activeConversations, archivedConversations, searchQuery]);

  // Group conversations by department (only active ones, unless viewing archived)
  const groupedConversations = useMemo(() => {
    const groups = {};
    const convsToGroup = filter === 'archived' ? filteredBySearch.archived : filteredBySearch.active;

    // Initialize groups for all departments
    departments.forEach(dept => {
      groups[dept.id] = {
        name: dept.name,
        conversations: [],
      };
    });

    // Add "Standard" if not present
    if (!groups['standard']) {
      groups['standard'] = { name: 'Standard', conversations: [] };
    }

    // Sort conversations into groups
    convsToGroup.forEach(conv => {
      const dept = conv.department || 'standard';
      if (!groups[dept]) {
        groups[dept] = { name: dept.charAt(0).toUpperCase() + dept.slice(1), conversations: [] };
      }
      groups[dept].conversations.push(conv);
    });

    return groups;
  }, [filteredBySearch, departments, filter]);

  // Filter groups based on selected filter
  const filteredGroups = useMemo(() => {
    if (filter === 'all' || filter === 'archived') {
      return groupedConversations;
    }
    return { [filter]: groupedConversations[filter] };
  }, [groupedConversations, filter]);

  const toggleGroup = (groupId) => {
    setExpandedGroups(prev => ({
      ...prev,
      [groupId]: !prev[groupId],
    }));
  };

  const toggleShowAll = (groupId) => {
    setShowAllInGroup(prev => ({
      ...prev,
      [groupId]: !prev[groupId],
    }));
  };

  // Check if a group is expanded (default to expanded if has conversations)
  const isExpanded = (groupId) => {
    if (expandedGroups[groupId] !== undefined) {
      return expandedGroups[groupId];
    }
    return groupedConversations[groupId]?.conversations.length > 0;
  };

  const totalConversations = conversations.length;

  return (
    <div className="sidebar">
      <div className="sidebar-header">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-orange-500 to-amber-600 flex items-center justify-center shadow-md">
            <span className="text-white font-bold text-sm">AX</span>
          </div>
          <h1 className="text-lg font-semibold text-gray-900 tracking-tight">AxCouncil</h1>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={onOpenLeaderboard}
            title="View Model Leaderboard"
            className="h-10 w-10 border-amber-300 bg-amber-50 hover:bg-amber-100 hover:border-amber-400"
          >
            <Trophy className="h-4 w-4 text-amber-600" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={onOpenMyCompany}
            title="My Company"
            className="h-10 w-10 border-indigo-300 bg-indigo-50 hover:bg-indigo-100 hover:border-indigo-400"
          >
            <Briefcase className="h-4 w-4 text-indigo-600" />
          </Button>
          <Button
            onClick={onNewConversation}
            className="flex-1 h-10 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white shadow-md hover:shadow-lg transition-all"
          >
            <Plus className="h-4 w-4 mr-1" />
            New Chat
          </Button>
        </div>
      </div>

      {/* Search Input */}
      {totalConversations > 0 && (
        <div className="sidebar-search">
          <div className="search-input-wrapper">
            <svg className="search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8" />
              <path d="M21 21l-4.35-4.35" />
            </svg>
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Search conversations..."
              value={searchQuery}
              onChange={handleSearchChange}
              onKeyDown={(e) => {
                if (e.key === 'Escape') {
                  setSearchQuery('');
                  if (onSearch) onSearch('');
                }
              }}
              className="search-input"
            />
            {isSearching && <span className="search-spinner"></span>}
            {searchQuery && !isSearching && (
              <button
                className="search-clear"
                onClick={() => {
                  setSearchQuery('');
                  if (onSearch) onSearch('');
                  searchInputRef.current?.focus();
                }}
              >
                ×
              </button>
            )}
          </div>
          {searchQuery && (
            <div className="search-results-count">
              {filteredBySearch.active.length + filteredBySearch.archived.length} result{(filteredBySearch.active.length + filteredBySearch.archived.length) !== 1 ? 's' : ''}
            </div>
          )}
        </div>
      )}

      {/* Filter Dropdown */}
      {totalConversations > 0 && (
        <div className="sidebar-filter">
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="filter-select"
          >
            <option value="all">All Conversations ({filteredBySearch.active.length})</option>
            {departments.map(dept => {
              const deptCount = groupedConversations[dept.id]?.conversations.length || 0;
              return (
                <option key={dept.id} value={dept.id}>
                  {dept.name} ({deptCount})
                </option>
              );
            })}
            {filteredBySearch.archived.length > 0 && (
              <option value="archived">Archived ({filteredBySearch.archived.length})</option>
            )}
          </select>
        </div>
      )}

      <div className="conversation-list">
        {totalConversations === 0 ? (
          <div className="no-conversations">No conversations yet</div>
        ) : searchQuery && filteredBySearch.active.length === 0 && filteredBySearch.archived.length === 0 ? (
          <div className="no-conversations">No conversations found for "{searchQuery}"</div>
        ) : filter === 'archived' && filteredBySearch.archived.length === 0 ? (
          <div className="no-conversations">No archived conversations</div>
        ) : filter !== 'archived' && filteredBySearch.active.length === 0 ? (
          <div className="no-conversations">No active conversations</div>
        ) : (
          Object.entries(filteredGroups).map(([groupId, group]) => {
            if (!group || group.conversations.length === 0) return null;

            const expanded = isExpanded(groupId);
            // Show all loaded conversations - no "show more" within groups
            const visibleConversations = group.conversations;

            return (
              <div key={groupId} className="conversation-group">
                <div
                  className="group-header"
                  onClick={() => toggleGroup(groupId)}
                >
                  <span className={`chevron ${expanded ? 'expanded' : ''}`}>
                    ›
                  </span>
                  <span className="group-name">{group.name}</span>
                  <span className="group-count">{group.conversations.length}</span>
                </div>

                {expanded && (
                  <div className="group-conversations">
                    {visibleConversations.map((conv) => (
                      <div
                        key={conv.id}
                        className={`conversation-item ${
                          conv.id === currentConversationId ? 'active' : ''
                        } ${conv.is_archived ? 'archived' : ''} ${conv.is_starred ? 'starred' : ''} ${selectedIds.has(conv.id) ? 'selected' : ''}`}
                        onClick={() => {
                          if (editingId !== conv.id) {
                            onSelectConversation(conv.id);
                          }
                        }}
                      >
                        {/* Main content - title and metadata */}
                        <div className="conversation-content">
                          {editingId === conv.id ? (
                            <div className="conversation-title-edit">
                              <input
                                ref={editInputRef}
                                type="text"
                                value={editingTitle}
                                onChange={(e) => setEditingTitle(e.target.value)}
                                onKeyDown={handleEditKeyDown}
                                onBlur={handleSaveEdit}
                                onClick={(e) => e.stopPropagation()}
                                className="title-edit-input"
                              />
                            </div>
                          ) : (
                            <div
                              className="conversation-title"
                              onDoubleClick={(e) => {
                                e.stopPropagation();
                                handleStartEdit(conv);
                              }}
                              title="Double-click to rename"
                            >
                              {conv.is_starred && <Star size={12} className="title-star" fill="currentColor" />}
                              {conv.is_archived && <span className="archived-badge">Archived</span>}
                              {conv.title || 'New Conversation'}
                            </div>
                          )}
                          <div className="conversation-meta">
                            {conv.message_count} messages
                            {conv.last_updated && (
                              <span className="conversation-time"> · {getRelativeTime(conv.last_updated)}</span>
                            )}
                          </div>
                        </div>

                        {/* Hover action bar - appears on hover */}
                        <div className="hover-actions">
                          <button
                            className={`hover-action-btn ${selectedIds.has(conv.id) ? 'active' : ''}`}
                            onClick={(e) => toggleSelection(conv.id, e)}
                            title={selectedIds.has(conv.id) ? 'Deselect' : 'Select'}
                          >
                            {selectedIds.has(conv.id) ? <CheckSquare size={14} /> : <Square size={14} />}
                          </button>
                          <button
                            className={`hover-action-btn ${conv.is_starred ? 'starred' : ''}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              onStarConversation(conv.id, !conv.is_starred);
                            }}
                            title={conv.is_starred ? 'Unstar' : 'Star'}
                          >
                            <Star size={14} fill={conv.is_starred ? 'currentColor' : 'none'} />
                          </button>
                          <button
                            className="hover-action-btn"
                            onClick={(e) => {
                              e.stopPropagation();
                              onArchiveConversation(conv.id, !conv.is_archived);
                            }}
                            title={conv.is_archived ? 'Unarchive' : 'Archive'}
                          >
                            {conv.is_archived ? <ArchiveRestore size={14} /> : <Archive size={14} />}
                          </button>
                          <button
                            className="hover-action-btn danger"
                            onClick={(e) => {
                              e.stopPropagation();
                              setDeleteConfirm(conv.id);
                            }}
                            title="Delete"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })
        )}

        {/* Load More Button */}
        {onLoadMore && hasMoreConversations && totalConversations > 0 && !searchQuery && (
          <button
            className="load-more-btn"
            onClick={handleLoadMore}
            disabled={isLoadingMore}
          >
            {isLoadingMore ? (
              <>
                <span className="load-more-spinner"></span>
                Loading...
              </>
            ) : (
              'Load More Conversations'
            )}
          </button>
        )}
      </div>

      {/* Multi-select action bar - shows when items are selected */}
      {selectedIds.size > 0 && (
        <div className="bulk-action-bar">
          <span className="bulk-count">{selectedIds.size} selected</span>
          <button
            className="bulk-cancel-btn"
            onClick={clearSelection}
          >
            Cancel
          </button>
          <button
            className="bulk-delete-btn"
            onClick={handleBulkDelete}
            disabled={isDeleting}
          >
            <Trash2 size={14} />
            {isDeleting ? 'Deleting...' : 'Delete'}
          </button>
        </div>
      )}

      {/* User Footer */}
      {user && (
        <div className="sidebar-footer">
          {/* Mode Toggle */}
          <div className="mode-toggle-section">
            <button
              className={`mode-toggle-btn ${mockMode ? 'mock' : 'production'} ${isToggling ? 'toggling' : ''}`}
              onClick={toggleMockMode}
              disabled={isToggling || mockMode === null}
              title={mockMode ? 'Mock Mode: Using simulated responses (free)' : 'Production Mode: Using real API calls (costs credits)'}
            >
              <span className="mode-indicator"></span>
              <span className="mode-label">{mockMode === null ? 'Loading...' : mockMode ? 'Mock' : 'Production'}</span>
            </button>
          </div>

          <div className="user-info">
            <span className="user-email" title={user.email}>
              {user.email}
            </span>
          </div>
          <div className="sidebar-footer-buttons">
            <button className="settings-btn" onClick={onOpenSettings} title="Settings & Profile">
              Settings
            </button>
            <button className="sign-out-btn" onClick={onSignOut} title="Sign out">
              Sign Out
            </button>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
        <div className="delete-modal-overlay" onClick={() => setDeleteConfirm(null)}>
          <div className="delete-modal" onClick={(e) => e.stopPropagation()}>
            <div className="delete-modal-header">Delete Conversation?</div>
            <div className="delete-modal-body">
              This action cannot be undone. The conversation will be permanently deleted.
            </div>
            <div className="delete-modal-actions">
              <button
                className="delete-modal-cancel"
                onClick={() => setDeleteConfirm(null)}
              >
                Cancel
              </button>
              <button
                className="delete-modal-confirm"
                onClick={() => {
                  onDeleteConversation(deleteConfirm);
                  setDeleteConfirm(null);
                }}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
