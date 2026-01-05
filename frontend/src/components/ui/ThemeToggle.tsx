/**
 * ThemeToggle - Single-click theme cycler
 *
 * Click to cycle: Light → Dark → System → Light...
 * Hover shows what the current theme is and what clicking will do.
 *
 * Uses fixed positioning to stay in top-right corner.
 * NO PORTAL - renders in place to avoid Radix "outside click" issues.
 */

import { useTheme } from 'next-themes';
import { useSyncExternalStore, useCallback } from 'react';
import { Sun, Moon, Monitor } from 'lucide-react';
import './ThemeToggle.css';

// SSR-safe mount detection
const emptySubscribe = () => () => {};
const getSnapshot = () => true;
const getServerSnapshot = () => false;

function useIsMounted() {
  return useSyncExternalStore(emptySubscribe, getSnapshot, getServerSnapshot);
}

// Theme cycle order
const themeCycle = ['light', 'dark', 'system'] as const;
type ThemeValue = (typeof themeCycle)[number];

// Theme info for tooltips
const themeInfo: Record<ThemeValue, { label: string; description: string }> = {
  light: { label: 'Light', description: 'Bright background with dark text' },
  dark: { label: 'Dark', description: 'Dark background with light text' },
  system: { label: 'System', description: 'Matches your device settings' },
};

export function ThemeToggle() {
  const { theme, resolvedTheme, setTheme } = useTheme();
  const mounted = useIsMounted();

  // Cycle to next theme on click
  // Set timestamp FIRST so onClose handlers can detect and skip closing
  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      e.preventDefault();
      e.nativeEvent.stopImmediatePropagation();

      // Set timestamp BEFORE anything else - this is checked by modal onClose handlers
      (window as Window & { __themeToggleClickTime?: number }).__themeToggleClickTime = Date.now();

      const currentTheme = (theme ?? 'system') as ThemeValue;
      const currentIndex = themeCycle.indexOf(currentTheme);
      const nextIndex = (currentIndex + 1) % themeCycle.length;

      // Defer theme change to next tick - this ensures all click event
      // handling (including Radix's outside-click detection) completes first
      setTimeout(() => {
        setTheme(themeCycle[nextIndex] as string);
      }, 0);
    },
    [theme, setTheme]
  );

  // Stop all pointer events from propagating and set timestamp on pointer down
  // This is critical because Radix's onPointerDownOutside fires BEFORE onClick
  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    e.stopPropagation();
    // Set timestamp on pointer down - this fires before Radix's outside-click detection
    (window as Window & { __themeToggleClickTime?: number }).__themeToggleClickTime = Date.now();
  }, []);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    // Also set on mouse down as backup
    (window as Window & { __themeToggleClickTime?: number }).__themeToggleClickTime = Date.now();
  }, []);

  if (!mounted) {
    return (
      <div className="theme-toggle-container">
        <button className="theme-toggle-btn" disabled aria-label="Loading theme">
          <Monitor size={16} />
        </button>
      </div>
    );
  }

  // Current theme info
  const currentTheme = (theme ?? 'system') as ThemeValue;
  const currentInfo = themeInfo[currentTheme];

  // Next theme info (what clicking will do)
  const currentIndex = themeCycle.indexOf(currentTheme);
  const nextTheme = themeCycle[(currentIndex + 1) % themeCycle.length] as ThemeValue;
  const nextInfo = themeInfo[nextTheme];

  // Icon based on current theme
  const Icon = currentTheme === 'system' ? Monitor : currentTheme === 'dark' ? Moon : Sun;

  // For system theme, show what it resolved to
  const currentLabel =
    currentTheme === 'system'
      ? `System (${resolvedTheme === 'dark' ? 'Dark' : 'Light'})`
      : currentInfo.label;

  // Render directly - no portal. CSS handles fixed positioning.
  return (
    <div className="theme-toggle-container">
      <button
        className="theme-toggle-btn"
        onClick={handleClick}
        onPointerDown={handlePointerDown}
        onMouseDown={handleMouseDown}
        aria-label={`Current: ${currentLabel}. Click to switch to ${nextInfo.label}.`}
        title={`${currentLabel} — Click for ${nextInfo.label}`}
      >
        <Icon size={16} />
      </button>
    </div>
  );
}
