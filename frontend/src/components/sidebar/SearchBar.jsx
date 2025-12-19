/**
 * SearchBar - Search input for conversations
 *
 * Extracted from Sidebar.jsx for better maintainability.
 */

import { useRef } from 'react';
import { Spinner } from '../ui/Spinner';

export function SearchBar({
  searchQuery,
  onSearchChange,
  onClear,
  isSearching,
  resultCount
}) {
  const searchInputRef = useRef(null);

  return (
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
          onChange={onSearchChange}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              onClear();
            }
          }}
          className="search-input"
        />
        {isSearching && <Spinner size="sm" />}
        {searchQuery && !isSearching && (
          <button
            className="search-clear"
            onClick={() => {
              onClear();
              searchInputRef.current?.focus();
            }}
          >
            ×
          </button>
        )}
      </div>
      {searchQuery && (
        <div className="search-results-count">
          {resultCount} result{resultCount !== 1 ? 's' : ''}
        </div>
      )}
    </div>
  );
}
