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
import { useSyncExternalStore, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
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

export function ThemeToggle() {
  const { t } = useTranslation();
  const { theme, resolvedTheme, setTheme } = useTheme();
  const mounted = useIsMounted();

  // Build translated theme info
  const themeInfo = useMemo(
    () =>
      ({
        light: { label: t('theme.light'), description: t('theme.lightDesc') },
        dark: { label: t('theme.dark'), description: t('theme.darkDesc') },
        system: { label: t('theme.system'), description: t('theme.systemDesc') },
      }) as Record<ThemeValue, { label: string; description: string }>,
    [t]
  );

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
        <button className="theme-toggle-btn" disabled aria-label={t('common.loading')}>
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
      ? t('theme.systemResolved', {
          resolved: resolvedTheme === 'dark' ? t('theme.dark') : t('theme.light'),
        })
      : currentInfo.label;

  // Render directly - no portal. CSS handles fixed positioning.
  return (
    <div className="theme-toggle-container">
      <button
        className="theme-toggle-btn"
        onClick={handleClick}
        onPointerDown={handlePointerDown}
        onMouseDown={handleMouseDown}
        aria-label={t('theme.currentLabel', { current: currentLabel, next: nextInfo.label })}
        title={t('theme.switchTo', { current: currentLabel, next: nextInfo.label })}
      >
        <Icon size={16} />
      </button>
    </div>
  );
}
