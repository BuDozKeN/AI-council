/**
 * SearchBar - Search input for conversations
 *
 * Extracted from Sidebar.jsx for better maintainability.
 * Supports Cmd+K global shortcut via external ref.
 */

import { useRef, forwardRef, useImperativeHandle } from 'react';
import { Spinner } from '../ui/Spinner';

interface SearchBarProps {
  searchQuery: string;
  onSearchChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onClear: () => void;
  isSearching: boolean;
  resultCount: number;
}

export interface SearchBarRef {
  focus: () => void;
  blur: () => void;
}

export const SearchBar = forwardRef<SearchBarRef, SearchBarProps>(function SearchBar({
  searchQuery,
  onSearchChange,
  onClear,
  isSearching,
  resultCount
}, ref) {
  const inputRef = useRef<HTMLInputElement>(null);

  // Expose focus method to parent
  useImperativeHandle(ref, () => ({
    focus: () => inputRef.current?.focus(),
    blur: () => inputRef.current?.blur(),
  }));

  return (
    <div className="sidebar-search">
      <div className="search-input-wrapper">
        <svg className="search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="11" cy="11" r="8" />
          <path d="M21 21l-4.35-4.35" />
        </svg>
        <input
          ref={inputRef}
          id="sidebar-search"
          name="search"
          type="search"
          inputMode="search"
          placeholder="Search conversations... (⌘K)"
          aria-label="Search conversations"
          aria-describedby={searchQuery ? "search-results-count" : undefined}
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
              inputRef.current?.focus();
            }}
            aria-label="Clear search"
          >
            ×
          </button>
        )}
      </div>
      {searchQuery && (
        <div
          id="search-results-count"
          className="search-results-count"
          role="status"
          aria-live="polite"
        >
          {resultCount} result{resultCount !== 1 ? 's' : ''}
        </div>
      )}
    </div>
  );
});
