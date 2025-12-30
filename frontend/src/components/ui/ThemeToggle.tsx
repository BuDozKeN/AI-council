/**
 * ThemeToggle - Subtle top-right theme switcher with dropdown
 *
 * Shows current theme icon, click to reveal dropdown with 3 options:
 * Light, Dark, System
 */

import { useTheme } from 'next-themes';
import { useSyncExternalStore, useState, useRef, useEffect } from 'react';
import { Sun, Moon, Monitor, Check } from 'lucide-react';
import './ThemeToggle.css';

// SSR-safe mount detection
const emptySubscribe = () => () => {};
const getSnapshot = () => true;
const getServerSnapshot = () => false;

function useIsMounted() {
  return useSyncExternalStore(emptySubscribe, getSnapshot, getServerSnapshot);
}

const themes = [
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'dark', label: 'Dark', icon: Moon },
  { value: 'system', label: 'System', icon: Monitor },
] as const;

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const mounted = useIsMounted();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close on click outside
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  // Close on escape
  useEffect(() => {
    if (!isOpen) return;

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false);
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen]);

  if (!mounted) {
    return (
      <div className="theme-toggle-container">
        <button className="theme-toggle-btn" disabled aria-label="Loading theme">
          <Monitor size={16} />
        </button>
      </div>
    );
  }

  const currentTheme = theme || 'system';
  const CurrentIcon = themes.find(t => t.value === currentTheme)?.icon || Monitor;

  return (
    <div className="theme-toggle-container" ref={dropdownRef}>
      <button
        className="theme-toggle-btn"
        onClick={() => setIsOpen(!isOpen)}
        aria-label="Change theme"
        aria-expanded={isOpen}
        aria-haspopup="listbox"
      >
        <CurrentIcon size={16} />
      </button>

      {isOpen && (
        <div className="theme-toggle-dropdown" role="listbox" aria-label="Select theme">
          {themes.map(({ value, label, icon: Icon }) => (
            <button
              key={value}
              className={`theme-toggle-option ${currentTheme === value ? 'active' : ''}`}
              onClick={() => {
                setTheme(value);
                setIsOpen(false);
              }}
              role="option"
              aria-selected={currentTheme === value}
            >
              <Icon size={14} />
              <span>{label}</span>
              {currentTheme === value && <Check size={14} className="theme-toggle-check" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
