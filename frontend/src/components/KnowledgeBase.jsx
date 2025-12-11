import { useState, useEffect, useMemo } from 'react';
import { api } from '../api';
import './KnowledgeBase.css';

const CATEGORIES = [
  { value: '', label: 'All Categories' },
  { value: 'technical_decision', label: 'Decisions' },
  { value: 'ux_pattern', label: 'UX Patterns' },
  { value: 'feature', label: 'Features' },
  { value: 'policy', label: 'Policies' },
  { value: 'process', label: 'Processes' },
  { value: 'role', label: 'Roles' },
  { value: 'framework', label: 'Frameworks' },
  { value: 'sop', label: 'SOPs' },
];

const STATUS_OPTIONS = [
  { value: 'active', label: 'Active' },
  { value: 'superseded', label: 'Superseded' },
  { value: 'archived', label: 'Archived' },
  { value: '', label: 'All Statuses' },
];

export default function KnowledgeBase({ companyId, conversationFilter = null, onClose }) {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filters
  const [categoryFilter, setCategoryFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState(conversationFilter ? '' : 'active'); // Show all statuses when filtering by conversation
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  // UI state
  const [expandedId, setExpandedId] = useState(null);
  const [editingEntry, setEditingEntry] = useState(null);
  const [saving, setSaving] = useState(false);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Fetch entries when filters change
  useEffect(() => {
    if (companyId) {
      fetchEntries();
    }
  }, [companyId, categoryFilter, statusFilter, debouncedSearch, conversationFilter]);

  async function fetchEntries() {
    setLoading(true);
    setError(null);
    try {
      const result = await api.getKnowledgeEntries(companyId, {
        category: categoryFilter || undefined,
        status: statusFilter,
        search: debouncedSearch || undefined,
        limit: 100,
      });
      let filteredEntries = result.entries || [];

      // Filter by conversation if specified (for "View saved" from curator)
      if (conversationFilter) {
        filteredEntries = filteredEntries.filter(
          entry => entry.source_conversation_id === conversationFilter
        );
      }

      setEntries(filteredEntries);
    } catch (err) {
      console.error('Failed to fetch knowledge entries:', err);
      setError('Failed to load knowledge base');
    }
    setLoading(false);
  }

  async function handleDelete(entryId) {
    if (!confirm('Archive this entry? It can be restored by changing the status filter.')) return;
    try {
      await api.deactivateKnowledgeEntry(entryId);
      fetchEntries();
    } catch (err) {
      alert('Failed to archive entry');
    }
  }

  async function handleSaveEdit() {
    if (!editingEntry) return;
    setSaving(true);
    try {
      await api.updateKnowledgeEntry(editingEntry.id, {
        title: editingEntry.title,
        category: editingEntry.category,
        department_id: editingEntry.department_id,
        problem_statement: editingEntry.problem_statement,
        decision_text: editingEntry.decision_text,
        reasoning: editingEntry.reasoning,
        status: editingEntry.status,
        body_md: editingEntry.body_md,
        version: editingEntry.version,
      });
      setEditingEntry(null);
      fetchEntries();
    } catch (err) {
      alert('Failed to save changes: ' + err.message);
    }
    setSaving(false);
  }

  // Check if category needs body_md field
  const isLongFormCategory = (category) => {
    return ['framework', 'sop', 'process'].includes(category);
  };

  // Group entries by category for display
  const groupedEntries = useMemo(() => {
    const groups = {};
    entries.forEach(entry => {
      const cat = entry.category || 'general';
      if (!groups[cat]) {
        groups[cat] = [];
      }
      groups[cat].push(entry);
    });
    return groups;
  }, [entries]);

  const getCategoryLabel = (value) => {
    return CATEGORIES.find(c => c.value === value)?.label || value.replace('_', ' ');
  };

  return (
    <div className="knowledge-base-overlay" onClick={onClose}>
      <div className="knowledge-base-panel" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <header className="kb-header">
          <div className="kb-header-content">
            <h1>Knowledge Base</h1>
            <p className="kb-subtitle">
              {conversationFilter
                ? 'Showing insights saved from this conversation'
                : 'Decisions, frameworks, and procedures that guide your AI Council'}
            </p>
          </div>
          <button className="kb-close-btn" onClick={onClose}>&times;</button>
        </header>

        {/* Conversation filter banner */}
        {conversationFilter && (
          <div className="kb-conversation-filter-banner">
            <span>Filtered to this conversation</span>
            <button
              className="kb-clear-filter-btn"
              onClick={() => {
                // Can't clear from here - need to close and reopen
                // This is just informational
              }}
              style={{ display: 'none' }}
            >
              Show all
            </button>
          </div>
        )}

        {/* Filters */}
        <div className="kb-filters">
          {/* Category tabs */}
          <div className="kb-category-tabs">
            {CATEGORIES.slice(0, 6).map(cat => (
              <button
                key={cat.value}
                className={`kb-tab ${categoryFilter === cat.value ? 'active' : ''}`}
                onClick={() => setCategoryFilter(cat.value)}
              >
                {cat.label}
              </button>
            ))}
            <select
              className="kb-more-categories"
              value={categoryFilter}
              onChange={e => setCategoryFilter(e.target.value)}
            >
              <option value="">More...</option>
              {CATEGORIES.slice(6).map(cat => (
                <option key={cat.value} value={cat.value}>{cat.label}</option>
              ))}
            </select>
          </div>

          {/* Search and status filter */}
          <div className="kb-search-row">
            <div className="kb-search-wrapper">
              <svg className="kb-search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="8" />
                <path d="M21 21l-4.35-4.35" />
              </svg>
              <input
                type="text"
                placeholder="Search knowledge base..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="kb-search-input"
              />
              {searchQuery && (
                <button className="kb-search-clear" onClick={() => setSearchQuery('')}>
                  &times;
                </button>
              )}
            </div>
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              className="kb-status-select"
            >
              {STATUS_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Content */}
        <div className="kb-content">
          {loading ? (
            <div className="kb-loading">
              <div className="kb-loading-spinner"></div>
              <p>Loading knowledge base...</p>
            </div>
          ) : error ? (
            <div className="kb-error">
              <p>{error}</p>
              <button onClick={fetchEntries}>Retry</button>
            </div>
          ) : entries.length === 0 ? (
            <div className="kb-empty">
              <div className="kb-empty-icon">&#128218;</div>
              <p className="kb-empty-title">No entries found</p>
              <p className="kb-empty-hint">
                {searchQuery || categoryFilter
                  ? 'Try adjusting your filters'
                  : 'Save decisions from Council responses using the "Save to Knowledge" button in Stage 3'}
              </p>
            </div>
          ) : (
            <div className="kb-entries">
              {entries.map(entry => (
                <div key={entry.id} className={`kb-entry ${entry.status !== 'active' ? 'kb-entry-inactive' : ''}`}>
                  {/* Entry header - clickable to expand */}
                  <div
                    className="kb-entry-header"
                    onClick={() => setExpandedId(expandedId === entry.id ? null : entry.id)}
                  >
                    <div className="kb-entry-title-row">
                      <span className={`kb-category-badge kb-cat-${entry.category}`}>
                        {getCategoryLabel(entry.category)}
                      </span>
                      <h3 className="kb-entry-title">{entry.title}</h3>
                    </div>
                    <div className="kb-entry-meta">
                      {entry.department_id && (
                        <span className="kb-department">{entry.department_id}</span>
                      )}
                      {entry.version && entry.version !== 'v1' && (
                        <span className="kb-version">{entry.version}</span>
                      )}
                      {entry.status !== 'active' && (
                        <span className={`kb-status kb-status-${entry.status}`}>{entry.status}</span>
                      )}
                      <span className="kb-date">
                        {new Date(entry.updated_at || entry.created_at).toLocaleDateString()}
                      </span>
                      <span className="kb-expand-icon">{expandedId === entry.id ? '▼' : '▶'}</span>
                    </div>
                  </div>

                  {/* Entry body - shown when expanded */}
                  {expandedId === entry.id && (
                    <div className="kb-entry-body">
                      {entry.problem_statement && (
                        <div className="kb-field">
                          <label>Problem / When to Use</label>
                          <p>{entry.problem_statement}</p>
                        </div>
                      )}
                      {entry.decision_text && (
                        <div className="kb-field">
                          <label>Decision / Summary</label>
                          <p>{entry.decision_text}</p>
                        </div>
                      )}
                      {entry.reasoning && (
                        <div className="kb-field">
                          <label>Reasoning</label>
                          <p>{entry.reasoning}</p>
                        </div>
                      )}
                      {entry.body_md && (
                        <div className="kb-field">
                          <label>Detailed Steps</label>
                          <pre className="kb-body-md">{entry.body_md}</pre>
                        </div>
                      )}
                      {!entry.problem_statement && !entry.decision_text && !entry.reasoning && !entry.body_md && entry.summary && (
                        <div className="kb-field">
                          <label>Summary</label>
                          <p>{entry.summary}</p>
                        </div>
                      )}

                      <div className="kb-entry-actions">
                        <button
                          onClick={() => setEditingEntry({ ...entry })}
                          className="kb-btn kb-btn-edit"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDelete(entry.id)}
                          className="kb-btn kb-btn-delete"
                        >
                          Archive
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Edit Modal */}
        {editingEntry && (
          <div className="kb-modal-overlay" onClick={() => setEditingEntry(null)}>
            <div className="kb-modal" onClick={e => e.stopPropagation()}>
              <div className="kb-modal-header">
                <h2>Edit Entry</h2>
                <button className="kb-modal-close" onClick={() => setEditingEntry(null)}>&times;</button>
              </div>

              <div className="kb-modal-body">
                <div className="kb-form-group">
                  <label>Title</label>
                  <input
                    type="text"
                    value={editingEntry.title || ''}
                    onChange={e => setEditingEntry(prev => ({ ...prev, title: e.target.value }))}
                  />
                </div>

                <div className="kb-form-row">
                  <div className="kb-form-group kb-form-half">
                    <label>Category</label>
                    <select
                      value={editingEntry.category || ''}
                      onChange={e => setEditingEntry(prev => ({ ...prev, category: e.target.value }))}
                    >
                      {CATEGORIES.slice(1).map(cat => (
                        <option key={cat.value} value={cat.value}>{cat.label}</option>
                      ))}
                    </select>
                  </div>

                  <div className="kb-form-group kb-form-half">
                    <label>Status</label>
                    <select
                      value={editingEntry.status || 'active'}
                      onChange={e => setEditingEntry(prev => ({ ...prev, status: e.target.value }))}
                    >
                      {STATUS_OPTIONS.slice(0, 3).map(opt => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="kb-form-group">
                  <label>Department</label>
                  <input
                    type="text"
                    value={editingEntry.department_id || ''}
                    onChange={e => setEditingEntry(prev => ({ ...prev, department_id: e.target.value }))}
                    placeholder="e.g., technology, marketing, operations"
                  />
                </div>

                <div className="kb-form-group">
                  <label>Problem / When to Use</label>
                  <textarea
                    value={editingEntry.problem_statement || ''}
                    onChange={e => setEditingEntry(prev => ({ ...prev, problem_statement: e.target.value }))}
                    rows={3}
                    placeholder="What problem does this solve? When should it be applied?"
                  />
                </div>

                <div className="kb-form-group">
                  <label>Decision / Summary</label>
                  <textarea
                    value={editingEntry.decision_text || ''}
                    onChange={e => setEditingEntry(prev => ({ ...prev, decision_text: e.target.value }))}
                    rows={3}
                    placeholder="What was decided? What is the recommendation?"
                  />
                </div>

                {!isLongFormCategory(editingEntry.category) && (
                  <div className="kb-form-group">
                    <label>Reasoning</label>
                    <textarea
                      value={editingEntry.reasoning || ''}
                      onChange={e => setEditingEntry(prev => ({ ...prev, reasoning: e.target.value }))}
                      rows={3}
                      placeholder="Why was this decision made?"
                    />
                  </div>
                )}

                {isLongFormCategory(editingEntry.category) && (
                  <>
                    <div className="kb-form-group">
                      <label>Version</label>
                      <input
                        type="text"
                        value={editingEntry.version || 'v1'}
                        onChange={e => setEditingEntry(prev => ({ ...prev, version: e.target.value }))}
                        placeholder="e.g., v1, v2.1"
                      />
                    </div>

                    <div className="kb-form-group">
                      <label>Detailed Steps (Markdown)</label>
                      <textarea
                        value={editingEntry.body_md || ''}
                        onChange={e => setEditingEntry(prev => ({ ...prev, body_md: e.target.value }))}
                        rows={10}
                        className="kb-body-textarea"
                        placeholder="Step-by-step instructions, checklists, detailed procedures..."
                      />
                    </div>
                  </>
                )}
              </div>

              <div className="kb-modal-footer">
                <button
                  className="kb-btn"
                  onClick={() => setEditingEntry(null)}
                  disabled={saving}
                >
                  Cancel
                </button>
                <button
                  className="kb-btn kb-btn-primary"
                  onClick={handleSaveEdit}
                  disabled={saving}
                >
                  {saving ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
