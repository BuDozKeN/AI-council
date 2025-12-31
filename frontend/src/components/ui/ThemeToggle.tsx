/**
 * ThemeToggle - Single-click theme cycler
 *
 * Click to cycle: Light → Dark → System → Light...
 * Hover shows what the current theme is and what clicking will do.
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
  const handleClick = useCallback(() => {
    const currentTheme = (theme ?? 'system') as ThemeValue;
    const currentIndex = themeCycle.indexOf(currentTheme);
    const nextIndex = (currentIndex + 1) % themeCycle.length;
    setTheme(themeCycle[nextIndex] as string);
  }, [theme, setTheme]);

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
  const currentTheme = ((theme ?? 'system') as ThemeValue);
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

  return (
    <div className="theme-toggle-container">
      <button
        className="theme-toggle-btn"
        onClick={handleClick}
        aria-label={`Current: ${currentLabel}. Click to switch to ${nextInfo.label}.`}
        title={`${currentLabel} — Click for ${nextInfo.label}`}
      >
        <Icon size={16} />
      </button>
    </div>
  );
}
